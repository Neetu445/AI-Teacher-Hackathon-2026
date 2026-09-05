"""AI Guru — FastAPI backend.

Routes
  GET  /api/config                capabilities (llm on/off, tts, languages)
  POST /api/upload                upload learning material -> parsed outline
  GET  /api/docs/{id}             document outline + stats
  POST /api/sessions              start a teaching session (doc or topic)
  POST /api/sessions/{id}/next    pull the next teaching beat
  POST /api/sessions/{id}/answer  evaluate an answer (adaptive remediation)
  POST /api/sessions/{id}/ask     ask a doubt (RAG-grounded)
  POST /api/sessions/{id}/language  switch teaching language mid-lesson
  GET  /api/sessions/{id}         session state / plan summary
  GET  /api/sessions/{id}/report  assessment report (also ends lesson early)
  GET  /api/profile               learner profile + mastery map
  GET  /api/tts                   optional server TTS (mp3)
"""
import os
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import config, ingest, tts, tutor, pedagogy, profile as profile_store
from .models import StartSessionRequest, AnswerRequest, DoubtRequest, LanguageRequest

app = FastAPI(title="AI Guru — AI Teacher")

DOCS = {}       # doc_id -> {title, text, outline, concepts, path, filename}
SESSIONS = {}   # session_id -> TutorSession


def _cap(store, limit):
    """Keep in-memory stores bounded (FIFO eviction) for long-running deploys."""
    while len(store) > limit:
        store.pop(next(iter(store)))


def _err(msg, code=400):
    raise HTTPException(status_code=code, detail=msg)


# ---------------------------------------------------------------- config

@app.get("/api/config")
def get_config():
    return {
        "app": config.APP_NAME,
        "tagline": config.APP_TAGLINE,
        "llm": "connected" if config.LLM_ENABLED else "offline",
        "model": config.MODEL if config.LLM_ENABLED else None,
        "tts": tts.available(),
        "languages": [{"code": c, **info} for c, info in pedagogy.LANG_INFO.items()],
        "personas": [{"id": k, "name": v} for k, v in pedagogy.PERSONA_NAME.items()],
    }


# ---------------------------------------------------------------- documents

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename:
        _err("No file provided")
    doc_id = uuid.uuid4().hex[:10]
    safe = "".join(c for c in file.filename if c.isalnum() or c in "._- ").strip() or "material"
    path = os.path.join(config.UPLOAD_DIR, f"{doc_id}_{safe}")
    content = await file.read()
    if len(content) > 40 * 1024 * 1024:
        _err("File too large (max 40 MB)")
    with open(path, "wb") as f:
        f.write(content)
    try:
        text = ingest.parse_file(path)
    except ValueError as e:
        _err(str(e))
    except Exception:
        _err("Could not parse this file. Try PDF, DOCX, PPTX, TXT or MD.")
    if len(text.strip()) < 80:
        _err("The document seems to have almost no readable text.")
    from . import rag as rag_mod
    _cap(DOCS, 50)
    DOCS[doc_id] = {
        "id": doc_id,
        "filename": file.filename,
        "title": ingest.guess_title(text, file.filename),
        "text": text,
        "outline": ingest.extract_outline(text),
        "concepts": rag_mod.extract_concepts(text, 12),
        "chars": len(text),
        "path": path,
    }
    d = DOCS[doc_id]
    return {"doc_id": doc_id, "title": d["title"], "outline": d["outline"],
            "concepts": d["concepts"], "chars": d["chars"], "filename": d["filename"]}


@app.get("/api/docs/{doc_id}")
def doc_info(doc_id: str):
    if doc_id not in DOCS:
        _err("Document not found", 404)
    d = DOCS[doc_id]
    return {"doc_id": doc_id, "title": d["title"], "outline": d["outline"],
            "concepts": d["concepts"], "chars": d["chars"], "filename": d["filename"]}


