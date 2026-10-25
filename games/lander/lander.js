/* Rocket Lander: land a rocket gently on the landing pads of 8 planets and moons, each with its own gravity
   (and wind on some). Fire the engine to slow down, tip left and right to steer, and touch down slowly and
   upright on a pad. A small pad scores more. Fuel left over is points too. After all 8 worlds the tour
   starts again, windier. 3 rockets per game. */
(function(){
  "use strict";
  const store = Hub.store;

  // g is in m/s² like the real thing; wind pushes sideways (px/s²)
  const WORLDS = [
    { name: "The Moon", icon: "🌕", g: 1.62, wind: 0, ground: "#9a9aa3", sky: ["#05060f", "#151a33"] },
    { name: "Pluto", icon: "🧊", g: 0.62, wind: 0, ground: "#d8c6ae", sky: ["#04040a", "#1a1630"] },
    { name: "Mars", icon: "🔴", g: 3.71, wind: 4, ground: "#c1572e", sky: ["#3a1a14", "#c27b55"] },
    { name: "Titan", icon: "🟠", g: 1.35, wind: 10, ground: "#a8742f", sky: ["#4a3510", "#c99a45"] },
    { name: "Europa", icon: "🧊", g: 1.31, wind: 0, ground: "#e8eef5", sky: ["#02040c", "#15233f"] },
    { name: "Mercury", icon: "🪨", g: 3.7, wind: 0, ground: "#7d7468", sky: ["#000", "#1c1b22"] },
    { name: "Venus", icon: "🌋", g: 8.87, wind: 12, ground: "#d9a441", sky: ["#6b4a12", "#e8c06a"] },
    { name: "Earth", icon: "🌍", g: 9.81, wind: 6, ground: "#4f9a3e", sky: ["#3a8de0", "#bfe2ff"] }
  ];
  const PX = 8;                 // pixels per metre, for gravity
  const THRUST = 115, TURN = 2.6, BURN = 8;
  const SAFE_VY = 42, SAFE_VX = 26, SAFE_TILT = 0.28;

  Hub.register({
    id: "lander", section: "games", title: "Rocket Lander", icon: "🚀",
    blurb: "Land a rocket softly on the Moon, Mars and 6 more worlds, each with its own gravity!",
    stat: () => store.landerBest ? "Best: " + store.landerBest : "",
    badges: [
      { id: "lander1", icon: "🌕", name: "One Small Step", desc: "Land on the Moon in Rocket Lander", test: () => (store.landerWorlds || 0) >= 1 },
      { id: "lander3", icon: "🔴", name: "Mars Pilot", desc: "Land on Mars in Rocket Lander", test: () => (store.landerWorlds || 0) >= 3 },
      { id: "lander8", icon: "🌍", name: "Space Ace", desc: "Land on all 8 worlds in one game of Rocket Lander", test: () => (store.landerWorlds || 0) >= 8 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="ldOverlay" hidden aria-label="Rocket Lander">
      <div class="game-box">
        <div class="game-hud">
          <h2>🚀 Rocket Lander</h2>
          <span class="mono game-stat" id="ldScore">⭐ 0</span>
          <span class="mono game-stat" id="ldLives">🚀 ×3</span>
          <span class="mono game-stat" id="ldWorld">🌕</span>
          <button class="btn ghost small" id="ldCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="ldCanvas" width="960" height="540"></canvas>
          <div class="game-panel ld-panel" id="ldPanel">
            <div class="game-panel-title" id="ldPanelTitle">🚀 Rocket Lander</div>
            <div class="game-panel-text" id="ldPanelText"></div>
            <button class="btn" id="ldPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">↑ or W or Space to fire the engine · ← → or A D to tip the rocket · land slowly and upright on a pad</div>
        <div class="game-touch">
          <button class="btn ghost" data-ldkey="left" type="button" aria-label="Tip left">↺</button>
          <button class="btn ghost" data-ldkey="up" type="button" aria-label="Fire the engine">🔥 Boost</button>
          <button class="btn ghost" data-ldkey="right" type="button" aria-label="Tip right">↻</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("ldOverlay"), canvas = $("ldCanvas"), ctx = canvas.getContext("2d");
    const panel = $("ldPanel"), panelTitle = $("ldPanelTitle"), panelText = $("ldPanelText"), playBtn = $("ldPlayBtn");
    const W = 960, H = 540;
    const fx = Fun.pops();
    const keys = {};

    let isOpen = false, running = false, last = 0, clock = 0;
    let score = 0, lives = 3, wi = 0, round = 1, landed = 0;
    let rocket = null, ground = [], pads = [], stars = [], parts = [], pause = 0, after = null, gust = 0;
    const world = () => WORLDS[wi % WORLDS.length];

    /* ----- a new world: bumpy ground with flat pads ----- */
    function buildWorld(){
      const n = 48, step = W / n;
      ground = [];
      let y = 430;
      for (let i = 0; i <= n; i++) { y = Math.max(300, Math.min(510, y + (Math.random() - 0.5) * (60 + round * 10))); ground.push([i * step, y]); }
      // two or three pads: wide ones score ×2, narrow ones ×5
      pads = [];
      const spots = [[6, 6, 2], [22, 3, 5], [37, 5, 2]].filter((p, k) => k !== 2 || wi % 2);
      spots.forEach(([at, wide, mult]) => {
        const i = at + Math.floor(Math.random() * 4), py = ground[i][1];
        for (let k = i; k <= i + wide - (round > 1 ? 1 : 0); k++) ground[k][1] = py;
        pads.push({ x0: ground[i][0], x1: ground[i + wide - (round > 1 ? 1 : 0)][0], y: py, mult });
      });
      stars = Array.from({ length: 70 }, () => [Math.random() * W, Math.random() * 300, Math.random()]);
      rocket = { x: 120 + Math.random() * 720, y: 60, vx: (Math.random() - 0.5) * 40, vy: 0, a: 0, fuel: 100, flame: 0, dead: false };
      parts = []; gust = 0;
      pause = 1.6; after = null;
      fx.pop(`${world().icon} ${world().name}`, W / 2, 180, "#fff", 40);
      fx.pop(`gravity ${world().g} m/s²` + (world().wind ? " · windy!" : ""), W / 2, 225, "#ffe14d", 22);
    }
    function groundAt(x){
      const step = W / (ground.length - 1), i = Math.max(0, Math.min(ground.length - 2, Math.floor(x / step))), k = (x - i * step) / step;
      return ground[i][1] + (ground[i + 1][1] - ground[i][1]) * k;
    }

    /* ----- flying ----- */
    function step(dt){
      const r = rocket, w = world();
      if (keys.left) r.a -= TURN * dt;
      if (keys.right) r.a += TURN * dt;
      r.a = Math.max(-1.4, Math.min(1.4, r.a));
      const burning = keys.up && r.fuel > 0;
      r.flame += ((burning ? 1 : 0) - r.flame) * Math.min(1, dt * 12);
      if (burning) {
        r.vx += Math.sin(r.a) * THRUST * dt; r.vy -= Math.cos(r.a) * THRUST * dt;
        r.fuel = Math.max(0, r.fuel - BURN * dt);
        if (Math.random() < 0.7) parts.push({ x: r.x - Math.sin(r.a) * 26, y: r.y + Math.cos(r.a) * 26, vx: -Math.sin(r.a) * 120 + (Math.random() - 0.5) * 40, vy: Math.cos(r.a) * 120, t: 0, c: Math.random() < 0.5 ? "#ffb347" : "#ffe14d" });
        if (r.fuel === 0) fx.pop("OUT OF FUEL!", r.x, r.y - 60, "#ff6b6b", 26);
      }
      // gravity, and wind that comes in gusts
      gust = Math.sin(clock * 0.7) * 0.6 + Math.sin(clock * 1.9) * 0.4;
      r.vy += w.g * PX * dt;
      r.vx += (w.wind + (round - 1) * 4) * gust * dt;
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (r.x < 0) r.x += W; if (r.x > W) r.x -= W;
      if (r.y < 10) { r.y = 10; r.vy = Math.max(0, r.vy); }
      // touching down: the rocket's feet are 24 px below its middle
      const feet = r.y + 22 * Math.cos(r.a);
      if (feet >= groundAt(r.x)) touchDown();
    }
    function touchDown(){
      const r = rocket, pad = pads.find(p => r.x - 12 >= p.x0 && r.x + 12 <= p.x1);
      const soft = r.vy <= SAFE_VY && Math.abs(r.vx) <= SAFE_VX && Math.abs(r.a) <= SAFE_TILT;
      if (pad && soft) {
        const butter = r.vy < 15;
        r.y = pad.y - 22; r.vy = 0; r.vx = 0; r.a = 0; r.flame = 0;
        const gentle = butter ? 50 : 0, pts = Math.round((100 + Math.round(r.fuel) + gentle) * pad.mult);
        score += pts; landed++;
        store.landerWorlds = Math.max(store.landerWorlds || 0, landed);
        fx.pop(butter ? "BUTTER LANDING! 🧈" : "THE EAGLE HAS LANDED!", W / 2, 150, "#7dff9a", 34);
        fx.pop(`+${pts} (×${pad.mult})`, r.x, r.y - 60, "#ffe14d", 28);
        Fun.sfx.tada(); Hub.checkBadges();
        pause = 2.2; after = () => { wi++; if (wi % WORLDS.length === 0) { round++; fx.pop("ROUND " + round + ": windier!", W / 2, 270, "#7df9ff", 30); } buildWorld(); };
      } else {
        r.dead = true;
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 200; parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, c: ["#ff4d4d", "#ffb347", "#ffe14d", "#ccc"][i % 4] }); }
        const why = !pad ? "Missed the pad!" : r.vy > SAFE_VY ? "Too fast!" : Math.abs(r.vx) > SAFE_VX ? "Sliding sideways!" : "Not upright!";
        fx.pop("KABOOM! 💥", r.x, r.y - 40, "#ff6b6b", 40); fx.pop(why, W / 2, 160, "#fff", 28);
        Fun.sfx.crash(); Fun.shake(canvas);
        lives--;
        pause = 2.2; after = () => { if (lives > 0) buildWorld(); else endGame(); };
      }
    }
    function endGame(){
      running = false;
      const wasBest = score > (store.landerBest || 0);
      if (wasBest) store.landerBest = score;
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = "🚀 Mission over!";
      panelText.textContent = `You landed on ${landed} world${landed === 1 ? "" : "s"} and scored ${score}.`
        + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.landerBest || 0}.`);
      playBtn.textContent = "▶ Fly again"; panel.hidden = false;
      if (wasBest) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }

    /* ----- drawing ----- */
    function draw(dt){
      const w = world(), sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, w.sky[0]); sky.addColorStop(1, w.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      stars.forEach(([x, y, b]) => { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(clock * (0.5 + b) + b * 9)); ctx.fillRect(x, y, 2, 2); });
      ctx.globalAlpha = 1;
      // the ground, with a darker rim on top
      ctx.fillStyle = w.ground; ctx.beginPath(); ctx.moveTo(0, H);
      ground.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W, H); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 3; ctx.beginPath(); ground.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      // the pads with blinking lights
      pads.forEach(p => {
        ctx.fillStyle = "#d0d4dc"; ctx.fillRect(p.x0, p.y - 4, p.x1 - p.x0, 8);
        const on = Math.floor(clock * 3) % 2;
        ctx.fillStyle = on ? "#7dff9a" : "#2a6"; ctx.beginPath(); ctx.arc(p.x0 + 4, p.y - 8, 4, 0, 7); ctx.arc(p.x1 - 4, p.y - 8, 4, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "800 16px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("×" + p.mult, (p.x0 + p.x1) / 2, p.y + 18);
      });
      // exhaust and explosion bits
      parts = parts.filter(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; ctx.globalAlpha = Math.max(0, 1 - p.t * 1.6); ctx.fillStyle = p.c; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); return p.t < 0.7; });
      ctx.globalAlpha = 1;
      if (rocket && !rocket.dead) drawRocket(rocket);
      if (rocket && running) drawGauges();
      fx.draw(ctx, dt);
    }
    function drawRocket(r){
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
      if (r.flame > 0.05) {
        const len = 18 + r.flame * (18 + Math.random() * 14);
        ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(0, 16 + len); ctx.lineTo(8, 16); ctx.fill();
        ctx.fillStyle = "#fff6b0"; ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(0, 16 + len * 0.6); ctx.lineTo(4, 16); ctx.fill();
      }
      // legs, body, window, nose and fins
      ctx.strokeStyle = "#bbb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-16, 22); ctx.moveTo(8, 10); ctx.lineTo(16, 22); ctx.stroke();
      ctx.fillStyle = "#f2f2f5"; ctx.beginPath(); ctx.moveTo(-11, 16); ctx.lineTo(-11, -10); ctx.quadraticCurveTo(0, -34, 11, -10); ctx.lineTo(11, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff4d6d"; ctx.beginPath(); ctx.moveTo(-11, -10); ctx.quadraticCurveTo(0, -34, 11, -10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff4d6d"; ctx.beginPath(); ctx.moveTo(-11, 4); ctx.lineTo(-18, 16); ctx.lineTo(-11, 16); ctx.moveTo(11, 4); ctx.lineTo(18, 16); ctx.lineTo(11, 16); ctx.fill();
      ctx.fillStyle = "#4db8ff"; ctx.beginPath(); ctx.arc(0, -2, 5, 0, 7); ctx.fill(); ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // speed, tilt and fuel, green when they're safe for landing
    function drawGauges(){
      const r = rocket, ok = (v, lim) => v <= lim ? "#7dff9a" : "#ff6b6b";
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(10, 10, 210, 92);
      ctx.font = "700 14px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = ok(r.vy, SAFE_VY); ctx.fillText(`⬇ down speed ${Math.max(0, Math.round(r.vy))}`, 20, 26);
      ctx.fillStyle = ok(Math.abs(r.vx), SAFE_VX); ctx.fillText(`↔ side speed ${Math.round(Math.abs(r.vx))}`, 20, 46);
      ctx.fillStyle = ok(Math.abs(r.a), SAFE_TILT); ctx.fillText(`📐 tilt ${Math.round(r.a * 57)}°`, 20, 66);
      ctx.fillStyle = "#333"; ctx.fillRect(20, 80, 190, 12);
      ctx.fillStyle = r.fuel > 25 ? "#ffd84d" : "#ff6b6b"; ctx.fillRect(20, 80, 1.9 * r.fuel, 12);
      ctx.fillStyle = "#fff"; ctx.font = "700 10px system-ui"; ctx.fillText("FUEL", 24, 86);
      if (world().wind) { ctx.textAlign = "right"; ctx.font = "700 14px system-ui"; ctx.fillStyle = "#fff"; ctx.fillText(`💨 wind ${gust > 0.2 ? "→" : gust < -0.2 ? "←" : "·"}`, W - 16, 24); }
      // a little arrow when the rocket is about to leave the top
      if (r.y < 14) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(r.x, 2); ctx.lineTo(r.x - 7, 14); ctx.lineTo(r.x + 7, 14); ctx.fill(); }
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last); last = now; clock += dt;
      if (running) {
        if (pause > 0) { pause -= dt; if (pause <= 0 && after) { const f = after; after = null; f(); } }
        else if (!rocket.dead) step(dt);
      }
      draw(dt);
      $("ldScore").textContent = "⭐ " + score;
      $("ldLives").textContent = "🚀 ×" + Math.max(0, lives);
      $("ldWorld").textContent = `${world().icon} ${world().name}` + (round > 1 ? ` · R${round}` : "");
      requestAnimationFrame(loop);
    }

    const KEYMAP = { ArrowUp: "up", KeyW: "up", Space: "up", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault(); keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => Fun.release(keys));
    Fun.holdButtons(host.querySelectorAll("[data-ldkey]"), keys, "ldkey");
    canvas.tabIndex = 0;

    function start(){
      score = 0; lives = 3; wi = 0; round = 1; landed = 0;
      Fun.release(keys); fx.clear();
      buildWorld();
      running = true; panel.hidden = true; canvas.focus();
    }
    function openGame(){
      isOpen = true; running = false;
      Fun.screen(overlay, true);
      wi = 0; round = 1; buildWorld(); rocket.y = 120; fx.clear();
      panelTitle.textContent = "🚀 Rocket Lander";
      panelText.textContent = "Land your rocket on 8 worlds, from the Moon to Earth! Fire the engine to slow down, tip it to steer, and touch down slowly and upright on a pad. Watch the numbers top left: green means safe. Small pads ×5, big pads ×2."
        + (store.landerBest ? ` Your best: ${store.landerBest}.` : "");
      playBtn.textContent = "▶ Play"; panel.hidden = false;
      last = performance.now(); requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; Fun.release(keys); Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    $("ldCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("ldCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
