/* Blox Bowling: ten-pin bowling in a neon Roblox-style alley, against BloxBot or on your own.
   Swipe up to bowl: a faster swipe throws faster, and a curved swipe hooks the ball. Drag sideways first to
   move along the line. Keyboard: ← → to move, A D to aim, Q E to hook, hold Space and let go to throw.
   Real scoring: a strike scores 10 plus your next two balls, a spare 10 plus your next ball, and the tenth
   frame gives bonus balls. The camera rides down the lane behind the ball. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "bowling", section: "games", title: "Blox Bowling", icon: "🎳",
    blurb: "Ten-pin bowling in a neon alley. Swipe to bowl, curve it to hook, go for strikes!",
    stat: () => store.bowlBest ? "Best: " + store.bowlBest : "",
    badges: [
      { id: "bowlstrike", icon: "🎳", name: "Strike!",      desc: "Bowl a strike in Blox Bowling",          test: () => (store.bowlStrikes || 0) >= 1 },
      { id: "bowlturkey", icon: "🦃", name: "Turkey",       desc: "Bowl three strikes in a row",            test: () => (store.bowlBestRow || 0) >= 3 },
      { id: "bowlwin",    icon: "🏆", name: "Alley Champ",  desc: "Beat BloxBot at bowling",                test: () => (store.bowlWins || 0) >= 1 },
      { id: "bowl150",    icon: "⭐", name: "150 Club",     desc: "Score 150 or more in one game",          test: () => (store.bowlBest || 0) >= 150 }
    ],
    mount
  });

  /* ---------------- the lane, in metres: x across (0 in the middle), z along from the foul line ---------------- */
  const LW = 0.53, GUT = 0.12, HEADPIN = 18.29, PIT = 19.3, BALL_R = 0.108, PIN_R = 0.061, PIN_H = 0.38;
  const PIN_SPOTS = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) PIN_SPOTS.push([(i - row / 2) * 0.3048, HEADPIN + row * 0.2639]);
  const M_BALL = 7, M_PIN = 1.5;
  const NAMES = ["You", "BloxBot"];
  const { clamp } = Hub.util;

  // the screen
  const W = 960, H = 540, CX = 480, HY = 150, F = 700;

  function scoreRolls(rolls){
    const out = []; let i = 0, total = 0;
    for (let f = 0; f < 10; f++) {
      if (rolls[i] === undefined) break;
      if (rolls[i] === 10) {
        if (rolls[i + 1] === undefined || rolls[i + 2] === undefined) { out.push(null); break; }
        total += 10 + rolls[i + 1] + rolls[i + 2]; out.push(total); i += 1;
      } else {
        if (rolls[i + 1] === undefined) { out.push(null); break; }
        if (rolls[i] + rolls[i + 1] === 10) {
          if (rolls[i + 2] === undefined) { out.push(null); break; }
          total += 10 + rolls[i + 2];
        } else total += rolls[i] + rolls[i + 1];
        out.push(total); i += 2;
      }
    }
    return out;
  }
  const finalScore = frames => scoreRolls(frames.flat()).reduce((m, v) => v === null ? m : v, 0);   // the last frame that has a score yet

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="bwOverlay" hidden aria-label="Blox Bowling">
      <div class="game-box">
        <div class="game-hud">
          <h2>🎳 Blox Bowling</h2>
          <span class="mono game-stat" id="bwWho">Your turn</span>
          <span class="mono game-stat" id="bwFrame">Frame 1</span>
          <button class="btn ghost small" id="bwCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="bwCanvas" width="960" height="540"></canvas>
          <div class="game-panel bw-panel" id="bwPanel">
            <div class="game-panel-title" id="bwPanelTitle">Blox Bowling</div>
            <div class="game-panel-text" id="bwPanelText"></div>
            <button class="btn" id="bwPlayBtn" type="button">▶ Play</button>
            <div class="bw-modes" id="bwModes" role="group" aria-label="Who to play">
              <button class="btn ghost small" type="button" data-mode="bot">🤖 vs BloxBot</button>
              <button class="btn ghost small" type="button" data-mode="solo">🎳 On my own</button>
            </div>
          </div>
        </div>
        <div class="game-help">Swipe up on the lane to bowl: faster swipe = faster ball, curve the swipe to hook it · drag sideways first to move · keys: ← → move, A D aim, Q E hook, hold Space and let go to throw</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("bwOverlay"), canvas = $("bwCanvas"), ctx = canvas.getContext("2d");
    const panel = $("bwPanel"), panelTitle = $("bwPanelTitle"), panelText = $("bwPanelText"), playBtn = $("bwPlayBtn"), modesEl = $("bwModes");
    const whoEl = $("bwWho"), frameEl = $("bwFrame");
    const fx = Fun.pops();
    const myBall = () => Hub.cosmetic ? Hub.cosmetic("bowlBall").colors[0] : "#2f7bff";   // the shop can change your ball

    let open = false, running = false, last = 0, clock = 0, scale = 1;
    let mode = store.bowlMode === "solo" ? "solo" : "bot";
    let state = "ready", turn = 0, frames = [[], []], pins = [], ball = null;
    let posX = 0, angle = 0, hook = 0, power = 0, charging = false, rollT = 0, settleT = 0, standingBefore = 10, row = [0, 0];
    let cam = { z: -3, y: 1.3 }, status = "", bot = null, gesture = null;
    const keys = { left: false, right: false, aimL: false, aimR: false };

    /* ---------------- pins and the ball ---------------- */
    function rackPins(){ pins = PIN_SPOTS.map(([x, z]) => ({ x, z, vx: 0, vz: 0, down: false, gone: false, fall: 0, dx: 0, dz: 1 })); }
    const standing = () => pins.filter(p => !p.down && !p.gone).length;
    function sweep(){ pins = pins.filter(p => !p.down && !p.gone); pins.forEach(p => { p.vx = p.vz = 0; }); }
    function newBall(){ ball = { x: posX, z: 0.3, vx: 0, vz: 0, spin: 0, hook: 0, gutter: false, gone: false, rot: 0 }; }

    function knock(p, vx, vz){
      if (p.down) return;
      p.down = true;
      const l = Math.hypot(vx, vz) || 1;
      p.dx = vx / l; p.dz = vz / l;
      Fun.sfx.thunk();
    }
    function hitCircles(a, ma, ra, b, mb, rb, onHit){
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), md = ra + rb;
      if (d >= md || d === 0) return;
      const nx = dx / d, nz = dz / d, ov = md - d;
      const ia = mb / (ma + mb), ib = ma / (ma + mb);
      a.x -= nx * ov * ia; a.z -= nz * ov * ia; b.x += nx * ov * ib; b.z += nz * ov * ib;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv >= 0) return;
      const j = -(1 + 0.7) * rv / (1 / ma + 1 / mb);
      a.vx -= j / ma * nx; a.vz -= j / ma * nz; b.vx += j / mb * nx; b.vz += j / mb * nz;
      if (onHit) onHit(-rv);
    }
    function physics(h){
      if (ball && !ball.gone) {
        if (!ball.gutter && ball.z > 7) ball.vx += ball.hook * 1.5 * h;          // the hook bites on the dry end of the lane
        ball.x += ball.vx * h; ball.z += ball.vz * h; ball.rot += ball.vz * h / BALL_R;
        ball.vz = Math.max(0, ball.vz - 0.25 * h);
        if (!ball.gutter && Math.abs(ball.x) > LW) { ball.gutter = true; ball.vx = 0; ball.x = Math.sign(ball.x) * (LW + GUT / 2); fx.pop("GUTTER!", CX, 260, "#ff8a8a", 40); Fun.sfx.wah(); }
        if (ball.z > PIT + 0.3 || ball.vz < 0.05) ball.gone = true;
        if (!ball.gutter) for (const p of pins) if (!p.gone) hitCircles(ball, M_BALL, BALL_R, p, M_PIN, PIN_R, () => knock(p, p.vx, p.vz));
      }
      for (const p of pins) {
        if (p.gone) continue;
        p.x += p.vx * h; p.z += p.vz * h;
        const sp = Math.hypot(p.vx, p.vz);
        if (sp > 0) { const s2 = Math.max(0, sp - 2.2 * h); p.vx *= s2 / sp; p.vz *= s2 / sp; }
        if (!p.down && sp > 0.15) knock(p, p.vx, p.vz);
        if (p.z > PIT || p.z < HEADPIN - 0.5 || Math.abs(p.x) > LW + 0.02) { p.gone = true; p.down = true; }
      }
      for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i], b = pins[j];
        if (a.gone || b.gone) continue;
        hitCircles(a, M_PIN, PIN_R, b, M_PIN, PIN_R, () => { if (a.down || Math.hypot(a.vx, a.vz) > 0.1) knock(b, b.vx, b.vz); if (b.down || Math.hypot(b.vx, b.vz) > 0.1) knock(a, a.vx, a.vz); });
      }
    }
    const pinsMoving = () => pins.some(p => !p.gone && Math.hypot(p.vx, p.vz) > 0.04);

    /* ---------------- frames and turns ---------------- */
    const curFrame = p => frames[p].length && !frameDone(frames[p][frames[p].length - 1], frames[p].length - 1) ? frames[p].length - 1 : frames[p].length;
    function frameDone(fr, i){
      if (i < 9) return fr[0] === 10 || fr.length === 2;
      if (fr.length < 2) return false;
      if (fr.length === 2) return fr[0] + fr[1] < 10;
      return true;
    }
    const gameDone = p => frames[p].length === 10 && frameDone(frames[p][9], 9);

    function throwBall(speed, ang, hk){
      newBall();
      ball.vz = speed * Math.cos(ang); ball.vx = speed * Math.sin(ang); ball.hook = hk;
      standingBefore = standing();
      state = "roll"; rollT = 0; settleT = 0; power = 0; charging = false;
      Fun.sfx.whoosh();
    }
    function endRoll(){
      const p = turn, knocked = standingBefore - standing();
      const fi = curFrame(p);
      if (!frames[p][fi]) frames[p][fi] = [];
      const fr = frames[p][fi]; fr.push(knocked);
      const first = fr.length === 1, tenth = fi === 9;
      let reset = false;
      if (knocked === standingBefore && standingBefore === 10 && (first || (tenth && fr[fr.length - 2] === 10) || (tenth && fr.length === 3))) {
        // a strike
        fx.pop("STRIKE!", CX, 230, "#ffe14d", 64); Fun.sfx.tada(); Hub.confettiBurst(canvas);
        if (p === 0) { store.bowlStrikes = (store.bowlStrikes || 0) + 1; row[0]++; if (row[0] > (store.bowlBestRow || 0)) store.bowlBestRow = row[0]; Hub.saveStore(); Hub.checkBadges(); }
        if (row[p] >= 3 && p === 0) fx.pop("TURKEY! 🦃", CX, 300, "#ff9a3c", 44);
        reset = true;
      } else if (knocked === standingBefore && !first) {
        fx.pop("SPARE!", CX, 230, "#7dff9a", 56); Fun.sfx.ding(); reset = true; if (p === 0) row[0] = 0;
      } else {
        if (knocked === 0) fx.pop(ball.gutter ? "Gutter ball" : "Oops!", CX, 230, "#ff8a8a", 40);
        else fx.pop(knocked + (knocked === 1 ? " pin" : " pins"), CX, 230, "#ffffff", 44);
        if (p === 0) row[0] = 0;
      }
      if (p === 1 && knocked === standingBefore && standingBefore === 10) row[1]++; else if (p === 1) row[1] = 0;
      const done = frameDone(fr, fi);
      if (done || reset) rackPins(); else sweep();
      ball = null;
      if (done) {
        if (mode === "bot" && !(gameDone(0) && gameDone(1))) turn = gameDone(1 - p) ? p : 1 - p;
        if (gameDone(0) && (mode === "solo" || gameDone(1))) { finish(); return; }
        rackPins();
      }
      startTurn();
    }
    function startTurn(){
      cam.z = -3; cam.y = 1.3;
      if (turn === 0) { state = "aim"; status = "Swipe up to bowl!"; }
      else { state = "bot"; bot = { t: 0 }; status = "BloxBot is bowling..."; }
    }
    function finish(){
      state = "over"; running = false;
      const me = finalScore(frames[0]), them = finalScore(frames[1]);
      if (me > (store.bowlBest || 0)) store.bowlBest = me;
      let title, text;
      if (mode === "bot") {
        const won = me > them;
        if (won) store.bowlWins = (store.bowlWins || 0) + 1;
        title = won ? "🏆 You won!" : me === them ? "🤝 A tie!" : "😩 BloxBot won this time";
        text = `You ${me}, BloxBot ${them}.`;
        if (won) { Fun.sfx.tada(); Hub.confettiBurst(playBtn); } else Fun.sfx.wah();
      } else { title = "🎳 Game over!"; text = `You scored ${me}.`; Fun.sfx.tada(); }
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = title;
      panelText.textContent = text + (store.bowlBest ? ` Your best is ${store.bowlBest}.` : "");
      showPanel("▶ Play again");
    }

    /* ---------------- BloxBot ---------------- */
    function updateBot(dt){
      bot.t += dt;
      if (!bot.plan) {
        const fi = curFrame(1), fr = frames[1][fi] || [];
        let tx = 0.065, tz = HEADPIN;                                      // the pocket, between the 1 and 3 pins
        if (fr.length === 1 || (fi === 9 && standing() < 10)) {           // a spare: go for the pins that are left
          const left = pins.filter(p => !p.down && !p.gone);
          if (left.length) { tx = left.reduce((s, p) => s + p.x, 0) / left.length; tz = left.reduce((s, p) => s + p.z, 0) / left.length; }
        }
        const sx = clamp(tx * 0.5 + (Math.random() - 0.5) * 0.3, -0.4, 0.4);
        const ang = Math.atan2(tx - sx, tz - 0.3) + (Math.random() + Math.random() - 1) * 0.012;
        bot.plan = { sx, ang, speed: 7.5 + Math.random() * 1.5 };
      }
      posX += (bot.plan.sx - posX) * Math.min(1, dt * 4); angle = bot.plan.ang;
      if (bot.t > 1.4) throwBall(bot.plan.speed, bot.plan.ang, 0);
    }

    /* ---------------- each frame ---------------- */
    function update(dt){
      clock += dt;
      if (state === "aim") {
        if (keys.left) posX -= dt * 0.6; if (keys.right) posX += dt * 0.6;
        if (keys.aimL) angle -= dt * 0.08; if (keys.aimR) angle += dt * 0.08;
        posX = clamp(posX, -LW + BALL_R, LW - BALL_R); angle = clamp(angle, -0.06, 0.06);
        if (charging) power = Math.min(1, power + dt * 0.8);
      } else if (state === "bot") updateBot(dt);
      else if (state === "roll") {
        const n = Math.ceil(dt * 240);
        for (let i = 0; i < n; i++) physics(dt / n);
        for (const p of pins) if (p.down && p.fall < 1) p.fall = Math.min(1, p.fall + dt * 3.2);
        rollT += dt;
        // the camera rides behind the ball, then waits by the pins
        const target = ball && !ball.gone ? clamp(ball.z - 3.6, -3, 13) : 13;
        cam.z += (target - cam.z) * Math.min(1, dt * 3);
        cam.y += ((cam.z > 6 ? 0.85 : 1.3) - cam.y) * Math.min(1, dt * 2);
        if ((!ball || ball.gone) && !pinsMoving()) { settleT += dt; if (settleT > 0.9) endRoll(); }
        else settleT = 0;
        if (rollT > 9) endRoll();
      }
    }

    /* ---------------- drawing ---------------- */
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 2); }
    function P(x, y, z){ const d = z - cam.z; if (d < 0.25) return null; const k = F / d; return [CX + x * k, HY + (cam.y - y) * k, k]; }
    function quad(pts, fill){
      const s = pts.map(p => P(p[0], p[1], p[2]));
      if (s.some(v => !v)) return;
      ctx.beginPath(); s.forEach((v, i) => i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    function drawAlley(){
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1b0f3f"); g.addColorStop(0.35, "#2b1765"); g.addColorStop(1, "#130b2e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const z0 = Math.max(0, cam.z + 0.35), zEnd = PIT + 0.6;
      // the room: floor, side walls with neon stripes, and the back wall with the sign
      const RW = 2.4;
      quad([[-RW, 0, z0], [RW, 0, z0], [RW, 0, zEnd], [-RW, 0, zEnd]], "#3a2a5e");
      [-1, 1].forEach(s => {
        quad([[s * RW, 0, z0], [s * RW, 0, zEnd], [s * RW, 2.6, zEnd], [s * RW, 2.6, z0]], "#24154e");
        quad([[s * RW, 1.1, z0], [s * RW, 1.1, zEnd], [s * RW, 1.25, zEnd], [s * RW, 1.25, z0]], s < 0 ? "#2bd9ff" : "#ff4df0");
      });
      quad([[-RW, 0, zEnd], [RW, 0, zEnd], [RW, 2.6, zEnd], [-RW, 2.6, zEnd]], "#100828");
      const sign = P(0, 1.35, zEnd);
      if (sign) {
        ctx.save(); ctx.font = `900 ${Math.round(0.34 * sign[2])}px "Bricolage Grotesque", system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "#ff4df0"; ctx.shadowBlur = 20; ctx.fillStyle = "#ffc2fb"; ctx.fillText("BLOX BOWL", sign[0], sign[1]); ctx.restore();
      }
      // gutters
      quad([[-LW - GUT, 0, z0], [-LW, 0, z0], [-LW, 0, PIT], [-LW - GUT, 0, PIT]], "#1c1830");
      quad([[LW, 0, z0], [LW + GUT, 0, z0], [LW + GUT, 0, PIT], [LW, 0, PIT]], "#1c1830");
      // the lane: maple boards
      quad([[-LW, 0, z0], [LW, 0, z0], [LW, 0, PIT - 0.05], [-LW, 0, PIT - 0.05]], "#e8b96f");
      ctx.strokeStyle = "rgba(140,80,30,0.25)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = -19; i <= 19; i += 2) { const x = i / 39 * 2 * LW * 0.5 * 2 / 2, a = P(x, 0, z0), b = P(x, 0, PIT - 0.05); if (a && b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } }
      ctx.stroke();
      // the shine, the pin deck and the pit
      quad([[-LW, 0, HEADPIN - 0.4], [LW, 0, HEADPIN - 0.4], [LW, 0, PIT - 0.05], [-LW, 0, PIT - 0.05]], "#f3cf8f");
      quad([[-LW - GUT, 0, PIT], [LW + GUT, 0, PIT], [LW + GUT, 0.5, zEnd], [-LW - GUT, 0.5, zEnd]], "#0a0618");
      // side bumpers: neon blocks
      [-1, 1].forEach(s => {
        quad([[s * (LW + GUT), 0, z0], [s * (LW + GUT + 0.1), 0, z0], [s * (LW + GUT + 0.1), 0.22, zEnd], [s * (LW + GUT), 0.22, zEnd]], s < 0 ? "#2bd9ff" : "#ff4df0");
      });
      // aiming arrows and dots
      ctx.fillStyle = "#b5462a";
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.13, z = 4.6 + Math.abs(i) * 0.3;
        const a = P(x, 0, z + 0.28), b = P(x - 0.035, 0, z), c = P(x + 0.035, 0, z);
        if (a && b && c) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill(); }
      }
      // the foul line
      const f1 = P(-LW, 0, 0), f2 = P(LW, 0, 0);
      if (f1 && f2) { ctx.strokeStyle = "#d63a3a"; ctx.lineWidth = Math.max(2, 0.02 * f1[2]); ctx.beginPath(); ctx.moveTo(f1[0], f1[1]); ctx.lineTo(f2[0], f2[1]); ctx.stroke(); }
    }
    function drawPin(p){
      const a = p.fall * Math.PI / 2, ux = p.dx * Math.sin(a), uz = p.dz * Math.sin(a), uy = Math.cos(a);
      const at = s => P(p.x + ux * PIN_H * s, uy * PIN_H * s + (1 - uy) * PIN_R, p.z + uz * PIN_H * s);
      const b = at(0), m = at(0.55), n = at(0.75), t = at(0.9);
      if (!b || !m || !n || !t) return;
      const k = b[2];
      const sh = P(p.x, 0, p.z);
      if (sh && !p.fall) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], PIN_R * k * 1.2, PIN_R * k * 0.4, 0, 0, 7); ctx.fill(); }
      ctx.lineCap = "round"; ctx.strokeStyle = "#1a1030";
      ctx.lineWidth = PIN_R * 2.2 * k + 3; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(m[0], m[1]); ctx.stroke();
      ctx.lineWidth = PIN_R * 1.1 * k + 3; ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = PIN_R * 2.2 * k; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(m[0], m[1]); ctx.stroke();
      ctx.lineWidth = PIN_R * 1.1 * k; ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
      ctx.strokeStyle = "#e3242b"; ctx.lineWidth = PIN_R * 1.15 * k; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(m[0] + (n[0] - m[0]) * 0.35, m[1] + (n[1] - m[1]) * 0.35); ctx.lineTo(m[0] + (n[0] - m[0]) * 0.75, m[1] + (n[1] - m[1]) * 0.75); ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(t[0], t[1], PIN_R * 0.85 * k, 0, 7); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#1a1030"; ctx.stroke();
      ctx.lineCap = "butt";
    }
    function drawBall(b, colour){
      const y = b.gutter ? BALL_R - 0.04 : BALL_R, c = P(b.x, y, b.z), sh = P(b.x, 0, b.z);
      if (!c) return;
      const r = BALL_R * c[2];
      if (sh) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], r, r * 0.35, 0, 0, 7); ctx.fill(); }
      const g = ctx.createRadialGradient(c[0] - r * 0.35, c[1] - r * 0.4, r * 0.1, c[0], c[1], r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.25, colour); g.addColorStop(1, "#140a30");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill();
      // a swirl that turns as it rolls
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath(); ctx.ellipse(c[0], c[1], r * 0.7, r * Math.abs(Math.cos(b.rot)) * 0.7 + 0.5, 0, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = "#140a30"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.stroke();
    }
    function drawScoreboard(){
      const rows = mode === "bot" ? [0, 1] : [0];
      const x0 = 70, bw = 78, y0 = 8, rh = 34;
      rows.forEach((p, ri) => {
        const y = y0 + ri * (rh + 4), cum = scoreRolls(frames[p].flat());
        ctx.fillStyle = turn === p && state !== "over" ? "rgba(255,225,77,0.25)" : "rgba(0,0,0,0.45)";
        ctx.fillRect(x0 - 64, y, 64 + bw * 10 + 60, rh);
        ctx.fillStyle = "#fff"; ctx.font = '800 13px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(NAMES[p], x0 - 58, y + rh / 2);
        for (let f = 0; f < 10; f++) {
          const x = x0 + f * bw, fr = frames[p][f] || [];
          ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, rh);
          ctx.font = "800 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffe14d";
          const marks = fr.map((v, i) => {
            if (v === 10 && (i === 0 || f === 9 && (fr[i - 1] === 10 || (i === 2 && fr[0] + fr[1] === 10)))) return "X";
            if (i > 0 && fr[i - 1] !== 10 && fr[i - 1] + v === 10 && !(f === 9 && i === 2 && fr[0] + fr[1] !== 10 && fr[1] + v !== 10)) return "/";
            return v === 0 ? "–" : String(v);
          });
          marks.forEach((m, i) => ctx.fillText(m, x + bw - 12 - (marks.length - 1 - i) * 18 - (f < 9 && marks.length === 1 && m === "X" ? 0 : 0), y + 10));
          if (cum[f] !== undefined && cum[f] !== null) { ctx.fillStyle = "#fff"; ctx.font = "800 13px system-ui, sans-serif"; ctx.fillText(String(cum[f]), x + bw / 2, y + 25); }
        }
        ctx.fillStyle = "#fff"; ctx.font = '900 16px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "center";
        ctx.fillText(String(finalScore(frames[p])), x0 + bw * 10 + 30, y + rh / 2);
      });
    }
    function drawAim(){
      const b = { x: posX, z: 0.3, gutter: false, rot: clock * 0 };
      const len = 6;
      const a = P(posX, 0.01, 0.5), e = P(posX + Math.sin(angle) * len, 0.01, 0.5 + Math.cos(angle) * len);
      if (a && e) {
        ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        // show the hook as a bend at the end
        const steps = 12; for (let i = 1; i <= steps; i++) { const s = i / steps, z = 0.5 + Math.cos(angle) * len * s, x = posX + Math.sin(angle) * len * s + hook * 0.25 * s * s, q = P(x, 0.01, z); if (q) ctx.lineTo(q[0], q[1]); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      drawBall(b, turn === 0 ? myBall() : "#e8332b");
      if (charging) {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(CX - 110, 500, 220, 18);
        ctx.fillStyle = power > 0.8 ? "#ff4b3a" : power > 0.45 ? "#ffe14d" : "#38d96b"; ctx.fillRect(CX - 108, 502, 216 * power, 14);
      }
    }
    function draw(dt){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawAlley();
      const items = pins.filter(p => !p.gone).map(p => ({ z: p.z, d: () => drawPin(p) }));
      if (ball && !ball.gone) items.push({ z: ball.z, d: () => drawBall(ball, turn === 0 ? myBall() : "#e8332b") });
      items.sort((a, b) => b.z - a.z).forEach(i => i.d());
      if (state === "aim" || state === "bot") drawAim();
      if (gesture && gesture.pts.length > 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath();
        gesture.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.lineCap = "butt";
      }
      fx.draw(ctx, dt);
      drawScoreboard();
      if (status && (state === "aim" || state === "bot")) {
        ctx.font = '800 17px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.fillStyle = "#fff";
        ctx.strokeText(status, CX, 530 - 14); ctx.fillText(status, CX, 530 - 14);
      }
    }
    let lastWho = "", lastFrame = "";
    function hud(){
      const who = state === "over" ? "Game over" : turn === 0 ? "Your turn" : "BloxBot's turn";
      const fr = "Frame " + Math.min(10, curFrame(turn) + 1);
      if (who !== lastWho) { whoEl.textContent = who; lastWho = who; }
      if (fr !== lastFrame) { frameEl.textContent = fr; lastFrame = fr; }
    }
    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now;
      if (running) update(dt); else clock += dt;
      draw(dt); hud();
      requestAnimationFrame(loop);
    }

    /* ---------------- starting and leaving ---------------- */
    function reset(){ frames = [[], []]; turn = 0; row = [0, 0]; posX = 0; angle = 0; hook = 0; ball = null; rackPins(); fx.clear(); cam = { z: -3, y: 1.3 }; }
    function showPanel(label){
      playBtn.textContent = label;
      modesEl.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
      panel.hidden = false; playBtn.focus();
    }
    function start(){
      store.bowlMode = mode; Hub.saveStore();
      reset(); running = true; panel.hidden = true; startTurn();
      canvas.focus();
    }
    function openGame(){
      open = true; running = false; state = "ready"; reset();
      Fun.screen(overlay, true);
      panelTitle.textContent = "🎳 Blox Bowling";
      panelText.textContent = "Ten frames of bowling. Swipe up the lane to throw: swipe faster for a faster ball, and curve your swipe to hook it into the pins. Knock all 10 down with one ball for a STRIKE, or with two for a SPARE."
        + (store.bowlBest ? ` Your best: ${store.bowlBest}.` : "");
      showPanel("▶ Play");
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeGame(){ open = false; running = false; Fun.screen(overlay, false); }

    /* ---------------- controls ---------------- */
    const canThrow = () => running && state === "aim" && turn === 0;
    function release(){ if (!charging) return; charging = false; if (canThrow() && power > 0.05) throwBall(5 + power * 5, angle, hook); else power = 0; }
    const KEYS = { ArrowLeft: "left", ArrowRight: "right", KeyA: "aimL", KeyD: "aimR" };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!canThrow()) return;
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) { charging = true; power = 0; } return; }
      if (e.code === "KeyQ") { hook = clamp(hook - 0.25, -1, 1); return; }
      if (e.code === "KeyE") { hook = clamp(hook + 0.25, -1, 1); return; }
      const k = KEYS[e.code]; if (k) { e.preventDefault(); keys[k] = true; }
    });
    window.addEventListener("keyup", e => {
      if (e.code === "Space" && open) { release(); return; }
      const k = KEYS[e.code]; if (k) keys[k] = false;
    });
    window.addEventListener("blur", () => { Fun.release(keys); charging = false; gesture = null; });
    const local = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    // a swipe throws; a sideways drag first moves you along the line
    canvas.addEventListener("pointerdown", e => {
      if (!canThrow()) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      const q = local(e);
      gesture = { pts: [q], t: [performance.now()], kind: null, x0: posX };
    });
    canvas.addEventListener("pointermove", e => {
      if (!gesture) return;
      const q = local(e), p0 = gesture.pts[0];
      gesture.pts.push(q); gesture.t.push(performance.now());
      if (gesture.pts.length > 40) { gesture.pts.splice(1, 1); gesture.t.splice(1, 1); }
      if (!gesture.kind && Math.hypot(q[0] - p0[0], q[1] - p0[1]) > 14) gesture.kind = Math.abs(q[0] - p0[0]) > Math.abs(q[1] - p0[1]) * 1.3 ? "move" : "throw";
      if (gesture.kind === "move") { const k = F / (0.3 - cam.z); posX = clamp(gesture.x0 + (q[0] - p0[0]) / k, -LW + BALL_R, LW - BALL_R); gesture.pts = [p0, q]; }
    });
    const endGesture = () => {
      const g = gesture; gesture = null;
      if (!g || g.kind !== "throw" || !canThrow()) return;
      const p0 = g.pts[0], p1 = g.pts[g.pts.length - 1], dy = p0[1] - p1[1], dx = p1[0] - p0[0];
      if (dy < 40) return;
      // speed from the last part of the swipe
      let i = g.pts.length - 1; while (i > 0 && g.t[g.pts.length - 1] - g.t[i] < 120) i--;
      const ms = Math.max(16, g.t[g.pts.length - 1] - g.t[i]), sp = Math.hypot(p1[0] - g.pts[i][0], p1[1] - g.pts[i][1]) / ms;   // px per ms
      const speed = clamp(4.5 + sp * 2.6, 5, 10.5);
      const ang = clamp(Math.atan2(dx, dy) * 0.12, -0.06, 0.06);
      // the curve: how far the middle of the swipe bows out from the straight line
      const mid = g.pts[Math.floor(g.pts.length / 2)], cl = Math.hypot(dx, dy) || 1;
      const bow = ((mid[0] - p0[0]) * dy - (p0[1] - mid[1]) * dx) / cl;          // + when the swipe bows to the right
      const hk = clamp(-bow / 40, -1, 1);
      angle = ang; hook = hk;
      throwBall(speed, ang, hk);
    };
    canvas.addEventListener("pointerup", endGesture);
    canvas.addEventListener("pointercancel", () => { gesture = null; });
    modesEl.addEventListener("click", e => {
      const b = e.target.closest("[data-mode]"); if (!b) return;
      mode = b.dataset.mode;
      modesEl.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      Fun.sfx.pop();
    });
    canvas.tabIndex = 0;
    $("bwCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("bwCloseBtn"));
    playBtn.addEventListener("click", start);
    window.__bowl = { get state(){ return state; }, get turn(){ return turn; }, frames: () => frames, throwBall: (s, a, h) => throwBall(s, a, h), set posX(v){ posX = v; }, pins: () => pins, score: p => finalScore(frames[p]) };

    return { open: openGame, close: closeGame };
  }
})();