# ---------------------------------------------------------------- sessions

@app.post("/api/sessions")
def start_session(req: StartSessionRequest):
    prof = req.model_dump()
    if req.doc_id:
        if req.doc_id not in DOCS:
            _err("Unknown document. Upload it again.", 404)
        source = {"type": "doc", "doc_id": req.doc_id, "section": req.section or ""}
        prof["_doc_id"] = req.doc_id
    elif req.topic and req.topic.strip():
        source = {"type": "topic", "topic": req.topic.strip()}
    else:
        _err("Provide either an uploaded document or a topic.")

    planner = tutor.LessonPlanner(DOCS)
    try:
        plan = planner.build(source, prof)
    except Exception as e:
        _err(f"Could not build a lesson: {e}")
    sid = uuid.uuid4().hex[:12]
    _cap(SESSIONS, 300)
    SESSIONS[sid] = tutor.TutorSession(sid, plan, prof, DOCS)
    first = SESSIONS[sid].next_beat()
    return {
        "session_id": sid,
        "plan": {
            "title": plan["title"], "mode": plan["mode"], "engine": plan.get("engine"),
            "segments": len(plan.get("segments", [])), "quiz": len(plan.get("quiz", [])),
            "days": len(plan.get("days", [])) if plan["mode"] == "study_plan" else 0,
            "grounded": plan.get("grounded"), "path": plan.get("path"),
            "minutes": plan.get("minutes"), "language": plan.get("language"),
        },
        "first_beat": first,
    }


def _session(sid):
    s = SESSIONS.get(sid)
    if not s:
        _err("Session not found", 404)
    return s


@app.get("/api/sessions/{sid}")
def session_state(sid: str):
    s = _session(sid)
    return {"session_id": sid, "stage": s.stage, "si": s.si, "qi": s.qi,
            "awaiting": bool(s.awaiting), "language": s.lang,
            "plan_title": s.plan["title"], "mode": s.plan["mode"],
            "transcript": s.transcript[-60:]}


@app.post("/api/sessions/{sid}/next")
def next_beat(sid: str):
    s = _session(sid)
    beat = s.next_beat()
    if beat is None:
        return {"type": "done", "say": None, "can_answer": False}
    return beat


@app.post("/api/sessions/{sid}/answer")
def answer(sid: str, req: AnswerRequest):
    s = _session(sid)
    result = s.answer(req.answer.strip())
    return result


@app.post("/api/sessions/{sid}/ask")
def doubt(sid: str, req: DoubtRequest):
    s = _session(sid)
    return s.ask(req.question.strip())


@app.post("/api/sessions/{sid}/language")
def language(sid: str, req: LanguageRequest):
    s = _session(sid)
    code = req.language.lower().strip()
    if code not in pedagogy.LANG_INFO and not config.LLM_ENABLED:
        _err(f"Language '{code}' needs an LLM key. Offline languages: English, Hindi, Hinglish.")
    return s.set_language(code)


@app.get("/api/sessions/{sid}/report")
def report(sid: str):
    s = _session(sid)
    return s.report()


@app.get("/api/profile")
def get_profile():
    p = profile_store.load()
    p["mastery"] = profile_store.concept_mastery()
    return p


@app.get("/api/tts")
def synth(text: str, lang: str = "en"):
    if len(text) > 1500:
        text = text[:1500]
    audio, mime = tts.synthesize(text, lang) or (None, None)
    if not audio:
        return JSONResponse({"detail": "server TTS not configured"}, status_code=404)
    return Response(content=audio, media_type=mime)


# ---------------------------------------------------------------- frontend

@app.get("/healthz")
def health():
    return {"ok": True, "llm": config.LLM_ENABLED}


if os.path.isdir(config.WEB_DIR):
    app.mount("/", StaticFiles(directory=config.WEB_DIR, html=True), name="web")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0",
                port=int(os.environ.get("PORT", 8000)), log_level="info")
