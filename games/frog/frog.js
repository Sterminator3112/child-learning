/* Frog Hop: get the frog across a busy road full of race cars and trucks, then over a river by hopping on
   logs and turtles, into one of the five lily pads at the top. Fill all five for the next level, where
   everything goes faster. Watch the clock: each frog has 40 seconds. Hop with the arrows, W A S D,
   a swipe or the arrow pad. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "frog", section: "games", title: "Frog Hop", icon: "🐸",
    blurb: "Hop across the race-car road and the log river to the lily pads!",
    stat: () => store.frogBest ? "Best: " + store.frogBest : "",
    badges: [
      { id: "frog-home", icon: "🪷", name: "Home Sweet Home", desc: "Get a frog to a lily pad in Frog Hop", test: () => (store.frogHomes || 0) >= 1 },
      { id: "frog-lv3", icon: "🐸", name: "Hop Star", desc: "Reach level 3 in Frog Hop", test: () => (store.frogLevel || 0) >= 3 }
    ],
    mount
  });

  const COLS = 13, ROWS = 13, T = 48, W = COLS * T, H = ROWS * T, TIME = 40;
  const HOMES = [1, 3.5, 6, 8.5, 11];   // the lily pads' columns (centres) in the top row
  // lanes, bottom to top: row, speed (cells/s, minus is leftwards), what, length in cells, how many
  const LANES = [
    { row: 11, speed: -1.6, kind: "car", len: 1, n: 3, colour: "#ff4d6d" },
    { row: 10, speed: 2.2, kind: "car", len: 1, n: 3, colour: "#4db8ff" },
    { row: 9, speed: -1.2, kind: "truck", len: 2, n: 2, colour: "#ffb347" },
    { row: 8, speed: 3.4, kind: "car", len: 1, n: 2, colour: "#ffe14d" },
    { row: 7, speed: -2, kind: "truck", len: 2, n: 2, colour: "#b26bff" },
    { row: 5, speed: 1.3, kind: "log", len: 3, n: 3 },
    { row: 4, speed: -1.6, kind: "turtle", len: 2, n: 4 },
    { row: 3, speed: 2, kind: "log", len: 4, n: 2 },
    { row: 2, speed: 1, kind: "log", len: 2, n: 4 },
    { row: 1, speed: -1.8, kind: "turtle", len: 3, n: 3 }
  ];

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="fgOverlay" hidden aria-label="Frog Hop">
      <div class="game-box fg-box">
        <div class="game-hud">
          <h2>🐸 Frog Hop</h2>
          <span class="mono game-stat" id="fgScore">⭐ 0</span>
          <span class="mono game-stat" id="fgLives">🐸 ×3</span>
          <span class="mono game-stat" id="fgLevel">Level 1</span>
          <button class="btn ghost small" id="fgCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="fgCanvas" width="${W}" height="${H + 30}"></canvas>
          <div class="game-panel fg-panel" id="fgPanel">
            <div class="game-panel-title" id="fgPanelTitle">🐸 Frog Hop</div>
            <div class="game-panel-text" id="fgPanelText"></div>
            <button class="btn" id="fgPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">← ↑ → ↓ or W A S D to hop (or swipe) · dodge the cars · ride the logs and turtles · fill all 5 lily pads!</div>
        <div class="fg-pad fun-dpad">
          <button class="btn ghost" data-dir="up" type="button" aria-label="Hop up">▲</button>
          <button class="btn ghost" data-dir="left" type="button" aria-label="Hop left">◀</button>
          <button class="btn ghost" data-dir="down" type="button" aria-label="Hop down">▼</button>
          <button class="btn ghost" data-dir="right" type="button" aria-label="Hop right">▶</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("fgOverlay"), canvas = $("fgCanvas"), ctx = canvas.getContext("2d");
    const panel = $("fgPanel"), panelTitle = $("fgPanelTitle"), panelText = $("fgPanelText"), playBtn = $("fgPlayBtn");
    const fx = Fun.pops();

    let isOpen = false, running = false, last = 0, clock = 0;
    let frog = null, things = [], homes = [], score = 0, lives = 3, level = 1, timer = TIME, best = 12, dead = 0;

    function buildLanes(){
      things = [];
      LANES.forEach(l => {
        const gap = COLS / l.n;
        for (let i = 0; i < l.n; i++) things.push({ lane: l, x: i * gap + Math.random() * (gap - l.len) * 0.5 });
      });
    }
    const laneSpeed = l => l.speed * (1 + (level - 1) * 0.18);
    const isWater = row => LANES.some(l => l.row === row && (l.kind === "log" || l.kind === "turtle"));
    function newFrog(){ frog = { x: 6, y: 12, hop: 0, face: "up" }; timer = TIME; best = 12; }

    function hop(dir){
      if (!running || dead || !frog) return;
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      const ny = frog.y + dy;
      let nx = frog.x + dx;
      // on the river the frog keeps where the log carried it; anywhere else it lines up with a square
      if (!isWater(ny)) nx = Math.round(nx);
      if (nx < -0.4 || nx > COLS - 0.6 || ny > 12 || ny < 0) return;
      frog.x = nx; frog.y = ny; frog.hop = 1; frog.face = dir;
      if (ny < best) { best = ny; score += 10; }
      Fun.sfx.pop();
      if (ny === 0) reachTop();
    }
    function reachTop(){
      // snap to the nearest lily pad, if it's close enough and still empty
      const i = HOMES.findIndex(h => Math.abs(h - frog.x) <= 0.8);
      if (i < 0 || homes[i]) { die("Bonk! Aim for a lily pad 🪷"); return; }
      homes[i] = true;
      score += 50 + Math.ceil(timer) * 2;
      store.frogHomes = (store.frogHomes || 0) + 1;
      fx.pop("HOME! 🪷", HOMES[i] * T + T / 2, T, "#7dff9a", 30); Fun.sfx.ding();
      if (homes.every(Boolean)) {
        level++; score += 500; homes = HOMES.map(() => false);
        store.frogLevel = Math.max(store.frogLevel || 0, level);
        fx.pop("LEVEL " + level + "! 🎉", W / 2, H / 2, "#ffe14d", 42); Fun.sfx.tada();
      }
      Hub.checkBadges();
      newFrog();
    }
    function die(why){
      dead = 1.1; lives--;
      fx.pop(why, W / 2, H / 2 - 30, "#fff", 28);
      Fun.shake(canvas);
    }

    function step(dt){
      things.forEach(t => { t.x += laneSpeed(t.lane) * dt; if (t.x > COLS + 1) t.x -= COLS + t.lane.len + 2; if (t.x < -t.lane.len - 1) t.x += COLS + t.lane.len + 2; });
      if (dead) {
        dead -= dt;
        if (dead <= 0) { dead = 0; if (lives <= 0) endGame(); else newFrog(); }
        return;
      }
      frog.hop = Math.max(0, frog.hop - dt * 8);
      timer -= dt;
      if (timer <= 0) { die("⏰ Out of time!"); Fun.sfx.wah(); return; }
      const fx0 = frog.x + 0.5, onLane = LANES.find(l => l.row === frog.y);
      if (!onLane) return;
      // things in the frog's row that it is standing on (or is under)
      const under = things.find(t => t.lane === onLane && fx0 > t.x + 0.1 && fx0 < t.x + t.lane.len - 0.1);
      if (onLane.kind === "car" || onLane.kind === "truck") {
        if (under) { die("SQUISH! 🚗"); Fun.sfx.splat(); }
      } else if (!under) { die("SPLASH! 💦"); Fun.sfx.splash(); }
      else {
        frog.x += laneSpeed(onLane) * dt;   // ride along
        if (frog.x < -0.4 || frog.x > COLS - 0.6) { die("Whoa! Swept away! 💦"); Fun.sfx.splash(); }
      }
    }

    function endGame(){
      running = false;
      const wasBest = score > (store.frogBest || 0);
      if (wasBest) store.frogBest = score;
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = "🐸 Game over!";
      panelText.textContent = `You scored ${score} and reached level ${level}.` + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.frogBest || 0}.`);
      playBtn.textContent = "▶ Play again"; panel.hidden = false;
      if (wasBest) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }

    /* ----- drawing ----- */
    function drawCar(x, y, len, colour, dir, truck){
      const w = len * T - 6, X = x * T + 3, Y = y * T + 8;
      ctx.fillStyle = "#111"; [0.18, 0.82].forEach(k => { ctx.fillRect(X + w * k - 7, Y - 3, 14, 6); ctx.fillRect(X + w * k - 7, Y + T - 19, 14, 6); });
      ctx.fillStyle = colour; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X, Y, w, T - 16, 8) : ctx.rect(X, Y, w, T - 16); ctx.fill();
      if (truck) { ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(dir > 0 ? X : X + w * 0.35, Y + 3, w * 0.65, T - 22); }
      else {
        // a race car: windscreen, a stripe and a number
        ctx.fillStyle = "#bfe8ff"; ctx.fillRect(dir > 0 ? X + w * 0.55 : X + w * 0.2, Y + 6, w * 0.25, T - 28);
        ctx.fillStyle = "#fff"; ctx.fillRect(X, Y + (T - 16) / 2 - 2, w, 4);
      }
      ctx.fillStyle = "#fff59d"; ctx.fillRect(dir > 0 ? X + w - 4 : X, Y + 3, 4, 6); ctx.fillRect(dir > 0 ? X + w - 4 : X, Y + T - 25, 4, 6);
    }
    function draw(dt){
      // water at the top, grass in the middle and at the bottom, the road in between
      ctx.fillStyle = "#1e5fa8"; ctx.fillRect(0, 0, W, 6 * T);
      ctx.fillStyle = "#2a2f38"; ctx.fillRect(0, 7 * T, W, 5 * T);
      ctx.fillStyle = "#4caf50"; ctx.fillRect(0, 6 * T, W, T); ctx.fillRect(0, 12 * T, W, T);
      ctx.fillStyle = "#2e7d32"; ctx.fillRect(0, 0, W, T);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let r = 8; r <= 11; r++) for (let x = 0; x < W; x += 60) ctx.fillRect(x + 10, r * T - 2, 30, 4);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2;
      for (let r = 1; r <= 5; r++) for (let x = 0; x < W; x += 80) { const wx = (x + clock * 20 * (r % 2 ? 1 : -1)) % W; ctx.beginPath(); ctx.arc((wx + W) % W, r * T + 24, 10, 0.3, 2.8); ctx.stroke(); }
      // the lily pads
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      HOMES.forEach((h, i) => {
        const x = h * T + T / 2;
        ctx.fillStyle = "#1e5fa8"; ctx.fillRect(x - T * 0.55, 4, T * 1.1, T - 4);
        ctx.fillStyle = "#43a047"; ctx.beginPath(); ctx.arc(x, T / 2 + 2, 18, 0.3, Math.PI * 2 - 0.3); ctx.lineTo(x, T / 2 + 2); ctx.fill();
        if (homes[i]) { ctx.font = "30px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'"; ctx.fillText("🐸", x, T / 2 + 2); }
      });
      // logs, turtles and traffic
      things.forEach(t => {
        const l = t.lane, y = l.row;
        if (l.kind === "log") {
          ctx.fillStyle = "#8d5a2b"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(t.x * T, y * T + 8, l.len * T, T - 16, 14) : ctx.rect(t.x * T, y * T + 8, l.len * T, T - 16); ctx.fill();
          ctx.fillStyle = "#6b4220"; for (let k = 1; k < l.len * 2; k++) ctx.fillRect(t.x * T + k * T / 2, y * T + 12, 2, T - 24);
        } else if (l.kind === "turtle") {
          for (let k = 0; k < l.len; k++) { const cx = (t.x + k + 0.5) * T, cy = y * T + T / 2; ctx.fillStyle = "#7cb342"; ctx.beginPath(); ctx.arc(cx + (l.speed > 0 ? 16 : -16), cy, 7, 0, 7); ctx.fill(); ctx.fillStyle = "#33691e"; ctx.beginPath(); ctx.ellipse(cx, cy, 18, 15, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#9ccc65"; ctx.lineWidth = 2; ctx.stroke(); }
        } else drawCar(t.x, y, l.len, l.colour, laneSpeed(l), l.kind === "truck");
      });
      // the frog (a little bigger in the middle of a hop)
      if (frog) {
        const s = 1 + frog.hop * 0.25, x = frog.x * T + T / 2, y = frog.y * T + T / 2;
        ctx.save(); ctx.translate(x, y); ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[frog.face]); ctx.scale(s, s);
        if (dead) { ctx.globalAlpha = Math.max(0, dead); ctx.rotate(clock * 10); }
        ctx.fillStyle = "#2e7d32"; [[-14, 10], [14, 10], [-12, -10], [12, -10]].forEach(([lx, ly]) => { ctx.beginPath(); ctx.ellipse(lx, ly, 7, 5, 0, 0, 7); ctx.fill(); });
        ctx.fillStyle = "#66d94a"; ctx.beginPath(); ctx.ellipse(0, 2, 14, 16, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; [-7, 7].forEach(ex => { ctx.beginPath(); ctx.arc(ex, -10, 5, 0, 7); ctx.fill(); });
        ctx.fillStyle = "#111"; [-7, 7].forEach(ex => { ctx.beginPath(); ctx.arc(ex, -11, 2.4, 0, 7); ctx.fill(); });
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // the timer bar along the bottom
      ctx.fillStyle = "#111"; ctx.fillRect(0, H, W, 30);
      ctx.fillStyle = timer > 10 ? "#7dff9a" : "#ff6b6b"; ctx.fillRect(8, H + 8, (W - 16) * Math.max(0, timer / TIME), 14);
      ctx.fillStyle = "#fff"; ctx.font = "700 13px system-ui"; ctx.fillText(`⏰ ${Math.ceil(Math.max(0, timer))}`, W / 2, H + 15);
      fx.draw(ctx, dt);
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last); last = now; clock += dt;
      if (running) step(dt); else things.forEach(t => { t.x += laneSpeed(t.lane) * dt * 0.5; if (t.x > COLS + 1) t.x -= COLS + t.lane.len + 2; if (t.x < -t.lane.len - 1) t.x += COLS + t.lane.len + 2; });
      draw(dt);
      $("fgScore").textContent = "⭐ " + score;
      $("fgLives").textContent = "🐸 ×" + Math.max(0, lives);
      $("fgLevel").textContent = "Level " + level;
      requestAnimationFrame(loop);
    }

    const go = hop;
    const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const d = KEYMAP[e.code]; if (!d) return;
      e.preventDefault(); if (!e.repeat) go(d);
    });
    host.querySelectorAll(".fg-pad [data-dir]").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); go(b.dataset.dir); }));
    let swipe = null;
    canvas.addEventListener("pointerdown", e => { swipe = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", e => {
      if (!swipe) return;
      const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1]; swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) { go("up"); return; }   // a tap hops forward
      go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });
    canvas.tabIndex = 0;

    function start(){
      score = 0; lives = 3; level = 1; dead = 0; homes = HOMES.map(() => false);
      fx.clear(); buildLanes(); newFrog();
      running = true; panel.hidden = true; canvas.focus();
    }
    function openGame(){
      isOpen = true; running = false;
      Fun.screen(overlay, true);
      level = 1; homes = HOMES.map(() => false); buildLanes(); frog = null; timer = TIME;
      panelTitle.textContent = "🐸 Frog Hop";
      panelText.textContent = "Help the frog get home! Hop across the road without getting squished by the race cars, then hop on the logs and turtles to cross the river (the frog can't swim!). Land in all 5 lily pads 🪷 for the next level."
        + (store.frogBest ? ` Your best: ${store.frogBest}.` : "");
      playBtn.textContent = "▶ Play"; panel.hidden = false;
      last = performance.now(); requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    $("fgCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("fgCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
