import os
import pickle
import threading
import numpy as np
from sentence_transformers import SentenceTransformer

# Free local embedding - no API key needed
MODEL_NAME = "all-MiniLM-L6-v2"
_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model

import pathlib
BASE_DIR = pathlib.Path(__file__).parent
STORE_PATH = str(BASE_DIR / "vector_store.pkl")

# In-memory store
store = {"chunks": [], "embeddings": None, "metadatas": []}
_store_lock = threading.Lock()

def _save():
    with open(STORE_PATH, "wb") as f:
        pickle.dump(store, f)

def _load():
    global store
    if os.path.exists(STORE_PATH):
        try:
            with open(STORE_PATH, "rb") as f:
                store = pickle.load(f)
        except:
            store = {"chunks": [], "embeddings": None, "metadatas": []}

_load()

def _remove_source(source: str):
    """Remove existing chunks for source (dedup on re-upload)."""
    global store
    if not store["chunks"]:
        return 0
    keep_idx = [i for i, m in enumerate(store["metadatas"]) if m.get("source") != source]
    removed = len(store["chunks"]) - len(keep_idx)
    if removed == 0:
        return 0
    if not keep_idx:
        store["chunks"] = []
        store["metadatas"] = []
        store["embeddings"] = None
    else:
        store["chunks"] = [store["chunks"][i] for i in keep_idx]
        store["metadatas"] = [store["metadatas"][i] for i in keep_idx]
        # reindex chunk_id
        for idx, m in enumerate(store["metadatas"]):
            m["chunk_id"] = idx
        if store["embeddings"] is not None:
            store["embeddings"] = store["embeddings"][keep_idx]
    return removed

def add_chunks(chunks: list[str], source: str = "upload", pages: list[int | None] | None = None, ocr_used: bool | list[bool] | None = None):
    global store
    # Support list of (chunk, page) tuples for backward convenience
    if chunks and isinstance(chunks[0], (list, tuple)) and len(chunks[0]) == 2 and isinstance(chunks[0][0], str):
        # unpack [(chunk, page), ...]
        pages = [p for _, p in chunks]
        chunks = [c for c, _ in chunks]
    if pages is None:
        pages = [None] * len(chunks)
    if len(pages) != len(chunks):
        raise ValueError(f"pages length {len(pages)} != chunks length {len(chunks)}")
    # Normalize ocr_used to per-chunk list
    if ocr_used is None:
        ocr_list = [False] * len(chunks)
    elif isinstance(ocr_used, bool):
        ocr_list = [ocr_used] * len(chunks)
    elif isinstance(ocr_used, (list, tuple)):
        if len(ocr_used) != len(chunks):
            raise ValueError(f"ocr_used length {len(ocr_used)} != chunks length {len(chunks)}")
        ocr_list = list(ocr_used)
    else:
        ocr_list = [bool(ocr_used)] * len(chunks)
    model = get_model()
    new_emb = model.encode(chunks, convert_to_numpy=True, normalize_embeddings=True)

    with _store_lock:
        # dedup: remove previous version of same source
        _remove_source(source)

        if store["embeddings"] is None or len(store["chunks"]) == 0:
            store["embeddings"] = new_emb
        else:
            store["embeddings"] = np.vstack([store["embeddings"], new_emb])

        start_idx = len(store["chunks"])
        store["chunks"].extend(chunks)
        for i, c in enumerate(chunks):
            store["metadatas"].append({"source": source, "chunk_id": start_idx + i, "page": pages[i], "ocr_used": ocr_list[i]})

        _save()
        return len(chunks)

def query_relevant(query: str, n_results: int = 4) -> dict:
    if not store["chunks"]:
        return {"documents": [], "metadatas": [], "distances": [], "similarities": []}
    # clamp n_results
    try:
        n_results = int(n_results)
    except:
        n_results = 4
    n_results = max(1, min(10, n_results))

    model = get_model()
    q_emb = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)[0]

    with _store_lock:
        # cosine similarity (embeddings are normalized)
        sims = np.dot(store["embeddings"], q_emb)
        # get top k
        top_k = min(n_results, len(sims))
        idx = np.argsort(sims)[::-1][:top_k]

        docs = [store["chunks"][i] for i in idx]
        metas = [store["metadatas"][i] for i in idx]
        dists = [float(1 - sims[i]) for i in idx]  # convert to distance
        sim_list = [float(sims[i]) for i in idx]

        return {"documents": docs, "metadatas": metas, "distances": dists, "similarities": sim_list}

def clear_store():
    global store
    with _store_lock:
        store = {"chunks": [], "embeddings": None, "metadatas": []}
        if os.path.exists(STORE_PATH):
            try:
                os.remove(STORE_PATH)
            except:
                pass

def remove_source(source: str) -> int:
    """Remove chunks for a specific source, thread-safe."""
    global store
    with _store_lock:
        n = _remove_source(source)
        if n:
            _save()
        return n
