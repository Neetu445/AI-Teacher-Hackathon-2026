import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chunkText, indexChunks, retrieve } from "./rag.js";
import { planLesson } from "./planner.js";
import { applyAnswer } from "./engine.js";
import { loadProfile, saveProfile, recordLesson } from "./store.js";
import { chatJson, hasLlm } from "./llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const f of [".env", ".env.local"]) {
  try {
    const t = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    for (const line of t.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no env file */
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const sessions = new Map();
let profile = loadProfile();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "4mb" }));

const sid = (req) => req.header("x-session") || "demo";

app.get("/api/health", (_req, res) => res.json({ ok: true, llm: hasLlm() }));

app.post("/api/ingest", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const name = req.file.originalname.toLowerCase();
    let text = "";
    if (name.endsWith(".txt") || name.endsWith(".md")) text = req.file.buffer.toString("utf8");
    else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
    } else if (name.endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        text = (await pdfParse(req.file.buffer)).text;
      } catch {
        text = req.file.buffer.toString("utf8");
      }
    } else if (name.endsWith(".pptx")) {
      text = req.file.buffer.toString("utf8").replace(/[^\x09\x0a\x0d\x20-\x7E\u0900-\u097F]/g, " ");
    } else text = req.file.buffer.toString("utf8");
    text = text.replace(/\s+/g, " ").trim();
    if (text.length < 40) return res.status(422).json({ error: "Not enough readable text." });
    const chunks = chunkText(text, req.file.originalname);
    res.json({ name: req.file.originalname, chars: text.length, text: text.slice(0, 40000), chunks });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/start", async (req, res) => {
  try {
    const b = req.body || {};
    const setup = {
      name: b.name || profile.name || "Student",
      topic: b.topic || "Ohm's law",
      level: b.level || profile.level || "beginner",
      language: b.language || profile.language || "en",
      minutes: Number(b.minutes) || 15,
      goal: b.goal || profile.goal || "understand",
      style: b.style || profile.style || "patient",
      knowledge: b.knowledge || profile.knowledge || "",
      demo: Boolean(b.demo),
      sourceText: b.sourceText || "",
      sourceName: b.sourceName || "",
      weak: profile.weak,
    };
    let chunks = [];
    if (setup.sourceText) {
      chunks = chunkText(setup.sourceText, setup.sourceName || "upload");
      chunks = await indexChunks(chunks);
    }
    const lesson = await planLesson(setup, chunks);
    const mastery = {};
    lesson.concepts.forEach((c, i) => {
      mastery[c.id] = i === 0 ? "learning" : "not_started";
    });
    const state = {
      setup,
      lesson,
      chunks,
      conceptIndex: 0,
      phase: "explain",
      mastery,
      logs: [],
      lastDecision: null,
      chat: [],
      startedAt: Date.now(),
    };
    sessions.set(sid(req), state);
    profile = saveProfile({ ...profile, name: setup.name, language: setup.language, level: setup.level, goal: setup.goal, knowledge: setup.knowledge, style: setup.style });
    res.json(publicState(state));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/session", (req, res) => {
  const s = sessions.get(sid(req));
  if (!s) return res.status(404).json({ error: "No session" });
  res.json(publicState(s));
});

app.post("/api/phase", (req, res) => {
  const s = sessions.get(sid(req));
  if (!s) return res.status(404).json({ error: "No session" });
  const next = req.body?.phase;
  if (next === "question" && (s.phase === "explain" || s.phase === "harder")) s.phase = "question";
  if (next === "recheck" && s.phase === "remediate") s.phase = "recheck";
  if (next === "assess") s.phase = "assess";
  sessions.set(sid(req), s);
  res.json(publicState(s));
});

