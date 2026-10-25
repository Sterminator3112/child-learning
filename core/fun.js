/* Fun: the silly bits every game can share.
     Fun.pops()          comic words ("BONK!") and sparkles drawn on a canvas: { pop, burst, draw, clear }
     Fun.sfx.name()      little sounds made by the browser: pop, boing, bonk, zap, whoosh, ding, tada, nope,
                         splat, chomp, coin, crash, honk, wah, waka, beep, splash,
                         oink, cluck, thunk, oof
     Fun.face(ctx, ...)  a cartoon face with blinking eyes that look around, and a mouth for the mood
     Fun.soundButton(el) a 🔊/🔇 button put just before el (all the games share the one setting)
     Fun.shake(el)       wobbles an element, for a crash or a hit
     Fun.hint(stage)     a tip that pops up at the top of a game for a few seconds: { show(text, ms), hide() }
     Fun.quality()       "high" or "low": the graphics setting (Auto switches to low by itself when a game runs slowly)
     Fun.res(cssW, W, max) the pixel scale a canvas should use, lower on low quality
     Fun.stickKeys(stick, keys, map) feeds that joystick into a game's key table
     Fun.joystick(stage) a thumb joystick in the bottom-left corner, on phones and tablets only:
                         { x, y, on, reset() }, x right and y down, each -1 to 1
   And the plumbing every game screen repeats:
     Fun.dt(now, last, max) seconds since the last frame, never below 0 or above max (default 1/30)
     Fun.fit(canvas, W, H, scale, max) resizes a canvas drawn at W x H to the pixel scale Fun.res picks and
                         returns that scale (unchanged unless it moved), so: scale = Fun.fit(canvas, W, H, scale, 2)
     Fun.screen(overlay, on) shows or hides a game's full-screen overlay and stops the page scrolling behind it
     Fun.release(keys)   lets go of every key in a key table (on blur, or when a game starts)
     Fun.holdButtons(buttons, keys, attr) on-screen buttons that hold keys[button.dataset[attr]] while pressed
     Fun.animate(step)   a scene that draws step(dt) every frame while it's open: { open(), close() }
                         (the 3D scenes above the Learning questions), dt in seconds, at most 0.05
     Fun.shade(hex, f)   a #rrggbb colour with every channel multiplied by f (darker below 1, lighter above)
   Sounds are on unless Hub.store.sound is false. */
