"""The tutor: lesson planner + adaptive teaching state machine.

Teaching loop:  Understand -> Plan -> Explain -> Question -> Evaluate ->
(correct: praise, extend) / (wrong: detect misconception, re-teach with a new
analogy, re-evaluate) -> Continue -> Quiz -> Report -> Recommend next steps.

Every beat the engine emits is a small dict the frontend renders on the
whiteboard, speaks with TTS, and animates the avatar with.
"""
import random
import re
from collections import deque

from . import llm, pedagogy, profile as profile_store
from . import rag as rag_mod
from . import ingest

# ------------------------------------------------------------------ planner

LEVEL_DEPTH = {"beginner": 2, "intermediate": 3, "advanced": 4}


def _pick(seq, n):
    """Evenly-spaced subset of size n from seq (keeps first & last)."""
    if n >= len(seq):
        return list(seq)
    if n <= 1:
        return [seq[0]]
    idxs = {round(i * (len(seq) - 1) / (n - 1)) for i in range(n)}
    return [seq[i] for i in sorted(idxs)]


def _sentences(text, limit=4, min_len=30):
    parts = re.split(r"(?<=[.!?।])\s+", text.replace("\n", " "))
    out = []
    for p in parts:
        p = p.strip()
        if min_len <= len(p) <= 400:
            out.append(p)
        if len(out) >= limit:
            break
    return out


