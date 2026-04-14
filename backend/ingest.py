import os
import pickle
import json
import numpy as np
import pandas as pd
from groq import Groq
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import faiss

load_dotenv()

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
model = SentenceTransformer("all-MiniLM-L6-v2")

USER_INDEXES = {}
CURRENT_DF = None
FAISS_INDEX = None
CHUNK_TEXTS = []


def detect_columns_with_ai(columns: list) -> dict:
    prompt = f"""You are a bank CSV parser. Given these column names from a bank export:
{columns}

Map them to these standard fields:
- date: the transaction date column
- amount: the transaction amount column
- description: the merchant or description column
- category: the spending category column (may not exist)

Respond ONLY with a valid JSON object like this:
{{"date": "actual_col_name", "amount": "actual_col_name", "description": "actual_col_name_or_null", "category": "actual_col_name_or_null"}}

If a field cannot be mapped, use null.
Do not explain. Just return the JSON."""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=100,
    )

    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


def parse_csv(path, user_id=None):
    global CURRENT_DF

    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]
    columns = list(df.columns)

    DATE_COLS = [
        "Date", "Transaction Date", "Started Date",
        "Completed Date", "date", "DATE", "Order Date"
    ]
    AMOUNT_COLS = [
        "Amount", "Debit Amount", "Transaction Amount",
        "amount", "AMOUNT", "Net Amount", "Value",
        "Spent", "Cost", "Price", "Withdrawal", "Payment", "Charge"
    ]
    DESC_COLS = [
        "Description", "Merchant Name", "Narrative",
        "Transaction Description", "description", "DESCRIPTION",
        "Name", "Details", "Memo", "Note"
    ]
    CAT_COLS = [
        "Category", "category", "Transaction Type", "Tag", "Label"
    ]

    def pick(candidates):
        for c in candidates:
            if c in columns:
                return c
        return None

    date_col   = pick(DATE_COLS)
    amount_col = pick(AMOUNT_COLS)
    desc_col   = pick(DESC_COLS)
    cat_col    = pick(CAT_COLS)

    if not date_col or not amount_col:
        print(f"Local column matching failed. Asking AI to map: {columns}")
        try:
            mapping = detect_columns_with_ai(columns)
            date_col   = mapping.get("date")
            amount_col = mapping.get("amount")
            desc_col   = mapping.get("description")
            cat_col    = mapping.get("category")
        except Exception as e:
            raise ValueError(
                f"Could not detect columns automatically. "
                f"Please rename your CSV columns to: Date, Amount, Description. "
                f"Found: {columns}. Error: {str(e)}"
            )

    if not date_col or not amount_col:
        raise ValueError(
            f"Could not find date or amount columns. Found: {columns}"
        )

    rename = {date_col: "date", amount_col: "amount"}
    if desc_col:
        rename[desc_col] = "description"
    if cat_col:
        rename[cat_col] = "category"
    df = df.rename(columns=rename)

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    df["amount"] = (
        df["amount"]
        .astype(str)
        .str.replace(r"[€$£,\s]", "", regex=True)
    )
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)

    if "State" in df.columns:
        df = df[df["State"].str.upper() == "COMPLETED"]

    if "description" not in df.columns:
        df["description"] = "Unknown"
    if "category" not in df.columns:
        df["category"] = "Uncategorized"
    else:
        df["category"] = df["category"].fillna("Uncategorized")

    # --- Smart expense detection ---
    # Case 1: file has a Type column (e.g. "Expense" / "Income")
    if "Type" in df.columns:
        expense_mask = df["Type"].str.lower().str.contains(
            "expense|debit|withdraw|payment|charge", na=False
        )
        if expense_mask.any():
            df = df[expense_mask].copy()
        df["amount"] = df["amount"].abs()

    # Case 2: file uses negative numbers for expenses
    elif df["amount"].lt(0).any():
        df = df[df["amount"] < 0].copy()
        df["amount"] = df["amount"].abs()

    # Case 3: all amounts are positive — treat everything as expenses
    else:
        df = df[df["amount"] > 0].copy()
        df["amount"] = df["amount"].abs()

    if df.empty:
        raise ValueError(
            "No transactions found after processing. "
            "The file may be empty or in an unsupported format."
        )

    if user_id is not None:
        if user_id not in USER_INDEXES:
            USER_INDEXES[user_id] = {}
        USER_INDEXES[user_id]["df"] = df
    else:
        CURRENT_DF = df

    return df


def build_chunks(df: pd.DataFrame) -> list:
    chunks = []

    df = df.copy()
    df["month"] = df["date"].dt.to_period("M").astype(str)

    summary = (
        df.groupby(["month", "category"])["amount"]
        .sum()
        .reset_index()
    )
    for _, row in summary.iterrows():
        text = (
            f"In {row['month']}, you spent "
            f"${row['amount']:.2f} on {row['category']}."
        )
        chunks.append({
            "text": text,
            "meta": {
                "month": str(row["month"]),
                "category": row["category"],
                "amount": row["amount"]
            }
        })

    threshold = df["amount"].quantile(0.80)
    big = df[df["amount"] >= threshold]
    for _, row in big.iterrows():
        text = (
            f"Large transaction on {row['date'].date()}: "
            f"${row['amount']:.2f} at {row['description']}."
        )
        chunks.append({
            "text": text,
            "meta": {
                "date": str(row["date"].date()),
                "amount": row["amount"],
                "description": row["description"]
            }
        })

    return chunks


def build_index(user_id=None):
    global FAISS_INDEX, CHUNK_TEXTS

    if user_id is not None:
        if user_id not in USER_INDEXES or "df" not in USER_INDEXES[user_id]:
            raise ValueError("No CSV data found for this user.")
        df = USER_INDEXES[user_id]["df"]
    else:
        if CURRENT_DF is None:
            raise ValueError("No CSV data loaded.")
        df = CURRENT_DF

    chunks = build_chunks(df)
    texts = [c["text"] for c in chunks]

    vecs = model.encode(texts, show_progress_bar=False)
    index = faiss.IndexFlatL2(vecs.shape[1])
    index.add(np.array(vecs, dtype="float32"))

    if user_id is not None:
        USER_INDEXES[user_id]["index"]  = index
        USER_INDEXES[user_id]["chunks"] = chunks
        with open(f"index_{user_id}.pkl", "wb") as f:
            pickle.dump({"index": index, "chunks": chunks}, f)
    else:
        FAISS_INDEX  = index
        CHUNK_TEXTS  = texts
        with open("index.pkl", "wb") as f:
            pickle.dump({"index": index, "chunks": chunks}, f)

    return index, chunks