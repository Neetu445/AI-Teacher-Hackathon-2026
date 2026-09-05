/* AI Guru — animated teacher avatar (canvas).
   Expressions: explain | ask | happy | think | greet
   Lip-sync: driven by setEnergy(0..1) while TTS speaks. */
class Avatar {
  constructor(persona) {
    this.persona = persona || "priya";
    this.expr = "explain";
    this.speaking = false;
    this.energy = 0;
    this.blinkAt = 0;
    this.blink = 0;
    this.t0 = performance.now();
  }
  setExpression(e) { this.expr = e || "explain"; }
  setSpeaking(on) { this.speaking = on; if (!on) this.energy = 0; }
  setEnergy(v) { this.energy = Math.max(0, Math.min(1, v)); }

  draw(ctx, x, y, w, h) {
    const t = (performance.now() - this.t0) / 1000;
    const F = (px) => `${px}px 'Segoe UI', system-ui, sans-serif`;

    // ---------------- classroom scene
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#eef1fb"); g.addColorStop(1, "#dde4f7");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // chalkboard
    ctx.save();
    ctx.fillStyle = "#1e4a40";
    roundRect(ctx, x + 16, y + 16, w - 32, h * 0.30, 10); ctx.fill();
    ctx.strokeStyle = "#8a6b3f"; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "italic "+ F(15);
    ctx.fillText("V = I × R", x + 40, y + 52);
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 36, y + 60); ctx.lineTo(x + 108, y + 60); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.font = "italic "+ F(13);
    ctx.fillText("learning = fun!", x + w - 150, y + 52);
    // chalk tray
    ctx.fillStyle = "#8a6b3f"; ctx.fillRect(x + 16, y + 16 + h * 0.30 + 4, w - 32, 6);
    ctx.fillStyle = "#eee"; roundRect(ctx, x + 40, y + 16 + h * 0.30 - 2, 26, 8, 3); ctx.fill();
    ctx.fillStyle = "#ffb703"; roundRect(ctx, x + 72, y + 16 + h * 0.30 - 2, 20, 8, 3); ctx.fill();
    ctx.restore();

    // ---------------- character geometry
    const prof = this.persona === "prof";
    const cx = x + w / 2;
    const R = Math.min(w, h) * 0.23;
    const hy = y + h * 0.47;
    const sway = Math.sin(t * 1.05) * R * 0.02;
    const nod = this.expr === "explain" && this.speaking ? Math.sin(t * 3.4) * R * 0.028 : 0;
    const tilt = this.expr === "think" ? 0.11 : this.expr === "ask" ? -0.06 : 0;

