# AI-TEACH — Judge Demo Script (4 minutes)

> The brief says *"Do not build a chatbot that simply answers questions."*
> Every beat below proves AI-TEACH is a teacher: it plans, explains, asks,
> detects misconceptions, **changes its own teaching strategy**, and re-tests.

## Before you start

```bash
./run.sh            # or: uvicorn app.main:app --port 8000
# open http://localhost:8000
# (optional) export OPENAI_API_KEY=sk-...  → unlocks LLM planning + all 12 languages
# no key needed for this script — offline pedagogy engine covers it fully
```

## Act 1 — Structured, level-aware lesson (≈60s)  → *Task 1*

1. Landing page: **Grade = Class 5**, **Subject = Science**, **Language = English**, 5 min.
2. Pick the chip **"Ohm's Law"** (or type any topic / drop a PDF of your own notes).
3. Press **Start Learning**.
4. **Say it out loud**: "The teacher just *planned* a lesson — 3 concept segments plus a
   quiz — from a topic string. No key? Deterministic pedagogy engine. With a key? LLM-written
   plan grounded in the uploaded material (RAG)."
5. The **avatar** explains with voice + a live **whiteboard** (circuit diagram, equations,
   graphs). Mention the **Record** button → exports the whole class as a **video** (.webm)
   — the Task 1 video deliverable.

## Act 2 — Adaptive teaching, visibly (≈90s)  → *Task 2, the money shot*

1. Teacher asks: *"What happens to current if resistance increases?"* → **answer wrongly**:
   type `the current increases`.
2. **🧠 Adaptive banner appears instantly** (amber, pulsing): *"I noticed a mix-up…
   New approach: a simpler, real-world analogy"* — the engine detected the specific
   misconception (inverse V–R–I relationship), **re-explains differently** (water-pipe
   analogy), and asks a **fresh, easier retest question**.
3. Answer correctly this time → banner turns **green**: *"Excellent! You improved after
   the new explanation."*
4. **Say it**: "That wasn't scripted empathy — the engine tagged the misconception,
   switched analogy, lowered difficulty, and re-tested. The whole trail is logged."

## Act 3 — Multilingual teacher (≈30s)  → *Task 1, languages*

1. Press the **EN ⇄ हिं** button mid-lesson → teaching continues in **Hindi**, and the
   **entire UI** (buttons, hints, banner, report) switches too.
2. With an `OPENAI_API_KEY`, all 12 languages work; without one, the app *tells you*
   honestly instead of silently ignoring your choice.

## Act 4 — Evidence: the learning report (≈60s)

1. Press **End & report**. The report shows:
   - **Score ring, questions attempted / correct**
   - **Your adaptive learning journey** — every misconception → re-teach → retest outcome
     ("improved" / "flagged for revision")
   - **Concept mastery bars**, strong vs. weak topics
   - **Recommendations + what to learn next**, and **"Revise my weak topics"**
     which launches a *new* targeted lesson from the report's own analysis.
2. **📊 My learning** (top-right) → persistent learner profile across sessions.

## 30-second closing line

> "A chatbot waits for questions. AI-TEACH **drives the lesson**: it plans from the
> student's grade, time and material; it explains with voice, avatar and whiteboard;
> it *interrupts itself* when the student is wrong, re-teaches with a new analogy,
> verifies with a new question, and leaves a written trail of every adaptive decision —
> in the student's own language. That is a teacher."
