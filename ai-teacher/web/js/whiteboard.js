/* AI Guru — whiteboard renderer: turns the tutor's visual spec into
   subject-aware diagrams on the classroom canvas. */
const Whiteboard = (() => {

  function draw(ctx, rect, board, t) {
    const { x, y, w, h } = rect;
    // board background
    ctx.fillStyle = "#f5f0e1";                       // old-paper whiteboard
    roundRect(ctx, x, y, w, h, 16); ctx.fill();
    ctx.strokeStyle = "#c9bf9e"; ctx.lineWidth = 2; ctx.stroke();

    if (!board || !board.kind || board.kind === "none") { watermark(ctx, rect); return; }
    if (board._born === undefined) board._born = t;   // reveal animation clock
    const p = Math.min(1, (t - board._born) / 1.4);   // 1.4s reveal

    ctx.fillStyle = "#1d2b53"; ctx.strokeStyle = "#1d2b53";

    switch (board.kind) {
      case "title":        return drawTitle(ctx, rect, board, p);
      case "bullets":      return drawBullets(ctx, rect, board, p);
      case "equation_steps": return drawSteps(ctx, rect, board, p);
      case "circuit":      return drawCircuit(ctx, rect, board, t, p);
      case "triangle":     return drawTriangle(ctx, rect, board, p);
      case "graph":        return drawGraph(ctx, rect, board, p);
      case "flow":         return drawFlow(ctx, rect, board, p);
      case "timeline":     return drawTimeline(ctx, rect, board, p);
      case "code":         return drawCode(ctx, rect, board, p);
      case "question":     return drawQuestion(ctx, rect, board, p);
      case "verdict":      return drawVerdict(ctx, rect, board, p);
      case "plan_day":     return drawPlanDay(ctx, rect, board, p);
      case "path_overview": return drawPath(ctx, rect, board, p);
      case "report":       return drawReportMini(ctx, rect, board, p);
      default:             return drawBullets(ctx, rect, { kind: "bullets", title: board.title || "", items: board.items || [] }, p);
    }
  }

  // ------------------------------------------------ helpers
  function wrap(ctx, text, maxW, maxLines = 6) {
    const words = String(text).split(/\s+/), lines = [];
    let line = "";
    for (const wd of words) {
      const test = line ? line + " " + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }
  function heading(ctx, rect, text) {
    ctx.fillStyle = "#14315c";
    ctx.font = "700 26px 'Segoe UI', sans-serif";
    const lines = wrap(ctx, text || "", rect.w - 60);
    lines.forEach((l, i) => ctx.fillText(l, rect.x + 30, rect.y + 46 + i * 30));
    ctx.strokeStyle = "#f4a300"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(rect.x + 30, rect.y + 58 + (lines.length - 1) * 30);
    ctx.lineTo(rect.x + 30 + Math.min(320, ctx.measureText(lines[0] || "").width), rect.y + 58 + (lines.length - 1) * 30);
    ctx.stroke();
    return rect.y + 74 + (lines.length - 1) * 30;
  }
  function watermark(ctx, rect) {
    ctx.fillStyle = "rgba(29,43,83,.28)";
    ctx.font = "700 42px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🎓 AI Guru", rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    ctx.font = "16px 'Segoe UI', system-ui, sans-serif"; ctx.fillText("your personal classroom", rect.x + rect.w / 2, rect.y + rect.h / 2 + 24);
    ctx.textAlign = "left";
  }
  function ease(p) { return p * (2 - p); }

  // ------------------------------------------------ kinds
  function drawTitle(ctx, rect, b, p) {
    ctx.textAlign = "center";
    ctx.globalAlpha = ease(p);
    ctx.fillStyle = "#14315c"; ctx.font = "800 40px 'Segoe UI', system-ui, sans-serif";
    const lines = wrap(ctx, b.title || "", rect.w - 80);
    lines.forEach((l, i) => ctx.fillText(l, rect.x + rect.w / 2, rect.y + rect.h / 2 - 20 + i * 46));
    ctx.fillStyle = "#b3541e"; ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    if (b.subtitle) ctx.fillText("with " + b.subtitle, rect.x + rect.w / 2, rect.y + rect.h / 2 + 42 + (lines.length - 1) * 46);
    ctx.font = "60px serif"; ctx.fillText("🎓", rect.x + rect.w / 2, rect.y + rect.h / 2 - 88);
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }

  function drawBullets(ctx, rect, b, p) {
    let y = heading(ctx, rect, b.title) + 6;
    const items = b.items || [];
    const single = items.length === 1;              // analogy / doubt card
    ctx.font = (single ? "20px" : "19px") + " 'Segoe UI', system-ui, sans-serif";
    const show = Math.ceil(items.length * ease(p));
    if (single) {
      ctx.fillStyle = "#fff9e8"; ctx.strokeStyle = "#f4a300"; ctx.lineWidth = 3;
      roundRect(ctx, rect.x + 30, y - 12, rect.w - 60, rect.h - (y - rect.y) - 60, 14);
      ctx.fill(); ctx.stroke();
      y += 18;
      ctx.fillStyle = "#f4a300"; ctx.beginPath(); ctx.arc(rect.x + 58, y - 4, 7, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < show; i++) {
      const it = items[i];
      if (!single) {
        ctx.fillStyle = "#f4a300";
        ctx.beginPath(); ctx.arc(rect.x + 42, y - 6, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#233a66";
      const xoff = single ? 74 : 62;
      for (const l of wrap(ctx, it, rect.w - 150, single ? 10 : 6)) { ctx.fillText(l, rect.x + xoff, y); y += single ? 30 : 26; }
      y += single ? 4 : 10;
    }
    if (b.note && p > 0.8) {
      ctx.font = "italic 17px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = "#8a5a00";
      ctx.fillText("💡 " + b.note, rect.x + 30, rect.y + rect.h - 24);
    }
  }

  function drawSteps(ctx, rect, b, p) {
    let y = heading(ctx, rect, b.title);
    const steps = b.steps || [];
    const active = Math.min(steps.length - 1, Math.floor(ease(p) * steps.length));
    steps.forEach((s, i) => {
      const isA = i === active;
      const bw = rect.w - 80;
      ctx.fillStyle = isA ? "#fff3d1" : "#efe9d3";
      ctx.strokeStyle = isA ? "#f4a300" : "#cfc39f"; ctx.lineWidth = isA ? 3 : 1.5;
      roundRect(ctx, rect.x + 40, y - 8, bw, 56, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isA ? "#8a5a00" : "#5a6a92"; ctx.font = "700 16px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("STEP " + (i + 1), rect.x + 54, y + 13);
      ctx.fillStyle = "#1d2b53"; ctx.font = "600 20px 'Cascadia Code', 'Segoe UI', monospace";
      wrap(ctx, s, bw - 70).slice(0, 2).forEach((l, j) => ctx.fillText(l, rect.x + 54, y + 36 + j * 22));
      y += 66;
      if (i < steps.length - 1) {
        ctx.fillStyle = "#b3541e"; ctx.font = "20px serif"; ctx.fillText("▼", rect.x + rect.w / 2, y - 4);
        y += 14;
      }
    });
  }

  function drawCircuit(ctx, rect, b, t, p) {
    heading(ctx, rect, b.title);
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h * 0.56;
    const W = rect.w * 0.62, H = rect.h * 0.44;
    const x0 = cx - W / 2, x1 = cx + W / 2, y0 = cy - H / 2, y1 = cy + H / 2;

    // ---- wires
    ctx.strokeStyle = "#1d2b53"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0);            // top
    ctx.moveTo(x1, y0); ctx.lineTo(x1, cy - H * 0.26); // right down to resistor
    ctx.moveTo(x1, cy + H * 0.26); ctx.lineTo(x1, y1); // right from resistor
    ctx.moveTo(x1, y1); ctx.lineTo(x0, y1);            // bottom
    ctx.moveTo(x0, y1); ctx.lineTo(x0, cy + 10);       // left up to battery
    ctx.moveTo(x0, cy - 10); ctx.lineTo(x0, y0);       // left from battery
    ctx.stroke();
    // corner nodes
    ctx.fillStyle = "#1d2b53";
    for (const [nx, ny] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
      ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();
    }
    // ---- battery (left edge)
    ctx.fillStyle = "#1d2b53";
    ctx.fillRect(x0 - 16, cy - 12, 32, 5);    // long plate (+)
    ctx.fillRect(x0 - 7, cy + 8, 14, 5);      // short plate (−)
    ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#b3541e";
    ctx.fillText("+", x0 - 34, cy - 16);
    ctx.fillText("−", x0 - 34, cy + 24);
    ctx.font = "700 17px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(b.battery || "Battery", x0 - 40, cy + H / 4 + 22);
    // ---- resistor zigzag (right edge)
    ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 4;
    ctx.beginPath();
    const zTop = cy - H * 0.26, zBot = cy + H * 0.26, seg = (zBot - zTop) / 6;
    ctx.moveTo(x1, zTop);
    for (let i = 1; i <= 6; i++) ctx.lineTo(x1 + (i % 2 ? 14 : -14), zTop + seg * i - seg / 2);
    ctx.lineTo(x1, zBot);
    ctx.stroke();
    ctx.fillStyle = "#8a5a00"; ctx.font = "700 18px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(b.resistor || "R", x1 + 26, cy + 6);
    // ---- bulb on top wire
    ctx.fillStyle = "#fff3d1"; ctx.strokeStyle = "#1d2b53"; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx, y0, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 13, y0 - 13); ctx.lineTo(cx + 13, y0 + 13);
    ctx.moveTo(cx + 13, y0 - 13); ctx.lineTo(cx - 13, y0 + 13); ctx.stroke();
    // glow
    ctx.strokeStyle = "rgba(244,163,0,.75)"; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 4 - i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 26, y0 + Math.sin(a) * 26);
      ctx.lineTo(cx + Math.cos(a) * 34, y0 + Math.sin(a) * 34); ctx.stroke();
    }
    // ---- animated conventional current
    ctx.strokeStyle = "#e63946"; ctx.lineWidth = 2.6;
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -((t * 70) % 44);
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath();
    ctx.stroke(); ctx.setLineDash([]);
    // travelling arrowhead on the loop
    const per = 2 * (W + H), d = ((t * 90) % per);
    let px, py, ang;
    if (d < W)           { px = x0 + d;      py = y0; ang = 0; }
    else if (d < W + H)  { px = x1; py = y0 + (d - W); ang = Math.PI / 2; }
    else if (d < 2*W + H){ px = x1 - (d - W - H); py = y1; ang = Math.PI; }
    else                 { px = x0; py = y1 - (d - 2*W - H); ang = -Math.PI / 2; }
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = "#e63946";
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = "italic 600 16px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = "#e63946";
    ctx.fillText("current", cx + 40, y0 - 12);
    // ---- note / formula chip
    if (b.note) {
      ctx.fillStyle = "#14315c"; ctx.font = "600 18px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(b.note, rect.x + 30, rect.y + rect.h - 24);
    }
  }

  function drawTriangle(ctx, rect, b, p) {
    heading(ctx, rect, b.title);
    const cx = rect.x + rect.w / 2 - rect.w * 0.14, cy = rect.y + rect.h * 0.52;
    const s = Math.min(rect.w, rect.h) * (0.5 * ease(p));
    ctx.fillStyle = "#fff3d1"; ctx.strokeStyle = "#f4a300"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.62); ctx.lineTo(cx - s * 0.62, cy + s * 0.42);
    ctx.lineTo(cx + s * 0.62, cy + s * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
    // divider
    ctx.strokeStyle = "#f4a300"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - s * 0.34, cy + s * 0.05); ctx.lineTo(cx + s * 0.34, cy + s * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.05); ctx.lineTo(cx, cy + s * 0.42); ctx.stroke();
    ctx.fillStyle = "#14315c"; ctx.font = "800 30px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(b.top || "V", cx, cy - s * 0.16);
    ctx.fillText(b.left || "I", cx - s * 0.3, cy + s * 0.32);
    ctx.fillText("×", cx, cy + s * 0.32);
    ctx.fillText(b.right || "R", cx + s * 0.3, cy + s * 0.32);
    ctx.textAlign = "left";
    // rule cards
    let y = rect.y + 96;
    (b.steps || []).forEach((st, i) => {
      ctx.fillStyle = "#efe9d3"; ctx.strokeStyle = "#cfc39f";
      roundRect(ctx, rect.x + rect.w * 0.68, y, rect.w * 0.27, 44, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1d2b53"; ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(st, rect.x + rect.w * 0.68 + 14, y + 29); y += 54;
    });
    if (b.note) { ctx.fillStyle = "#b3541e"; ctx.font = "italic 17px 'Segoe UI', system-ui, sans-serif"; ctx.fillText("💡 " + b.note, rect.x + 30, rect.y + rect.h - 22); }
  }

  function drawGraph(ctx, rect, b, p) {
    heading(ctx, rect, b.title);
    const gx = rect.x + 80, gy = rect.y + rect.h - 90, gw = rect.w - 160, gh = rect.h - 200;
    // axes
    ctx.strokeStyle = "#1d2b53"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.stroke();
    arrow(ctx, gx + gw, gy, 0); arrow(ctx, gx, gy - gh, -Math.PI / 2);
    ctx.fillStyle = "#1d2b53"; ctx.font = "16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(b.xlabel || "x", gx + gw - 60, gy + 26);
    ctx.save(); ctx.translate(gx - 26, gy - gh + 60); ctx.rotate(-Math.PI / 2);
    ctx.fillText(b.ylabel || "y", 0, 0); ctx.restore();
    // line through origin
    const prog = ease(p);
    ctx.strokeStyle = "#e63946"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(gx, gy);
    ctx.lineTo(gx + gw * 0.85 * prog, gy - gh * 0.75 * prog); ctx.stroke();
    // slope annotation
    if (b.slope && p > 0.6) {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 2;
      const x1 = gx + gw * .55, y1 = gy - gh * .485;
      ctx.beginPath(); ctx.moveTo(x1, gy); ctx.lineTo(x1, y1); ctx.lineTo(x1 + 24, y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#8a5a00"; ctx.font = "700 17px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(b.slope, x1 + 34, y1 + 6);
    }
    if (b.note) { ctx.fillStyle = "#14315c"; ctx.font = "600 17px 'Segoe UI', system-ui, sans-serif"; ctx.fillText(b.note, rect.x + 30, rect.y + rect.h - 22); }
  }
  function arrow(ctx, x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, -6); ctx.moveTo(0, 0); ctx.lineTo(-9, 6);
    ctx.stroke(); ctx.restore();
  }

  function drawFlow(ctx, rect, b, p) {
    let y = heading(ctx, rect, b.title) + 6;
    const steps = b.steps || [];
    const bw = rect.w * 0.62, bx = rect.x + (rect.w - bw) / 2;
    steps.forEach((s, i) => {
      const on = i / steps.length <= ease(p);
      ctx.globalAlpha = on ? 1 : 0.18;
      ctx.fillStyle = i % 2 ? "#e4ecf7" : "#fff3d1";
      ctx.strokeStyle = i % 2 ? "#5a7fb5" : "#f4a300"; ctx.lineWidth = 2.5;
      const hh = Math.min(54, (rect.y + rect.h - y - 30) / (steps.length - i) - 14);
      roundRect(ctx, bx, y, bw, hh, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1d2b53"; ctx.font = "600 17px 'Segoe UI', system-ui, sans-serif";
      const lines = wrap(ctx, s, bw - 30);
      lines.forEach((l, j) => ctx.fillText(l, bx + 16, y + 22 + j * 20));
      y += hh + 6;
      if (i < steps.length - 1) { ctx.fillStyle = "#b3541e"; ctx.font = "18px serif"; ctx.fillText("▼", bx + bw / 2 - 6, y + 10); y += 16; }
      ctx.globalAlpha = 1;
    });
  }

  function drawTimeline(ctx, rect, b, p) {
    heading(ctx, rect, b.title);
    const ev = (b.events || []).slice(0, 6);
    const x0 = rect.x + 60, x1 = rect.x + rect.w - 60, cy = rect.y + rect.h * 0.55;
    ctx.strokeStyle = "#1d2b53"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + (x1 - x0) * ease(p), cy); ctx.stroke();
    ev.forEach((e, i) => {
      const ex = x0 + ((x1 - x0) * (ev.length === 1 ? 0.5 : i / (ev.length - 1)));
      const up = i % 2 === 0;
      ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.arc(ex, cy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#e63946"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex, cy); ctx.lineTo(ex, cy + (up ? -52 : 52)); ctx.stroke();
      ctx.fillStyle = "#14315c"; ctx.font = "800 19px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(e.year, ex, cy + (up ? -64 : 78));
      ctx.font = "14px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = "#40507a";
      wrap(ctx, e.label, 130).forEach((l, j) => ctx.fillText(l, ex, cy + (up ? -84 - j * 17 + 17 : 96 + j * 17)));
      ctx.textAlign = "left";
    });
  }

  function drawCode(ctx, rect, b, p) {
    heading(ctx, rect, b.title);
    ctx.fillStyle = "#10182e";
    roundRect(ctx, rect.x + 30, rect.y + 96, rect.w - 60, rect.h - 130, 12); ctx.fill();
    ctx.fillStyle = "#2a355a";
    roundRect(ctx, rect.x + 30, rect.y + 96, rect.w - 60, 34, 12); ctx.fill();
    ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.arc(rect.x + 52, rect.y + 113, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffb703"; ctx.beginPath(); ctx.arc(rect.x + 72, rect.y + 113, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#2ec4b6"; ctx.beginPath(); ctx.arc(rect.x + 92, rect.y + 113, 6, 0, 7); ctx.fill();
    const lines = String(b.code || "").split("\n").slice(0, 12);
    const show = Math.ceil(lines.length * ease(p));
    ctx.font = "16px 'Cascadia Code', Consolas, monospace";
    lines.slice(0, show).forEach((l, i) => {
      ctx.fillStyle = "#5a6a92"; ctx.fillText(String(i + 1).padStart(2, " "), rect.x + 44, rect.y + 156 + i * 24);
      ctx.fillStyle = "#a8e6a3";
      ctx.fillText(l.replace(/\t/g, "  ").slice(0, 64), rect.x + 80, rect.y + 156 + i * 24);
    });
  }

  function drawQuestion(ctx, rect, b, p) {
    // playful question card
    ctx.fillStyle = "#14315c"; ctx.font = "800 22px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("🤔 " + (b.label || "Think about it"), rect.x + 30, rect.y + 44);
    ctx.fillStyle = "#fff9e8"; ctx.strokeStyle = "#f4a300"; ctx.lineWidth = 3;
    roundRect(ctx, rect.x + 30, rect.y + 66, rect.w - 60, rect.h * 0.34, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1d2b53"; ctx.font = "600 21px 'Segoe UI', system-ui, sans-serif";
    let y = rect.y + 100;
    for (const l of wrap(ctx, b.question || "", rect.w - 110)) { ctx.fillText(l, rect.x + 50, y); y += 27; }
    if (b.options) {
      ctx.font = "19px 'Segoe UI', system-ui, sans-serif";
      const L = ["A", "B", "C", "D"];
      b.options.slice(0, 4).forEach((o, i) => {
        const oy = rect.y + rect.h * 0.52 + i * 44;
        ctx.fillStyle = "#efe9d3"; ctx.strokeStyle = "#cfc39f"; ctx.lineWidth = 1.5;
        roundRect(ctx, rect.x + 40, oy, rect.w - 80, 38, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#b3541e"; ctx.font = "800 18px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(L[i], rect.x + 56, oy + 26);
        ctx.fillStyle = "#1d2b53"; ctx.font = "19px 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(String(o).slice(0, 60), rect.x + 90, oy + 26);
      });
      ctx.fillStyle = "#5a6a92"; ctx.font = "italic 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("Click an option below — or just type / speak your answer.", rect.x + 40, rect.y + rect.h - 18);
    } else {
      ctx.fillStyle = "#5a6a92"; ctx.font = "italic 16px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("Answer in your own words — type or press 🎤 and speak.", rect.x + 40, rect.y + rect.h - 18);
    }
  }

  function drawVerdict(ctx, rect, b, p) {
    ctx.textAlign = "center";
    const ok = b.ok;
    const emoji = ok === true ? "✅" : ok === false ? "🧐" : "📌";
    const col = ok === true ? "#1b8a5a" : ok === false ? "#b3541e" : "#14315c";
    const head = ok === true ? "Correct!" : ok === false ? "Let's fix this" : "Remember";
    ctx.globalAlpha = ease(p);
    ctx.font = "66px serif";
    ctx.fillText(emoji, rect.x + rect.w / 2, rect.y + rect.h * 0.34);
    ctx.fillStyle = col; ctx.font = "800 32px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(head, rect.x + rect.w / 2, rect.y + rect.h * 0.46);
    ctx.font = "18px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = "#40507a";
    const msg = b.answer ? "Answer: " + b.answer : (b.label ? "Misconception: " + b.label : "");
    wrap(ctx, msg, rect.w * 0.55 ).slice(0, 3).forEach((l, i) =>
      ctx.fillText(l, rect.x + rect.w / 2, rect.y + rect.h * 0.56 + i * 24));
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }

  function drawPlanDay(ctx, rect, b, p) {
    ctx.textAlign = "center"; ctx.globalAlpha = ease(p);
    ctx.fillStyle = "#f4a300"; ctx.font = "800 64px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("DAY " + b.day, rect.x + rect.w / 2, rect.y + 92);
    ctx.fillStyle = "#14315c"; ctx.font = "700 23px 'Segoe UI', system-ui, sans-serif";
    wrap(ctx, b.focus || "", rect.w - 100).forEach((l, i) => ctx.fillText(l, rect.x + rect.w / 2, rect.y + 132 + i * 27));
    ctx.textAlign = "left";
    let y = rect.y + 200;
    (b.tasks || []).forEach(task => {
      ctx.fillStyle = "#efe9d3"; ctx.strokeStyle = "#cfc39f";
      roundRect(ctx, rect.x + 50, y, rect.w - 100, 42, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1b8a5a"; ctx.font = "700 18px 'Segoe UI', system-ui, sans-serif"; ctx.fillText("☐", rect.x + 64, y + 28);
      ctx.fillStyle = "#1d2b53"; ctx.font = "17px 'Segoe UI', system-ui, sans-serif";
      wrap(ctx, task, rect.w - 150).slice(0, 1).forEach(l => ctx.fillText(l, rect.x + 96, y + 28));
      y += 52;
    });
    if (b.revision) {
      ctx.fillStyle = "#8a5a00"; ctx.font = "italic 16px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("🔁 " + b.revision, rect.x + 50, rect.y + rect.h - 24);
    }
    ctx.globalAlpha = 1;
  }

  function drawPath(ctx, rect, b, p) {
    let y = heading(ctx, rect, b.title || "Your learning path");
    (b.items || []).slice(0, 8).forEach((it, i) => {
      if (i / 8 > ease(p)) return;
      ctx.fillStyle = "#1b8a5a"; ctx.beginPath(); ctx.arc(rect.x + 46, y - 6, 11, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 13px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(i + 1, rect.x + 46, y - 2); ctx.textAlign = "left";
      ctx.fillStyle = "#233a66"; ctx.font = "19px 'Segoe UI', system-ui, sans-serif";
      wrap(ctx, it, rect.w - 120).slice(0, 2).forEach(l => { ctx.fillText(l, rect.x + 70, y); y += 25; });
      y += 12;
    });
  }

  function drawReportMini(ctx, rect, b, p) {
    const rep = b.report || {};
    ctx.textAlign = "center";
    ctx.fillStyle = "#14315c"; ctx.font = "800 30px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("📋 Lesson report", rect.x + rect.w / 2, rect.y + 54);
    if (rep.score != null) {
      const cx = rect.x + rect.w / 2 - 130, cy = rect.y + 150, r = 46;
      ctx.strokeStyle = "#d8d0b4"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = rep.score >= 70 ? "#1b8a5a" : rep.score >= 40 ? "#f4a300" : "#e63946";
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (rep.score / 100) * ease(p)); ctx.stroke();
      ctx.fillStyle = "#14315c"; ctx.font = "800 26px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(Math.round(rep.score * ease(p)) + "%", cx, cy + 9);
    }
    ctx.textAlign = "left";
    ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = "#1b8a5a";
    ctx.fillText("Strong: " + ((rep.strong || []).join(", ") || "—"), rect.x + rect.w / 2 - 30, rect.y + 130);
    ctx.fillStyle = "#b3541e";
    ctx.fillText("Revise: " + ((rep.weak || []).join(", ") || "—"), rect.x + rect.w / 2 - 30, rect.y + 160);
    ctx.fillStyle = "#40507a"; ctx.font = "16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Full report is on the right — great work today! 🎉", rect.x + 40, rect.y + rect.h - 26);
    ctx.textAlign = "left";
  }

  return { draw };
})();
