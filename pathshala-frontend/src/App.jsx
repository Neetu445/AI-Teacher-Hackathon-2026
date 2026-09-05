import { useEffect, useState } from "react";
import { api } from "./api.js";

function speak(text, lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "en" ? "en-IN" : "hi-IN";
  window.speechSynthesis.speak(u);
}

function Visual({ v }) {
  if (!v) return null;
  return (
    <div className="card">
      <div className="chip">{v.type}</div>
      <h3 className="serif" style={{ margin: "8px 0" }}>
        {v.title}
      </h3>
      {v.type === "circuit" && (
        <svg viewBox="0 0 320 100" width="100%" style={{ maxWidth: 280 }}>
          <rect x="10" y="32" width="22" height="32" fill="none" stroke="#1d4ed8" strokeWidth="2" />
          <path d="M32 48 H100 l8-10 8 20 8-20 8 20 8-10 H220" fill="none" stroke="#1c1917" strokeWidth="2" />
          <circle cx="236" cy="48" r="12" fill="none" stroke="#1d4ed8" strokeWidth="2" />
          <path d="M248 48 H300 V80 H21 V48" fill="none" stroke="#1c1917" strokeWidth="2" />
        </svg>
      )}
      {v.steps && (
        <ol>
          {v.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {v.bullets && (
        <ul>
          {v.bullets.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [answer, setAnswer] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

  async function start(body) {
    setErr("");
    try {
      const data = await api.start(body);
      setS(data);
      setAnswer("");
      setView("lesson");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function goPhase(phase) {
    const data = await api.phase(phase);
    setS(data);
    setAnswer("");
  }

  async function submit() {
    if (!answer) return;
    const data = await api.answer(answer);
    setS(data);
    setAnswer("");
    if (data.phase === "done") setView("report");
    if (data.phase === "assess") setView("assess");
  }

  return (
    <>
      <nav>
        <a href="#/" onClick={() => setView("home")}>
          Pathshala
        </a>
        <div className="links">
          <a href="#/setup" onClick={() => setView("setup")}>
            Learn
          </a>
          <a
            href="#/history"
            onClick={async () => {
              setHistory(await api.history());
              setView("history");
            }}
          >
            History
          </a>
          <a
            href="#/profile"
            onClick={async () => {
              setProfile(await api.profile());
              setView("profile");
            }}
          >
            Profile
          </a>
        </div>
      </nav>
      <div className="wrap">
        {err && <p className="err">{err}</p>}
        {view === "home" && <Home onDemo={() => start({ demo: true, language: "en", minutes: 15, topic: "Ohm's law", name: "Aarav" })} onSetup={() => setView("setup")} />}
        {view === "setup" && (
          <Setup
            fileLabel={fileLabel}
            onFile={async (f) => {
              const d = await api.ingest(f);
              setFileLabel(`${d.name} · ${d.chars} chars`);
              setSourceText(d.text);
            }}
            onStart={(form) => start({ ...form, sourceText })}
          />
        )}
        {view === "lesson" && s && <Lesson s={s} onEnter={() => setView("class")} />}
        {view === "class" && s && (
          <Class
            s={s}
            answer={answer}
            setAnswer={setAnswer}
            onAsk={() => goPhase("question")}
            onRecheck={() => goPhase("recheck")}
            onSubmit={submit}
            onLang={async (language) => setS(await api.language(language))}
            onAskTeacher={async (q) => {
              const r = await api.followup(q);
              setS((prev) => ({ ...prev, chat: r.chat }));
            }}
          />
        )}
        {view === "assess" && s && (
          <Assess
            onDone={async () => {
              const r = await api.finish();
              setS(r);
              setView("report");
            }}
          />
        )}
        {view === "report" && s?.report && <Report r={s.report} onHome={() => setView("home")} />}
        {view === "history" && <History rows={history} />}
        {view === "profile" && profile && <Profile p={profile} />}
      </div>
    </>
  );
}

function Home({ onDemo, onSetup }) {
  return (
    <>
      <p className="chip">AI Teacher</p>
      <h1>Pathshala</h1>
      <p className="muted">Upload a PDF or type a topic. We teach it in your language. Avatar is the face. Adaptive teaching is the brain.</p>
      <div className="card" style={{ marginTop: 16 }}>
        <strong>Task 1 — Create & deliver</strong>
        <p className="muted">PDF / topic → lesson plan → personalize (level, time, language) → teacher + voice</p>
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <strong>Task 2 — Teach like a human</strong>
        <p className="muted">Teach → ask → you answer → evaluate → understand? yes: continue · no: new explanation → ask again</p>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn primary" onClick={onDemo}>
          Ohm’s law demo (see Task 2)
        </button>
        <button className="btn ghost" onClick={onSetup}>
          Upload PDF or topic
        </button>
      </div>
    </>
  );
}

function Setup({ onStart, onFile, fileLabel }) {
  const [form, setForm] = useState({
    name: "Aarav",
    topic: "Ohm's law",
    level: "beginner",
    language: "en",
    minutes: 15,
    goal: "understand",
    style: "patient",
    knowledge: "",
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <>
      <h1>Start learning</h1>
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        <input value={form.topic} onChange={(e) => set("topic", e.target.value)} />
        <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
        <input
          placeholder="What you already know (optional)"
          value={form.knowledge}
          onChange={(e) => set("knowledge", e.target.value)}
        />
        {fileLabel && <p className="muted">{fileLabel}</p>}
        <div className="row">
          <select value={form.level} onChange={(e) => set("level", e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select value={form.language} onChange={(e) => set("language", e.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="hinglish">Hinglish</option>
          </select>
          <select value={form.minutes} onChange={(e) => set("minutes", Number(e.target.value))}>
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
          </select>
          <select value={form.goal} onChange={(e) => set("goal", e.target.value)}>
            <option value="understand">Understand</option>
            <option value="exam">Exam</option>
            <option value="interview">Interview</option>
            <option value="revision">Revision</option>
          </select>
        </div>
        <button className="btn primary" onClick={() => onStart(form)}>
          Create lesson
        </button>
      </div>
    </>
  );
}

function Lesson({ s, onEnter }) {
  return (
    <>
      <p className="chip">
        Task 1 · {s.minutes} min · {s.language} · {s.usedLlm ? "LLM planner" : "fallback planner"} ·{" "}
        {s.grounded ? "grounded" : "topic"}
      </p>
      <h1>{s.title}</h1>
      <p className="muted">{s.intro}</p>
      <ol className="plan">
        {s.preview.map((c, i) => (
          <li key={c.id} style={{ margin: "8px 0" }}>
            <strong>{c.title}</strong> <span className="muted">{c.minutes} min</span>
          </li>
        ))}
      </ol>
      <button className="btn primary" onClick={onEnter}>
        Start teaching (Task 2)
      </button>
    </>
  );
}

function Class({ s, answer, setAnswer, onAsk, onRecheck, onSubmit, onLang }) {
  const c = s.concept;
  const q = c.question;
  const adapt = s.lastDecision && s.lastDecision.understanding !== "understood";
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#57534e" }}>
        <span>
          {s.conceptIndex + 1}/{s.total} · {c.title}
        </span>
        <span className="chip">{s.mastery[c.id]?.replace("_", " ")}</span>
      </div>

      {s.lastDecision && (
        <div className={s.lastDecision.understanding === "understood" ? "banner ok" : "banner"}>
          <strong>{s.lastDecision.strategy === "analogy" ? "New strategy: analogy" : `Teacher: ${s.lastDecision.strategy}`}</strong>
          <div>{s.lastDecision.status}</div>
        </div>
      )}

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card teacher">
          <div className="face">👩‍🏫</div>
          <p>
            <strong>Meera</strong>
          </p>
          <p className="muted">Teacher</p>
        </div>
        <div>
          <Visual v={c.visual} />
          <p className="card serif" style={{ marginTop: 12, fontSize: 18, lineHeight: 1.5 }}>
            {s.phase === "remediate" ? c.analogy : c.explanation}
          </p>
          {s.phase === "remediate" && <p className="muted">{c.simple}</p>}
          <p className="muted">{c.citation}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn ghost" onClick={() => speak(s.phase === "remediate" ? c.analogy : c.explanation, s.language)}>
          Play voice
        </button>
        <select value={s.language} onChange={(e) => onLang(e.target.value)}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="hinglish">Hinglish</option>
        </select>
      </div>

      {s.phase === "explain" && (
        <button className="btn primary" style={{ marginTop: 16 }} onClick={onAsk}>
          Ask me a question
        </button>
      )}
      {s.phase === "remediate" && (
        <button className="btn primary" style={{ marginTop: 16 }} onClick={onRecheck}>
          Check if that helped
        </button>
      )}
      {(s.phase === "question" || s.phase === "recheck" || s.phase === "harder") && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="chip">{s.phase === "recheck" ? "New question after adaptation" : "Checkpoint"}</div>
          <p className="serif" style={{ fontSize: 20 }}>
            {q.prompt}
          </p>
          {q.options ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {q.options.map((o) => (
                <label key={o} className="opt">
                  <input type="radio" name="a" checked={answer === o} onChange={() => setAnswer(o)} />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          )}
          {adapt && s.phase === "recheck" && (
            <p className="muted">This is a different question on the same idea — to check if the new explanation worked.</p>
          )}
          <button className="btn primary" style={{ marginTop: 12 }} disabled={!answer} onClick={onSubmit}>
            Submit
          </button>
        </div>
      )}
      {s.phase === "harder" && (
        <button className="btn primary" style={{ marginTop: 16 }} onClick={onAsk}>
          Harder question
        </button>
      )}
      <div className="card" style={{ marginTop: 20 }}>
        <p className="muted">Ask a follow-up about this concept</p>
        <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Question…" />
        <button
          className="btn ghost"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (fq) onAskTeacher(fq);
            setFq("");
          }}
        >
          Ask teacher
        </button>
        {(s.chat || []).map((c, i) => (
          <p key={i} className="muted">
            <strong>You:</strong> {c.q}
            <br />
            <strong>Teacher:</strong> {c.a}
          </p>
        ))}
      </div>
    </>
  );
}

function Assess({ onDone }) {
  return (
    <>
      <h1>Quick assessment</h1>
      <p className="muted">Based on concepts just taught. Continue to generate your report from your class answers.</p>
      <button className="btn primary" onClick={onDone}>
        See learning report
      </button>
    </>
  );
}

function Report({ r, onHome }) {
  return (
    <>
      <p className="chip">Learning report</p>
      <h1>{r.title}</h1>
      <div className="score">{r.score}%</div>
      <div className="card">
        <p>
          <strong>Strong:</strong> {r.mastered.join(", ") || "—"}
        </p>
        <p>
          <strong>Needs practice:</strong> {r.needsWork.join(", ") || "None"}
        </p>
        <p>
          <strong>Misconceptions:</strong> {r.misconceptions.join(", ") || "None"}
        </p>
        <p className="serif">{r.recommendation}</p>
        <p style={{ color: "#1d4ed8" }}>Next: {r.nextTopic}</p>
      </div>
      <button className="btn primary" style={{ marginTop: 16 }} onClick={onHome}>
        Home
      </button>
    </>
  );
}

function History({ rows }) {
  return (
    <>
      <h1>History</h1>
      {!rows.length && <p className="muted">No sessions yet.</p>}
      {rows.map((r) => (
        <div key={r.at} className="card" style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span>{r.title}</span>
          <strong>{r.score}%</strong>
        </div>
      ))}
    </>
  );
}

function Profile({ p }) {
  return (
    <>
      <h1>Profile</h1>
      <div className="card">
        <p>{p.name}</p>
        <p className="muted">
          {p.level} · {p.language} · {p.goal}
        </p>
        <p>Topics: {p.topics.join(", ") || "—"}</p>
      </div>
    </>
  );
}
