/* AI Guru — lesson video recorder.
   Captures the live classroom canvas (avatar + whiteboard + captions)
   into a downloadable .webm video. When server TTS is configured the
   teacher's voice is included as an audio track; with browser-native
   TTS the browser doesn't allow capturing its audio, so the export is
   video + on-screen captions (a recorded-on-screen subtitle track). */
const LessonRecorder = (() => {
  let recorder = null, chunks = [], stream = null;

  function start(canvas) {
    if (recorder) return false;
    try {
      stream = canvas.captureStream(30);
      const audio = Speech.recordStream && Speech.recordStream();
      if (audio) audio.getAudioTracks().forEach(tr => stream.addTrack(tr));
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.start(1000);
      return true;
    } catch (e) { recorder = null; return false; }
  }

  function stop() {
    return new Promise(resolve => {
      if (!recorder) return resolve(null);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        recorder = null; chunks = [];
        stream && stream.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      recorder.stop();
    });
  }

  function isRecording() { return !!recorder; }

  return { start, stop, isRecording };
})();