    if (t > this.blinkAt) { this.blink = 1; this.blinkAt = t + 2.2 + Math.random() * 3.4; }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - 0.16);

    const skin = prof ? "#eab98e" : "#f4c79e";
    const skinShade = prof ? "#d9a27600" : "#e3ac7d";
    const hair = prof ? "#c7c9d6" : "#2c1a10";
    const cloth = prof ? "#3d4670" : "#7c3fb0";
    const clothDark = prof ? "#323a5e" : "#6a3598";
    const lip = "#bb5a48";

    ctx.save();
    ctx.translate(cx + sway, hy + nod);

    // ---- shadow under shoulders
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.ellipse(0, R * 2.95, R * 1.75, R * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    // ---- shoulders / torso
    ctx.fillStyle = cloth;
    roundRect(ctx, -R * 1.65, R * 1.05, R * 3.3, R * 2.1, R * 0.55); ctx.fill();
    ctx.fillStyle = clothDark;
    roundRect(ctx, -R * 1.65, R * 1.05, R * 0.5, R * 2.1, R * 0.35); ctx.fill(); // side shade
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();                                     // collar V
    ctx.moveTo(-R * 0.42, R * 1.05); ctx.lineTo(0, R * 1.75);
    ctx.lineTo(R * 0.42, R * 1.05); ctx.closePath(); ctx.fill();
    if (!prof) {                                         // dupatta sash
      ctx.strokeStyle = "#ffb703"; ctx.lineWidth = R * 0.16; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-R * 0.6, R * 1.15); ctx.lineTo(R * 0.72, R * 3.0); ctx.stroke();
    } else {                                             // tie
      ctx.fillStyle = "#b3541e";
      ctx.beginPath(); ctx.moveTo(0, R * 1.35); ctx.lineTo(-R * 0.14, R * 1.5);
      ctx.lineTo(0, R * 2.3); ctx.lineTo(R * 0.14, R * 1.5); ctx.closePath(); ctx.fill();
    }

    ctx.rotate(tilt);
    // ---- neck
    ctx.fillStyle = skin;
    roundRect(ctx, -R * 0.2, R * 0.62, R * 0.4, R * 0.5, 6); ctx.fill();
    ctx.fillStyle = "rgba(150,80,40,.28)";
    roundRect(ctx, -R * 0.2, R * 0.62, R * 0.4, R * 0.16, 6); ctx.fill();

    // ---- head
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.05, R * 0.92, R * 1.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = skin; ctx.fill();
    // ears
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * R * 0.92, -R * 0.05, R * 0.13, R * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = skin; ctx.fill();
    }
    // hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    if (prof) {  // short neat parting
      ctx.ellipse(0, -R * 0.72, R * 0.94, R * 0.55, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      for (const s of [-1, 1]) {   // side patches
        ctx.beginPath(); ctx.ellipse(s * R * 0.86, -R * 0.42, R * 0.14, R * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {     // dome + fringe + bun
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.5, R * 1.0, R * 0.92, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      ctx.beginPath();   // bun
      ctx.ellipse(R * 0.88, -R * 0.85, R * 0.28, R * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();   // side strand
      ctx.ellipse(-R * 0.9, -R * 0.35, R * 0.13, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = R * 0.05;  // sheen
      ctx.beginPath(); ctx.ellipse(-R * 0.25, -R * 0.78, R * 0.42, R * 0.3, -0.5, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    }

    // ---- eyes
    const eyeY = -R * 0.18, eyeDX = R * 0.4, eyeR = R * 0.155;
    const look = this.expr === "think" ? R * 0.05 : this.expr === "ask" ? 0 : R * 0.015;
    for (const s of [-1, 1]) {
      const openH = eyeR * 1.05 * (1 - this.blink);
      ctx.beginPath();
      ctx.ellipse(s * eyeDX, eyeY, eyeR * 0.95, Math.max(1.2, openH), 0, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
      if (this.blink < 0.5) {
        ctx.beginPath();
        ctx.arc(s * eyeDX + look, eyeY + R * 0.02, eyeR * 0.52, 0, Math.PI * 2);
        ctx.fillStyle = "#33241b"; ctx.fill();
        ctx.beginPath();   // highlight
        ctx.arc(s * eyeDX + look - eyeR * 0.18, eyeY - R * 0.03, eyeR * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
      } else {
        ctx.strokeStyle = "#33241b"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(s * eyeDX - eyeR, eyeY); ctx.lineTo(s * eyeDX + eyeR, eyeY); ctx.stroke();
      }
      // upper lash line
      ctx.strokeStyle = "rgba(50,30,20,.55)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s * eyeDX, eyeY, eyeR * 0.95, Math.max(1.2, openH), 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
    // eyebrows
    ctx.strokeStyle = hair; ctx.lineWidth = R * 0.06; ctx.lineCap = "round";
    const lift = this.expr === "ask" || this.expr === "greet" ? -R * 0.1
      : this.expr === "happy" ? -R * 0.05 : this.expr === "think" ? R * 0.02 : 0;
    for (const s of [-1, 1]) {
      const innerUp = this.expr === "think" && s > 0 ? R * 0.05 : 0;
      ctx.beginPath();
      ctx.moveTo(s * (eyeDX - eyeR * 1.1), eyeY - eyeR * 1.55 + lift + innerUp);
      ctx.quadraticCurveTo(s * eyeDX, eyeY - eyeR * 2.1 + lift - innerUp,
        s * (eyeDX + eyeR * 1.1), eyeY - eyeR * 1.6 + lift + innerUp);
      ctx.stroke();
    }
    // glasses (prof)
    if (prof) {
      ctx.strokeStyle = "#e8ebf8"; ctx.lineWidth = 2.4;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(s * eyeDX, eyeY, eyeR * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * eyeDX + s * eyeR * 1.5, eyeY - 2);
        ctx.lineTo(s * R * 0.92, eyeY - 4); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-eyeDX + eyeR * 1.5, eyeY); ctx.lineTo(eyeDX - eyeR * 1.5, eyeY); ctx.stroke();
    }
    // nose
    ctx.strokeStyle = "rgba(140,80,45,.5)"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(R * 0.01, eyeY + R * 0.12);
    ctx.quadraticCurveTo(-R * 0.06, eyeY + R * 0.34, R * 0.02, eyeY + R * 0.38); ctx.stroke();
    // blush on happy
    if (this.expr === "happy" || this.expr === "greet") {
      ctx.fillStyle = "rgba(235,120,110,.28)";
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(s * R * 0.55, eyeY + R * 0.42, R * 0.16, R * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- mouth (lip-sync, clamped)
    const mY = R * 0.52;
    const open = Math.min(0.62, this.speaking ? this.energy : 0);
    const smile = this.expr === "happy" ? 1 : this.expr === "greet" ? 0.75
      : this.expr === "think" ? -0.3 : this.expr === "ask" ? 0.35 : 0.25;
    if (open > 0.03) {
      const mW = R * 0.42, mH = R * 0.42 * open + 3;
      ctx.beginPath();
      ctx.ellipse(0, mY, mW, mH, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#87372c"; ctx.fill();
      ctx.strokeStyle = lip; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = "#fff";                                    // teeth
      ctx.beginPath(); ctx.ellipse(0, mY - mH * 0.72, mW * 0.68, mH * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c65b54";                                 // tongue
      ctx.beginPath(); ctx.ellipse(0, mY + mH * 0.62, mW * 0.55, mH * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = lip; ctx.lineWidth = R * 0.055; ctx.lineCap = "round";
      ctx.beginPath();
      const mW = R * 0.34, c = smile * R * 0.18;
      ctx.moveTo(-mW, mY - (smile < 0 ? -c * 0.35 : 0));
      ctx.quadraticCurveTo(0, mY + c, mW, mY - (smile < 0 ? -c * 0.35 : 0));
      ctx.stroke();
    }
    if (!prof) {  // bindi
      ctx.fillStyle = "#c0392b";
      ctx.beginPath(); ctx.arc(0, -R * 0.62, R * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ---- waving hand for greet
    if (this.expr === "greet") {
      const wave = Math.sin(t * 6.5) * 0.45;
      ctx.save();
      ctx.translate(cx + R * 1.55, hy + R * 0.85);
      ctx.rotate(-0.85 + wave);
      ctx.strokeStyle = cloth; ctx.lineWidth = R * 0.26; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, R * 0.7); ctx.lineTo(0, -R * 0.6); ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, -R * 0.8, R * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---- name plate
    const name = prof ? "Prof. Sharma · AI Teacher" : "Priya · AI Teacher";
    ctx.fillStyle = "rgba(79,70,229,.92)";
    roundRect(ctx, cx - w * 0.34, y + h - 42, w * 0.68, 30, 15); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "600 "+ F(13); ctx.textAlign = "center";
    ctx.fillText(name + (this.speaking ? "• speaking" : ""), cx, y + h - 22);
    if (this.speaking) {   // sound bars
      ctx.fillStyle = "#a5b4fc";
      for (let i = 0; i < 3; i++) {
        const hh = 3 + Math.abs(Math.sin(t * 7 + i)) * 9;
        ctx.fillRect(cx + w * 0.68 - 34 + i * 6 - 12, y + h - 22 - hh / 2, 4, hh);
      }
    }
    ctx.textAlign = "left";
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
