"""
retriever.py — Load the FAISS index and chunk metadata produced by ingest.py,
encode a user query with the same embedding model, and return the top-k most similar chunks.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# Must match ingest.py so query vectors live in the same space as stored chunks.
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_DATA_DIR = Path("finance_data")


class FinanceRetriever:
    """
    Holds the FAISS index, embedding model, and chunk records (text + month/category meta).
    """

    def __init__(self, data_dir: str | Path | None = None) -> None:
        self.data_dir = Path(data_dir) if data_dir else DEFAULT_DATA_DIR
        self.index_path = self.data_dir / "transactions.faiss"
        self.meta_path = self.data_dir / "metadata.json"

        if not self.index_path.is_file() or not self.meta_path.is_file():
            raise FileNotFoundError(
                f"Missing index or metadata under {self.data_dir.resolve()}. "
                "Run ingest.py on your CSV first."
            )

        # --- Load FAISS index from disk ---
        self.index = faiss.read_index(str(self.index_path))

        # --- Load chunk texts and metadata saved during ingest ---
        raw = json.loads(self.meta_path.read_text(encoding="utf-8"))
        self.chunks: list[dict[str, Any]] = raw["chunks"]

        # --- Lazy-load the transformer (shared across queries) ---
        self._model: SentenceTransformer | None = None

    @property
    def model(self) -> SentenceTransformer:
        """Load sentence-transformers once on first use."""
        if self._model is None:
            self._model = SentenceTransformer(EMBED_MODEL_NAME)
        return self._model

    def embed_query(self, query: str) -> np.ndarray:
        """Encode a single question string; normalize to match ingest-time cosine/IP setup."""
        vec = self.model.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        v = np.asarray(vec, dtype=np.float32)
        faiss.normalize_L2(v)
        return v

    def search(self, query: str, k: int = 6) -> list[dict[str, Any]]:
        """
        Return the top-k chunks as dicts: text, year_month, category, score, rank.
        `score` is inner product (higher is more similar for normalized vectors).
        """
        k = min(k, len(self.chunks))
        if k <= 0:
            return []

        q = self.embed_query(query)
        # distances/scores shape (1, k)
        scores, indices = self.index.search(q, k)

        results: list[dict[str, Any]] = []
        for rank, (idx, sc) in enumerate(zip(indices[0], scores[0])):
            if idx < 0:  # FAISS can return -1 for missing neighbors
                continue
            chunk = self.chunks[int(idx)]
            results.append(
                {
                    "text": chunk["text"],
                    "year_month": chunk.get("year_month"),
                    "category": chunk.get("category"),
                    "transaction_count": chunk.get("transaction_count"),
                    "score": float(sc),
                    "rank": rank + 1,
                }
            )
        return results


def load_retriever(data_dir: str | Path | None = None) -> FinanceRetriever:
    """Convenience factory for app.py / coach.py."""
    return FinanceRetriever(data_dir)
