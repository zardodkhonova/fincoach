from __future__ import annotations

import json
import os
import tempfile
from datetime import timedelta
from pathlib import Path

import bcrypt
import ingest
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from werkzeug.utils import secure_filename

import coach
from models import ChatMessage, User, UserFile, db

# -------------------------------------------------------------------
# Environment Setup
# -------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

app = Flask(__name__)

# Allow requests from Vercel frontend
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=True,
)

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{BACKEND_DIR / 'finance_coach.db'}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get(
    "JWT_SECRET_KEY",
    "fincoach_super_secret_key_2026_abc123xyz"
)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)

db.init_app(app)
jwt = JWTManager(app)

# -------------------------------------------------------------------
# Health & Root Routes
# -------------------------------------------------------------------
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "success",
        "message": "FinCoach backend is running",
        "service": "fincoach-api"
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "message": "API is operational"
    })


# -------------------------------------------------------------------
# JWT Error Handlers
# -------------------------------------------------------------------
@jwt.unauthorized_loader
def jwt_unauthorized(reason):
    return jsonify({"error": reason or "Unauthorized"}), 401


@jwt.invalid_token_loader
def jwt_invalid(reason):
    return jsonify({"error": reason or "Invalid token"}), 401


@jwt.expired_token_loader
def jwt_expired(jwt_header, jwt_payload):
    return jsonify({"error": "Token has expired"}), 401


# -------------------------------------------------------------------
# Utility Functions
# -------------------------------------------------------------------
def _json_error(message: str, status: int):
    return jsonify({"error": message}), status


def _user_data_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "plan": user.plan,
    }


def _require_user_ingest_state(user_id: int) -> dict | None:
    state = ingest.USER_INDEXES.get(int(user_id))
    if not state:
        return None
    df = state.get("df")
    matrix = state.get("matrix")
    chunks = state.get("chunks") or []
    if df is None or df.empty or matrix is None or not chunks:
        return None
    return state


def _ensure_month_col(df):
    if "month" not in df.columns:
        df["month"] = df["date"].dt.to_period("M").astype(str)
    return df


def _compute_summary(user_id: int) -> dict | None:
    state = _require_user_ingest_state(user_id)
    if state is None:
        return None

    df = _ensure_month_col(state["df"].copy())
    abs_spend = df["amount"].abs()
    total = float(abs_spend.sum())

    by_category = (
        df.assign(_abs=abs_spend)
        .groupby("category", as_index=False)["_abs"]
        .sum()
        .set_index("category")["_abs"]
        .to_dict()
    )
    by_category = {k: float(v) for k, v in by_category.items()}

    by_month = (
        df.assign(_abs=abs_spend)
        .groupby("month", as_index=False)["_abs"]
        .sum()
        .set_index("month")["_abs"]
        .to_dict()
    )
    by_month = {k: float(v) for k, v in by_month.items()}

    idx_max = abs_spend.idxmax()
    row = df.loc[idx_max]
    biggest = {
        "date": row["date"].strftime("%Y-%m-%d"),
        "description": str(row["description"]),
        "amount": float(row["amount"]),
    }

    discretionary = sum(
        by_category.get(c, 0.0) for c in ("Shopping", "Entertainment", "Food")
    )
    savings_potential = round(min(discretionary * 0.12, total * 0.18), 2)

    categories = sorted(df["category"].unique().tolist())
    months = sorted(df["month"].unique().tolist())
    filename = state.get("filename", "")

    return {
        "filename": filename,
        "total": round(total, 2),
        "transaction_count": int(len(df)),
        "by_category": by_category,
        "by_month": by_month,
        "biggest_transaction": biggest,
        "savings_potential": float(savings_potential),
        "categories": categories,
        "months": months,
    }


