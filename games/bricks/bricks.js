/* Rainbow Bricks: bounce the ball off your paddle to smash a wall of rainbow bricks. Silver bricks take two
   hits. Some bricks drop a power-up: 🍄 a wide paddle, ⚡ two more balls, 🐢 a slow ball or ❤️ an extra life.
   Clear the wall for the next level (five walls, then round again, faster). Move with the mouse, a finger
   or ← →, and launch with a click, a tap or Space. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "bricks", section: "games", title: "Rainbow Bricks", icon: "🏓",
    blurb: "Bounce the ball and smash the rainbow brick walls, with power-ups!",
    stat: () => store.bricksBest ? "Best: " + store.bricksBest : "",
    badges: [
      { id: "br-wall", icon: "🧱", name: "Wall Smasher", desc: "Clear a wall in Rainbow Bricks", test: () => (store.bricksLevel || 0) >= 2 },
      { id: "br-five", icon: "🌈", name: "Rainbow Wrecker", desc: "Clear all 5 walls in Rainbow Bricks", test: () => (store.bricksLevel || 0) >= 6 }
    ],
    mount
  });

  const W = 800, H = 600, COLS = 10, BW = 72, BH = 24, BX = (W - COLS * BW) / 2, BY = 70;
  const RAINBOW = ["#ff4d6d", "#ff9f1c", "#ffe14d", "#4dd96b", "#4db8ff", "#6b7bff", "#b26bff"];
  // the walls: each letter is a brick (a number is its colour row, S is silver), . is a gap
  const WALLS = [
    ["0000000000", "1111111111", "2222222222", "3333333333", "4444444444", "5555555555"],
    ["..000000..", ".11111111.", "2222222222", "3333SS3333", ".44444444.", "..555555.."],
    ["0.0.0.0.0.", ".1.1.1.1.1", "2.2.2.2.2.", ".3.3.3.3.3", "4.4.4.4.4.", ".5.5.5.5.5"],
    ["SSSSSSSSSS", "0000000000", "1........1", "2.333333.2", "2.4....4.2", "5555555555"],
    ["....00....", "...1111...", "..222222..", ".33333333.", "4444SS4444", "5555555555", "6666666666"]
  ];
  const POWERS = [["wide", "🍄"], ["multi", "⚡"], ["slow", "🐢"], ["life", "❤️"]];

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="brOverlay" hidden aria-label="Rainbow Bricks">
      <div class="game-box br-box">
        <div class="game-hud">
          <h2>🏓 Rainbow Bricks</h2>
          <span class="mono game-stat" id="brScore">⭐ 0</span>
          <span class="mono game-stat" id="brLives">❤️ ×3</span>
          <span class="mono game-stat" id="brLevel">Wall 1</span>
          <button class="btn ghost small" id="brCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="brCanvas" width="${W}" height="${H}"></canvas>
          <div class="game-panel br-panel" id="brPanel">
            <div class="game-panel-title" id="brPanelTitle">🏓 Rainbow Bricks</div>
            <div class="game-panel-text" id="brPanelText"></div>
            <button class="btn" id="brPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">Move the mouse (or ← →) to steer the paddle · click or Space to launch the ball · catch the power-ups!</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("brOverlay"), canvas = $("brCanvas"), ctx = canvas.getContext("2d");
    const panel = $("brPanel"), panelTitle = $("brPanelTitle"), panelText = $("brPanelText"), playBtn = $("brPlayBtn");
    const fx = Fun.pops();
    const keys = {};

    let isOpen = false, running = false, last = 0, clock = 0;
    let bricks = [], balls = [], drops = [], paddle = null, score = 0, lives = 3, wall = 0, round = 1, pause = 0;
    let wide = 0, slow = 0;

    function buildWall(){
      const plan = WALLS[wall % WALLS.length];
      bricks = [];
      plan.forEach((row, r) => [...row].forEach((c, col) => {
        if (c === ".") return;
        bricks.push({ x: BX + col * BW, y: BY + r * BH, hits: c === "S" ? 2 : 1, silver: c === "S", colour: c === "S" ? "#c8cdd6" : RAINBOW[+c % RAINBOW.length] });
      }));
      drops = []; resetBall();
      fx.pop(`WALL ${wall + 1}` + (round > 1 ? ` · ROUND ${round}` : ""), W / 2, H / 2, "#fff", 40);
    }
    const speed = () => (330 + wall * 18 + (round - 1) * 60) * (slow > 0 ? 0.65 : 1);
    function resetBall(){
      paddle = paddle || { x: W / 2, w: 110 };
      balls = [{ x: paddle.x, y: H - 52, vx: 0, vy: 0, stuck: true }];
      wide = 0; slow = 0; paddle.w = 110;
    }
    function launch(){
      balls.forEach(b => { if (b.stuck) { b.stuck = false; const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6; b.vx = Math.cos(a); b.vy = Math.sin(a); } });
    }

    /* ----- the ball bouncing about ----- */
    function stepBall(b, dt){
      if (b.stuck) { b.x = paddle.x; b.y = H - 52; return true; }
      const sp = speed(), R = 8;
      // a few small steps, so a fast ball can't skip through a brick
      for (let s = 0; s < 4; s++) {
        const px = b.x, py = b.y;
        b.x += b.vx * sp * dt / 4; b.y += b.vy * sp * dt / 4;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
        if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
        // the paddle: where it hits decides the angle
        const top = H - 40;
        if (b.vy > 0 && b.y + R >= top && py + R <= top + 6 && Math.abs(b.x - paddle.x) <= paddle.w / 2 + R) {
          const k = Math.max(-1, Math.min(1, (b.x - paddle.x) / (paddle.w / 2))), a = -Math.PI / 2 + k * 1.05;
          b.vx = Math.cos(a); b.vy = Math.sin(a); b.y = top - R;
          Fun.sfx.boing();
        }
        if (b.y > H + 20) return false;
        for (const br of bricks) {
          if (b.x + R < br.x || b.x - R > br.x + BW || b.y + R < br.y || b.y - R > br.y + BH) continue;
          // bounce off the side it came in from
          if (px + R <= br.x || px - R >= br.x + BW) b.vx = -b.vx; else b.vy = -b.vy;
          b.x = px; b.y = py;
          hitBrick(br);
          break;
        }
      }
      return true;
    }
    function hitBrick(br){
      br.hits--;
      const cx = br.x + BW / 2, cy = br.y + BH / 2;
      if (br.hits > 0) { br.colour = "#8e95a3"; Fun.sfx.thunk(); return; }
      bricks.splice(bricks.indexOf(br), 1);
      score += br.silver ? 30 : 10;
      fx.burst(cx, cy, br.colour, 12, 150); Fun.sfx.pop();
      if (Math.random() < 0.14) { const p = POWERS[Math.floor(Math.random() * POWERS.length)]; drops.push({ x: cx, y: cy, kind: p[0], icon: p[1] }); }
      if (!bricks.length) {
        fx.pop("WALL CLEARED! 🎉", W / 2, H / 2 - 40, "#ffe14d", 42); Fun.sfx.tada();
        wall++; if (wall % WALLS.length === 0) round++;
        store.bricksLevel = Math.max(store.bricksLevel || 0, wall + 1); Hub.checkBadges();
        pause = 1.5; balls = [];
      }
    }
    function power(kind){
      if (kind === "wide") { wide = 10; paddle.w = 170; fx.pop("🍄 BIG PADDLE!", paddle.x, H - 80, "#ff8a8a", 26); }
      if (kind === "slow") { slow = 8; fx.pop("🐢 SLOW BALL", paddle.x, H - 80, "#7dff9a", 26); }
      if (kind === "life") { lives++; fx.pop("❤️ +1 LIFE", paddle.x, H - 80, "#ff6b8a", 26); }
      if (kind === "multi") {
        const from = balls.find(b => !b.stuck) || balls[0];
        if (from) for (const a of [-0.5, 0.5]) { const ang = Math.atan2(from.vy || -1, from.vx) + a; balls.push({ x: from.x, y: from.y, vx: Math.cos(ang), vy: Math.sin(ang), stuck: false }); }
        fx.pop("⚡ MULTI BALL!", paddle.x, H - 80, "#7df9ff", 26);
      }
      Fun.sfx.coin();
    }

    function step(dt){
      if (keys.left) paddle.x -= 560 * dt;
      if (keys.right) paddle.x += 560 * dt;
      paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));
      wide = Math.max(0, wide - dt); if (!wide) paddle.w = 110;
      slow = Math.max(0, slow - dt);
      if (pause > 0) { pause -= dt; if (pause <= 0) buildWall(); return; }
      balls = balls.filter(b => stepBall(b, dt));
      drops = drops.filter(d => {
        d.y += 150 * dt;
        if (d.y > H - 50 && d.y < H - 20 && Math.abs(d.x - paddle.x) < paddle.w / 2 + 14) { power(d.kind); return false; }
        return d.y < H + 20;
      });
      if (!balls.length && pause <= 0) {
        lives--; Fun.sfx.wah(); Fun.shake(canvas);
        if (lives <= 0) { endGame(); return; }
        fx.pop("Oops! 💨", W / 2, H / 2, "#ff6b6b", 36);
        resetBall();
      }
    }
    function endGame(){
      running = false;
      const wasBest = score > (store.bricksBest || 0);
      if (wasBest) store.bricksBest = score;
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = "🏓 Game over!";
      panelText.textContent = `You scored ${score} and reached wall ${wall + 1}.` + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.bricksBest || 0}.`);
      playBtn.textContent = "▶ Play again"; panel.hidden = false;
      if (wasBest) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }

    /* ----- drawing ----- */
    function draw(dt){
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#14082e"); g.addColorStop(1, "#08203a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      bricks.forEach(br => {
        ctx.fillStyle = br.colour; ctx.fillRect(br.x + 2, br.y + 2, BW - 4, BH - 4);
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(br.x + 2, br.y + 2, BW - 4, 6);
        if (br.silver && br.hits > 1) { ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(br.x + 8 + ((clock * 80) % (BW - 20)), br.y + 4, 6, BH - 8); }
      });
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "26px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'";
      drops.forEach(d => ctx.fillText(d.icon, d.x, d.y));
      // the paddle, with a rainbow stripe
      const px = paddle.x - paddle.w / 2, py = H - 40;
      const pg = ctx.createLinearGradient(px, 0, px + paddle.w, 0); RAINBOW.forEach((c, i) => pg.addColorStop(i / 6, c));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, paddle.w, 16, 8) : ctx.rect(px, py, paddle.w, 16); ctx.fill();
      balls.forEach(b => {
        ctx.fillStyle = slow > 0 ? "#7dff9a" : "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(b.x - b.vx * 10, b.y - b.vy * 10, 6, 0, 7); ctx.fill();
      });
      if (running && balls.some(b => b.stuck)) { ctx.fillStyle = "#fff"; ctx.font = "700 18px system-ui"; ctx.fillText("Click or press Space to launch!", W / 2, H - 100); }
      fx.draw(ctx, dt);
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last); last = now; clock += dt;
      if (running) step(dt);
      draw(dt);
      $("brScore").textContent = "⭐ " + score;
      $("brLives").textContent = "❤️ ×" + Math.max(0, lives);
      $("brLevel").textContent = "Wall " + (wall + 1);
      requestAnimationFrame(loop);
    }

    const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (running) launch(); return; }
      const k = KEYMAP[e.code]; if (k) { e.preventDefault(); keys[k] = true; }
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => Fun.release(keys));
    // the paddle follows the mouse or a finger; a click or a tap launches
    const toX = e => { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) * W / r.width; };
    canvas.addEventListener("pointermove", e => { if (running && paddle) paddle.x = toX(e); });
    canvas.addEventListener("pointerdown", e => { if (!running) return; paddle.x = toX(e); launch(); });
    canvas.tabIndex = 0;

    function start(){
      score = 0; lives = 3; wall = 0; round = 1; pause = 0; paddle = null;
      Fun.release(keys); fx.clear();
      buildWall();
      running = true; panel.hidden = true; canvas.focus();
    }
    function openGame(){
      isOpen = true; running = false;
      Fun.screen(overlay, true);
      wall = 0; round = 1; paddle = null; buildWall(); fx.clear();
      panelTitle.textContent = "🏓 Rainbow Bricks";
      panelText.textContent = "Bounce the ball off your paddle and smash every brick! Silver bricks need two hits. Catch the power-ups that fall: 🍄 big paddle, ⚡ multi ball, 🐢 slow ball and ❤️ an extra life."
        + (store.bricksBest ? ` Your best: ${store.bricksBest}.` : "");
      playBtn.textContent = "▶ Play"; panel.hidden = false;
      last = performance.now(); requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; Fun.release(keys); Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    $("brCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("brCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
