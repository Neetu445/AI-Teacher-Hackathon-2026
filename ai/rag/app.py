import os
import shutil
import tempfile
import pathlib
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
BASE_DIR = pathlib.Path(__file__).parent

from chunker import extract_text_from_pdf, extract_pdf_pages, was_last_ocr_used, extract_text_from_pptx, extract_text_from_txt, chunk_text
from vector_store import add_chunks, query_relevant, clear_store

# Adaptive thresholds: clean text vs OCR-noisy text
THRESHOLD_CLEAN = 0.35
THRESHOLD_OCR = 0.20

def _get_adaptive_threshold(metadatas: list[dict] | None) -> float:
    """Use lower threshold if any retrieved chunk came from OCR (noisy text)."""
    if metadatas and any(m.get("ocr_used") for m in metadatas):
        return THRESHOLD_OCR
    return THRESHOLD_CLEAN

load_dotenv()

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "20")) * 1024 * 1024
MAX_TOP_K = 10

app = FastAPI(title="RAG Service - Hackathon", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LLM Helper (100% Free - No Ollama, No Gemini Needed) ---
def _is_generic_query(q: str) -> bool:
    ql = q.lower().strip()
    generics = ["what is document", "summarize", "summary", "main topic", "key points", "overview", "what is this document", "describe document", "what does document contain"]
    return any(g in ql for g in generics)

def _format_citation(metas: list[dict] | None, similarities: list[float] | None, idx: int = 0) -> str:
    """Helper to format page-aware citation: [Source: file.pdf - Page 5 | relevance 0.82]"""
    if not metas or idx >= len(metas):
        return ""
    m = metas[idx]
    src = m.get("source", "book")
    page = m.get("page")
    sim = similarities[idx] if similarities and idx < len(similarities) else None
    page_str = f"Page {page}" if isinstance(page, int) and page is not None else ("Page 1" if page == 1 else "Page N/A" if page is None else f"Page {page}")
    # For .txt/.md where page is 1 or None, still show page but gracefully
    if sim is not None:
        return f"[Source: {src} - {page_str} | relevance {sim:.2f}]"
    return f"[Source: {src} - {page_str}]"

def generate_grounded_answer(query: str, contexts: list[str], similarities: list[float] = None, metadatas: list[dict] = None) -> str:
    """
    Strict RAG - Pure extractive fallback.
    No API, no Ollama, no Gemini - just grounded chunks from book.
    Filters low-relevance if similarities provided.
    Now page-aware: cites source page numbers.
    """
    if not contexts:
        return "Ye is material me nahi hai."

    # Optional Gemini grounded answer if key present
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key != "your_gemini_key_here":
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            ctx_parts = []
            for i, c in enumerate(contexts[:4]):
                meta = metadatas[i] if metadatas and i < len(metadatas) else {}
                pg = meta.get("page") if meta else None
                src = meta.get("source", "book") if meta else "book"
                label = f"[Page {pg} from {src}]" if isinstance(pg, int) else f"[{src}]"
                ctx_parts.append(f"{label}\n{c}")
            ctx = "\n\n---\n\n".join(ctx_parts)
            prompt = f"""You are a strict RAG assistant. Answer ONLY from the given context.
If answer not in context, reply exactly: "Ye is material me nahi hai."
For every fact, cite page like [Source: <file> - Page <n>].
Context:\n{ctx}\n\nQuestion: {query}\nAnswer in same language as question, grounded and concise."""
            resp = model.generate_content(prompt)
            if resp.text:
                return resp.text.strip()
        except Exception as e:
            print(f"Gemini fallback failed, using extractive: {e}")

    # Generic summary queries -> combine top 2-3 passages as overview, not just top 1
    if _is_generic_query(query):
        combined_parts = []
        for i, c in enumerate(contexts[:3]):
            cite = _format_citation(metadatas, similarities, i) if metadatas else ""
            combined_parts.append(f"{cite}\n{c[:800]}" if cite else c[:800])
        combined = "\n\n---\n\n".join(combined_parts)
        return f"[Document Overview - from uploaded book]\n\n{combined[:1800]}\n\n---\n(Top {min(3,len(contexts))} relevant sections combined for: {query})"

    # For specific queries: filter by relevance threshold (adaptive: 0.35 clean, 0.20 OCR-noisy)
    threshold = _get_adaptive_threshold(metadatas)
    if similarities:
        # build filtered with original indices to preserve page cites
        filtered_idx = [(i, c, s) for i, (c, s) in enumerate(zip(contexts, similarities)) if s >= threshold]
        if not filtered_idx:
            return "Ye is material me nahi hai. (No relevant passage found - similarity too low [threshold {:.2f}, OCR={}], try rephrasing. Best match was {:.2f})".format(threshold, any(m.get("ocr_used") for m in metadatas) if metadatas else False, max(similarities) if similarities else 0)
        # Full question vs keyword: full question gets synthesized multi-passage answer
        is_full_q = len(query.split()) >= 3 or "?" in query or query.lower().startswith(("what","how","why","explain","describe","when","where","list"))
        if is_full_q and len(filtered_idx) > 1:
            # combine top 2-3 filtered passages for complete answer with per-passage citations
            top3 = filtered_idx[:3]
            parts = []
            for orig_i, c, s in top3:
                cite = _format_citation(metadatas, similarities, orig_i) if metadatas else f"[relevance {s:.2f}]"
                parts.append(f"{cite}\n{c[:900]}")
            combined = "\n\n---\n\n".join(parts)
            sim_str = ", ".join([f"{s:.2f}" for _, _, s in top3])
            pages_str = ", ".join([f"Page {metadatas[i].get('page')}" if metadatas and metadatas[i].get('page') is not None else "Page N/A" for i,_,_ in top3])
            return f"[Grounded Answer - Full Question | relevance {sim_str} | {pages_str}]\n\n{combined[:2000]}\n\n---\n(Question: {query} - {len(filtered_idx)}/{len(contexts)} passages combined for complete answer.)"
        # keyword / short query -> best passage
        orig_i, best, best_sim = filtered_idx[0]
        cite = _format_citation(metadatas, similarities, orig_i) if metadatas else f"[relevance {best_sim:.2f}]"
        return f"{cite}\n\n{best[:1300]}\n\n---\n(Question: {query} - {len(filtered_idx)}/{len(contexts)} relevant passages used. Low-relevance passages filtered.)"

    # Fallback extractive
    cite = _format_citation(metadatas, similarities, 0) if metadatas else ""
    prefix = f"{cite}\n\n" if cite else "[Grounded Answer - from uploaded book]\n\n"
    return f"{prefix}{contexts[0][:1200]}\n\n---\n(Question: {query} - Top {len(contexts)} relevant passages used from document.)"

@app.get("/health")
def health():
    from vector_store import store
    return {"status": "RAG service running", "endpoints": ["/upload", "/query", "/clear"], "indexed_chunks": len(store["chunks"])}

@app.get("/web")
def web_alt():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.get("/")
def web_root():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.post("/upload")
async def upload_material(file: UploadFile = File(...)):
    # size guard: check declared size + actual temp file size
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=413, content={"error": f"File too large ({file.size} bytes). Max {MAX_UPLOAD_BYTES//(1024*1024)} MB."})
    suffix = os.path.splitext(file.filename)[1].lower()
    ALLOWED = {".pdf", ".pptx", ".txt", ".md"}
    if suffix not in ALLOWED:
        return JSONResponse(status_code=400, content={"error": "Only .pdf, .pptx, .txt, .md supported for hackathon demo"})
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    # actual size check after write
    try:
        if os.path.getsize(tmp_path) > MAX_UPLOAD_BYTES:
            return JSONResponse(status_code=413, content={"error": f"File too large ({os.path.getsize(tmp_path)} bytes). Max {MAX_UPLOAD_BYTES//(1024*1024)} MB."})
    except:
        pass

    try:
        # --- PDF: per-page chunking to preserve page numbers ---
        if suffix == ".pdf":
            pages = extract_pdf_pages(tmp_path)
            ocr_flag = was_last_ocr_used()
            if not pages or sum(len(p.get("text","").strip()) for p in pages) < 20:
                return JSONResponse(status_code=400, content={"error": f"Could not extract text (got {sum(len(p.get('text','').strip()) for p in pages)} chars). Scanned PDF may need OCR - try a text-based PDF."})
            total_chars = sum(len(p["text"]) for p in pages)
            all_chunks: list[str] = []
            all_pages: list[int] = []
            for pg in pages:
                p_chunks = chunk_text(pg["text"], chunk_size=350, overlap=50)
                for c in p_chunks:
                    all_chunks.append(c)
                    all_pages.append(pg["page"])
            if not all_chunks:
                return JSONResponse(status_code=400, content={"error": "No chunks generated from PDF pages."})
            count = add_chunks(all_chunks, source=file.filename, pages=all_pages, ocr_used=ocr_flag)
            return {
                "filename": file.filename,
                "chars": total_chars,
                "chunks": count,
                "pages": len(pages),
                "ocr_used": ocr_flag,
                "threshold_hint": THRESHOLD_OCR if ocr_flag else THRESHOLD_CLEAN,
                "message": f"Uploaded and indexed {count} chunks from {len(pages)} pages" + (" (OCR mode)" if ocr_flag else " (text mode)")
            }
        elif suffix == ".pptx":
            text = extract_text_from_pptx(tmp_path)
            if not text or len(text.strip()) < 20:
                return JSONResponse(status_code=400, content={"error": f"Could not extract text (got {len(text.strip())} chars)."})
            chunks = chunk_text(text, chunk_size=350, overlap=50)
            # PPTX has no real pages -> store page=None (citations will show Page N/A)
            count = add_chunks(chunks, source=file.filename, pages=[None] * len(chunks))
            return {
                "filename": file.filename,
                "chars": len(text),
                "chunks": count,
                "message": f"Uploaded and indexed {count} chunks"
            }
        elif suffix in [".txt", ".md"]:
            text = extract_text_from_txt(tmp_path)
            if not text or len(text.strip()) < 20:
                return JSONResponse(status_code=400, content={"error": f"Could not extract text (got {len(text.strip())} chars)."})
            chunks = chunk_text(text, chunk_size=350, overlap=50)
            # .txt/.md: single logical page
            count = add_chunks(chunks, source=file.filename, pages=[1] * len(chunks))
            return {
                "filename": file.filename,
                "chars": len(text),
                "chunks": count,
                "message": f"Uploaded and indexed {count} chunks"
            }
        else:
            return JSONResponse(status_code=400, content={"error": "Only .pdf, .pptx, .txt, .md supported for hackathon demo"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Upload error: {str(e)[:200]}"}
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass

@app.post("/query")
async def query_material(request: Request, query: Optional[str] = Form(None), top_k: Optional[int] = Form(None)):
    # Support both JSON {"query": "...", "top_k": 4} and FormData
    if query is None:
        try:
            ctype = request.headers.get("content-type", "")
            if "application/json" in ctype:
                body = await request.json()
                query = body.get("query") or body.get("q")
                top_k = body.get("top_k", body.get("topK", top_k))
            else:
                # fallback: try form parse again
                form = await request.form()
                query = form.get("query") or form.get("q")
                top_k = form.get("top_k", form.get("topK", top_k))
        except Exception:
            pass
    if not query or not str(query).strip():
        return JSONResponse(status_code=400, content={"error": "query is required (Form or JSON: {\"query\": \"...\"})"})
    query = str(query).strip()
    # clamp top_k
    try:
        top_k = int(top_k) if top_k is not None else 4
    except:
        top_k = 4
    top_k = max(1, min(MAX_TOP_K, top_k))

    result = query_relevant(query, n_results=top_k)
    docs = result["documents"]
    sims = result.get("similarities", [])

    if not docs:
        return {"query": query, "answer": "Ye is material me nahi hai.", "contexts": [], "similarities": []}

    # For non-generic queries, check best similarity threshold here before generating answer (adaptive)
    adaptive_thr = _get_adaptive_threshold(result["metadatas"])
    if sims and not _is_generic_query(query) and max(sims) < adaptive_thr:
        return {"query": query, "answer": "Ye is material me nahi hai. (No passage crosses relevance threshold {:.2f} [OCR={}] - best was {:.2f}. Try different wording or check if topic is in document.)".format(adaptive_thr, any(m.get("ocr_used") for m in result["metadatas"]), max(sims)), "contexts": docs, "metadatas": result["metadatas"], "distances": result["distances"], "similarities": sims}

    answer = generate_grounded_answer(query, docs, similarities=sims, metadatas=result["metadatas"])

    return {
        "query": query,
        "answer": answer,
        "contexts": docs,
        "metadatas": result["metadatas"],
        "distances": result["distances"],
        "similarities": sims
    }

@app.delete("/clear")
async def clear_delete():
    clear_store()
    return {"message": "Vector store cleared"}

@app.post("/clear")
async def clear():
    clear_store()
    return {"message": "Vector store cleared"}

@app.delete("/source/{source}")
async def delete_source(source: str):
    from vector_store import remove_source
    n = remove_source(source)
    return {"source": source, "removed": n, "message": f"Removed {n} chunks for {source}" if n else f"No chunks found for {source}"}

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# For local run: uvicorn app:app --reload --port 8000
