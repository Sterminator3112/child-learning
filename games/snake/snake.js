/* Rainbow Snake: the classic snake game, in rainbow colours. Eat fruit to grow, and every fruit adds the
   next colour of the rainbow to your tail. Don't bump into the wall, a rock or yourself! A ⭐ shows up
   every 5 fruits: grab it for Rainbow Mode (double points, and you can slide through your own tail).
   Every 10 fruits is a new level: a bit faster, with a few more rocks.
   ♾️ Can't-Die Mode: no rocks, you wrap round the edges and slide through your tail, and there are always
   3 upgrades on the lawn: ⭐ Rainbow Mode, 🍄 Mega Grow (5 longer at once) and 💎 a gem (10 points). */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "snake", section: "games", title: "Rainbow Snake", icon: "🐍",
    blurb: "Eat fruit, grow a rainbow tail, and grab the ⭐ for Rainbow Mode!",
    stat: () => store.snakeBest ? "Best: " + store.snakeBest : "",
    badges: [
      { id: "snake10", icon: "🐍", name: "Hungry Snake", desc: "Score 10 in Rainbow Snake", test: () => (store.snakeBest || 0) >= 10 },
      { id: "snake50", icon: "🌈", name: "Rainbow Snake", desc: "Score 50 in Rainbow Snake", test: () => (store.snakeBest || 0) >= 50 },
      { id: "snakeLong", icon: "🐉", name: "Mega Dragon", desc: "Grow your snake to 40 long", test: () => (store.snakeLongest || 0) >= 40 }
    ],
    mount
  });

  const COLS = 25, ROWS = 20, T = 24, CW = COLS * T, CH = ROWS * T;
  const RAINBOW = ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd96b", "#4db8ff", "#6b7bff", "#b26bff"];
  const FRUIT = ["🍎", "🍓", "🍌", "🍇", "🍊", "🍉", "🍒", "🍍", "🥝", "🫐"];
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  // upgrades you can pick up: what they look like, and what they do
  const UPGRADES = { star: "⭐", grow: "🍄", gem: "💎" };
  const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="snOverlay" hidden aria-label="Rainbow Snake">
      <div class="game-box sn-box">
        <div class="game-hud">
          <h2>🐍 Rainbow Snake</h2>
          <span class="mono game-stat" id="snScore">⭐ 0</span>
          <span class="mono game-stat" id="snLen">📏 3</span>
          <span class="mono game-stat" id="snLevel">Level 1</span>
          <button class="btn ghost small" id="snCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="snCanvas" width="${CW}" height="${CH}"></canvas>
          <div class="game-panel sn-panel" id="snPanel">
            <div class="game-panel-title" id="snPanelTitle">🐍 Rainbow Snake</div>
            <div class="game-panel-text" id="snPanelText"></div>
            <div class="sn-panel-btns">
              <button class="btn" id="snPlayBtn" type="button">▶ Play</button>
              <button class="btn ghost" id="snZenBtn" type="button">♾️ Can't-Die Mode</button>
            </div>
          </div>
        </div>
        <div class="game-help">← ↑ → ↓ or W A S D to steer (or swipe) · eat 🍎 to grow · ⭐ Rainbow Mode · 🍄 Mega Grow · 💎 10 points</div>
        <div class="sn-pad fun-dpad">
          <button class="btn ghost" data-dir="up" type="button" aria-label="Up">▲</button>
          <button class="btn ghost" data-dir="left" type="button" aria-label="Left">◀</button>
          <button class="btn ghost" data-dir="down" type="button" aria-label="Down">▼</button>
          <button class="btn ghost" data-dir="right" type="button" aria-label="Right">▶</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("snOverlay"), canvas = $("snCanvas"), ctx = canvas.getContext("2d");
    const panel = $("snPanel"), panelTitle = $("snPanelTitle"), panelText = $("snPanelText"), playBtn = $("snPlayBtn");
    const fx = Fun.pops();

    let isOpen = false, running = false, last = 0, clock = 0, tickT = 0;
    let snake = [], dir = "right", queue = [], fruit = null, ups = [], rocks = [];
    let score = 0, level = 1, eaten = 0, rainbow = 0, dead = 0, grow = 0, zen = false;

    const same = (a, b) => a.x === b.x && a.y === b.y;
    const taken = p => snake.some(s => same(s, p)) || rocks.some(r => same(r, p)) || (fruit && same(fruit, p)) || ups.some(u => same(u, p));
    function freeSpot(){
      for (let i = 0; i < 500; i++) {
        const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        // keep things off the row the snake starts on, so a rock never sits right in front of it
        if (!taken(p) && !(p.y === 10 && p.x < 14)) return p;
      }
      return { x: 0, y: 0 };
    }
    const tickTime = () => Math.max(0.055, 0.15 - (level - 1) * 0.012) * (rainbow > 0 ? 0.8 : 1);

    function reset(){
      snake = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }];
      dir = "right"; queue = []; rocks = []; ups = []; fruit = null;
      score = 0; level = 1; eaten = 0; rainbow = 0; dead = 0; grow = 0; tickT = 0;
      fruit = { ...freeSpot(), icon: FRUIT[0] };
      if (zen) for (const kind of Object.keys(UPGRADES)) ups.push({ ...freeSpot(), kind });
      fx.clear();
    }
    function levelUp(){
      level++;
      if (!zen) for (let i = 0; i < 3; i++) rocks.push(freeSpot());
      fx.pop("LEVEL " + level + "!", CW / 2, CH / 2, "#ffe14d", 40); Fun.sfx.tada();
    }

    function step(){
      while (queue.length && (queue[0] === OPPOSITE[dir] || queue[0] === dir)) queue.shift();
      if (queue.length) dir = queue.shift();
      const [dx, dy] = DIRS[dir], head = { x: snake[0].x + dx, y: snake[0].y + dy };
      if (zen) { head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS; }   // out one side, in the other
      const hitSelf = snake.slice(0, grow > 0 ? snake.length : -1).some(s => same(s, head));
      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || rocks.some(r => same(r, head)) || (hitSelf && rainbow <= 0 && !zen)) {
        crash(); return;
      }
      snake.unshift(head);
      if (grow > 0) grow--; else snake.pop();
      const px = (head.x + 0.5) * T, py = (head.y + 0.5) * T;
      if (fruit && same(head, fruit)) {
        const pts = rainbow > 0 ? 2 : 1;
        score += pts; eaten++; grow += 1;
        fx.pop("+" + pts, px, py - 10, RAINBOW[eaten % RAINBOW.length], 26); fx.burst(px, py, RAINBOW[eaten % RAINBOW.length], 14);
        Fun.sfx.chomp();
        fruit = { ...freeSpot(), icon: FRUIT[eaten % FRUIT.length] };
        if (!zen && eaten % 5 === 0 && !ups.length) ups.push({ ...freeSpot(), kind: "star", life: 7 });
        if (eaten % 10 === 0) levelUp();
      }
      const up = ups.find(u => same(head, u));
      if (up) {
        ups.splice(ups.indexOf(up), 1);
        if (up.kind === "star") { rainbow = 6; score += 3; fx.pop("🌈 RAINBOW MODE!", CW / 2, CH * 0.3, "#fff", 38); Fun.sfx.zap(); }
        if (up.kind === "grow") { grow += 5; score += 2; fx.pop("🍄 MEGA GROW!", CW / 2, CH * 0.3, "#ff8a8a", 38); Fun.sfx.boing(); }
        if (up.kind === "gem") { score += 10; fx.pop("💎 +10!", px, py - 10, "#7df9ff", 34); Fun.sfx.coin(); }
        fx.burst(px, py, "#ffe14d", 30, 200);
        // in Can't-Die Mode a new upgrade pops up straight away, so there are always 3
        if (zen) ups.push({ ...freeSpot(), kind: up.kind });
      }
      if (zen) store.snakeZenBest = Math.max(store.snakeZenBest || 0, score);
      else store.snakeLongest = Math.max(store.snakeLongest || 0, snake.length);
    }
    function crash(){
      running = false; dead = 1.2;
      const h = snake[0];
      fx.pop("BONK!", (h.x + 0.5) * T, (h.y + 0.5) * T, "#ff4d4d", 40); Fun.sfx.bonk(); Fun.shake(canvas);
      setTimeout(endGame, 900);
    }
    function endGame(){
      if (!isOpen) return;
      const wasBest = score > (store.snakeBest || 0);
      if (wasBest) store.snakeBest = score;
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = "🐍 Game over!";
      panelText.textContent = `You scored ${score}, grew to ${snake.length} long and reached level ${level}.`
        + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.snakeBest || 0}.`);
      playBtn.textContent = "▶ Play again";
      panel.hidden = false;
      if (wasBest) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }

    /* ----- drawing ----- */
    function draw(dt){
      // a checkered lawn, which shimmers in Rainbow Mode
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = rainbow > 0 ? `hsl(${(x * 14 + y * 14 + clock * 220) % 360},70%,${(x + y) % 2 ? 30 : 34}%)` : (x + y) % 2 ? "#2f8f4e" : "#36a058";
        ctx.fillRect(x * T, y * T, T, T);
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${T * 0.85}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
      rocks.forEach(r => ctx.fillText("🪨", (r.x + 0.5) * T, (r.y + 0.55) * T));
      if (fruit) { const b = 1 + Math.sin(clock * 6) * 0.08; ctx.save(); ctx.translate((fruit.x + 0.5) * T, (fruit.y + 0.55) * T); ctx.scale(b, b); ctx.fillText(fruit.icon, 0, 0); ctx.restore(); }
      ups = ups.filter(u => {
        if (u.life !== undefined && (u.life -= dt) <= 0) return false;   // a star in normal mode only stays a few seconds
        if (u.life === undefined || u.life > 2 || Math.floor(clock * 8) % 2) { ctx.save(); ctx.translate((u.x + 0.5) * T, (u.y + 0.55) * T); ctx.rotate(Math.sin(clock * 4) * 0.3); ctx.fillText(UPGRADES[u.kind], 0, 0); ctx.restore(); }
        return true;
      });
      // the snake: tail first, each piece the next rainbow colour, getting a little thinner to the tip
      for (let i = snake.length - 1; i >= 0; i--) {
        const s = snake[i], r = T * (0.48 - Math.min(0.14, i * 0.006));
        ctx.fillStyle = rainbow > 0 ? `hsl(${(i * 25 + clock * 400) % 360},90%,60%)` : RAINBOW[i % RAINBOW.length];
        ctx.beginPath(); ctx.arc((s.x + 0.5) * T, (s.y + 0.5) * T, r, 0, 7); ctx.fill();
        // join it to the next piece so the body looks smooth (not across the lawn when it wraps round an edge)
        const n = snake[i - 1];
        if (n && Math.abs(s.x - n.x) + Math.abs(s.y - n.y) === 1) ctx.fillRect(Math.min(s.x, n.x) * T + T / 2 - (s.y === n.y ? 0 : r), Math.min(s.y, n.y) * T + T / 2 - (s.x === n.x ? 0 : r), s.y === n.y ? T : r * 2, s.x === n.x ? T : r * 2);
      }
      const h = snake[0];
      if (h) {
        const look = DIRS[dir];
        Fun.face(ctx, (h.x + 0.5) * T + look[0] * 3, (h.y + 0.5) * T + look[1] * 3, T * 0.42, dead > 0 ? "dizzy" : rainbow > 0 ? "grin" : "happy", clock, look[0], look[1]);
      }
      fx.draw(ctx, dt);
      if (rainbow > 0) {
        ctx.font = "900 18px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "right"; ctx.lineWidth = 4; ctx.strokeStyle = "#1a1030";
        const t = `🌈 ${Math.ceil(rainbow)}`; ctx.strokeText(t, CW - 10, 18); ctx.fillStyle = "#fff"; ctx.fillText(t, CW - 10, 18);
      }
    }
    function hud(){
      $("snScore").textContent = "⭐ " + score;
      $("snLen").textContent = "📏 " + snake.length;
      $("snLevel").textContent = (zen ? "♾️ " : "") + "Level " + level;
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last); last = now; clock += dt;
      if (running) {
        rainbow = Math.max(0, rainbow - dt);
        tickT += dt;
        while (running && tickT >= tickTime()) { tickT -= tickTime(); step(); }
      }
      dead = Math.max(0, dead - dt);
      draw(dt); hud();
      requestAnimationFrame(loop);
    }

    function start(noDying){
      zen = !!noDying;
      reset();
      running = true; panel.hidden = true;
      canvas.focus();
    }
    function openGame(){
      isOpen = true; running = false;
      reset();
      Fun.screen(overlay, true);
      panelTitle.textContent = "🐍 Rainbow Snake";
      panelText.textContent = "Eat the fruit to grow a rainbow tail! Don't bump into the wall, a rock 🪨 or yourself. When a ⭐ shows up, grab it fast for Rainbow Mode: double points, and you can slide right through your own tail."
        + (store.snakeBest ? ` Your best: ${store.snakeBest}.` : "")
        + " Or try ♾️ Can't-Die Mode: no rocks, no crashing, and 3 upgrades on the lawn at once!"
        + (store.snakeZenBest ? ` (best: ${store.snakeZenBest})` : "");
      playBtn.textContent = "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; Hub.saveStore(); Fun.screen(overlay, false); }

    const want = d => { if (running && queue.length < 3) queue.push(d); };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const d = KEYMAP[e.code];
      if (!d) return;
      e.preventDefault(); want(d);
    });
    host.querySelectorAll(".sn-pad [data-dir]").forEach(btn => btn.addEventListener("pointerdown", e => { e.preventDefault(); want(btn.dataset.dir); }));
    // swipe on the lawn to steer
    let swipeFrom = null;
    canvas.addEventListener("pointerdown", e => { swipeFrom = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointermove", e => {
      if (!swipeFrom) return;
      const dx = e.clientX - swipeFrom[0], dy = e.clientY - swipeFrom[1];
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      want(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      swipeFrom = [e.clientX, e.clientY];
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { swipeFrom = null; }));
    canvas.tabIndex = 0;

    $("snCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("snCloseBtn"));
    playBtn.addEventListener("click", () => start(false));
    $("snZenBtn").addEventListener("click", () => start(true));

    return { open: openGame, close: closeGame };
  }
})();