class LessonPlanner:
    """Builds a plan dict. LLM-first; deterministic offline fallback."""

    def __init__(self, docs):
        self.docs = docs

    # -- public -------------------------------------------------------
    def build(self, source, prof):
        minutes = max(1, int(prof.get("minutes", 20)))
        if minutes >= 1440:
            return self._study_plan(source, prof, days=max(2, minutes // 1440))
        plan = self._llm_lesson(source, prof)
        if not plan:
            plan = self._fallback_lesson(source, prof)
        plan["mode"] = "lesson"
        plan["minutes"] = minutes
        plan["language"] = prof["language"]
        plan["level"] = prof["level"]
        # graceful, *visible* fallback: the offline engine only teaches in
        # languages it has content for — never silently switch to English.
        info = pedagogy.LANG_INFO.get(plan["language"], {})
        if plan.get("engine") != "llm" and not info.get("offline"):
            requested = plan["language"]
            plan["language"] = "hi" if requested in ("mr", "pa", "bn", "gu", "kn") else "en"
            names = {"en": "English", "hi": "Hindi", "hinglish": "Hinglish"}
            plan["language_note"] = (
                f"{info.get('name', requested)} needs an AI key for full lessons — "
                f"teaching in {names[plan['language']]} for now."
            )
            prof["language"] = plan["language"]
        return plan

    # -- LLM lesson ---------------------------------------------------
    def _llm_lesson(self, source, prof):
        if not llm.is_available():
            return None
        minutes = max(1, int(prof.get("minutes", 20)))
        n_seg = max(2, min(8, round(minutes / 3.5)))
        n_quiz = 2 if minutes < 12 else 3 if minutes < 30 else 5
        lang_name = pedagogy.LANG_INFO.get(prof["language"], {}).get("name", prof["language"])
        context, title_hint, grounded = self._context(source, max_chars=4200)
        schema = """Return ONLY JSON with this exact shape:
{"title": str,
 "segments": [{"concept": str, "script": [1-3 spoken paragraphs, each <=60 words],
   "visual": {"kind": one of "bullets","equation_steps","flow","timeline","graph","circuit","triangle","code",
              "title": str, ...payload matching the kind},
   "check": {"kind": "open"|"mcq", "question": str, "answer": str|int, "keywords": [synonyms the student might say],
     "options": [str] (mcq only),
     "misconceptions": [{"patterns": [substrings, lowercase] (open) or "option": int (mcq),
        "label": short name, "feedback": why it's wrong, "analogy": a NEW analogy re-teaching it,
        "followup": a fresh check question object}]}}],
 "quiz": [question objects like check], "next_topics": [str]}"""
        user = (
            f"Design a {minutes}-minute lesson for a {prof['level']} student, teaching style: {prof.get('style','conceptual')}.\n"
            f"Write EVERYTHING (scripts, questions, feedback) in {lang_name}.\n"
            f"Cover {n_seg} concepts progressively (simple to complex), each with a concrete example and an "
            f"age-appropriate analogy, then a check question with the 1-2 most likely misconceptions mapped.\n"
            f"Pick the visual kind by subject: math -> equation_steps/graph, physics -> diagram/circuit/graph, "
            f"history -> timeline, programming -> code, processes -> flow.\n"
            f"Add a final quiz of {n_quiz} questions and 3 next_topics.\n"
        )
        if grounded:
            user += (f'The lesson is on "{title_hint}" and MUST be grounded ONLY in this material. '
                     f"Do not invent facts beyond it.\n=== MATERIAL ===\n{context}\n=== END ===")
        else:
            user += f'Topic: "{title_hint}".'
        data = llm.chat_json(
            [{"role": "system", "content": "You are an expert instructional designer and teacher. " + schema},
             {"role": "user", "content": user}],
            max_tokens=3200)
        if not isinstance(data, dict) or not data.get("segments"):
            return None
        # sanitize
        segs = []
        for s in data.get("segments", [])[:8]:
            if not s.get("concept") or not s.get("script"):
                continue
            segs.append({
                "concept": str(s["concept"])[:90],
                "script": [str(x) for x in (s.get("script") or []) if str(x).strip()][:3],
                "visual": self._clean_visual(s.get("visual"), str(s["concept"])),
                "check": self._clean_question(s.get("check"), str(s["concept"])),
            })
        if not segs:
            return None
        quiz = [self._clean_question(q, q.get("concept", "Overall") if isinstance(q, dict) else "Overall")
                for q in (data.get("quiz") or []) if isinstance(q, dict)]
        quiz = [q for q in quiz if q][: (2 if minutes < 12 else 3 if minutes < 30 else 5)]
        return {"title": str(data.get("title") or title_hint)[:120], "segments": segs,
                "segments_by_lang": {}, "quiz": quiz, "quiz_by_lang": {},
                "next_topics": [str(t)[:80] for t in (data.get("next_topics") or [])][:3],
                "path": None, "grounded": grounded, "engine": "llm"}

    def _clean_visual(self, v, concept):
        kinds = {"bullets", "equation_steps", "flow", "timeline", "graph", "circuit", "triangle", "code"}
        if isinstance(v, dict) and v.get("kind") in kinds:
            return v
        return {"kind": "bullets", "title": concept, "items": []}

    def _clean_question(self, q, concept):
        if not isinstance(q, dict) or not q.get("question"):
            return None
        kind = q.get("kind") if q.get("kind") in ("open", "mcq") else "open"
        out = {"kind": kind, "question": str(q["question"]), "concept": str(q.get("concept") or concept)}
        if kind == "mcq":
            opts = [str(o) for o in (q.get("options") or [])][:4]
            if len(opts) < 2:
                return None
            out["options"] = opts
            ans = q.get("answer")
            out["answer"] = int(ans) if isinstance(ans, (int, float)) and 0 <= int(ans) < len(opts) else 0
        else:
            out["answer"] = str(q.get("answer") or "")
            out["keywords"] = [str(k).lower() for k in (q.get("keywords") or [])][:8]
        mis = []
        for m in (q.get("misconceptions") or [])[:2]:
            if not isinstance(m, dict):
                continue
            entry = {"label": str(m.get("label") or "misconception"),
                     "feedback": str(m.get("feedback") or ""),
                     "analogy": str(m.get("analogy") or "")}
            if kind == "mcq":
                if isinstance(m.get("option"), int):
                    mis.append({**entry, "option": m["option"],
                                "followup": self._clean_question(m.get("followup"), concept)})
            else:
                pats = [str(p).lower() for p in (m.get("patterns") or [])][:6]
                if pats:
                    mis.append({**entry, "patterns": pats,
                                "followup": self._clean_question(m.get("followup"), concept)})
        out["misconceptions"] = mis
        return out

    # -- fallback lesson ----------------------------------------------
    def _fallback_lesson(self, source, prof):
        if source["type"] == "topic":
            return self._topic_lesson(source, prof)
        return self._doc_lesson(source, prof)

    def _topic_lesson(self, source, prof):
        topic = source["topic"]
        pack = pedagogy.find_pack(topic)
        lang = prof["language"]
        pack_lang = "hi" if (lang in ("hi", "hinglish") and "hi" in (pack or {}).get("segments", {})) else "en"
        if pack:
            minutes = max(1, int(prof.get("minutes", 20)))
            all_segs = pack["segments"][pack_lang]
            n = max(2, min(len(all_segs), round(minutes / 3.5)))
            chosen = _pick(all_segs, n)
            skipped = [s for s in all_segs if s not in chosen]
            quiz = list(pack["quiz"].get(pack_lang, pack["quiz"].get("en", [])))
            for s in skipped:  # skipped segments' checks resurface in the quiz
                if s.get("check") and len(quiz) < 4:
                    quiz.append(s["check"])
            return {"title": pack["titles"].get(pack_lang, pack["titles"]["en"]),
                    "segments": chosen, "segments_by_lang": pack["segments"],
                    "quiz": quiz[: (2 if minutes < 12 else 3 if minutes < 30 else 4)],
                    "quiz_by_lang": pack.get("quiz", {}),
                    "next_topics": pack["next_topics"].get(pack_lang, pack["next_topics"].get("en", [])),
                    "path": pedagogy.find_path(topic), "grounded": False, "engine": "pack"}
        # unknown topic without LLM: honest scaffold
        path = pedagogy.find_path(topic)
        segs = [{
            "concept": f"Orientation: {topic}",
            "script": [
                f"You asked me to teach you {topic}. I can build a solid orientation for you right now.",
                "For a full, rich lesson on any custom topic, connect an OpenAI-compatible API key — the planner then generates scripts, questions and misconception maps automatically. Meanwhile, let me lay out how we'd attack this subject.",
                "Learning any subject works the same way: first the vocabulary, then the core mechanisms, then worked examples, and finally practice with feedback. That is exactly the path on the board.",
            ],
            "visual": {"kind": "flow", "title": f"How we'll master {topic}", "steps": (path or ["Foundations and vocabulary", "Core concepts and mechanisms", "Worked examples", "Practice with feedback"])[:4]},
            "check": {"kind": "open", "concept": "Learning approach",
                      "question": "Quick check — why do we learn vocabulary before deep mechanisms?",
                      "answer": "so that the deeper explanations have building blocks to attach to",
                      "keywords": ["building", "vocabulary", "foundation", "basic", "understand"], "misconceptions": []},
        }]
        return {"title": f"Introduction to {topic}", "segments": segs, "segments_by_lang": {},
                "quiz": [], "quiz_by_lang": {}, "next_topics": (path or [f"{topic} — fundamentals"])[:3],
                "path": path, "grounded": False, "engine": "pack"}

    def _doc_lesson(self, source, prof):
        doc = self.docs[source["doc_id"]]
        text = ingest.slice_section(doc["text"], source.get("section"))
        retriever = rag_mod.Retriever(rag_mod.chunk_text(text))
        minutes = max(1, int(prof.get("minutes", 20)))
        depth = LEVEL_DEPTH.get(prof["level"], 2)
        concepts = rag_mod.extract_concepts(text, top_n=10)
        n = max(2, min(6, round(minutes / 3.5)))
        concepts = _pick(concepts, n)
        formulas = ingest.detect_formulas(text)
        segs, checks_pool = [], []
        for concept in concepts:
            found = retriever.search(concept, k=1)
            chunk = found[0][0] if found else concept
            sents = _sentences(chunk, limit=depth)
            if not sents:
                sents = [f"{concept} is a key idea in this material."]
            script = [f"Let's look at {concept}. " + (sents[0] if sents else "")]
            if len(sents) > 1:
                script.append(" ".join(sents[1:]))
            visual = self._pick_visual(concept, chunk, formulas)
            check = self._make_check(concept, chunk)
            segs.append({"concept": concept.title(), "script": script, "visual": visual, "check": check})
        # formula relationship segment — classic misconception trap
        for f in (formulas or [])[:1]:
            direct = f["op"] == "multiply"
            q_text = (f"From the relation {f['raw']}: if {f['a']} stays constant and {f['b']} increases, "
                      f"what happens to {f['lhs']}?")
            ans = (f"{f['lhs']} increases (direct relation)" if direct
                   else f"{f['lhs']} decreases (inverse relation)")
            kws = ["increase", "more", "बढ़"] if direct else ["decrease", "less", "reduce", "fall", "घट", "कम"]
            mis_pats = ["decrease", "less", "घट"] if direct else ["increase", "more", "बढ़", "ज्यादा"]
            segs.append({
                "concept": f"Relation: {f['raw']}",
                "script": [f"The material gives us an important relationship: {f['raw']}.",
                           ("This is a direct relation — grow the right side, and the left side grows too." if direct
                            else f"Read it carefully: {f['lhs']} equals {f['a']} divided by {f['b']}. So when {f['b']} grows while {f['a']} stays fixed, {f['lhs']} must shrink. The formula hides a story — let's test it.")],
                "visual": {"kind": "equation_steps", "title": f"Working with {f['raw']}",
                           "steps": [f["raw"], (f"{f['lhs']} ∝ {f['a']}·{f['b']}" if direct else f"{f['lhs']} ∝ 1/{f['b']}  (with {f['a']} fixed)"),
                                     f"Check: {f['b']} ↑  ⇒  {f['lhs']} {'↑' if direct else '↓'}"]},
                "check": {"kind": "open", "concept": f["raw"], "question": q_text, "answer": ans, "keywords": kws,
                          "misconceptions": [{
                              "patterns": mis_pats, "label": f"inverted relationship in {f['raw']}",
                              "feedback": f"Careful — look at the formula. {f['lhs']} = {f['a']}{'×' if direct else '/'}{f['b']}. "
                                          + (f"More {f['b']} means more {f['lhs']}, not less." if direct
                                             else f"{f['b']} sits in the denominator, so more {f['b']} means less {f['lhs']}, not more."),
                              "analogy": f"Cover the formula except {f['lhs']} and {f['b']}. If {f['a']} never changes, only {f['b']} can move the result — and it moves it {'the same way' if direct else 'the opposite way'}.",
                              "followup": None}]},
            })
        for s in segs:
            if s.get("check"):
                checks_pool.append(s["check"])
        quiz = checks_pool[1:4] if len(checks_pool) > 2 else checks_pool[:2]
        nxt = [h for h in doc["outline"] if h.lower() not in " ".join(c.title().lower() for c in [s["concept"] for s in segs])][:3]
        return {"title": (source.get("section") or doc["title"])[:110], "segments": segs,
                "segments_by_lang": {}, "quiz": quiz, "quiz_by_lang": {},
                "next_topics": nxt or ["Revise this section", "Practice problems on " + doc["title"][:40]],
                "path": None, "grounded": True, "engine": "doc"}

    def _pick_visual(self, concept, chunk, formulas):
        """Subject-aware visual choice (rule-based fallback / mirrors LLM schema)."""
        if formulas and any(f["raw"] in chunk or f["lhs"] in concept.upper() for f in formulas):
            f = formulas[0]
            return {"kind": "equation_steps", "title": f"Key relation",
                    "steps": [f["raw"] for f in formulas[:3]]}
        years = re.findall(r"\b(1[5-9]\d{2}|20[0-2]\d)\b", chunk)
        if len(years) >= 2:
            events = []
            for m in re.finditer(r"\b(1[5-9]\d{2}|20[0-2]\d)\b[,:\-\s]+([^.\n]{6,60})", chunk):
                events.append({"year": m.group(1), "label": m.group(2).strip().capitalize()})
            if len(events) >= 2:
                return {"kind": "timeline", "title": concept.title(), "events": events[:5]}
        if re.search(r"\b(def |import |class |return |function |=>|\{|\};)", chunk):
            code_lines = [l for l in chunk.split(". ") if re.search(r"[{}();=]", l)][:6]
            return {"kind": "code", "title": concept.title(), "code": "\n".join(code_lines)}
        items = [s[:110] for s in _sentences(chunk, limit=4)]
        return {"kind": "bullets", "title": concept.title(), "items": items}

    def _make_check(self, concept, chunk):
        toks = [t for t in rag_mod.tokenize(chunk) if t not in concept.lower().split()]
        kws = []
        for t in toks:
            if t not in kws:
                kws.append(t)
            if len(kws) >= 4:
                break
        sents = _sentences(chunk, limit=2)
        answer = sents[0] if sents else concept
        return {"kind": "open", "concept": concept.title(),
                "question": f"Explain briefly: what do you understand about {concept}?",
                "answer": answer, "keywords": kws or [w for w in concept.lower().split() if len(w) > 3],
                "misconceptions": []}

    # -- study plan (multi-day) ---------------------------------------
    def _study_plan(self, source, prof, days):
        topic = source.get("topic") if source["type"] == "topic" else None
        lang_name = pedagogy.LANG_INFO.get(prof["language"], {}).get("name", prof["language"])
        context, title_hint, _ = (self._context(source, max_chars=2500) if source["type"] == "doc"
                                  else ("", topic, False))
        items = None
        if llm.is_available():
            data = llm.chat_json(
                [{"role": "system", "content": "You are an expert study planner. Return only JSON."},
                 {"role": "user", "content":
                  f"Build a {days}-day study plan in {lang_name} for a {prof['level']} learner on "
                  f'"{title_hint}". {"Ground it in: " + context if context else ""} '
                  'JSON: {"title": str, "days": [{"day": int, "focus": str, "tasks": [str], "revision": str}]}. '
                  "Include spaced revision of earlier topics on later days, a self-test on the last day. "
                  "Tasks must take 45-60 minutes per day."}],
                max_tokens=2400)
            if isinstance(data, dict) and data.get("days"):
                plan_days = [{"day": int(d.get("day", i + 1)), "focus": str(d.get("focus", ""))[:90],
                              "tasks": [str(t)[:90] for t in (d.get("tasks") or [])][:4],
                              "revision": str(d.get("revision", ""))[:140]}
                             for i, d in enumerate(data["days"][:days])]
                return {"mode": "study_plan", "title": str(data.get("title") or title_hint)[:120],
                        "days": plan_days, "segments": [], "quiz": [], "next_topics": [],
                        "path": None, "grounded": bool(context), "engine": "llm",
                        "language": prof["language"], "level": prof["level"], "minutes": prof["minutes"]}
        # fallback: distribute path / outline / concepts across days
        pool = (pedagogy.find_path(topic or "")
                or (self.docs[source["doc_id"]]["outline"] if source["type"] == "doc" else None)
                or [f"{title_hint} — part {i + 1}" for i in range(days)])
        items = pool + [pool[-1]] * max(0, days - len(pool))
        plan_days = []
        for d in range(1, days + 1):
            focus = items[min(d - 1, len(items) - 1)]
            tasks = [f"Study: {focus}", "Take your own notes in 5 bullet points"]
            if d == days:
                tasks.append("Self-test: explain every earlier topic aloud in 2 minutes each")
            elif d % 2 == 0:
                tasks.append(f"Quick revision of day {d - 1}")
            plan_days.append({"day": d, "focus": focus, "tasks": tasks[:3],
                              "revision": "" if d == 1 else f"Revise day {d - 1} before starting."})
        return {"mode": "study_plan", "title": f"{days}-day plan: {title_hint}", "days": plan_days,
                "segments": [], "quiz": [], "next_topics": pool[days:days + 3] if len(pool) > days else [],
                "path": pool, "grounded": bool(context), "engine": "fallback",
                "language": prof["language"], "level": prof["level"], "minutes": prof["minutes"]}

    def _context(self, source, max_chars):
        if source["type"] == "doc" and source.get("doc_id") in self.docs:
            doc = self.docs[source["doc_id"]]
            text = ingest.slice_section(doc["text"], source.get("section"))
            return text[:max_chars], (source.get("section") or doc["title"]), True
        return "", (source.get("topic") or "General"), False


# ------------------------------------------------------------------ engine

def _norm(s):
    return re.sub(r"[^\w\s\u0900-\u097F]", " ", (s or "").lower())


class TutorSession:
    def __init__(self, sid, plan, prof, docs):
        self.id = sid
        self.plan = plan
        self.prof = prof
        self.docs = docs
        self.lang = prof["language"]
        self.beats = deque()
        self.stage = "intro_done"          # intro served immediately by caller
        self.si = -1
        self.qi = -1
        self.awaiting = None               # question dict awaiting an answer
        self.followup_depth = 0
        self.consecutive_correct = 0
        self.stats = {}                    # concept -> attempts/score_sum/misconceptions
        self.transcript = []
        self.q_events = []               # every graded answer: concept/verdict/score
        self.adapt = []                  # adaptive actions: misconception -> reteach -> outcome
        self._pending_adapt = None       # index into self.adapt awaiting retest outcome
        self._translation_cache = {}
        self.retriever = None
        if plan.get("grounded") and prof.get("_doc_id") in docs:
            doc = docs[prof["_doc_id"]]
            self.retriever = rag_mod.Retriever(rag_mod.chunk_text(doc["text"]))
        self._open_lesson()

    # ------------- templates & language
    def _t(self, key, **kw):
        text = pedagogy.tmpl(self.lang, key)
        if not kw:
            return text
        try:
            return text.format(**kw)
        except (KeyError, IndexError):
            return text

    def _say(self, text):
        """Push a plain spoken beat."""
        if text:
            self.beats.append({"type": "script", "say": text, "avatar": "explain",
                               "board": None, "can_answer": False})

    def _open_lesson(self):
        name = f", {self.prof['student_name']}" if self.prof.get("student_name") else ""
        what = self._t("what_doc" if self.plan.get("grounded") else "what_topic",
                       title=self.plan["title"])
        key = "greet_persona_prof" if self.prof.get("persona") == "prof" else "greet"
        self.beats.append({"type": "script", "say": self._t(key, name=name, what=what),
                           "avatar": "greet", "can_answer": False,
                           "board": {"kind": "title", "title": self.plan["title"],
                                     "subtitle": pedagogy.PERSONA_NAME.get(self.prof.get("persona"), "Priya")}})
        if self.plan["mode"] == "study_plan":
            self.beats.append({"type": "script",
                               "say": self._t("study_plan_intro", days=len(self.plan["days"])),
                               "avatar": "explain", "can_answer": False,
                               "board": {"kind": "path_overview", "title": self.plan["title"],
                                         "items": [f"Day {d['day']}: {d['focus']}" for d in self.plan["days"][:8]]}})
        else:
            board = None
            if self.plan.get("path"):
                board = {"kind": "path_overview", "title": "Your learning path",
                         "items": self.plan["path"][:8]}
            self.beats.append({"type": "script",
                               "say": self._t("agenda", n=len(self.plan["segments"]),
                                              minutes=self.plan.get("minutes", 20)),
                               "avatar": "explain", "can_answer": False, "board": board})
        self.transcript.append(("teacher", self.plan["title"]))

    # ------------- beat flow
    def next_beat(self):
        if not self.beats:
            self._advance()
        if not self.beats:
            return None
        beat = self.beats.popleft()
        if beat.get("q"):
            self.awaiting = beat["q"]
            self.followup_depth = beat.get("depth", 0)
        if beat.get("say"):
            beat = self._localize(beat)
            self.transcript.append(("teacher", beat["say"]))
        beat["progress"] = {"stage": self.stage, "si": self.si,
                            "n": len(self.plan.get("segments", [])),
                            "qi": self.qi, "qn": len(self.plan.get("quiz", []))}
        return beat

    def _localize(self, beat):
        if self.lang == self.plan.get("language"):
            return beat
        if len(beat.get("say", "")) < 400 and llm.is_available() and self.lang not in pedagogy.T:
            cache_key = (self.lang, beat["say"])
            if cache_key not in self._translation_cache:
                lang_name = pedagogy.LANG_INFO.get(self.lang, {}).get("name", self.lang)
                out = llm.chat([{"role": "system", "content":
                                 f"Translate the teacher's line into {lang_name}. Keep it warm and natural, "
                                 f"same length. Return only the translation."},
                                {"role": "user", "content": beat["say"]}], max_tokens=500)
                self._translation_cache[cache_key] = out or beat["say"]
            beat = dict(beat, say=self._translation_cache[cache_key])
        return beat

    def _advance(self):
        if self.plan["mode"] == "study_plan":
            return self._advance_study()
        if self.stage in ("intro_done", "segment"):
            self.si += 1
            segs = self.plan.get("segments", [])
            if self.si < len(segs):
                self.stage = "segment"
                if self.si > 0:
                    self._say(self._t("next_segment", concept=segs[self.si]["concept"]))
                self._schedule_segment(self.si)
            else:
                self._start_quiz_or_end()
        elif self.stage == "quiz":
            self.qi += 1
            quiz = self.plan.get("quiz", [])
            if self.qi < len(quiz):
                self._schedule_question(quiz[self.qi], depth=0, board_kind="question",
                                        label=f"Question {self.qi + 1} of {len(quiz)}")
            else:
                self._finish()

    def _advance_study(self):
        if self.stage == "intro_done":
            self.stage = "study"
            for d in self.plan["days"]:
                say = f"Day {d['day']}: {d['focus']}. " + " ".join(d["tasks"])
                if d.get("revision"):
                    say += " " + d["revision"]
                self.beats.append({"type": "script", "say": say, "avatar": "explain",
                                   "can_answer": False,
                                   "board": {"kind": "plan_day", "day": d["day"], "focus": d["focus"],
                                             "tasks": d["tasks"], "revision": d.get("revision", "")}})
            self.stage = "done_pending"
        else:
            self._finish()

    def _schedule_segment(self, i):
        seg = self.plan["segments"][i]
        for j, line in enumerate(seg.get("script", [])):
            self.beats.append({"type": "script", "say": line, "avatar": "explain",
                               "board": seg.get("visual") if j == 0 else None,
                               "can_answer": False})
        if seg.get("check"):
            self._schedule_question(seg["check"], depth=0, board_kind="question")

    def _schedule_question(self, q, depth, board_kind="question", label=None, tag=None):
        say = q["question"]
        if q.get("kind") == "mcq":
            opts = q.get("options", [])
            letters = ["A", "B", "C", "D"]
            say += " " + " ".join(f"Option {letters[i]}: {o}." for i, o in enumerate(opts))
        self.beats.append({"type": "question", "say": say, "avatar": "ask", "can_answer": True,
                           "q": q, "depth": depth, "tag": tag,
                           "board": {"kind": "question", "question": q["question"],
                                     "options": q.get("options"), "label": label or "Think about it"}})

    def _start_quiz_or_end(self):
        if self.plan.get("quiz"):
            self.stage = "quiz"
            self._say(self._t("quiz_intro", n=len(self.plan["quiz"])))
        else:
            self._finish()

    def _finish(self):
        self.stage = "report"
        self._say(self._t("conclusion"))
        rep = self.report()
        if rep.get("score") is not None:
            self.beats.append({"type": "report", "say": self._t(
                "report_line", score=rep["score"],
                strong=", ".join(rep["strong"]) or "—",
                weak=", ".join(rep["weak"]) or "—") + " " + self._t(
                "next_topics_line", topics=", ".join(rep["next_topics"]) or "—"),
                "avatar": "happy", "can_answer": False,
                "board": {"kind": "report", "report": rep}})
        self.beats.append({"type": "done", "say": None, "avatar": "greet", "can_answer": False})

    # ------------- answering
    def answer(self, text):
        """Evaluate the student's answer; queue praise / remediation; return a verdict."""
        q = self.awaiting
        if q is None:
            return {"verdict": "doubt", "detail": self.ask(text)}
        self.transcript.append(("student", text))
        score, verdict, miscon = evaluate(q, text, self.retriever)
        concept = q.get("concept", "Overall")
        st = self.stats.setdefault(concept, {"attempts": 0, "score_sum": 0.0, "misconceptions": []})
        st["attempts"] += 1
        st["score_sum"] += score
        if miscon and miscon.get("label"):
            st["misconceptions"].append(miscon["label"])
        self.q_events.append({"concept": concept, "verdict": verdict, "score": score})

        if score >= 0.75:
            self.consecutive_correct += 1
            improved = False
            if self._pending_adapt is not None:
                self.adapt[self._pending_adapt]["outcome"] = "improved"
                self._pending_adapt = None
                improved = True
            self.beats.appendleft({"type": "script", "say": random.choice(self._t_all("praise")),
                                   "avatar": "happy", "can_answer": False,
                                   "tag": "improved" if improved else "praise",
                                   "board": {"kind": "verdict", "ok": True, "answer": answer_text(q)}})
            self.awaiting = None
            self.followup_depth = 0
            self._advance()
            return {"verdict": "improved" if improved else "correct", "score": score}
        if score >= 0.4:
            self.consecutive_correct = 0
            if self._pending_adapt is not None:
                self.adapt[self._pending_adapt]["outcome"] = "partial"
                self._pending_adapt = None
            say = self._t("partial") + " " + answer_text(q)
            self.beats.appendleft({"type": "script", "say": say[:600], "avatar": "explain",
                                   "can_answer": False, "tag": "partial",
                                   "board": {"kind": "verdict", "ok": True,
                                             "answer": answer_text(q)}})
            self.awaiting = None
            self.followup_depth = 0
            self._advance()
            return {"verdict": "partial", "score": score}

        # --- wrong answer: misconception-aware remediation
        self.consecutive_correct = 0
        label_txt = (miscon or {}).get("label") or "needs review"
        self.adapt.append({"concept": concept, "misconception": label_txt,
                           "action": "reteach_with_new_analogy", "outcome": "retest_pending"})
        self._pending_adapt = len(self.adapt) - 1

        intro = self._t("first_time_mis") if (miscon and self.followup_depth == 0) else self._t("wrong")
        if miscon:
            fb = (intro + " " + miscon.get("feedback", "")).strip()
            self.beats.appendleft({"type": "script", "say": fb[:700], "avatar": "think",
                                   "can_answer": False, "tag": "misconception",
                                   "misconception_label": label_txt,
                                   "board": {"kind": "verdict", "ok": False, "label": miscon.get("label")}})
            if miscon.get("analogy"):
                follow = {"type": "script", "say": miscon["analogy"][:700], "avatar": "explain",
                          "can_answer": False, "tag": "reteach",
                          "board": {"kind": "bullets", "title": "Let's see it another way",
                                    "items": [miscon["analogy"]]}}
                self.beats.insert(1, follow)
            followup = miscon.get("followup")
        else:
            ans_txt = answer_text(q)
            say = (intro + " " + (f"The key idea is: {ans_txt}" if ans_txt else "")).strip()
            self.beats.appendleft({"type": "script", "say": say[:700], "avatar": "think",
                                   "can_answer": False, "tag": "misconception",
                                   "misconception_label": label_txt,
                                   "board": {"kind": "verdict", "ok": False,
                                             "label": "needs review"}})
            followup = None

        if followup and self.followup_depth < 2:
            retry_line = {"type": "script", "say": self._t("retry_after_reteach"),
                          "avatar": "explain", "can_answer": False, "tag": "retest_intro"}
            self.beats.insert(2 if miscon and miscon.get("analogy") else 1, retry_line)
            self._schedule_question(followup, depth=self.followup_depth + 1, tag="retest")
        elif self.followup_depth == 0:
            # give the same question one more chance, this time after the reteach
            self._schedule_question(q, depth=1, tag="retest")
        else:
            self._move_on(q)
            return {"verdict": "incorrect_move_on", "score": score,
                    "misconception": miscon.get("label") if miscon else None}
        return {"verdict": "incorrect_reteach", "score": score,
                "misconception": miscon.get("label") if miscon else None}

    def _move_on(self, q):
        if self._pending_adapt is not None:
            self.adapt[self._pending_adapt]["outcome"] = "scheduled_for_revision"
            self._pending_adapt = None
        ans = answer_text(q)
        self.beats.append({"type": "script", "say": self._t("move_on", answer=ans)[:650],
                           "avatar": "explain", "can_answer": False, "tag": "moveon",
                           "board": {"kind": "verdict", "ok": None, "answer": ans}})
        self.awaiting = None
        self.followup_depth = 0
        self._advance()

    def _t_all(self, key):
        val = pedagogy.tmpl(self.lang, key)
        return val if isinstance(val, list) else [val]

    # ------------- doubts (RAG-grounded)
    def ask(self, question):
        self.transcript.append(("student", "? " + question))
        answer = None
        grounded_heading = None
        if llm.is_available():
            ctx = ""
            if self.retriever:
                hits = self.retriever.search(question, k=3)
                if hits:
                    grounded_heading = self.plan["title"]
                    ctx = "\n".join(h[0] for h in hits)
            lang_name = pedagogy.LANG_INFO.get(self.lang, {}).get("name", self.lang)
            answer = llm.chat([{"role": "system", "content":
                                f"You are a teacher answering a student's doubt mid-lesson, in {lang_name}, "
                                f"for a {self.prof['level']} learner. Under 70 words, simple, with one tiny "
                                f"example. {'Answer ONLY from this context: ' + ctx if ctx else ''} "
                                f"If the question is off-topic, gently say so."},
                               {"role": "user", "content": question}], max_tokens=400)
        elif self.retriever:
            hits = self.retriever.search(question, k=2)
            if hits and hits[0][1] > 0.05:
                sents = _sentences(hits[0][0], limit=3)
                if sents:
                    answer = " ".join(sents)
                    grounded_heading = self.plan["title"]
        if not answer:
            self.beats.appendleft({"type": "script", "say": self._t("doubt_unknown"),
                                   "avatar": "explain", "can_answer": False})
            return {"answered": False}
        say = self._t("doubt_back", answer=answer[:450])
        if grounded_heading and self.lang in pedagogy.T:
            board = {"kind": "bullets", "title": "From your material", "items": [answer[:230]]}
        else:
            board = {"kind": "bullets", "title": "Good question", "items": [answer[:230]]}
        self.beats.appendleft({"type": "script", "say": say[:800], "avatar": "explain",
                               "can_answer": False, "board": board})
        return {"answered": True, "source": grounded_heading}

    def set_language(self, lang):
        self.lang = lang
        # pack plans carry full translations; swap not-yet-taught content
        by_lang = self.plan.get("segments_by_lang") or {}
        use = "hi" if lang in ("hi", "hinglish") else lang
        swapped = False
        if use in by_lang:
            segs_new = by_lang[use]
            for i in range(max(0, self.si), min(len(self.plan["segments"]), len(segs_new))):
                self.plan["segments"][i] = segs_new[i]
            if (self.plan.get("quiz_by_lang") or {}).get(use):
                self.plan["quiz"] = self.plan["quiz_by_lang"][use]
            if self.stage == "segment" and not self.awaiting:
                self.beats.clear()
                self._schedule_segment(max(0, self.si))
            swapped = True
        return {"language": lang,
                "fully_supported": swapped or lang in pedagogy.T or llm.is_available()}

    # ------------- report
    def report(self):
        if getattr(self, "_report_cache", None):
            return self._report_cache
        per = []
        total_att, total_score = 0, 0.0
        for concept, st in self.stats.items():
            if st["attempts"] == 0:
                continue
            avg = st["score_sum"] / st["attempts"]
            per.append({"concept": concept, "mastery": round(avg, 2),
                        "attempts": st["attempts"], "misconceptions": st["misconceptions"]})
            total_att += st["attempts"]
            total_score += st["score_sum"]
        score = round(100 * total_score / total_att) if total_att else None
        strong = [p["concept"] for p in per if p["mastery"] >= 0.75]
        weak = [p["concept"] for p in per if p["mastery"] < 0.5]
        mid = [p["concept"] for p in per if 0.5 <= p["mastery"] < 0.75]
        attempted = len(self.q_events)
        correct_n = sum(1 for e in self.q_events if e["verdict"] in ("correct", "improved"))
        improvements = sum(1 for a in self.adapt if a["outcome"] == "improved")
        misconceptions = [{"concept": p["concept"], "label": m} for p in per for m in p["misconceptions"]]
        recs = []
        for w in weak:
            recs.append(f"Revise “{w}” — re-read that section and retry its practice questions.")
        for m in mid:
            recs.append(f"Strengthen “{m}” with one more worked example.")
        if score is not None and score >= 80:
            recs.append("Great mastery — you're ready to move ahead.")
        rep = {"title": self.plan["title"], "mode": self.plan["mode"], "score": score,
               "strong": strong, "weak": weak, "improving": mid,
               "misconceptions": misconceptions, "recommendations": recs[:4],
               "next_topics": self.plan.get("next_topics") or [],
               "path": self.plan.get("path"), "language": self.lang,
               "level": self.prof["level"], "minutes": self.plan.get("minutes"),
               "grade": self.prof.get("grade"), "subject": self.prof.get("subject"),
               "questions_attempted": attempted, "answers_correct": correct_n,
               "adaptive_actions": self.adapt, "retest_improvements": improvements,
               "engine": self.plan.get("engine"),
               "per_concept": sorted(per, key=lambda x: x["mastery"])}
        profile_store.record_session(self.plan["title"], score, strong, weak, self.lang,
                                     self.plan.get("minutes"), self.stats,
                                     grade=self.prof.get("grade"),
                                     subject=self.prof.get("subject"))
        self._report_cache = rep
        return rep


# ------------------------------------------------------------------ grading

def answer_text(q):
    """Human-readable expected answer (works for open and mcq questions)."""
    a = q.get("answer")
    if q.get("kind") == "mcq":
        opts = q.get("options") or []
        if isinstance(a, int) and 0 <= a < len(opts):
            return opts[a]
        return ""
    return str(a or "")


def evaluate(q, text, retriever=None):
    """Return (score 0/0.5/1, verdict, misconception-dict|None).
    LLM grading when available; robust keyword/misconception rules otherwise."""
    if llm.is_available():
        graded = _llm_grade(q, text, retriever)
        if graded is not None:
            return graded
    return _rule_grade(q, text)


def _llm_grade(q, text, retriever):
    expected = q.get("answer") if q.get("kind") == "open" else (q.get("options") or [""])[q.get("answer", 0)]
    ctx = ""
    if retriever:
        hits = retriever.search(q.get("question", "") + " " + str(expected), k=2)
        ctx = "\n".join(h[0] for h in hits)
    out = llm.chat_json(
        [{"role": "system", "content":
          "You grade a student's short answer in a live tutoring session. Return JSON only: "
          '{"score": 1|0.5|0, "misconception": short label or null, "feedback": sentence}. '
          "Be generous with phrasing, strict with concepts. Use the lesson context if given."},
         {"role": "user", "content":
          f"Question: {q.get('question')}\nExpected idea: {expected}\nStudent: {text}\n"
          + (f"Lesson context:\n{ctx}" if ctx else "")}],
        max_tokens=250)
    if not isinstance(out, dict) or "score" not in out:
        return None
    try:
        score = 1.0 if float(out["score"]) >= 0.9 else 0.5 if float(out["score"]) >= 0.4 else 0.0
    except (TypeError, ValueError):
        return None
    miscon = None
    if score == 0.0:
        miscon = {"label": out.get("misconception") or "incorrect concept",
                  "feedback": out.get("feedback") or "",
                  "analogy": "", "followup": _miscon_followup(q)}
    return score, ("correct" if score >= .75 else "partial" if score >= .4 else "incorrect"), miscon


def _miscon_followup(q):
    if q.get("misconceptions"):
        for m in q["misconceptions"]:
            if m.get("followup"):
                return m["followup"]
    return None


def _rule_grade(q, text):
    t = _norm(text)
    if q.get("kind") == "mcq":
        return _grade_mcq(q, t)
    kws = [k.lower() for k in (q.get("keywords") or [])]
    hits = sum(1 for k in kws if k and (k in t or (len(k) > 4 and k[:5] in t)))
    need = 1 if len(kws) > 4 else (2 if len(kws) > 1 else 1)
    matched_mis = None
    for m in q.get("misconceptions") or []:
        pats = [p.lower() for p in m.get("patterns", [])]
        if any(p and p in t for p in pats):
            matched_mis = m
            break
    if matched_mis and hits < need:
        return 0.0, "incorrect", matched_mis
    if hits >= need:
        return 1.0, "correct", None
    if matched_mis:
        return 0.0, "incorrect", matched_mis
    if hits >= 1:
        return 0.5, "partial", None
    return 0.0, "incorrect", None


def _grade_mcq(q, t):
    options = q.get("options", [])
    correct_idx = q.get("answer", 0)
    letters = {"a": 0, "b": 1, "c": 2, "d": 3}
    chosen = None
    m = re.search(r"\boption\s*([abcd1-4])\b", t) or re.search(r"^\s*([abcd1-4])\s*$", t)
    if m:
        token = m.group(1)
        chosen = letters.get(token, None) if token in letters else (int(token) - 1 if token.isdigit() else None)
    if chosen is None:  # exact option text (e.g. "3 A") inside the utterance
        tpad = f" {t} "
        for i, opt in enumerate(options):
            onorm = _norm(opt).strip()
            if onorm and f" {onorm} " in tpad:
                chosen = i
                break
    if chosen is None:
        best, best_score = None, 0.0
        for i, opt in enumerate(options):
            otoks = [w for w in _norm(opt).split() if len(w) > 1]
            if not otoks:
                continue
            overlap = sum(1 for w in otoks if f" {w} " in f" {t} " or (len(w) > 4 and w in t))
            score = overlap / len(otoks)
            if score > best_score:
                best, best_score = i, score
        if best_score >= 0.5:
            chosen = best
    if chosen is None:
        return 0.0, "incorrect", None
    if chosen == correct_idx:
        return 1.0, "correct", None
    for msc in q.get("misconceptions") or []:
        if msc.get("option") == chosen:
            return 0.0, "incorrect", msc
    return 0.0, "incorrect", {"label": f"wrong option chosen",
                              "feedback": "That option isn't the right one. Let's look again.",
                              "analogy": "", "followup": _miscon_followup(q)}