app.post("/api/answer", async (req, res) => {
  try {
    const s = sessions.get(sid(req));
    if (!s) return res.status(404).json({ error: "No session" });
    const next = await applyAnswer(s, String(req.body?.answer || ""));
    sessions.set(sid(req), next);
    res.json(publicState(next));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/language", async (req, res) => {
  const s = sessions.get(sid(req));
  if (!s) return res.status(404).json({ error: "No session" });
  const language = req.body?.language || "en";
  const lesson = await planLesson({ ...s.setup, language }, s.chunks || []);
  const idx = Math.min(s.conceptIndex, lesson.concepts.length - 1);
  const next = { ...s, lesson, conceptIndex: idx, setup: { ...s.setup, language }, phase: s.phase === "done" ? "explain" : s.phase };
  sessions.set(sid(req), next);
  res.json(publicState(next));
});

app.post("/api/followup", async (req, res) => {
  const s = sessions.get(sid(req));
  if (!s) return res.status(404).json({ error: "No session" });
  const q = String(req.body?.question || "");
  const c = s.lesson.concepts[s.conceptIndex];
  const ctx = await retrieve(q, s.chunks || [], 4);
  let answer = c.simple;
  if (hasLlm()) {
    try {
      const j = await chatJson(
        `Answer the student's question about the CURRENT lesson only. JSON { "answer": string, "citation": string }. Language: ${s.lesson.language}. Use chunks if relevant.`,
        JSON.stringify({ q, concept: c.title, explanation: c.explanation, chunks: ctx })
      );
      if (j?.answer) answer = j.answer;
    } catch {
      /* keep simple */
    }
  }
  s.chat = [...(s.chat || []), { q, a: answer }];
  sessions.set(sid(req), s);
  res.json({ answer, chat: s.chat });
});

app.post("/api/assess-answer", (req, res) => {
  const s = sessions.get(sid(req));
  if (!s) return res.status(404).json({ error: "No session" });
  const { id, answer } = req.body || {};
  s.assess = s.assess || {};
  s.assess[id] = answer;
  sessions.set(sid(req), s);
  res.json({ ok: true });
});

app.post("/api/finish", (req, res) => {
  const s = sessions.get(sid(req));
  if (!s) return res.status(404).json({ error: "No session" });
  s.phase = "done";
  const report = reportOf(s);
  profile = recordLesson(profile, s.lesson.title, report, s.mastery);
  sessions.set(sid(req), s);
  res.json({ ...publicState(s), report });
});

app.get("/api/profile", (_req, res) => res.json(profile));
app.get("/api/history", (_req, res) => res.json(profile.scores));

function publicState(s) {
  const c = s.lesson.concepts[s.conceptIndex];
  const q =
    s.phase === "recheck" ? c.followUp || c.question : s.phase === "harder" ? c.harder || c.question : c.question;
  const visual =
    s.phase === "remediate"
      ? s.lastDecision?.strategy === "analogy" && /ohm|resist|current/i.test(c.title + (c.question?.misconceptionId || ""))
        ? { type: "process", title: "Water-pipe analogy", steps: ["Pump → voltage", "Flow → current", "Squeeze → resistance", "Tighter pipe → less flow"] }
        : { type: "process", title: "Another way", steps: [s.lastReexplain || c.simple, c.example] }
      : c.visual;
  const speech = s.phase === "remediate" ? s.lastReexplain || c.analogy : c.explanation;
  return {
    title: s.lesson.title,
    intro: s.lesson.intro,
    objective: s.lesson.objective,
    path: s.lesson.path,
    nextTopic: s.lesson.nextTopic,
    minutes: s.lesson.minutes,
    language: s.lesson.language,
    usedLlm: Boolean(s.lesson.usedLlm),
    grounded: Boolean(s.lesson.grounded),
    llmConfigured: hasLlm(),
    conceptIndex: s.conceptIndex,
    total: s.lesson.concepts.length,
    phase: s.phase,
    mastery: s.mastery,
    lastDecision: s.lastDecision,
    preview: s.lesson.concepts.map((x) => ({ id: x.id, title: x.title, minutes: x.minutes })),
    concept: {
      id: c.id,
      title: c.title,
      explanation: c.explanation,
      simple: c.simple,
      example: c.example,
      analogy: c.analogy,
      citation: c.citation,
      visual,
      speech,
      question: q,
    },
    chat: s.chat || [],
    report: s.phase === "done" ? reportOf(s) : null,
    assessQuiz: s.phase === "assess" || s.phase === "done" ? quizFrom(s) : null,
  };
}

function quizFrom(s) {
  return s.lesson.concepts.map((c) => ({
    id: c.id,
    prompt: c.question.prompt,
    options: c.question.options,
    type: c.question.type,
  }));
}

function reportOf(s) {
  const attempted = s.logs.length;
  const ok = s.logs.filter((l) => l.correct || l.understanding === "understood").length;
  const score = attempted ? Math.round((ok / attempted) * 100) : 0;
  const mastered = Object.entries(s.mastery)
    .filter(([, m]) => m === "mastered")
    .map(([id]) => s.lesson.concepts.find((c) => c.id === id)?.title || id);
  const needs = Object.entries(s.mastery)
    .filter(([, m]) => m !== "mastered")
    .map(([id]) => s.lesson.concepts.find((c) => c.id === id)?.title || id);
  const misconceptions = s.logs
  .filter((l) => l.understanding === "misconception")
  .map((l) => {
    if (l.misconception === "swap_qt") {
      return "Confused electric current with resistance.";
    }
    return l.misconception || "Concept mix-up";
  });
  return {
    title: s.lesson.title,
    score,
    attempted,
    mastered,
    needsWork: needs,
    misconceptions: [...new Set(misconceptions.filter(Boolean))],
    recommendation: needs.length ? `Revise ${needs.join(", ")}.` : "Ready for the next topic.",
    nextTopic: s.lesson.nextTopic,
  };
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => console.log("Pathshala API on " + PORT + " llm=" + hasLlm()));
