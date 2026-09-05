/* AI Guru — frontend orchestrator: setup → classroom loop → report. */
(() => {
  // ------------------------------------------------------------ state
  let CFG = null;
  let session = null;            // {id, plan}
  let avatar = null;
  let currentBeat = null, lastBoard = null;
  let paused = false, sessionEnded = false, awaitingAnswer = false;
  let inputMode = "answer";      // answer | doubt
  let nextTimer = null, rafId = null;
  let recognition = null;
  let lastReport = null;
  let uploadedDoc = null;
  let minutes = 5;

  const $ = id => document.getElementById(id);
  const canvas = $("classCanvas"), ctx = canvas.getContext("2d");

  // ------------------------------------------------------------ init
  window.addEventListener("load", async () => {
    CFG = await api("/api/config");
    Speech.init(CFG);
    buildSetup();
    bindControls();
    if ("speechSynthesis" in window) speechSynthesis.getVoices();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
  });

  function buildSetup() {
    const badge = $("engineBadge");
    badge.textContent = CFG.llm === "connected" ? `🧠 ${CFG.model}` : "🧠 offline pedagogy engine";
    badge.classList.toggle("on", CFG.llm === "connected");

    const langSel = $("langSelect");
    CFG.languages.forEach(l => {
      const o = document.createElement("option");
      o.value = l.code;
      o.textContent = l.name + (l.offline ? "" : " · needs AI key");
      langSel.appendChild(o);
    });
    langSel.value = "en";
    const note = () => {
      const l = CFG.languages.find(x => x.code === langSel.value);
      $("langNote").textContent = (l && !l.offline && CFG.llm !== "connected")
        ? "This language needs an OPENAI_API_KEY — offline supports English, Hindi, Hinglish."
        : "";
    };
    langSel.onchange = note; note();

    const per = $("personaSelect");
    CFG.personas.forEach(p => {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = `${p.name}${p.id === "prof" ? " (formal)" : " (warm & friendly)"}`;
      per.appendChild(o);
    });

    const sw = $("switchLang");
    CFG.languages.forEach(l => {
      const o = document.createElement("option"); o.value = l.code; o.textContent = "🌐 " + l.name;
      sw.appendChild(o);
    });

    if (!Speech.sttSupported()) { $("micBtn").style.display = "none"; }
  }

  // ------------------------------------------------------------ setup screen
  function bindControls() {
    document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      $("tab-" + t.dataset.tab).classList.add("active");
    });

    document.querySelectorAll(".chip[data-topic]").forEach(c => c.onclick = () => {
      $("topicInput").value = c.dataset.topic;
      if (c.dataset.topic.toLowerCase().includes("machine learning")) setTime(10080);
    });

    document.querySelectorAll(".chip.time").forEach(c => c.onclick = () => setTime(
      c.dataset.min === "custom" ? "custom" : parseInt(c.dataset.min), c));

    const dz = $("dropzone"), fi = $("fileInput");
    dz.onclick = () => fi.click();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add("over"); };
    dz.ondragleave = () => dz.classList.remove("over");
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove("over"); fi.files = e.dataTransfer.files; upload(); };
    fi.onchange = upload;

    $("startBtn").onclick = startSession;
    $("pauseBtn").onclick = togglePause;
    $("replayBtn").onclick = replayBeat;
    $("recordBtn").onclick = toggleRecord;
    $("endBtn").onclick = endLesson;
    $("switchLang").onchange = switchLanguage;
    $("sendBtn").onclick = sendText;
    $("micBtn").onclick = toggleMic;
    $("modeAnswer").onclick = () => setMode("answer");
    $("modeDoubt").onclick = () => setMode("doubt");
    $("answerInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
    });
    $("profileBtn").onclick = showProfile;
    $("closeDrawer").onclick = () => $("profileDrawer").classList.add("hidden");
    $("againBtn").onclick = () => location.reload();
    $("reviseBtn").onclick = reviseWeak;
  }

  function setTime(v, chip) {
    document.querySelectorAll(".chip.time").forEach(x => x.classList.remove("active"));
    chip && chip.classList.add("active");
    minutes = v;
    $("customTime").classList.toggle("hidden", v !== "custom");
    if (v === "custom") $("customTime").focus();
  }
  function resolveMinutes() {
    if (minutes !== "custom") return minutes;
    const txt = $("customTime").value.toLowerCase().trim() || "20";
    const d = txt.match(/(\d+)\s*day/); if (d) return parseInt(d[1]) * 1440;
    const m = txt.match(/(\d+)/); return m ? Math.max(1, parseInt(m[1])) : 20;
  }

  async function upload() {
    const f = $("fileInput").files[0];
    if (!f) return;
    $("startStatus").textContent = "Reading your material…";
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "upload failed");
      uploadedDoc = data;
      $("docInfo").classList.remove("hidden");
      $("docTitle").textContent = data.title;
      $("docMeta").textContent = `${data.filename} · ${(data.chars / 1000).toFixed(1)}k chars · ${data.outline.length} sections found`;
      const sel = $("sectionSelect"); sel.innerHTML = "";
      const all = document.createElement("option"); all.value = ""; all.textContent = "Whole document"; sel.appendChild(all);
      data.outline.forEach(h => { const o = document.createElement("option"); o.value = h; o.textContent = h; sel.appendChild(o); });
      $("startStatus").textContent = "Material understood ✓ — now set preferences and start.";
    } catch (e) {
      $("startStatus").textContent = "⚠ " + e.message;
      uploadedDoc = null;
    }
  }

  // ------------------------------------------------------------ session start
  async function startSession() {
    const topic = $("topicInput").value.trim();
    const inUploadTab = $("tab-upload").classList.contains("active");
    if (inUploadTab && !uploadedDoc) { toast("Upload a document first (or switch to the topic tab)"); return; }
    if (!inUploadTab && !topic) { toast("Tell me what you want to learn"); return; }
    Speech.init(CFG);  // also unlocks audio ctx on this gesture
    $("startBtn").disabled = true;
    $("startStatus").textContent = "Your teacher is planning the lesson…";
    try {
      const payload = {
        level: $("levelSelect").value, language: $("langSelect").value,
        minutes: resolveMinutes(), style: $("styleSelect").value,
        persona: $("personaSelect").value, student_name: $("nameInput").value.trim() || null,
      };
      if (inUploadTab) { payload.doc_id = uploadedDoc.doc_id; payload.section = $("sectionSelect").value || null; }
      else payload.topic = topic;
      const r = await api("/api/sessions", "POST", payload);
      enterClassroom(r);
    } catch (e) {
      $("startStatus").textContent = "⚠ " + e.message;
    } finally {
      $("startBtn").disabled = false;
    }
  }

  function enterClassroom(startResp) {
    session = startResp;
    sessionEnded = false; paused = false; awaitingAnswer = false; lastReport = null;
    $("view-setup").classList.add("hidden");
    $("view-report").classList.add("hidden");
    $("view-class").classList.remove("hidden");
    $("chatLog").innerHTML = "";
    $("mcqBar").innerHTML = ""; $("mcqBar").classList.add("hidden");
    avatar = new Avatar($("personaSelect").value);
    currentBeat = null; lastBoard = null;
    const p = startResp.plan;
    try { $("switchLang").value = p.language; } catch (e) {}
    session._lang = p.language;
    logMsg("sys", `Lesson: ${p.title} · ${p.mode === "study_plan" ? p.days + "-day study plan" : p.segments + " concepts + " + p.quiz + "-question quiz"} · ${p.grounded ? "grounded in your material" : p.engine + " engine"}`);
    startRenderLoop();
    playBeat(startResp.first_beat);
  }

  // ------------------------------------------------------------ beat loop
  async function playBeat(beat) {
    if (!beat || sessionEnded) return;
    currentBeat = beat;
    if (beat.board) { lastBoard = beat.board; }
    if (beat.avatar && avatar) avatar.setExpression(beat.avatar);
    updateProgress(beat.progress);

    if (beat.type === "question" || (beat.can_answer && beat.q)) {
      awaitingAnswer = true;
      setInputEnabled(true);
      renderMcq(beat.board && beat.board.options ? beat.board.options : null);
      $("inputHint").textContent = "Your turn! Answer to continue — or switch to “Ask a doubt”.";
    } else {
      renderMcq(null);
    }
    if (beat.say) {
      logMsg("teacher", beat.say);
      await speakBeat(beat);
    }
    if (sessionEnded) return;
    if (awaitingAnswer) return;                       // wait for the student
    if (beat.type === "report") { fetchReport(); }
    if (beat.type === "done") { return finishLesson(); }
    scheduleNext(450);
  }

  function scheduleNext(ms) {
    clearTimeout(nextTimer);
    nextTimer = setTimeout(async () => {
      if (paused || sessionEnded || awaitingAnswer) return;
      try {
        const beat = await api(`/api/sessions/${session.session_id}/next`, "POST", {});
        playBeat(beat);
      } catch (e) { toast(e.message); }
    }, ms);
  }

  async function speakBeat(beat) {
    if (paused) return;
    avatar.setSpeaking(true);
    const langCode = currentLang();
    await Speech.speak(beat.say, {
      langCode: langCode, speechLang: speechLangOf(langCode),
      rate: 1.0, persona: $("personaSelect").value,
      onEnergy: v => avatar && avatar.setEnergy(v),
    });
    avatar.setSpeaking(false);
  }
  function currentLang() { return (session && (session._lang || session.plan.language)) || "en"; }
  function speechLangOf(code) {
    const l = CFG.languages.find(x => x.code === code);
    return l ? l.speech : "en-IN";
  }

  // ------------------------------------------------------------ answers & doubts
  function setMode(m) {
    inputMode = m;
    $("modeAnswer").classList.toggle("active", m === "answer");
    $("modeDoubt").classList.toggle("active", m === "doubt");
    $("answerInput").placeholder = m === "answer"
      ? "Type your answer… (or press 🎤 and speak)"
      : "Ask the teacher anything about the lesson…";
  }

  function setInputEnabled(on) { $("sendBtn").style.opacity = 1; }

  async function sendText() {
    const text = $("answerInput").value.trim();
    if (!text || !session) return;
    $("answerInput").value = "";
    logMsg("student", text);
    if (inputMode === "doubt" || !awaitingAnswer) {
      try {
        await api(`/api/sessions/${session.session_id}/ask`, "POST", { question: text });
        scheduleNext(200);
      } catch (e) { toast(e.message); }
      return;
    }
    // it's a real answer
    awaitingAnswer = false;
    renderMcq(null);
    $("inputHint").textContent = "The teacher is checking your answer…";
    try {
      const verdict = await api(`/api/sessions/${session.session_id}/answer`, "POST", { answer: text });
      const vmap = { correct: ["✅ Correct!", "good"], partial: ["🟡 Partly right", "warn"],
                     incorrect_reteach: ["🔁 Missed it — the teacher is re-explaining", "bad"],
                     incorrect_move_on: ["📝 Noted for revision", "warn"] };
      const v = vmap[verdict.verdict] || ["…", "warn"];
      logMsg("sys", v[0] + (verdict.misconception ? " — misconception spotted: " + verdict.misconception : ""));
    } catch (e) { toast(e.message); }
    scheduleNext(300);
  }

  function renderMcq(options) {
    const bar = $("mcqBar");
    bar.innerHTML = "";
    if (!options) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    const L = ["A", "B", "C", "D"];
    options.slice(0, 4).forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "mcq-opt";
      b.innerHTML = `<b>${L[i]}</b> ${escapeHtml(String(opt))}`;
      b.onclick = () => {
        if (!awaitingAnswer) return;
        document.querySelectorAll(".mcq-opt").forEach(x => x.classList.remove("picked"));
        b.classList.add("picked");
        $("answerInput").value = `Option ${L[i]}`;
        sendText();
      };
      bar.appendChild(b);
    });
  }

  // ------------------------------------------------------------ controls
  function togglePause() {
    paused = !paused;
    $("pauseBtn").textContent = paused ? "▶ Resume" : "⏸ Pause";
    if (paused) { Speech.cancel(); avatar && avatar.setSpeaking(false); clearTimeout(nextTimer); }
    else if (currentBeat) { playBeat(currentBeat); }
  }
  function replayBeat() { if (currentBeat && !paused) { clearTimeout(nextTimer); playBeat(currentBeat); } }

  async function switchLanguage() {
    const code = $("switchLang").value;
    try {
      const r = await api(`/api/sessions/${session.session_id}/language`, "POST", { language: code });
      session._lang = code;
      toast(r.fully_supported ? `Switched to ${code == "hi" ? "Hindi" : code}` :
        "Will continue mostly in previous language (limited offline content)");
      scheduleNext(300);
    } catch (e) { toast(e.message); }
  }

  function downloadBlob(blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ai-guru-lesson.webm";
    a.click();
  }

  async function toggleRecord() {
    if (LessonRecorder.isRecording()) {
      const blob = await LessonRecorder.stop();
      $("recordBtn").classList.remove("on"); $("recordBtn").textContent = "⏺ Record";
      $("recStatus").textContent = "";
      if (blob) { downloadBlob(blob); toast("🎥 Lesson video downloaded!"); }
      return;
    }
    if (LessonRecorder.start(canvas)) {
      $("recordBtn").classList.add("on"); $("recordBtn").textContent = "⏹ Stop";
      $("recStatus").textContent = "recording…";
      toast("Recording the class — press Stop to save the video");
    } else toast("Recording isn't supported in this browser");
  }

  function toggleMic() {
    if (recognition) { try { recognition.stop(); } catch (e) {} recognition = null; return; }
    recognition = Speech.listen(speechLangOf(currentLang()),
      text => { $("answerInput").value = text; sendText(); },
      () => { $("micBtn").classList.remove("listening"); recognition = null; });
    if (recognition) { $("micBtn").classList.add("listening"); }
    else toast("Speech input isn't supported in this browser — type instead");
  }

  async function endLesson() {
    if (!confirm("End the lesson and get your learning report?")) return;
    await finishLesson();
  }

  async function fetchReport() {
    if (lastReport || !session) return;
    try { lastReport = await api(`/api/sessions/${session.session_id}/report`); } catch (e) {}
  }

  async function finishLesson() {
    sessionEnded = true;
    clearTimeout(nextTimer);
    Speech.cancel();
    if (LessonRecorder.isRecording()) { const b = await LessonRecorder.stop(); if (b) downloadBlob(b); }
    await fetchReport();
    renderReport(lastReport);
  }

  // ------------------------------------------------------------ report view
  function renderReport(rep) {
    $("view-class").classList.add("hidden");
    $("view-report").classList.remove("hidden");
    if (!rep) { $("repTitle").textContent = "Lesson ended — no answers were recorded."; return; }
    $("repTitle").textContent = "Report: " + rep.title;
    const ring = $("scoreRing"), num = $("scoreNum");
    if (rep.score != null) {
      setTimeout(() => { ring.style.strokeDashoffset = 327 * (1 - rep.score / 100); }, 80);
      ring.style.stroke = rep.score >= 70 ? "var(--good)" : rep.score >= 40 ? "var(--accent)" : "var(--bad)";
      num.textContent = rep.score + "%";
    } else { num.textContent = "✓"; }
    chips($("repStrong"), rep.strong, "good");
    chips($("repWeak"), rep.weak, "bad");
    $("repMis").innerHTML = (rep.misconceptions || []).map(m =>
      `<div>“${escapeHtml(m.label)}” <span class="muted">(${escapeHtml(m.concept)})</span></div>`).join("") || "<span class='muted'>None — clean understanding!</span>";
    chips($("repNext"), rep.next_topics, "");
    $("repBars").innerHTML = (rep.per_concept || []).map(c => `
      <div class="bar-row"><span>${escapeHtml(c.concept)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c.mastery * 100)}%"></div></div>
      <span class="muted tiny">${Math.round(c.mastery * 100)}%</span></div>`).join("");
    $("repRecs").innerHTML = (rep.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join("");
    if (rep.path && rep.path.length) {
      $("repPathWrap").classList.remove("hidden");
      $("repPath").innerHTML = rep.path.map(p => `<li>${escapeHtml(p)}</li>`).join("");
    }
    session._lastSetup = { topic: rep.title };
  }

  async function reviseWeak() {
    if (!lastReport || !lastReport.weak.length) { toast("No weak topics — you're clear to learn something new!"); return; }
    const r = await api("/api/sessions", "POST", {
      topic: "Revise: " + lastReport.weak.join(", "),
      level: lastReport.level, language: lastReport.language === "hinglish" ? "hinglish" : lastReport.language,
      minutes: 10, style: "conceptual", persona: $("personaSelect").value,
    });
    enterClassroom(r);
  }

  // ------------------------------------------------------------ profile drawer
  async function showProfile() {
    $("profileDrawer").classList.remove("hidden");
    const p = await api("/api/profile");
    const hist = (p.sessions || []).slice(-10).reverse();
    $("profileBody").innerHTML = `
      <h4>Sessions (${(p.sessions || []).length})</h4>
      ${hist.length ? `<table class="prof-hist">${hist.map(s =>
        `<tr><td>${s.date}</td><td>${escapeHtml(s.title)}</td><td>${s.score == null ? "–" : s.score + "%"}</td></tr>`).join("")}</table>`
        : "<p class='muted'>No lessons yet — start your first class!</p>"}
      <h4 style="margin-top:18px">Concept mastery over time</h4>
      ${(p.mastery && p.mastery.length) ? p.mastery.map(m => `
        <div class="bar-row" style="grid-template-columns:150px 1fr 46px">
          <span class="tiny">${escapeHtml(m.concept)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${m.mastery * 100}%"></div></div>
          <span class="muted tiny">${Math.round(m.mastery * 100)}%</span></div>`).join("")
        : "<p class='muted'>Answer questions in class to build your mastery map.</p>"}`;
  }

  // ------------------------------------------------------------ canvas render loop
  function startRenderLoop() {
    cancelAnimationFrame(rafId);
    const loop = () => {
      renderFrame();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function renderFrame() {
    ctx.fillStyle = "#0a0f1e"; ctx.fillRect(0, 0, 1280, 720);
    const t = performance.now() / 1000;
    if (avatar) avatar.draw(ctx, 14, 14, 350, 556);
    Whiteboard.draw(ctx, { x: 378, y: 14, w: 888, h: 556 }, lastBoard, t);
    drawSubtitle();
  }

  function drawSubtitle() {
    ctx.fillStyle = "rgba(10,15,30,.88)";
    roundRect(ctx, 14, 584, 1252, 122, 16); ctx.fill();
    ctx.strokeStyle = "rgba(120,150,220,.25)"; ctx.lineWidth = 1.5; ctx.stroke();
    const say = currentBeat && currentBeat.say ? currentBeat.say :
      (awaitingAnswer ? "" : "…");
    ctx.fillStyle = "#ffd566"; ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(avatar ? (avatar.persona === "prof" ? "Prof. Sharma" : "Priya") : "Teacher", 34, 612);
    ctx.fillStyle = "#eef2ff"; ctx.font = "19px 'Segoe UI', system-ui, sans-serif";
    const maxW = 1210;
    let lines = wrapCanvasText(ctx, say, maxW);
    if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] += " …"; }
    lines.forEach((l, i) => ctx.fillText(l, 34, 642 + i * 26));
    if (awaitingAnswer) {
      ctx.fillStyle = "rgba(255,183,3,.9)"; ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("● waiting for your answer", 1090, 612);
    }
  }

  function wrapCanvasText(ctx, text, maxW) {
    const words = String(text || "").split(/\s+/), out = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    }
    if (line) out.push(line);
    return out;
  }

  // ------------------------------------------------------------ misc UI
  function updateProgress(p) {
    if (!p) return;
    let frac = 0, label = "";
    if (p.stage === "segment" && p.n) { frac = (p.si + 1) / (p.n + (p.qn ? 1 : 0)); label = `Concept ${Math.min(p.si + 1, p.n)} of ${p.n}`; }
    else if (p.stage === "quiz" && p.qn) { frac = (p.n + Math.max(0, p.qi)) / (p.n + 1); label = `Quiz ${Math.max(1, p.qi + 1)} of ${p.qn}`; }
    else if (p.stage === "report") { frac = 1; label = "Report"; }
    else if (p.stage === "study" || p.stage === "done_pending") { frac = 0.9; label = "Study plan walkthrough"; }
    if (label) { $("progressFill").style.width = Math.round(frac * 100) + "%"; $("stageLabel").textContent = label; }
  }

  function logMsg(who, text) {
    const div = document.createElement("div");
    div.className = "msg " + who;
    if (who === "teacher") div.innerHTML = `<span class="who">🎓 Teacher</span>${escapeHtml(text)}`;
    else if (who === "student") div.innerHTML = `<span class="who">🧑 You</span>${escapeHtml(text)}`;
    else div.textContent = text;
    const log = $("chatLog");
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 120) log.removeChild(log.firstChild);
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 3600);
  }

  function chips(el, items, cls) {
    el.innerHTML = (items && items.length)
      ? items.map(i => `<span class="${cls}">${escapeHtml(i)}</span>`).join("")
      : "<span class='muted tiny'>None — great job!</span>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function api(path, method = "GET", body) {
    const r = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || ("Error " + r.status));
    return data;
  }
})();
