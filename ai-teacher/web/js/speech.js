/* AI Guru — speech layer.
   TTS: server synthesis when configured, otherwise the browser's
   Web Speech API (free, multilingual: en-IN, hi-IN, …).
   STT: Web Speech API speech recognition for spoken answers. */
const Speech = (() => {
  let serverTTS = false;
  let audioCtx = null, mediaDest = null;
  let speakingTimer = null;

  function init(cfg) {
    serverTTS = !!cfg.tts;
  }
  function ensureAudioGraph() {
    // must be created after a user gesture
    if (!audioCtx && serverTTS) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        mediaDest = audioCtx.createMediaStreamDestination();
      } catch (e) { audioCtx = null; }
    }
  }
  function recordStream() { ensureAudioGraph(); return mediaDest ? mediaDest.stream : null; }

  function pickVoice(speechLang) {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const pref = [speechLang, speechLang.split("-")[0], "en-IN", "en"];
    for (const p of pref) {
      const v = voices.find(v => (v.lang || "").toLowerCase().startsWith(p.toLowerCase()));
      if (v) return v;
    }
    return null;
  }

  /* speak(text, {langCode, speechLang, rate, persona, onEnergy}) -> Promise
     Drives avatar lip-sync through onEnergy callbacks. */
  async function speak(text, opts) {
    if (!text) return;
    if (serverTTS) {
      const audioBlob = await fetchServer(text, opts.langCode);
      if (audioBlob) return playBlob(audioBlob, opts);
      // fall through to browser TTS if server failed
    }
    return speakBrowser(text, opts);
  }

  async function fetchServer(text, lang) {
    try {
      const r = await fetch("/api/tts?text=" + encodeURIComponent(text.slice(0, 1200)) + "&lang=" + lang);
      if (!r.ok) return null;
      return await r.blob();
    } catch (e) { return null; }
  }

  function playBlob(blob, opts) {
    return new Promise(resolve => {
      ensureAudioGraph();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (audioCtx && mediaDest) {
        try {
          const src = audioCtx.createMediaElementSource(audio);
          src.connect(audioCtx.destination);
          src.connect(mediaDest);       // also feed the lesson recorder
        } catch (e) { /* ignore */ }
      }
      const analyserTimer = setInterval(() => opts.onEnergy && opts.onEnergy(0.25 + Math.random() * 0.6), 110);
      audio.onended = audio.onerror = () => {
        clearInterval(analyserTimer);
        opts.onEnergy && opts.onEnergy(0);
        URL.revokeObjectURL(url); resolve();
      };
      audio.play().catch(() => { clearInterval(analyserTimer); resolve(); });
    });
  }

  async function ensureVoices() {
    if (!("speechSynthesis" in window)) return [];
    let v = speechSynthesis.getVoices();
    if (v && v.length) return v;
    await new Promise(res => {
      let fired = false;
      const done = () => { if (!fired) { fired = true; res(); } };
      try { speechSynthesis.onvoiceschanged = done; } catch (e) {}
      try { speechSynthesis.getVoices(); } catch (e) {}
      setTimeout(done, 1200);
    });
    return speechSynthesis.getVoices() || [];
  }

  async function speakBrowser(text, opts) {
    const voices = await ensureVoices();
    if (!voices.length) {
      // no TTS available (e.g. headless): simulate speech duration
      return flash(text, Math.min(7000, 800 + text.length * 50), opts);
    }
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(opts.speechLang || "en-IN") || voices[0];
      if (v) u.voice = v;
      u.lang = (v && v.lang) || opts.speechLang || "en-IN";
      u.rate = opts.rate || 1.0;
      u.pitch = opts.persona === "prof" ? 0.85 : 1.05;
      let done = false;
      const finish = () => { if (!done) { done = true; stopEnergy(); opts.onEnergy && opts.onEnergy(0); resolve(); } };
      u.onend = () => { clearTimeout(guard); finish(); };
      u.onerror = () => { clearTimeout(guard); finish(); };
      // word-boundary events give true-ish lip sync in Chrome
      u.onboundary = () => opts.onEnergy && opts.onEnergy(0.3 + Math.random() * 0.55);
      startEnergy(opts);
      const guard = setTimeout(finish, Math.min(40000, 3000 + text.length * 110));
      speechSynthesis.speak(u);
    });
  }

  function startEnergy(opts) {
    stopEnergy();
    speakingTimer = setInterval(() => {
      if (window.speechSynthesis && speechSynthesis.speaking)
        opts.onEnergy && opts.onEnergy(0.15 + Math.random() * 0.7);
    }, 130);
  }
  function stopEnergy() { if (speakingTimer) { clearInterval(speakingTimer); speakingTimer = null; } }

  async function flash(text, ms, opts) {   // silent fallback
    const steps = Math.ceil(ms / 140);
    for (let i = 0; i < steps; i++) {
      opts.onEnergy && opts.onEnergy(Math.random());
      await new Promise(r => setTimeout(r, 140));
    }
    opts.onEnergy && opts.onEnergy(0);
  }

  function cancel() {
    try { speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    stopEnergy();
  }

  /* ---- STT (spoken answers) ---- */
  function listen(speechLang, onResult, onEnd) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    try {
      const rec = new SR();
      rec.lang = speechLang || "en-IN";
      rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = e => onResult(e.results[0][0].transcript);
      rec.onend = () => onEnd && onEnd();
      rec.onerror = () => onEnd && onEnd();
      rec.start();
      return rec;
    } catch (e) { return null; }
  }
  function sttSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  return { init, speak, cancel, listen, sttSupported, recordStream };
})();
