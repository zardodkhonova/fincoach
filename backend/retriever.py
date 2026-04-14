import numpy as np
import ingest


def retrieve(query: str, user_id: int, k: int = 6):
    state = ingest.USER_INDEXES.get(int(user_id))
    if not state:
        raise ValueError("No index found for this user.")

    index = state.get("index")
    chunks = state.get("chunks")

    if index is None or not chunks:
        raise ValueError("Index not built yet for this user.")

    q_vec = ingest.model.encode([query])
    _, ids = index.search(np.array(q_vec, dtype="float32"), k)

    results = []
    for i in ids[0]:
        if i >= 0 and i < len(chunks):
            results.append(chunks[i]["text"])

    return results