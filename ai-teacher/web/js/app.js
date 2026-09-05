/* AI-TEACH — frontend orchestrator: setup → adaptive classroom → report. */
(() => {
 let CFG = null;
 let session = null;
 let avatar = null;
 let currentBeat = null, lastBoard = null;
 let paused = false, sessionEnded = false, awaitingAnswer = false;
 let inputMode = "answer";
 let nextTimer = null, rafId = null;
 let recognition = null;
  let lastReport = null;
  let uploadedDoc = null;
  let recordedOnce = false;
 let minutes = 20;
 let uiLang = "en";

 const $ = id => document.getElementById(id);
 const canvas = $("classCanvas"), ctx = canvas.getContext("2d");
 const T = (k, v) => I18N.t(uiLang, k, v);

 // ------------------------------------------------------------ init
 window.addEventListener("load", async () => {
 const toastEl = document.createElement("div");
 toastEl.id = "toast"; toastEl.className = "toast hidden";
 document.body.appendChild(toastEl);
    try { CFG = await api("/api/config"); } catch (e) {
      CFG = { llm: "offline", languages: [], personas: [] };
      $("startStatus").innerHTML = "Backend se connection nahi ho paya — server chalu karke <b>http://localhost:8000</b> kholo (run: <code>./run.sh</code>). HTML file ko directly mat kholo.";
      $("startStatus").classList.add("warn");
    }
    Speech.init(CFG);
    const badge = $("engineBadge");
    if (badge) {
      badge.textContent = CFG.llm === "connected" ? `LLM: ${CFG.model}` : "Offline pedagogy engine";
      badge.classList.toggle("on", CFG.llm === "connected");
    }
    buildGrades();
    buildSetup();
 bindControls();
 setUiLang("en");
 if ("speechSynthesis" in window) speechSynthesis.getVoices();
 });

 function buildGrades() {
 const sel = $("gradeSelect");
 sel.innerHTML = "";
 for (let g = 1; g <= 12; g++) {
 const o = document.createElement("option");
 o.value = g;
 o.textContent = `${T("grade_class")} ${g}`;
 sel.appendChild(o);
 }
 sel.value = "5";
 }

 function buildSetup() {
 const langSel = $("langSelect");
 if (CFG.languages && CFG.languages.length) {
 langSel.innerHTML = "";
 CFG.languages.forEach(l => {
 const o = document.createElement("option");
 o.value = l.code;
 o.textContent = l.name + (l.offline ? "" : "· needs AI key");
 langSel.appendChild(o);
 });
 }
 langSel.value = "en";
 const note = () => {
 const l = (CFG.languages || []).find(x => x.code === langSel.value);
 const needs = l && !l.offline && CFG.llm !== "connected";
 $("langNote").classList.toggle("hidden", !needs);
 };
 langSel.onchange = () => { note(); setUiLang(["en", "hi"].includes(langSel.value) ? langSel.value : "en"); };
 note();
 if (!Speech.sttSupported()) $("micBtn").style.display = "none";
 }

 function setUiLang(lang) {
 uiLang = lang;
 I18N.apply(lang);
 buildGrades();
 if (inputMode) setMode(inputMode);
 }

 const gradeLevel = g => g <= 8 ? "beginner" : g <= 10 ? "intermediate" : "advanced";

 // ------------------------------------------------------------ setup screen
 function bindControls() {
 document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
 document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
 t.classList.add("active");
 $("tab-upload").classList.toggle("hidden", t.dataset.view !== "upload");
 $("tab-topic").classList.toggle("hidden", t.dataset.view !== "topic");
 });

 const topicChips = { "chip-ohm": "Electricity and Ohm's law", "chip-photo": "Photosynthesis in plants",
 "chip-newton": "Newton's laws of motion", "chip-ml": "Machine learning" };
 Object.entries(topicChips).forEach(([id, topic]) => {
 $(id).onclick = () => {
 $("topicInput").value = topic;
 if (id === "chip-ml") setTime("days:7", document.querySelector('[data-min="days:7"]'));
 };
 });

 document.querySelectorAll("#timeChips button").forEach(c => c.onclick = () => setTime(c.dataset.min, c));

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
 $("switchLang").onclick = switchLanguage;
 $("sendBtn").onclick = sendText;
 $("micBtn").onclick = toggleMic;
 $("modeAnswer").onclick = () => setMode("answer");
 $("modeDoubt").onclick = () => setMode("doubt");
 $("answerInput").addEventListener("keydown", e => {
 if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
 });
 $("drawerBtn").onclick = showProfile;
 $("drawerClose").onclick = () => $("drawer").classList.add("hidden");
 $("newTopicBtn").onclick = () => location.reload();
 $("reviseBtn").onclick = reviseWeak;
 }

 function setTime(v, chip) {
 document.querySelectorAll("#timeChips button").forEach(x => x.classList.remove("active"));
 chip && chip.classList.add("active");
 minutes = v;
 $("timeCustom").classList.toggle("hidden", v !== "custom");
 if (v === "custom") $("timeCustom").focus();
 }
 function resolveMinutes() {
 if (typeof minutes === "string" && minutes.startsWith("days:")) return parseInt(minutes.split(":")[1]) * 1440;
 if (minutes !== "custom") return parseInt(minutes);
 const txt = $("timeCustom").value.toLowerCase().trim() || "20";
 const d = txt.match(/(\d+)\s*day/); if (d) return parseInt(d[1]) * 1440;
 const m = txt.match(/(\d+)/); return m ? Math.max(1, parseInt(m[1])) : 20;
 }

 async function upload() {
 const f = $("fileInput").files[0];
 if (!f) return;
 $("startStatus").textContent = T("st_reading");
 const fd = new FormData(); fd.append("file", f);
 try {
 const r = await fetch("/api/upload", { method: "POST", body: fd });
 const data = await r.json();
 if (!r.ok) throw new Error(data.detail || "upload failed");
 uploadedDoc = data;
 $("docInfo").classList.remove("hidden");
 $("docInfo").querySelector(".doc-name").textContent =
 `${data.title} · ${(data.chars / 1000).toFixed(1)}k chars · ${data.outline.length} sections`;
 const sel = $("sectionSelect"); sel.innerHTML = "";
 const all = document.createElement("option"); all.value = ""; all.textContent = T("doc_whole"); sel.appendChild(all);
 data.outline.forEach(h => { const o = document.createElement("option"); o.value = h; o.textContent = h; sel.appendChild(o); });
 $("startStatus").textContent = T("st_ready");
 } catch (e) {
 $("startStatus").textContent = "" + e.message;
 uploadedDoc = null;
 }
 }

 // ------------------------------------------------------------ session start
 async function startSession() {
 const topic = $("topicInput").value.trim();
 const inUploadTab = document.querySelector('.tab[data-view="upload"]').classList.contains("active");
 if (inUploadTab && !uploadedDoc) { toast(T("err_doc")); return; }
 if (!inUploadTab && !topic) { toast(T("err_topic")); return; }
 Speech.init(CFG);
 $("startBtn").disabled = true;
 $("startStatus").textContent = T("st_plan");
 try {
 const grade = parseInt($("gradeSelect").value);
 const payload = {
 level: gradeLevel(grade), grade: grade, subject: $("subjectSelect").value,
 language: $("langSelect").value, minutes: resolveMinutes(), style: $("styleSelect").value,
 persona: $("personaSelect").value, student_name: $("nameInput").value.trim() || null,
 };
 if (inUploadTab) { payload.doc_id = uploadedDoc.doc_id; payload.section = $("sectionSelect").value || null; }
 else payload.topic = topic;
 const r = await api("/api/sessions", "POST", payload);
 enterClassroom(r);
 } catch (e) {
 $("startStatus").textContent = "" + e.message;
 } finally {
 $("startBtn").disabled = false;
 }
 }

 function showView(name) {
 ["landing", "class", "report"].forEach(v => $(`view-${v}`).classList.toggle("active", v === name));
 }

 function enterClassroom(startResp) {
 session = startResp;
 sessionEnded = false; paused = false; awaitingAnswer = false; lastReport = null;
 showView("class");
 $("chatLog").innerHTML = "";
 $("mcqBar").innerHTML = ""; $("mcqBar").classList.add("hidden");
 hideAdapt();
 const persona = startResp.plan.persona || $("personaSelect").value;
 avatar = new Avatar(persona);
 currentBeat = null; lastBoard = null;
 const p = startResp.plan;
 $("boardTitle").textContent = p.title;
    session._lang = p.language;
    setUiLang(["en", "hi"].includes(p.language) ? p.language : "en");
    if (p.language_note) setTimeout(() => toast(p.language_note), 800);
    logMsg("sys", `${p.title} · ${p.mode === "study_plan" ? p.days + "-day study plan" : p.segments + " concepts + " + p.quiz + "-question quiz"} · ${p.grounded ? "grounded in your material" : p.engine + " engine"}`);
 startRenderLoop();
 playBeat(startResp.first_beat);
 }

 // ------------------------------------------------------------ adaptive banner
 function showAdapt(label) {
 const b = $("adaptBanner");
 b.classList.remove("hidden", "success");
 $("adaptNotice").innerHTML = "" + T("b_notice") + (label ? `<b>${escapeHtml(label)}</b>` : "");
 b.querySelector(".ab-approach").classList.remove("hidden");
 $("adaptRetest").classList.remove("hidden");
 }
 function adaptSuccess() {
 const b = $("adaptBanner");
 b.classList.remove("hidden"); b.classList.add("success");
 $("adaptNotice").textContent = T("b_success");
 b.querySelector(".ab-approach").classList.add("hidden");
 $("adaptRetest").classList.add("hidden");
 setTimeout(() => hideAdapt(), 5000);
 }
 function hideAdapt() { $("adaptBanner").classList.add("hidden"); $("adaptBanner").classList.remove("success"); }

 // ------------------------------------------------------------ beat loop
 async function playBeat(beat) {
 if (!beat || sessionEnded) return;
 currentBeat = beat;
 if (beat.board) lastBoard = beat.board;
 if (beat.avatar && avatar) avatar.setExpression(beat.avatar);
 updateProgress(beat.progress);

 // adaptive banner driven by engine tags
 const tag = beat.tag || (beat.board && beat.board.tag);
 if (tag === "misconception" || tag === "reteach") showAdapt(beat.misconception_label || (beat.board && beat.board.misconception_label));
 else if (tag === "retest_intro" || tag === "retest") { /* keep banner visible for the retest question */ }
 else if (tag === "improved") adaptSuccess();
 else if (tag === "praise") hideAdapt();

 if (beat.type === "question" || (beat.can_answer && beat.q)) {
 awaitingAnswer = true;
 if (!tag) hideAdapt();
 renderMcq(beat.board && beat.board.options ? beat.board.options : null);
 setInputHint(T("hint_turn"));
 } else {
 renderMcq(null);
 }
 if (beat.say) {
 logMsg("teacher", beat.say);
 await speakBeat(beat);
 }
 if (sessionEnded) return;
 if (awaitingAnswer) return;
 if (beat.type === "report") { fetchReport(); }
 if (beat.type === "done") { return finishLesson(); }
 scheduleNext(450);
 }

 function setInputHint(t) { $("inputHint").textContent = t; }

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
 try {
 await Speech.speak(beat.say, {
 langCode: langCode, speechLang: speechLangOf(langCode),
 rate: 1.0, persona: (session.plan && session.plan.persona) || "priya",
 onEnergy: v => avatar && avatar.setEnergy(v),
 });
 } catch (e) { /* TTS failure never breaks text flow */ }
 avatar.setSpeaking(false);
 }
 function currentLang() { return (session && (session._lang || session.plan.language)) || "en"; }
 function speechLangOf(code) {
 const l = (CFG.languages || []).find(x => x.code === code);
 return l ? l.speech : "en-IN";
 }

 // ------------------------------------------------------------ answers & doubts
 function setMode(m) {
 inputMode = m;
 $("modeAnswer").classList.toggle("active", m === "answer");
 $("modeDoubt").classList.toggle("active", m === "doubt");
 $("answerInput").placeholder = T(m === "answer" ? "ph_answer" : "ph_doubt");
 }

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
 awaitingAnswer = false;
 renderMcq(null);
 setInputHint(T("hint_checking"));
 try {
 const verdict = await api(`/api/sessions/${session.session_id}/answer`, "POST", { answer: text });
 const vmap = {
 correct: "v_correct", improved: "v_improved", partial: "v_partial",
 incorrect_reteach: "v_reteach", incorrect_move_on: "v_move",
 };
 logMsg("sys", T(vmap[verdict.verdict] || "v_partial") + (verdict.misconception ? "— "+ verdict.misconception : ""));
 if (verdict.verdict === "improved") adaptSuccess();
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
 $("pauseBtn").textContent = T(paused ? "ctl_resume" : "ctl_pause");
 if (paused) { Speech.cancel(); avatar && avatar.setSpeaking(false); clearTimeout(nextTimer); }
 else if (currentBeat) { playBeat(currentBeat); }
 }
 function replayBeat() { if (currentBeat && !paused) { clearTimeout(nextTimer); playBeat(currentBeat); } }

 async function switchLanguage() {
 const next = currentLang() === "hi" ? "en" : "hi";
 try {
 const r = await api(`/api/sessions/${session.session_id}/language`, "POST", { language: next });
 session._lang = next;
 setUiLang(next);
 toast(r.fully_supported ? (next === "hi" ? "अब हिन्दी में" : "Switched to English") :
 (next === "hi" ? "हिन्दी सामग्री सीमित है — मुख्य रूप से अंग्रेज़ी जारी" : "Will continue mostly in previous language"));
 scheduleNext(300);
 } catch (e) { toast(e.message); }
 }

 function downloadBlob(blob) {
 const a = document.createElement("a");
 a.href = URL.createObjectURL(blob);
 a.download = "ai-teach-lesson.webm";
 a.click();
 }

 async function toggleRecord() {
 if (LessonRecorder.isRecording()) {
 const blob = await LessonRecorder.stop();
 $("recordBtn").classList.remove("on"); $("recordBtn").textContent = T("ctl_record");
 if (blob) { downloadBlob(blob); toast(" Lesson video downloaded!"); }
 return;
 }
    if (LessonRecorder.start(canvas)) {
      recordedOnce = true;
      $("recordBtn").classList.add("on"); $("recordBtn").textContent = T("ctl_stoprec");
 toast("Recording the class — press Stop to save the video");
 } else toast("Recording isn't supported in this browser");
 }

 function toggleMic() {
 if (recognition) { try { recognition.stop(); } catch (e) {} recognition = null; return; }
 recognition = Speech.listen(speechLangOf(currentLang()),
 text => { $("answerInput").value = text; sendText(); },
 () => { $("micBtn").classList.remove("listening"); recognition = null; });
 if (recognition) $("micBtn").classList.add("listening");
 else toast("Speech input isn't supported in this browser — type instead");
 }

 async function endLesson() { await finishLesson(); }

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
 showView("report");
 if (!rep) { $("repTitle").textContent = "Lesson ended — no answers were recorded."; return; }
 $("repTitle").textContent = rep.title;

 const stats = [];
 if (rep.score != null) stats.push(`<div class="stat score"><b>${rep.score}%</b><span>${T("mastery")}</span></div>`);
 if (rep.questions_attempted != null) stats.push(`<div class="stat"><b>${rep.questions_attempted}</b><span>${T("attempted_w")}</span></div>`);
 if (rep.answers_correct != null) stats.push(`<div class="stat"><b>${rep.answers_correct}</b><span>${T("correct_w")}</span></div>`);
 if (rep.retest_improvements != null) stats.push(`<div class="stat hi"><b>${rep.retest_improvements}</b><span>${T("improved_w")}</span></div>`);
 $("repStats").innerHTML = stats.join("");

 const journey = rep.adaptive_actions || [];
 $("repJourneySec").style.display = journey.length ? "" : "none";
 $("repJourney").innerHTML = journey.map(a => {
 const omap = { improved: ["o_improved", "ok"], scheduled_for_revision: ["o_revision", "warn"],
 retest_pending: ["o_pending", "warn"], partial: ["o_partial", "warn"] };
 const [ok, cls] = omap[a.outcome] || ["o_pending", "warn"];
 return `<div class="j-row">
 <div class="j-before"><span class="j-tag bad"> ${escapeHtml(a.misconception || "")}</span><small>${escapeHtml(a.concept)}</small></div>
 <div class="j-arrow">→ ${T("j_arrow")} →</div>
 <div class="j-after ${cls}">${T(ok)}</div>
 </div>`;
 }).join("");

 $("repMastery").innerHTML = (rep.per_concept || []).map(c => `
 <div class="bar-row"><span>${escapeHtml(c.concept)}</span>
 <div class="bar-track"><div class="bar-fill ${c.mastery >= .7 ? "good" : c.mastery >= .4 ? "" : "bad"}" style="width:${Math.round(c.mastery * 100)}%"></div></div><span class="muted tiny">${Math.round(c.mastery * 100)}%</span></div>`).join("") || "<p class='muted'>–</p>";
 $("repRecs").innerHTML = (rep.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join("");

 $("repPath").innerHTML = (rep.path && rep.path.length)
 ? `<ol class="path">${rep.path.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ol>` : "<p class='muted'>–</p>";

 const block = (label, items, cls) => items && items.length
 ? `<h4>${label}</h4><div class="chipbox">${items.map(i => `<span class="${cls}">${escapeHtml(i)}</span>`).join("")}</div>` : "";
 const mis = (rep.misconceptions || []).map(m => `${m.label} (${m.concept})`);
 $("repTopics").innerHTML =
 block(T("lbl_strong"), rep.strong, "good") +
 block(T("lbl_weak"), rep.weak, "bad") +
 block(T("lbl_mis"), mis, "warn") +
 block(T("lbl_next"), rep.next_topics, "");

    session._lastSetup = { topic: rep.title };
    if (!recordedOnce) setTimeout(() => toast(T("rep_tip_record")), 900);
  }

 async function reviseWeak() {
 if (!lastReport || !lastReport.weak.length) { toast("No weak topics — you're clear to learn something new!"); return; }
 const r = await api("/api/sessions", "POST", {
 topic: "Revise: "+ lastReport.weak.join(", "),
 level: lastReport.level, language: lastReport.language,
 minutes: 10, style: "conceptual", persona: (session.plan && session.plan.persona) || "priya",
 });
 enterClassroom(r);
 }

 // ------------------------------------------------------------ profile drawer
 async function showProfile() {
 $("drawer").classList.remove("hidden");
 let p = { sessions: [], mastery: [] };
 try { p = await api("/api/profile"); } catch (e) {}
 const hist = (p.sessions || []).slice(-10).reverse();
 $("drawerBody").innerHTML = `
 <h4>Sessions (${(p.sessions || []).length})</h4>
 ${hist.length ? `<table class="prof-hist">${hist.map(s =>
 `<tr><td>${s.date}</td><td>${escapeHtml(s.title)}</td><td>${s.score == null ? "–" : s.score + "%"}</td></tr>`).join("")}</table>`
 : "<p class='muted'>No lessons yet — start your first class!</p>"}
 <h4 style="margin-top:18px">Concept mastery over time</h4>
 ${(p.mastery && p.mastery.length) ? p.mastery.map(m => `
 <div class="bar-row" style="grid-template-columns:150px 1fr 46px"><span class="tiny">${escapeHtml(m.concept)}</span>
 <div class="bar-track"><div class="bar-fill" style="width:${m.mastery * 100}%"></div></div><span class="muted tiny">${Math.round(m.mastery * 100)}%</span></div>`).join("")
 : "<p class='muted'>Answer questions in class to build your mastery map.</p>"}`;
 }

 // ------------------------------------------------------------ canvas render loop (light theme)
 function startRenderLoop() {
 cancelAnimationFrame(rafId);
 const loop = () => { renderFrame(); rafId = requestAnimationFrame(loop); };
 rafId = requestAnimationFrame(loop);
 }

 function renderFrame() {
 ctx.fillStyle = "#f7f5ef"; ctx.fillRect(0, 0, 1280, 720);
 const t = performance.now() / 1000;
 if (avatar) avatar.draw(ctx, 14, 14, 350, 556);
 Whiteboard.draw(ctx, { x: 378, y: 14, w: 888, h: 556 }, lastBoard, t);
 drawSubtitle();
 }

 function drawSubtitle() {
 ctx.fillStyle = "rgba(255,255,255,.94)";
 roundRect(ctx, 14, 584, 1252, 122, 16); ctx.fill();
 ctx.strokeStyle = "rgba(99,102,241,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
 const say = currentBeat && currentBeat.say ? currentBeat.say : (awaitingAnswer ? "" : "…");
 ctx.fillStyle = "#4f46e5"; ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
 ctx.fillText(avatar ? (avatar.persona === "prof" ? "Prof. Sharma" : "Priya") : "Teacher", 34, 612);
 ctx.fillStyle = "#1e293b"; ctx.font = "19px 'Segoe UI', system-ui, sans-serif";
 const maxW = 1210;
 let lines = wrapCanvasText(ctx, say, maxW);
 if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] += "…"; }
 lines.forEach((l, i) => ctx.fillText(l, 34, 642 + i * 26));
 if (awaitingAnswer) {
 ctx.fillStyle = "rgba(217,119,6,.95)"; ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(currentLang() === "hi" ? "आपकी बारी" : "Your turn", 1090, 612);
 }
 }

 function wrapCanvasText(ctx, text, maxW) {
 const words = String(text || "").split(/\s+/), out = [];
 let line = "";
 for (const w of words) {
 const test = line ? line + "" + w : w;
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
 if (p.stage === "segment" && p.n) { frac = (p.si + 1) / (p.n + (p.qn ? 1 : 0)); label = T("prog_concept", { a: Math.min(p.si + 1, p.n), b: p.n }); }
 else if (p.stage === "quiz" && p.qn) { frac = (p.n + Math.max(0, p.qi)) / (p.n + 1); label = T("prog_quiz", { a: Math.max(1, p.qi + 1), b: p.qn }); }
 else if (p.stage === "report") { frac = 1; label = T("prog_report"); }
 else if (p.stage === "study" || p.stage === "done_pending") { frac = 0.9; label = T("prog_study"); }
 if (label) { $("progressFill").style.width = Math.round(frac * 100) + "%"; $("stageLabel").textContent = label; }
 }

 function logMsg(who, text) {
 const div = document.createElement("div");
 div.className = "msg "+ who;
 if (who === "teacher") div.innerHTML = `<span class="who">${T("who_teacher")}</span>${linkify(escapeHtml(text))}`;
 else if (who === "student") div.innerHTML = `<span class="who">${T("who_you")}</span>${escapeHtml(text)}`;
 else div.textContent = text;
 const log = $("chatLog");
 log.appendChild(div);
 log.scrollTop = log.scrollHeight;
 while (log.children.length > 120) log.removeChild(log.firstChild);
 }

 function linkify(s) { return s.replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">video</a>'); }

 function toast(msg) {
 const el = $("toast");
 if (!el) return;
 el.textContent = msg;
 el.classList.remove("hidden");
 clearTimeout(el._t);
 el._t = setTimeout(() => el.classList.add("hidden"), 3600);
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
 if (!r.ok) throw new Error(data.detail || ("Error "+ r.status));
 return data;
 }
})();
