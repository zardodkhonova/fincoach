"""
ingest.py — Parse a bank CSV, group transactions into monthly/category chunks,
embed them with sentence-transformers (all-MiniLM-L6-v2), and persist a FAISS index.

Run directly:  python ingest.py path/to/transactions.csv
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

# Embedding model: 384-dimensional vectors (must match FAISS index dimension).
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
EMBED_DIM = 384

# Default folder for the saved index and metadata (same defaults as retriever.py).
DEFAULT_OUTPUT_DIR = Path("finance_data")


def _normalize_col(name: str) -> str:
    """Lowercase and strip spaces/underscores for fuzzy column matching."""
    return re.sub(r"[\s_]+", "", str(name).strip().lower())


def _guess_columns(df: pd.DataFrame) -> dict[str, str]:
    """
    Map logical roles (date, amount, description, category) to actual CSV column names.
    Tries common bank-export header variants.
    """
    cols = { _normalize_col(c): c for c in df.columns }

    def pick(*candidates: str) -> str | None:
        for cand in candidates:
            n = _normalize_col(cand)
            if n in cols:
                return cols[n]
        return None

    date_col = pick("date", "transactiondate", "posted", "postingdate", "valuedate")
    amount_col = pick("amount", "debit", "credit", "value", "sum")
    desc_col = pick(
        "description",
        "memo",
        "details",
        "payee",
        "merchant",
        "narration",
        "name",
        "transaction",
    )
    cat_col = pick("category", "type", "class")

    missing = [k for k, v in [("date", date_col), ("amount", amount_col)] if v is None]
    if missing:
        raise ValueError(
            "Could not detect required columns (date, amount). "
            f"Found columns: {list(df.columns)}. "
            "Rename headers or add a row with standard names."
        )
    if desc_col is None:
        desc_col = df.columns[0]  # Fallback: first column as description text
    if cat_col is None:
        df["_synthetic_category"] = "Uncategorized"
        cat_col = "_synthetic_category"

    return {
        "date": date_col,
        "amount": amount_col,
        "description": desc_col,
        "category": cat_col,
    }


def _parse_amount(val: Any) -> float:
    """Convert cell values like '1,234.56', '($10)', '-€5' into a float."""
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float, np.floating)):
        return float(val)
    s = str(val).strip()
    s = re.sub(r"[€$£,\s]", "", s)
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    s = s.replace(",", ".") if s.count(",") == 1 and s.count(".") == 0 else s.replace(",", "")
    try:
        n = float(s)
        return -abs(n) if neg else n
    except ValueError:
        return 0.0


def _parse_date(series: pd.Series) -> pd.Series:
    """Parse mixed date strings into pandas datetime (NaT on failure)."""
    return pd.to_datetime(series, errors="coerce")


def _build_chunk_text(
    year_month: str,
    category: str,
    rows: list[tuple[str, str, float]],
) -> str:
    """
    Turn one (month, category) bucket into a single human-readable string for embedding.
    rows: list of (iso_date, description, amount)
    """
    lines = [f"Month: {year_month}", f"Category: {category}", "Transactions:"]
    total = 0.0
    for d, desc, amt in sorted(rows):
        lines.append(f"  - {d}: {amt:+.2f} | {desc}")
        total += amt
    lines.append(f"Subtotal for {year_month} / {category}: {total:+.2f}")
    return "\n".join(lines)


def ingest_csv(
    csv_path: str | Path,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    """
    Main entry: read CSV → chunk by month+category → embed → save FAISS index + metadata.

    Returns a small stats dict (counts, paths) for logging or UI feedback.
    """
    csv_path = Path(csv_path)
    out = Path(output_dir) if output_dir else DEFAULT_OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)

    # --- Load and normalize dataframe ---
    df = pd.read_csv(csv_path)
    mapping = _guess_columns(df)

    df = df.rename(columns={v: k for k, v in mapping.items()})
    df["date"] = _parse_date(df["date"])
    df["amount"] = df["amount"].map(_parse_amount)
    df["description"] = df["description"].fillna("").astype(str)
    df["category"] = df["category"].fillna("Uncategorized").astype(str)
    df = df.dropna(subset=["date"])

    if df.empty:
        raise ValueError("No valid rows after parsing dates.")

    # --- Bucket rows by (year-month string, category) ---
    df["year_month"] = df["date"].dt.strftime("%Y-%m")
    buckets: dict[tuple[str, str], list[tuple[str, str, float]]] = defaultdict(list)
    for _, row in df.iterrows():
        ym = row["year_month"]
        cat = row["category"] or "Uncategorized"
        d_str = row["date"].strftime("%Y-%m-%d")
        buckets[(ym, cat)].append((d_str, row["description"], float(row["amount"])))

    # --- Build one text chunk per bucket ---
    chunk_texts: list[str] = []
    metas: list[dict[str, Any]] = []
    for (ym, cat), rows in sorted(buckets.items()):
        text = _build_chunk_text(ym, cat, rows)
        chunk_texts.append(text)
        metas.append(
            {
                "year_month": ym,
                "category": cat,
                "transaction_count": len(rows),
            }
        )

    # --- Encode with sentence-transformers; normalize for cosine similarity via inner product ---
    print(f"Loading embedding model {EMBED_MODEL_NAME!r} …")
    model = SentenceTransformer(EMBED_MODEL_NAME)
    print(f"Encoding {len(chunk_texts)} chunks …")
    embeddings = model.encode(
        chunk_texts,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    embeddings = np.asarray(embeddings, dtype=np.float32)
    faiss.normalize_L2(embeddings)

    # --- FAISS: inner product on L2-normalized vectors ≈ cosine similarity ---
    index = faiss.IndexFlatIP(EMBED_DIM)
    index.add(embeddings)

    index_path = out / "transactions.faiss"
    meta_path = out / "metadata.json"
    faiss.write_index(index, str(index_path))

    # Store chunk texts next to metadata so retrieval can return full context without re-deriving.
    payload = {
        "embedding_model": EMBED_MODEL_NAME,
        "chunks": [{"text": t, **m} for t, m in zip(chunk_texts, metas)],
    }
    meta_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    stats = {
        "chunks": len(chunk_texts),
        "index_path": str(index_path.resolve()),
        "metadata_path": str(meta_path.resolve()),
    }
    print("Done:", stats)
    return stats


def main() -> None:
    """CLI: python ingest.py <csv_path> [output_dir]"""
    if len(sys.argv) < 2:
        print("Usage: python ingest.py <bank_export.csv> [output_dir]")
        sys.exit(1)
    csv_arg = sys.argv[1]
    out_arg = sys.argv[2] if len(sys.argv) > 2 else None
    ingest_csv(csv_arg, out_arg)


if __name__ == "__main__":
    main()