# -------------------------------------------------------------------
# Authentication Routes
# -------------------------------------------------------------------
@app.post("/api/auth/register")
def api_register():
    if not request.is_json:
        return _json_error("Expected application/json body.", 400)

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    name = (body.get("name") or "").strip()

    if not email or "@" not in email:
        return _json_error("Valid email is required.", 400)
    if not password or len(password) < 6:
        return _json_error("Password must be at least 6 characters.", 400)
    if not name:
        return _json_error("Name is required.", 400)

    if User.query.filter_by(email=email).first():
        return _json_error("An account with this email already exists.", 409)

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    user = User(
        email=email,
        password_hash=password_hash,
        name=name,
        plan="free",
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": _user_data_dict(user)})


@app.post("/api/auth/login")
def api_login():
    if not request.is_json:
        return _json_error("Expected application/json body.", 400)

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return _json_error("Email and password are required.", 400)

    user = User.query.filter_by(email=email).first()
    if not user:
        return _json_error("Invalid email or password.", 401)

    if not bcrypt.checkpw(
        password.encode("utf-8"),
        user.password_hash.encode("utf-8"),
    ):
        return _json_error("Invalid email or password.", 401)

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": _user_data_dict(user)})


@app.get("/api/auth/me")
@jwt_required()
def api_me():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return _json_error("User not found.", 404)
    return jsonify({"user": _user_data_dict(user)})


# -------------------------------------------------------------------
# File Upload
# -------------------------------------------------------------------
@app.post("/api/upload")
@jwt_required()
def api_upload():
    user_id = int(get_jwt_identity())

    if "file" not in request.files:
        return _json_error("Missing file field in multipart form.", 400)

    file = request.files["file"]
    if not file or file.filename == "":
        return _json_error("No file selected.", 400)

    if not file.filename.lower().endswith(".csv"):
        return _json_error("Only .csv files are supported.", 400)

    safe_name = secure_filename(file.filename)
    tmp_dir = tempfile.mkdtemp()
    tmp_path = Path(tmp_dir) / safe_name

    try:
        file.save(tmp_path)
        ingest.parse_csv(tmp_path, user_id=user_id)
        ingest.build_index(user_id=user_id)
    except ValueError as e:
        return _json_error(str(e), 400)
    except Exception as e:
        return _json_error(f"Failed to process CSV: {e}", 500)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
            os.rmdir(tmp_dir)
        except OSError:
            pass

    state = ingest.USER_INDEXES.get(user_id)
    if not state or state.get("df") is None:
        return _json_error("Failed to load parsed dataframe.", 500)

    df = _ensure_month_col(state["df"].copy())
    ingest.USER_INDEXES[user_id]["filename"] = safe_name

    row_count = int(len(df))
    uf = UserFile(
        user_id=user_id,
        filename=safe_name,
        row_count=row_count,
    )
    db.session.add(uf)
    db.session.commit()

    categories = sorted(df["category"].unique().tolist())
    months = sorted(df["month"].unique().tolist())

    return jsonify({
        "status": "ok",
        "rows": row_count,
        "categories": categories,
        "months": months,
    })


# -------------------------------------------------------------------
# Financial Insights Routes
# -------------------------------------------------------------------
@app.get("/api/summary")
@jwt_required()
def api_summary():
    user_id = int(get_jwt_identity())
    if _require_user_ingest_state(user_id) is None:
        return _json_error(
            "No file uploaded yet. Please upload a CSV first.", 400
        )

    payload = _compute_summary(user_id)
    return jsonify(payload)


@app.get("/api/transactions")
@jwt_required()
def api_transactions():
    user_id = int(get_jwt_identity())
    state = _require_user_ingest_state(user_id)
    if state is None:
        return _json_error(
            "No file uploaded yet. Please upload a CSV first.", 400
        )

    df = _ensure_month_col(state["df"].copy())
    category = request.args.get("category", "All")
    month = request.args.get("month", "All")

    out = df.copy()
    if category != "All":
        out = out[out["category"] == category]
    if month != "All":
        out = out[out["month"] == month]

    out = out.assign(_abs=out["amount"].abs()).sort_values(
        "_abs", ascending=False
    )

    rows = [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "description": str(row["description"]),
            "amount": float(row["amount"]),
            "category": str(row["category"]),
        }
        for _, row in out.iterrows()
    ]

    return jsonify({"transactions": rows})


# -------------------------------------------------------------------
# Chat Routes
# -------------------------------------------------------------------
@app.get("/api/chat/history")
@jwt_required()
def api_chat_history():
    user_id = int(get_jwt_identity())
    q = (
        ChatMessage.query.filter_by(user_id=user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(50)
    )
    items = list(q)
    items.reverse()
    messages = [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in items
    ]
    return jsonify({"messages": messages})


@app.delete("/api/chat/history/clear")
@jwt_required()
def api_chat_history_clear():
    user_id = int(get_jwt_identity())
    ChatMessage.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"status": "cleared"})


@app.post("/api/chat")
@jwt_required()
def api_chat():
    user_id = int(get_jwt_identity())

    if _require_user_ingest_state(user_id) is None:
        return _json_error(
            "No file uploaded yet. Please upload a CSV first.", 400
        )

    if not request.is_json:
        return _json_error("Expected application/json body.", 400)

    body = request.get_json(silent=True) or {}
    message = body.get("message")
    if not message:
        return _json_error("Missing non-empty 'message' field.", 400)

    text = str(message).strip()

    user_row = ChatMessage(user_id=user_id, role="user", content=text)
    db.session.add(user_row)
    db.session.commit()

    def event_stream():
        parts: list[str] = []
        try:
            for token in coach.ask(text, user_id):
                parts.append(token)
                payload = json.dumps({"token": token}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

            assistant_row = ChatMessage(
                user_id=user_id,
                role="assistant",
                content="".join(parts),
            )
            db.session.add(assistant_row)
            db.session.commit()

        except Exception as e:
            err = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# -------------------------------------------------------------------
# Database Initialization
# -------------------------------------------------------------------
with app.app_context():
    db.create_all()


# -------------------------------------------------------------------
# Run Locally
# -------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)