import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import ingest


def retrieve(query: str, user_id: int, k: int = 6) -> list:
    state = ingest.USER_INDEXES.get(int(user_id))
    if not state:
        return []

    vectorizer = state.get("vectorizer")
    matrix = state.get("matrix")
    chunks = state.get("chunks")

    if vectorizer is None or matrix is None or not chunks:
        return []

    try:
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, matrix).flatten()
        top_ids = np.argsort(scores)[::-1][:k]
        results = [chunks[i]["text"] for i in top_ids]
        return results
    except Exception:
        return [c["text"] for c in chunks[:k]]