(function(){
  "use strict";
  const store = Hub.store;

  /* ---------------- comic words and sparkles ---------------- */
  function pops(){
    const words = [], bits = [];
    return {
      // a word that pops in, wobbles and floats up; size is in canvas pixels
      pop(s, x, y, colour, size){ words.push({ s, x, y, colour: colour || "#ffd84d", size: size || 30, t: 0, rot: (Math.random() - 0.5) * 0.35 }); },
      burst(x, y, colour, n, speed, gravity){
        for (let i = 0; i < (n || 14); i++) {
          const a = Math.random() * 6.283, v = (speed || 120) * (0.4 + Math.random() * 0.8);
          bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.5 + Math.random() * 0.4, colour, g: gravity === undefined ? 160 : gravity });
        }
      },
      clear(){ words.length = 0; bits.length = 0; },
      draw(ctx, dt){
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.g * dt;
          if (b.t > b.life) { bits.splice(i, 1); continue; }
          ctx.globalAlpha = 1 - b.t / b.life; ctx.fillStyle = b.colour;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 8); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
        }
        ctx.globalAlpha = 1;
        for (let i = words.length - 1; i >= 0; i--) {
          const p = words[i]; p.t += dt;
          if (p.t > 1.3) { words.splice(i, 1); continue; }
          const s = p.t < 0.12 ? p.t / 0.12 * 1.25 : p.t < 0.24 ? 1.25 - (p.t - 0.12) / 0.12 * 0.25 : 1;
          ctx.globalAlpha = p.t > 0.9 ? Math.max(0, 1 - (p.t - 0.9) / 0.4) : 1;
          ctx.save(); ctx.translate(p.x, p.y - p.t * 22); ctx.rotate(p.rot); ctx.scale(s, s);
          ctx.font = `900 ${p.size}px "Bricolage Grotesque", system-ui, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
          ctx.lineWidth = p.size * 0.2; ctx.strokeStyle = "#1a1030"; ctx.strokeText(p.s, 0, 0);
          ctx.fillStyle = p.colour; ctx.fillText(p.s, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ---------------- sounds ---------------- */
  let ac = null;
  function audio(){
    if (store.sound === false) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function blip(f0, f1, dur, vol, type, delay){
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (delay || 0);
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, delay){
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + (delay || 0);
    src.buffer = buf; f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t); src.stop(t + dur);
  }
  // sounds can't all play at once: the same one at most every 60 ms
  const lastAt = {};
  let wakaHigh = false;
  const limit = (name, fn) => () => { const now = performance.now(); if (now - (lastAt[name] || 0) < 60) return; lastAt[name] = now; fn(); };
  const sfx = {
    pop: () => blip(500, 1300, 0.07, 0.18),
    boing: () => { blip(160, 520, 0.12, 0.18); blip(520, 260, 0.15, 0.13, "sine", 0.12); },
    bonk: () => { blip(180, 60, 0.18, 0.28, "triangle"); noise(0.08, 0.15, 800, 300); },
    zap: () => blip(1400, 300, 0.14, 0.1, "square"),
    whoosh: () => noise(0.3, 0.2, 400, 2400),
    ding: () => { blip(1320, 1320, 0.25, 0.1); blip(1760, 1760, 0.3, 0.08, "sine", 0.08); },
    tada: () => [523, 659, 784, 1047].forEach((n, i) => blip(n, n, 0.14, 0.09, "square", i * 0.08)),
    nope: () => { blip(320, 300, 0.07, 0.09, "square"); blip(240, 220, 0.09, 0.09, "square", 0.09); },
    splat: () => { noise(0.18, 0.35, 900, 150); blip(200, 70, 0.15, 0.15, "sine"); },
    chomp: () => { blip(420, 220, 0.06, 0.12, "square"); blip(320, 160, 0.06, 0.1, "square", 0.07); },
    coin: () => { blip(988, 988, 0.06, 0.08, "square"); blip(1319, 1319, 0.16, 0.08, "square", 0.06); },
    crash: () => { noise(0.35, 0.35, 1500, 120); blip(120, 40, 0.3, 0.2, "sawtooth"); },
    honk: () => { blip(330, 320, 0.16, 0.1, "sawtooth"); blip(415, 405, 0.16, 0.07, "sawtooth"); },
    wah: () => [392, 370, 349, 294].forEach((n, i) => blip(n, n * 0.97, i === 3 ? 0.5 : 0.2, 0.09, "triangle", i * 0.22)),
    waka: () => { wakaHigh = !wakaHigh; blip(wakaHigh ? 480 : 300, wakaHigh ? 300 : 480, 0.09, 0.06, "triangle"); },
    oink: () => { blip(260, 180, 0.12, 0.16, "sawtooth"); blip(240, 160, 0.14, 0.12, "sawtooth", 0.14); },
    cluck: () => { blip(900, 600, 0.05, 0.1, "square"); blip(1100, 700, 0.05, 0.08, "square", 0.08); blip(800, 500, 0.08, 0.08, "square", 0.17); },
    thunk: () => { blip(240, 110, 0.08, 0.2, "triangle"); noise(0.05, 0.1, 600, 300); },
    oof: () => { blip(360, 150, 0.16, 0.18, "square"); },
    beep: () => { blip(880, 880, 0.06, 0.07, "square"); blip(660, 660, 0.06, 0.07, "square", 0.08); },
    splash: () => { noise(0.4, 0.3, 2000, 300); blip(600, 200, 0.12, 0.08, "sine", 0.03); }
  };
  Object.keys(sfx).forEach(k => { sfx[k] = limit(k, sfx[k]); });

  /* ---------------- a cartoon face ---------------- */
  // mood: "happy", "wow", "sad", "dizzy", "angry", "grin"; lx, ly from -1 to 1 is where the eyes look
  function face(ctx, x, y, r, mood, t, lx, ly){
    const blink = Math.sin(t * 1.3 + x * 0.05) > 0.97 ? 0.15 : 1;
    const ex = r * 0.36, ey = -r * 0.12, er = r * 0.27;
    [-1, 1].forEach(s => {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x + s * ex, y + ey, er, er * blink, 0, 0, 7); ctx.fill();
      if (blink > 0.5) {
        ctx.fillStyle = "#1a1030"; ctx.beginPath();
        if (mood === "dizzy") { ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = "#1a1030"; ctx.moveTo(x + s * ex - er * 0.5, y + ey - er * 0.5); ctx.lineTo(x + s * ex + er * 0.5, y + ey + er * 0.5); ctx.moveTo(x + s * ex + er * 0.5, y + ey - er * 0.5); ctx.lineTo(x + s * ex - er * 0.5, y + ey + er * 0.5); ctx.stroke(); }
        else { ctx.arc(x + s * ex + (lx || 0) * er * 0.4, y + ey + (ly || 0) * er * 0.4, er * 0.52, 0, 7); ctx.fill(); }
      }
      if (mood === "angry") { ctx.strokeStyle = "#1a1030"; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.beginPath(); ctx.moveTo(x + s * ex - s * er, y + ey - er * 1.3); ctx.lineTo(x + s * ex + s * er * 0.7, y + ey - er * 0.7); ctx.stroke(); }
    });
    ctx.strokeStyle = "#1a1030"; ctx.fillStyle = "#1a1030"; ctx.lineWidth = Math.max(1.5, r * 0.11); ctx.lineCap = "round"; ctx.beginPath();
    if (mood === "wow") { ctx.ellipse(x, y + r * 0.42, r * 0.15, r * 0.2, 0, 0, 7); ctx.fill(); }
    else if (mood === "sad" || mood === "angry") { ctx.arc(x, y + r * 0.62, r * 0.28, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    else if (mood === "dizzy") { ctx.moveTo(x - r * 0.25, y + r * 0.42); ctx.quadraticCurveTo(x, y + r * 0.25, x + r * 0.25, y + r * 0.45); ctx.stroke(); }
    else if (mood === "grin") { ctx.arc(x, y + r * 0.15, r * 0.36, Math.PI * 0.1, Math.PI * 0.9); ctx.closePath(); ctx.fill(); }
    else { ctx.arc(x, y + r * 0.18, r * 0.32, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    ctx.lineCap = "butt";
  }

  /* ---------------- a sound on/off button, and a wobble ---------------- */
  function soundButton(beforeEl){
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost small";
    b.setAttribute("aria-label", "Sound on or off");
    const show = () => { b.textContent = store.sound === false ? "🔇" : "🔊"; };
    b.addEventListener("click", () => { store.sound = store.sound === false; Hub.saveStore(); show(); if (store.sound) sfx.pop(); });
    // other games may flip the setting too; refresh whenever the button comes back into view
    b.addEventListener("focus", show);
    show();
    beforeEl.parentNode.insertBefore(b, beforeEl);
    return { el: b, refresh: show };
  }
  function shake(el){
    if (!el || Hub.lessMotion()) return;
    el.classList.remove("fun-shake"); void el.offsetWidth; el.classList.add("fun-shake");
  }

  // a tip that shows for a moment at the top of a game, like "Press Esc to get your mouse back"
  function hint(stage){
    const el = document.createElement("div");
    el.className = "fun-hint"; el.hidden = true;
    stage.appendChild(el);
    let timer = 0;
    return {
      show(text, ms){ el.textContent = text; el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, ms || 3500); },
      hide(){ el.hidden = true; clearTimeout(timer); }
    };
  }

  // a joystick for touch screens; it follows your thumb and springs back when you let go
  function joystick(stage){
    const el = document.createElement("div"), knob = document.createElement("div");
    el.className = "fun-stick"; el.setAttribute("aria-label", "Joystick: drag to move");
    knob.className = "fun-knob"; el.appendChild(knob); stage.appendChild(el);
    const st = { x: 0, y: 0, on: false, reset };
    function move(e){
      const r = el.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      st.x = dx; st.y = dy;
      knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
    }
    function reset(){ st.on = false; st.x = st.y = 0; knob.style.transform = ""; el.classList.remove("on"); }
    el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); st.on = true; el.classList.add("on"); el.setPointerCapture(e.pointerId); move(e); });
    el.addEventListener("pointermove", e => { if (st.on) move(e); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => el.addEventListener(ev, reset));
    window.addEventListener("blur", reset);
    return st;
  }

  // turns the joystick into the same on/off keys the keyboard sets; call it once a frame. map: { left, right, up, down } -> key names
  function stickKeys(st, keys, map){
    const dead = 0.3, d = { left: st.on && st.x < -dead, right: st.on && st.x > dead, up: st.on && st.y < -dead, down: st.on && st.y > dead };
    st.held = st.held || {};
    Object.keys(map).forEach(dir => {
      const k = map[dir];
      if (d[dir]) { keys[k] = true; st.held[k] = true; }
      else if (st.held[k]) { keys[k] = false; st.held[k] = false; }
    });
  }

  /* ---------------- graphics quality: Auto, High or Low ----------------
     Low draws at the normal resolution instead of the sharp one and drops some of the extras, so older phones
     keep up. In Auto, a little watcher times the frames while a game is on screen and switches to Low after a
     few slow seconds (and says so). The choice is saved in store.quality; "auto" is the default. */
  const quality = () => store.quality === "low" || (store.quality !== "high" && store.qualityAuto === "low") ? "low" : "high";
  // the pixel scale for a canvas: 1 on Low; at most 2 on Auto (3x screens cost 2.25 times the pixels for little
  // difference); a game's own maximum only when High is chosen
  const res = (cssW, W, max) => Math.min(quality() === "low" ? 1 : store.quality === "high" ? max : Math.min(2, max), Math.max(1, cssW * (window.devicePixelRatio || 1) / W));
  const QUALITY_LABEL = { auto: "Auto", high: "High", low: "Low" };
  function qualityText(){ const q = store.quality || "auto"; return `⚙️ Graphics: ${QUALITY_LABEL[q]}${q === "auto" && store.qualityAuto === "low" ? " (now low)" : ""}`; }
  function setQuality(q){
    store.quality = q; if (q !== "auto") delete store.qualityAuto;
    Hub.saveStore();
    document.querySelectorAll("[data-quality-btn]").forEach(b => { b.textContent = qualityText(); });
  }
  function cycleQuality(){ setQuality({ auto: "high", high: "low", low: "auto" }[store.quality || "auto"]); }
  // the game screens open right now (Fun.screen keeps this up to date), so nothing has to search the page
  const shownScreens = new Set();
  // the watcher only runs while a game screen is open, and starts again with the next one
  let watching = false;
  function watch(){
    if (watching) return;
    watching = true;
    let last = 0, slow = 0, acc = 0, frames = 0;
    function tick(now){
      if (!shownScreens.size) { watching = false; return; }
      const dt = now - last; last = now;
      if (dt > 0 && dt < 500) { acc += dt; frames++; }
      if (acc >= 1000) {
        const fps = frames * 1000 / acc;
        slow = fps < 30 ? slow + 1 : Math.max(0, slow - 1);
        acc = 0; frames = 0;
        if (slow >= 4 && (store.quality || "auto") === "auto" && store.qualityAuto !== "low") {
          store.qualityAuto = "low"; Hub.saveStore(); slow = 0;
          document.querySelectorAll("[data-quality-btn]").forEach(b => { b.textContent = qualityText(); });
          const stage = [...shownScreens][0].querySelector(".game-stage");
          if (stage) hint(stage).show("🐢 Running slowly, so graphics are lower now. You can change it on the home screen.", 5000);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
  }
  // the button on the home screen
  document.addEventListener("click", e => { const b = e.target.closest("[data-quality-btn]"); if (b) cycleQuality(); });
  document.querySelectorAll("[data-quality-btn]").forEach(b => { b.textContent = qualityText(); });

  /* ---------------- the plumbing every game screen repeats ---------------- */
  const dt = (now, last, max) => Math.max(0, Math.min(max || 1 / 30, (now - last) / 1000 || 0));
  function fit(canvas, W, H, scale, max){
    const s = res(canvas.clientWidth, W, max || 2);
    if (Math.abs(s - scale) < 0.01) return scale;
    canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
    return s;
  }
  function screen(overlay, on){
    overlay.hidden = !on; document.body.style.overflow = on ? "hidden" : "";
    if (on) { shownScreens.add(overlay); watch(); } else shownScreens.delete(overlay);
  }
  function release(keys){ Object.keys(keys).forEach(k => { keys[k] = false; }); }
  function holdButtons(buttons, keys, attr){
    buttons.forEach(btn => {
      const k = btn.dataset[attr];
      btn.addEventListener("pointerdown", e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); keys[k] = true; btn.classList.add("on"); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(n => btn.addEventListener(n, () => { keys[k] = false; btn.classList.remove("on"); }));
    });
  }

  function animate(step){
    let raf = 0, last = 0, on = false;
    const frame = now => { raf = 0; if (!on) return; const t = dt(now, last, 0.05); last = now; step(t); raf = requestAnimationFrame(frame); };
    return {
      open(){ on = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
      close(){ on = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    };
  }
  function shade(hex, f){ const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }

  window.Fun = { pops, sfx, face, soundButton, shake, hint, joystick, stickKeys, quality, res, setQuality, qualityText, dt, fit, screen, release, holdButtons, animate, shade };
})();
