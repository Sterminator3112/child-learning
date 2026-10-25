/* Blox Pool: American 8-ball pool, Roblox style, against BloxBot.
   Fifteen balls, six pockets. Pot all of your group (solids or stripes), then the black 8, to win.
   The first ball you pot decides your group. Potting the cue ball, or hitting the wrong ball first, is a foul
   and gives the other player the cue ball to put anywhere. Pot the 8 too early and you lose.
   Aim: move the mouse, or tap the table. Shoot: hold the mouse button (or Space) and let go, or drag the POWER bar up and let go.
   SPIN: hit the cue ball high to follow through, low to screw back, or to the side to bend off the cushions.
   Modes: BloxBot on Easy, Normal or Hard, or Practice on your own (clear the table in as few shots as you can). */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "pool", section: "games", title: "Blox Pool", icon: "🎱",
    blurb: "American 8-ball pool, Roblox style. Pot your balls, then the black 8!",
    stat: () => store.poolWins ? "Wins: " + store.poolWins : "",
    badges: [
      { id: "poolwin", icon: "🎱", name: "Pool Shark", desc: "Win a game of Blox Pool",       test: () => (store.poolWins || 0) >= 1 },
      { id: "poolrun", icon: "🔥", name: "On a Roll",  desc: "Pot 3 balls in one turn",       test: () => (store.poolBestRun || 0) >= 3 },
      { id: "poolhard", icon: "🤖", name: "Bot Breaker", desc: "Beat BloxBot on Hard",           test: () => (store.poolHardWins || 0) >= 1 },
      { id: "poolclear", icon: "🎯", name: "Sharp Shooter", desc: "Clear the practice table in 30 shots or fewer", test: () => store.poolPracticeBest > 0 && store.poolPracticeBest <= 30 }
    ],
    mount
  });

  /* ---------------- the table: x runs along it, y across it (the near side is y = WD) ---------------- */
  const L = 240, WD = 120, R = 5;                    // table length and width, ball radius
  const POCKETS = [[0, 0, 10], [L / 2, 0, 9], [L, 0, 10], [0, WD, 10], [L / 2, WD, 9], [L, WD, 10]].map(([x, y, r]) => ({ x, y, r }));
  const FRIC = 140, E_BALL = 0.96, E_RAIL = 0.78, VMAX = 640, VMIN = 45, STOP = 5;
  const HEAD = L * 0.25, FOOT = L * 0.72;            // where the cue ball starts, and the front of the triangle
  const PAINT = ["", "#ffd400", "#1f6bff", "#ff3b30", "#8b3dff", "#ff8a00", "#19c24a", "#b5301f"];
  const colourOf = n => n === 0 ? "#ffffff" : n === 8 ? "#16161d" : PAINT[n > 8 ? n - 8 : n];
  const groupOf = n => n === 0 ? null : n === 8 ? "eight" : n < 8 ? "solid" : "stripe";
  const { clamp } = Hub.util;
  const NAMES = ["Noob_Max", "BloxBot"];
  const MODES = { easy: { label: "Easy", err: 0.07 }, normal: { label: "Normal", err: 0.022 }, hard: { label: "Hard", err: 0.007 }, practice: { label: "Practice" } };
  const SPIN_FOLLOW = 0.6, SPIN_SIDE = 0.32;         // how much top/back spin and side spin change the cue ball's path

  // how the table looks on the 960 x 540 screen: a slanted top-down view, near side wider
  const W = 960, H = 540, K = 3.3, CX = 480, Y0 = 140, HS = 300;
  const sc = t => 0.74 + 0.26 * t;
  const proj = (x, y) => { const t = y / WD, s = sc(t); return [CX + (x - L / 2) * K * s, Y0 + t * HS, K * s]; };
  const unproj = (sx, sy) => { const t = (sy - Y0) / HS, s = sc(t); return [(sx - CX) / (K * s) + L / 2, t * WD]; };

  function distSeg(px, py, ax, ay, bx, by){
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const u = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - ax - u * dx, py - ay - u * dy);
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="plOverlay" hidden aria-label="Blox Pool">
      <div class="game-box">
        <div class="game-hud">
          <h2>🎱 Blox Pool</h2>
          <span class="mono game-stat" id="plWho">Your turn</span>
          <span class="mono game-stat" id="plPot">🎱 ×0</span>
          <button class="btn ghost small" id="plCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="plCanvas" width="960" height="540"></canvas>
          <div class="pl-power" id="plPower" aria-label="Power: drag up and let go to shoot"><div class="pl-fill" id="plFill"></div><span>POWER</span></div>
          <div class="pl-spin" id="plSpin" role="slider" aria-label="Spin: tap where the cue hits the white ball"><i id="plSpinDot"></i><span>SPIN</span></div>
          <div class="game-panel pl-panel" id="plPanel">
            <div class="game-panel-title" id="plPanelTitle">Blox Pool</div>
            <div class="game-panel-text" id="plPanelText"></div>
            <button class="btn" id="plPlayBtn" type="button">▶ Play</button>
            <div class="pl-modes" id="plModes" role="group" aria-label="Who to play">
              <button class="btn ghost small" type="button" data-mode="easy">🤖 Easy</button>
              <button class="btn ghost small" type="button" data-mode="normal">🤖 Normal</button>
              <button class="btn ghost small" type="button" data-mode="hard">🤖 Hard</button>
              <button class="btn ghost small" type="button" data-mode="practice">🎯 Practice</button>
            </div>
          </div>
        </div>
        <div class="game-help">Move the mouse (or tap the table) to aim · hold the mouse button or Space and let go to shoot, harder the longer you hold · on a touch screen drag the POWER bar up and let go · ← → fine-tune the aim · tap the SPIN ball (or ↑ ↓) to hit high or low · pot your balls, then the black 8</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("plOverlay"), canvas = $("plCanvas"), ctx = canvas.getContext("2d");
    const panel = $("plPanel"), panelTitle = $("plPanelTitle"), panelText = $("plPanelText"), playBtn = $("plPlayBtn");
    const whoEl = $("plWho"), potEl = $("plPot"), powerEl = $("plPower"), fillEl = $("plFill"), spinEl = $("plSpin"), spinDot = $("plSpinDot");
    const fx = Fun.pops();

    let open = false, running = false, last = 0, clock = 0, scale = 1;
    let balls = [], cue = null, turn = 0, groups = [null, null], state = "ready";   // ready, aim, place, roll, ai, over
    let aim = 0, power = 0, charging = false, inHand = false, broke = false, shot = null, settleT = 0;
    let hover = null, runCount = 0, potThisGame = 0, status = "", ai = null, firstGame = true;
    let mode = MODES[store.poolMode] ? store.poolMode : "normal", shots = 0;
    const spin = { x: 0, y: 0 };   // where the cue hits the white ball: x right, y up, each -1 to 1
    const practice = () => mode === "practice";

    /* ---------------- setting up ---------------- */
    function ball(n, x, y){ return { n, x, y, vx: 0, vy: 0, out: false, sink: null }; }
    function rack(){
      const list = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      const order = list.slice(0, 4).concat([8]).concat(list.slice(4));   // 15 spots; the 8 goes in the middle of the third row
      // the two back corners must be one solid and one stripe
      if (groupOf(order[10]) === groupOf(order[14])) {
        const k = order.findIndex((n, i) => i !== 4 && i < 10 && n !== 8 && groupOf(n) !== groupOf(order[10]));
        [order[14], order[k]] = [order[k], order[14]];
      }
      const out = [ball(0, HEAD, WD / 2)];
      let idx = 0;
      for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
        out.push(ball(order[idx++], FOOT + row * (2 * R * 0.866 + 0.15), WD / 2 + (j - row / 2) * (2 * R + 0.15)));
      }
      return out;
    }
    function reset(){
      balls = rack(); cue = balls[0];
      groups = [null, null]; inHand = false; broke = false; shot = null; power = 0; charging = false;
      runCount = 0; potThisGame = 0; hover = null; ai = null;
      turn = firstGame || practice() ? 0 : (Math.random() < 0.5 ? 0 : 1); firstGame = false;
      shots = 0; setSpin(0, 0);
      aim = Math.atan2(0, 1);
      fx.clear();
      nextTurnState();
      status = turn === 0 ? "You break! Aim, then shoot." : "BloxBot breaks.";
    }
    function nextTurnState(){
      if (turn === 0) { state = inHand ? "place" : "aim"; }
      else { state = "ai"; ai = { t: 0, phase: "think", plan: null, a0: aim }; }
      power = 0; charging = false;
    }

    /* ---------------- the physics ---------------- */
    function collide(a, b){
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, md = 2 * R;
      if (d2 >= md * md || d2 === 0) return;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (md - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) return;
      const pre = Math.hypot(cue.vx, cue.vy);
      const j = -(1 + E_BALL) * rv / 2;
      a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
      // top spin rolls the cue ball on after the hit, back spin pulls it back
      if ((a === cue || b === cue) && cue.sy) { cue.vx += cue.dx * cue.sy * SPIN_FOLLOW * pre; cue.vy += cue.dy * cue.sy * SPIN_FOLLOW * pre; cue.sy = 0; }
      if (shot && shot.first === null && (a === cue || b === cue)) shot.first = (a === cue ? b : a).n;
      if (-rv > 30) Fun.sfx.thunk();
    }
    function capture(b, P){
      b.sink = { x: P.x, y: P.y, t: 0 }; b.vx = b.vy = 0;
      if (shot) { shot.pocketed.push(b.n); if (b === cue) shot.scratch = true; }
      Fun.sfx.pop();
      const [sx, sy] = proj(P.x, P.y);
      fx.burst(sx, sy, colourOf(b.n === 0 ? 0 : b.n), 12, 140);
      if (b === cue) { fx.pop("SCRATCH!", CX, 330, "#ff8a8a", 40); Fun.sfx.nope(); }
      else if (shot) { potThisGame++; fx.pop(b.n === 8 ? "THE 8!" : "POT!", sx, sy + 20, "#ffe14d", 34); }
    }
    function physics(h){
      for (const b of balls) {
        if (b.out || b.sink) continue;
        b.x += b.vx * h; b.y += b.vy * h;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) {
          const s2 = Math.max(0, sp - FRIC * h);
          if (s2 < STOP) { b.vx = b.vy = 0; } else { b.vx *= s2 / sp; b.vy *= s2 / sp; }
        }
        let caught = false;
        for (const P of POCKETS) if (Math.hypot(b.x - P.x, b.y - P.y) < P.r * 0.92) { capture(b, P); caught = true; break; }
        if (caught) continue;
        let hit = 0;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * E_RAIL; hit = 1; }
        if (b.x > L - R) { b.x = L - R; b.vx = -Math.abs(b.vx) * E_RAIL; hit = 1; }
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * E_RAIL; hit = 1; }
        if (b.y > WD - R) { b.y = WD - R; b.vy = -Math.abs(b.vy) * E_RAIL; hit = 1; }
        if (hit && b === cue && cue.sx && cue.rails < 2) {
          if (b.x <= R || b.x >= L - R) b.vy += cue.sx * SPIN_SIDE * sp * (b.x <= R ? -1 : 1);
          else b.vx += cue.sx * SPIN_SIDE * sp * (b.y <= R ? 1 : -1);
          cue.rails++; cue.sx *= 0.5;
        }
        if (hit && sp > 90) Fun.sfx.bonk();
      }
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.out || a.sink) continue;
        for (let j = i + 1; j < balls.length; j++) { const b = balls[j]; if (b.out || b.sink) continue; collide(a, b); }
      }
    }
    function stepPhysics(dt){
      const n = Math.min(10, Math.max(1, Math.ceil(dt * 240)));
      for (let i = 0; i < n; i++) physics(dt / n);
      for (const b of balls) if (b.sink) { b.sink.t += dt; if (b.sink.t >= 0.3) { b.out = true; b.sink = null; } }
    }
    const moving = () => balls.some(b => b.sink || (!b.out && (b.vx || b.vy)));

    /* ---------------- taking a shot, and the rules ---------------- */
    const remaining = p => balls.filter(b => !b.out && groups[p] && groupOf(b.n) === groups[p]).length;
    function shoot(angle, pw){
      const v = VMIN + clamp(pw, 0, 1) * (VMAX - VMIN);
      cue.vx = Math.cos(angle) * v; cue.vy = Math.sin(angle) * v;
      cue.dx = Math.cos(angle); cue.dy = Math.sin(angle);
      const sp = turn === 0 ? spin : { x: 0, y: 0 };
      cue.sx = sp.x; cue.sy = sp.y; cue.rails = 0;
      shots++;
      shot = { pocketed: [], scratch: false, first: null, breakShot: !broke, cleared: !!groups[turn] && remaining(turn) === 0 };
      broke = true; state = "roll"; settleT = 0; charging = false; power = 0; inHand = false;
      setSpin(0, 0);
      Fun.sfx.whoosh();
    }
    function respot8(){
      const b = balls.find(o => o.n === 8); b.out = false; b.vx = b.vy = 0;
      let x = FOOT; b.y = WD / 2;
      while (balls.some(o => o !== b && !o.out && Math.hypot(o.x - x, o.y - b.y) < 2 * R + 0.2) && x < L - 2 * R) x += 2 * R;
      b.x = x;
    }
    function finish(winner, why){
      state = "over"; running = false;
      const won = winner === 0;
      store.poolPlayed = (store.poolPlayed || 0) + 1;
      if (won) store.poolWins = (store.poolWins || 0) + 1;
      if (won && mode === "hard") store.poolHardWins = (store.poolHardWins || 0) + 1;
      if (runCount > (store.poolBestRun || 0)) store.poolBestRun = runCount;
      Hub.saveStore(); Hub.checkBadges();
      if (won) { Fun.sfx.tada(); Hub.confettiBurst(playBtn); } else Fun.sfx.wah();
      panelTitle.textContent = won ? "🏆 You won!" : "😩 BloxBot won this time";
      panelText.textContent = why + ` (BloxBot on ${MODES[mode].label}.)` + (store.poolWins ? ` Wins so far: ${store.poolWins}.` : "");
      showPanel("▶ Play again");
    }
    function finishPractice(){
      state = "over"; running = false;
      const best = !store.poolPracticeBest || shots < store.poolPracticeBest;
      if (best) store.poolPracticeBest = shots;
      Hub.saveStore(); Hub.checkBadges();
      Fun.sfx.tada(); Hub.confettiBurst(playBtn);
      panelTitle.textContent = "🎯 Table cleared!";
      panelText.textContent = `You potted all 15 balls in ${shots} shots.` + (best ? " That's your best yet!" : ` Your best is ${store.poolPracticeBest}.`) + " Can you do it in fewer?";
      showPanel("▶ Play again");
    }
    function showPanel(label){
      playBtn.textContent = label;
      modesEl.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
      panel.hidden = false; powerEl.hidden = true; spinEl.hidden = true; playBtn.focus();
    }
    function switchTurn(){
      if (turn === 0 && runCount > (store.poolBestRun || 0)) { store.poolBestRun = runCount; Hub.saveStore(); Hub.checkBadges(); }
      runCount = 0; turn = 1 - turn;
    }
    function endShot(){
      const p = turn, o = 1 - p, S = shot, pot = S.pocketed.filter(n => n !== 0), eight = pot.includes(8);
      if (practice()) {
        const left = balls.filter(b => b.n && !b.out).length;
        if (!left) { finishPractice(); return; }
        runCount = pot.length ? runCount + pot.length : 0;
        if (pot.length > 1) fx.pop(pot.length + " IN ONE!", CX, 300, "#ffe14d", 40);
        if (S.scratch) { inHand = true; fx.pop("SCRATCH!", CX, 300, "#ff6b6b", 40); }
        status = `Shot ${shots}. ${15 - left} of 15 potted.` + (S.scratch ? " Put the cue ball back anywhere." : "");
        nextTurnState();
        if (state === "aim") aim = aimAtBest();
        return;
      }
      const myGroup = groups[p];
      let foul = S.scratch || S.first === null;
      if (!foul && myGroup) foul = !(S.first === 8 ? S.cleared : groupOf(S.first) === myGroup);
      else if (!foul && !myGroup && S.first === 8) foul = true;
      if (eight) {
        if (S.breakShot) respot8();
        else {
          const win = !foul && S.cleared;
          const who = p === 0 ? "You" : "BloxBot";
          finish(win ? p : o, win ? `${who} potted the 8 ball to win!` : S.cleared && foul ? `${who} fouled while potting the 8 ball.` : `${who} potted the 8 ball too early.`);
          return;
        }
      }
      const own = pot.filter(n => n !== 8);
      let msg = "";
      if (!foul && !myGroup && own.length) {
        groups[p] = groupOf(own[0]); groups[o] = groups[p] === "solid" ? "stripe" : "solid";
        msg = `${p === 0 ? "You are" : "BloxBot is"} ${groups[p] === "solid" ? "solids" : "stripes"}. `;
      }
      const g = groups[p];
      const mine = g ? own.filter(n => groupOf(n) === g).length : 0;
      if (p === 0 && !foul) { runCount += mine; if (runCount >= 3) { fx.pop("ON A ROLL!", CX, 300, "#ffe14d", 40); } }
      if (foul) {
        inHand = true; switchTurn();
        status = msg + (o === 0 ? "You have ball in hand. " : "BloxBot has ball in hand. ") + (S.scratch ? "(cue ball potted)" : S.first === null ? "(missed every ball)" : "(wrong ball first)");
        fx.pop("FOUL!", CX, 300, "#ff6b6b", 44); Fun.sfx.nope();
      } else if (mine > 0 || (!g && own.length)) {
        status = msg + (p === 0 ? "You shoot again." : "BloxBot shoots again.");
        Fun.sfx.ding();
      } else {
        switchTurn();
        status = o === 0 ? "Your turn." : "BloxBot's turn.";
      }
      if (cue.out && !inHand) inHand = true;   // can't happen, but keep the cue ball on the table
      nextTurnState();
      if (state === "aim") aim = aimAtBest();
    }
    function aimAtBest(){ const t = targetsFor(0), b = t.length ? t.reduce((m, x) => Math.hypot(x.x - cue.x, x.y - cue.y) < Math.hypot(m.x - cue.x, m.y - cue.y) ? x : m) : null; return b ? Math.atan2(b.y - cue.y, b.x - cue.x) : 0; }

    /* ---------------- the bot ---------------- */
    function targetsFor(p){
      const live = balls.filter(b => b.n && !b.out), g = groups[p];
      if (practice()) return live;
      if (!g) return live.filter(b => b.n !== 8);
      const own = live.filter(b => groupOf(b.n) === g);
      return own.length ? own : live.filter(b => b.n === 8);
    }
    function clear(ax, ay, bx, by, skip){
      for (const o of balls) if (!o.out && !skip.includes(o) && distSeg(o.x, o.y, ax, ay, bx, by) < 2 * R * 0.98) return false;
      return true;
    }
    function planShot(cx, cy, p){
      let best = null;
      const ts = targetsFor(p);
      for (const T of ts) for (const P of POCKETS) {
        const dx = P.x - T.x, dy = P.y - T.y, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
        const gx = T.x - ux * 2 * R, gy = T.y - uy * 2 * R;                         // where the cue ball must be to send T at the pocket
        if (gx < R || gx > L - R || gy < R || gy > WD - R) continue;
        const vx = gx - cx, vy = gy - cy, vl = Math.hypot(vx, vy);
        if (vl < 1) continue;
        const cut = (vx * ux + vy * uy) / vl;
        if (cut < 0.25) continue;
        if (!clear(cx, cy, gx, gy, [cue, T]) || !clear(T.x, T.y, P.x, P.y, [cue, T])) continue;
        const score = cut - (vl + dl) / (L * 2.5);
        if (!best || score > best.score) best = { score, angle: Math.atan2(vy, vx), dist: vl + dl * 1.5 };
      }
      if (!best && ts.length) {
        const T = ts.reduce((m, x) => Math.hypot(x.x - cx, x.y - cy) < Math.hypot(m.x - cx, m.y - cy) ? x : m);
        best = { score: -1, angle: Math.atan2(T.y - cy, T.x - cx), dist: Math.hypot(T.x - cx, T.y - cy) * 1.3 };
      }
      if (!best) best = { score: -2, angle: 0, dist: 120 };
      const v = clamp(Math.sqrt(2 * FRIC * best.dist) + 70, VMIN + 60, VMAX);
      best.power = (v - VMIN) / (VMAX - VMIN);
      best.angle += (Math.random() + Math.random() - 1) * (MODES[mode].err || 0.022);   // nobody is perfect (Easy least of all)
      if (mode === "easy") best.power = clamp(best.power * (0.8 + Math.random() * 0.4), 0.1, 1);
      return best;
    }
    function legalSpot(x, y){
      if (x < R || x > L - R || y < R || y > WD - R) return false;
      if (!broke && x > HEAD) return false;
      return !balls.some(b => b !== cue && !b.out && Math.hypot(b.x - x, b.y - y) < 2 * R + 0.5);
    }
    function placeCue(x, y){ cue.x = x; cue.y = y; cue.vx = cue.vy = 0; cue.out = false; cue.sink = null; inHand = false; }
    function botPlace(){
      let best = null;
      for (let x = 2 * R; x < L - 2 * R; x += 24) for (let y = 2 * R; y < WD - 2 * R; y += 18) {
        if (!legalSpot(x, y)) continue;
        const pl = planShot(x, y, 1);
        if (!best || pl.score > best.score) best = { x, y, score: pl.score };
      }
      if (!best) best = { x: HEAD, y: WD / 2 };
      placeCue(best.x, best.y);
    }
    function botPlan(){
      if (!broke) return { angle: Math.atan2(WD / 2 - cue.y, FOOT - cue.x) + (Math.random() - 0.5) * 0.03, power: mode === "easy" ? 0.8 : 1 };
      return planShot(cue.x, cue.y, 1);
    }
    function updateBot(dt){
      ai.t += dt;
      if (ai.phase === "think") {
        if (ai.t > 1) {
          if (inHand) botPlace();
          ai.plan = botPlan(); ai.a0 = aim; ai.phase = "turn"; ai.t = 0;
          status = "BloxBot is lining up...";
        }
      } else if (ai.phase === "turn") {
        const u = Math.min(1, ai.t / 0.9), e = u * u * (3 - 2 * u);
        let d = ((ai.plan.angle - ai.a0) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        aim = ai.a0 + d * e;
        if (u >= 1) { ai.phase = "pull"; ai.t = 0; }
      } else if (ai.phase === "pull") {
        power = Math.min(1, ai.t / 0.5) * ai.plan.power;
        if (ai.t >= 0.5) shoot(aim, ai.plan.power);
      }
    }

    /* ---------------- each frame ---------------- */
    function update(dt){
      clock += dt;
      if (state === "aim" && turn === 0) {
        if (keys.left) aim -= (keys.shift ? 0.15 : 1.1) * dt;
        if (keys.right) aim += (keys.shift ? 0.15 : 1.1) * dt;
        if (charging) power = Math.min(1, power + dt * 0.85);
      } else if (state === "ai") updateBot(dt);
      else if (state === "roll") {
        stepPhysics(dt);
        if (moving()) settleT = 0; else { settleT += dt; if (settleT > 0.35) endShot(); }
      } else if (state === "over") { stepPhysics(dt); }
    }

    /* ---------------- drawing ---------------- */
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 2); }
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const [sx, sy] = proj(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    const rim = (m, fill) => poly([[-m, -m], [L + m, -m], [L + m, WD + m], [-m, WD + m]], fill);

    function drawRoom(){
      const g = ctx.createLinearGradient(0, 0, 0, 150);
      g.addColorStop(0, "#241a55"); g.addColorStop(1, "#3a2a7c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 150);
      // a glowing sign and blocky wall panels
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let x = 0; x < W; x += 120) ctx.fillRect(x + 6, 8, 108, 116);
      ctx.font = '900 34px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#4df2ff"; ctx.shadowBlur = 18; ctx.fillStyle = "#b8fbff";
      ctx.fillText("🎱 BLOX POOL 🎱", CX, 40); ctx.shadowBlur = 0;
      // the floor: a baseplate with studs
      ctx.save(); ctx.beginPath(); ctx.rect(0, 125, W, H - 125); ctx.clip();
      ctx.fillStyle = "#4b4a66"; ctx.fillRect(0, 125, W, H - 125);
      ctx.strokeStyle = "rgba(255,255,255,0.09)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = -360; x <= 600; x += 40) { const [a, b] = proj(x, -90), [c, d] = proj(x, 210); ctx.moveTo(a, b); ctx.lineTo(c, d); }
      for (let y = -90; y <= 210; y += 30) { const [a, b] = proj(-360, y), [c, d] = proj(600, y); ctx.moveTo(a, b); ctx.lineTo(c, d); }
      ctx.stroke(); ctx.restore();
      // the table's shadow on the floor
      const [sx, sy] = proj(L / 2, WD + 26);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sx, sy + 6, 420, 26, 0, 0, 7); ctx.fill();
    }
    function drawAvatar(p){
      const cx = p === 0 ? 250 : 710, active = turn === p && state !== "over";
      const dy = active ? Math.sin(clock * 6) * 3 : 0, shirt = p === 0 ? "#2f7bff" : "#e8332b", skin = p === 0 ? "#ffd84d" : "#c9ccd6";
      ctx.save(); ctx.translate(0, dy);
      ctx.lineJoin = "round"; ctx.strokeStyle = "#14102c"; ctx.lineWidth = 3;
      ctx.fillStyle = skin;   // arms
      ctx.fillRect(cx - 52, 74, 17, 52); ctx.strokeRect(cx - 52, 74, 17, 52); ctx.fillRect(cx + 35, 74, 17, 52); ctx.strokeRect(cx + 35, 74, 17, 52);
      ctx.fillStyle = shirt; ctx.fillRect(cx - 36, 70, 72, 70); ctx.strokeRect(cx - 36, 70, 72, 70);
      ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillRect(cx - 36, 92, 72, 8);
      ctx.fillStyle = skin; ctx.fillRect(cx - 23, 20, 46, 46); ctx.strokeRect(cx - 23, 20, 46, 46);
      ctx.fillStyle = "#14102c";
      if (p === 0) { ctx.fillRect(cx - 11, 34, 6, 10); ctx.fillRect(cx + 5, 34, 6, 10); ctx.beginPath(); ctx.arc(cx, 46, 11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 3; ctx.stroke(); }
      else { ctx.fillStyle = "#14102c"; ctx.fillRect(cx - 19, 33, 38, 11); ctx.fillStyle = "#ff3b30"; ctx.fillRect(cx - 14, 36, 28, 5); ctx.fillStyle = "#14102c"; ctx.fillRect(cx - 9, 52, 18, 4); }
      ctx.restore();
      if (active) { ctx.fillStyle = "#ffe14d"; ctx.beginPath(); ctx.moveTo(cx - 9, 8 + dy); ctx.lineTo(cx + 9, 8 + dy); ctx.lineTo(cx, 19 + dy); ctx.closePath(); ctx.fill(); }
    }
    function drawTable(){
      const felt = Hub.cosmetic ? Hub.cosmetic("poolFelt").colors : ["#2fbf71", "#177a43"];   // the shop can change the cloth
      rim(15, "#6b3f1e"); rim(13.5, "#9a6330"); rim(7, felt[1]);
      poly([[0, 0], [L, 0], [L, WD], [0, WD]], felt[0]);
      // studs on the felt
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      for (let x = 12; x < L; x += 12) for (let y = 12; y < WD; y += 12) { const [sx, sy, k] = proj(x, y); ctx.fillRect(sx - k * 0.5, sy - k * 0.35, k, k * 0.7); }
      // the spots
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      [[HEAD, WD / 2], [FOOT, WD / 2]].forEach(([x, y]) => { const [sx, sy, k] = proj(x, y); ctx.beginPath(); ctx.ellipse(sx, sy, k * 0.9, k * 0.6, 0, 0, 7); ctx.fill(); });
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 2; ctx.beginPath();
      { const [a, b] = proj(HEAD, 0), [c, d] = proj(HEAD, WD); ctx.moveTo(a, b); ctx.lineTo(c, d); } ctx.stroke();
      for (const P of POCKETS) {
        const [sx, sy, k] = proj(P.x, P.y), rr = P.r * k;
        ctx.fillStyle = "#6b3f1e"; ctx.beginPath(); ctx.ellipse(sx, sy, rr * 1.12, rr * 0.86, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#0c0a16"; ctx.beginPath(); ctx.ellipse(sx, sy, rr * 0.95, rr * 0.72, 0, 0, 7); ctx.fill();
      }
    }
    function drawBall(b, a){
      const [sx, sy, k] = proj(b.x, b.y);
      let x = sx, y = sy, rr = R * k, al = a === undefined ? 1 : a;
      if (b.sink) { const u = Math.min(1, b.sink.t / 0.3), [px, py] = proj(b.sink.x, b.sink.y); x = sx + (px - sx) * u; y = sy + (py - sy) * u; rr *= 1 - u * 0.7; al = 1 - u * 0.6; }
      else y -= rr * 0.25;
      ctx.globalAlpha = al;
      if (!b.sink) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sx + rr * 0.15, sy + rr * 0.45, rr * 0.95, rr * 0.5, 0, 0, 7); ctx.fill(); }
      const col = colourOf(b.n);
      ctx.fillStyle = b.n > 8 ? "#fff" : col; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
      if (b.n > 8) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(x - rr, y - rr * 0.52, rr * 2, rr * 1.04); ctx.restore(); }
      if (b.n) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, rr * 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#14102c"; ctx.font = `900 ${Math.round(rr * 0.78)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b.n, x, y + rr * 0.04);
      }
      ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.beginPath(); ctx.ellipse(x - rr * 0.38, y - rr * 0.45, rr * 0.22, rr * 0.14, -0.6, 0, 7); ctx.fill();
      ctx.strokeStyle = "#14102c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function castRay(ox, oy, dx, dy){
      let tb = 1e9, hit = null;
      for (const b of balls) {
        if (b === cue || b.out || b.sink) continue;
        const fx = b.x - ox, fy = b.y - oy, pr = fx * dx + fy * dy;
        if (pr <= 0) continue;
        const d2 = fx * fx + fy * fy - pr * pr;
        if (d2 >= 4 * R * R) continue;
        const t = pr - Math.sqrt(4 * R * R - d2);
        if (t < tb) { tb = t; hit = b; }
      }
      let tw = 1e9;
      if (dx > 1e-9) tw = Math.min(tw, (L - R - ox) / dx); else if (dx < -1e-9) tw = Math.min(tw, (R - ox) / dx);
      if (dy > 1e-9) tw = Math.min(tw, (WD - R - oy) / dy); else if (dy < -1e-9) tw = Math.min(tw, (R - oy) / dy);
      return tw < tb ? { t: tw, hit: null } : { t: tb, hit };
    }
    function drawAim(){
      const dx = Math.cos(aim), dy = Math.sin(aim), r = castRay(cue.x, cue.y, dx, dy);
      const ex = cue.x + dx * r.t, ey = cue.y + dy * r.t;
      const [ax, ay] = proj(cue.x, cue.y), [bx, by] = proj(ex, ey);
      ctx.setLineDash([7, 7]); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [gx, gy, k] = proj(ex, ey);
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(gx, gy, R * k, 0, 7); ctx.stroke();
      if (r.hit) {   // where the ball you hit will go
        let nx = r.hit.x - ex, ny = r.hit.y - ey; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const [hx, hy] = proj(r.hit.x, r.hit.y), [tx, ty] = proj(r.hit.x + nx * 50, r.hit.y + ny * 50);
        ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(255,225,77,0.95)"; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
        // and the cue ball: it slides off sideways, then rolls on or comes back with top or back spin
        if (turn === 0) {
          const along = dx * nx + dy * ny;
          let cx2 = dx - along * nx, cy2 = dy - along * ny;
          cx2 += dx * spin.y * SPIN_FOLLOW; cy2 += dy * spin.y * SPIN_FOLLOW;
          const cl = Math.hypot(cx2, cy2);
          if (cl > 0.05) {
            const len = 18 + cl * 34, [ux, uy] = proj(ex + cx2 / cl * len, ey + cy2 / cl * len);
            ctx.setLineDash([3, 6]); ctx.strokeStyle = "rgba(160,220,255,0.9)"; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ux, uy); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }
    }
    function drawCue(){
      const dx = Math.cos(aim), dy = Math.sin(aim), pull = 4 + power * 38;
      const a = [cue.x - dx * (R + pull), cue.y - dy * (R + pull)], b = [cue.x - dx * (R + pull + 110), cue.y - dy * (R + pull + 110)], tip = [cue.x - dx * (R + pull + 8), cue.y - dy * (R + pull + 8)];
      const [ax, ay, ka] = proj(a[0], a[1]), [bx, by, kb] = proj(b[0], b[1]), [tx, ty] = proj(tip[0], tip[1]);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#14102c"; ctx.lineWidth = kb * 2.4 + 4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = "#f0c27a"; ctx.lineWidth = kb * 2.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = "#4aa3ff"; ctx.lineWidth = ka * 2.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.lineCap = "butt";
    }
    function drawPracticeTray(){
      ctx.fillStyle = "rgba(255,225,77,0.22)"; ctx.fillRect(30, 492, 900, 40);
      ctx.strokeStyle = "#ffe14d"; ctx.lineWidth = 2; ctx.strokeRect(30, 492, 900, 40);
      ctx.fillStyle = "#fff"; ctx.font = '800 15px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`🎯 Practice · shot ${shots}`, 40, 505);
      ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(store.poolPracticeBest ? `Best: ${store.poolPracticeBest} shots` : "Pot all 15 in as few shots as you can", 40, 522);
      for (let n = 1; n <= 15; n++) {
        const b = balls.find(o => o.n === n), x = 330 + (n - 1) * 39, y = 512;
        ctx.globalAlpha = b && b.out ? 1 : 0.25;
        drawMini(n, x, y);
        ctx.globalAlpha = 1;
      }
    }
    function drawMini(n, x, y){
      ctx.fillStyle = n > 8 ? "#fff" : colourOf(n); ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
      if (n > 8) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.clip(); ctx.fillStyle = colourOf(n); ctx.fillRect(x - 13, y - 6, 26, 12); ctx.restore(); }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#14102c"; ctx.font = "900 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(n, x, y + 0.5);
      ctx.strokeStyle = "#14102c"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
    }
    function drawTray(p){
      const x0 = p === 0 ? 30 : 500, w = 430, g = groups[p];
      ctx.fillStyle = turn === p && state !== "over" ? "rgba(255,225,77,0.22)" : "rgba(0,0,0,0.35)";
      ctx.fillRect(x0, 492, w, 40); ctx.strokeStyle = turn === p && state !== "over" ? "#ffe14d" : "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.strokeRect(x0, 492, w, 40);
      ctx.fillStyle = "#fff"; ctx.font = '800 15px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(NAMES[p] + (p === 0 ? " (you)" : ` (${MODES[mode].label})`), x0 + 10, 505);
      ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(g ? (g === "solid" ? "Solids" : "Stripes") : "Open table", x0 + 10, 522);
      if (!g) return;
      const nums = g === "solid" ? [1, 2, 3, 4, 5, 6, 7, 8] : [9, 10, 11, 12, 13, 14, 15, 8];
      nums.forEach((n, i) => {
        const b = balls.find(o => o.n === n), x = x0 + 140 + i * 36, y = 512;
        const dim = b && b.out; ctx.globalAlpha = dim ? 0.25 : 1;
        drawMini(n, x, y);
        ctx.globalAlpha = 1;
      });
    }
    function draw(dt){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawRoom();
      drawAvatar(0); if (!practice()) drawAvatar(1);
      drawTable();
      const list = balls.filter(b => !b.out).sort((a, b) => a.y - b.y);
      if (state === "place" && hover) {
        const ok = legalSpot(hover[0], hover[1]);
        ctx.globalAlpha = 0.6; const gh = { n: 0, x: clamp(hover[0], R, L - R), y: clamp(hover[1], R, WD - R), sink: null }; drawBall(gh, 0.6);
        const [sx, sy, k] = proj(gh.x, gh.y); ctx.strokeStyle = ok ? "#7dff9a" : "#ff6b6b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, R * k * 1.6, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      }
      const showAim = (state === "aim" && turn === 0) || (state === "ai" && ai && ai.phase !== "think");
      if (showAim && !cue.out) drawAim();
      list.forEach(b => { if (!(state === "place" && b === cue && hover)) drawBall(b); });
      if (showAim && !cue.out) drawCue();
      fx.draw(ctx, dt);
      if (practice()) drawPracticeTray(); else { drawTray(0); drawTray(1); }
      // what's going on
      const msg = status || ""; ctx.font = '700 15px "Bricolage Grotesque", system-ui, sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 4;
      if (msg) { ctx.strokeText(msg, CX, 484); ctx.fillText(msg, CX, 484); }
    }
    let lastWho = "", lastPot = -1;
    function hud(){
      const who = state === "over" ? "Game over" : state === "place" ? (turn === 0 ? "Place the cue ball" : "BloxBot places") : practice() ? "Practice" : turn === 0 ? "Your turn" : "BloxBot's turn";
      if (who !== lastWho) { whoEl.textContent = who; lastWho = who; }
      if (potThisGame !== lastPot) { potEl.textContent = "🎱 ×" + potThisGame; lastPot = potThisGame; }
      const showPower = state === "aim" && turn === 0 && running;
      if (powerEl.hidden === showPower) powerEl.hidden = !showPower;
      if (spinEl.hidden === showPower) spinEl.hidden = !showPower;
      fillEl.style.height = Math.round(power * 100) + "%";
      if (state === "aim" && turn === 0 && !status) status = "Your turn.";
    }

    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now;
      if (running || state === "over") update(dt); else clock += dt;
      draw(dt);
      hud();
      requestAnimationFrame(loop);
    }

    /* ---------------- starting and leaving ---------------- */
    function setSpin(x, y){
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      spin.x = x; spin.y = y;
      spinDot.style.left = (50 + x * 34) + "%"; spinDot.style.top = (50 - y * 34) + "%";
      spinEl.setAttribute("aria-valuetext", spin.y > 0.2 ? "top spin" : spin.y < -0.2 ? "back spin" : Math.abs(spin.x) > 0.2 ? "side spin" : "no spin");
    }
    function start(){
      store.poolMode = mode; Hub.saveStore();
      reset();
      running = true; panel.hidden = true;
      Fun.release(keys);
      if (state === "aim") status = practice() ? "Practice: pot all 15 balls. You break!" : "You break! Aim, then shoot.";
      canvas.focus();
    }
    function openGame(){
      open = true; running = false; state = "ready";
      reset(); status = "";
      Fun.screen(overlay, true);
      panelTitle.textContent = "🎱 Blox Pool";
      panelText.textContent = "American 8-ball against BloxBot. Pot all of your group, solids or stripes (the first ball you pot decides), then sink the black 8 to win. Potting the white cue ball or hitting the wrong ball first is a foul, and the other player gets the cue ball to put anywhere. Pick how good BloxBot is, or practise on your own."
        + (store.poolWins ? ` Wins so far: ${store.poolWins}.` : "");
      showPanel("▶ Play");
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeGame(){
      open = false; running = false; Fun.screen(overlay, false);
    }

    /* ---------------- controls ---------------- */
    const keys = { left: false, right: false, shift: false };
    function chargeStart(){ if (state === "aim" && turn === 0 && running && !charging) { charging = true; power = 0; } }
    function chargeRelease(){
      if (!charging) return;
      charging = false;
      if (state === "aim" && turn === 0 && power > 0.06) shoot(aim, power); else power = 0;
    }
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!running) return;
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) chargeStart(); return; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); keys.left = true; }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); keys.right = true; }
      if (e.key === "Shift") keys.shift = true;
      if ((e.code === "ArrowUp" || e.code === "ArrowDown") && state === "aim" && turn === 0) {
        e.preventDefault(); setSpin(spin.x, clamp(spin.y + (e.code === "ArrowUp" ? 0.25 : -0.25), -1, 1));
      }
    });
    window.addEventListener("keyup", e => {
      if (e.code === "Space" && open) { chargeRelease(); return; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
      if (e.key === "Shift") keys.shift = false;
    });
    window.addEventListener("blur", () => { keys.left = keys.right = keys.shift = false; charging = false; if (state === "aim") power = 0; });
    const spot = e => { const r = canvas.getBoundingClientRect(); return unproj((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height); };
    const aimAt = p => { aim = Math.atan2(p[1] - cue.y, p[0] - cue.x); };
    canvas.addEventListener("pointermove", e => {
      if (!running) return;
      const p = spot(e);
      if (state === "place" && turn === 0) hover = p;
      else if (state === "aim" && turn === 0 && !charging && (e.pointerType === "mouse" || e.buttons)) aimAt(p);
    });
    canvas.addEventListener("pointerdown", e => {
      if (!running || turn !== 0) return;
      const p = spot(e);
      if (state === "place") {
        hover = p;
        if (legalSpot(p[0], p[1])) { placeCue(clamp(p[0], R, L - R), clamp(p[1], R, WD - R)); state = "aim"; aim = aimAtBest(); status = "Your turn."; Fun.sfx.ding(); }
        else { Fun.sfx.nope(); }
        return;
      }
      if (state !== "aim") return;
      if (e.pointerType === "mouse") { aimAt(p); chargeStart(); canvas.setPointerCapture(e.pointerId); }
      else aimAt(p);
    });
    ["pointerup", "pointercancel"].forEach(n => canvas.addEventListener(n, e => { if (e.pointerType === "mouse") chargeRelease(); }));
    // the POWER bar for touch screens: drag up, let go to shoot
    // the SPIN ball: tap or drag where the cue should hit it; double tap to hit it in the middle again
    let spinning = false;
    const spinAt = e => { const r = spinEl.getBoundingClientRect(); setSpin((e.clientX - r.left - r.width / 2) / (r.width * 0.34), -(e.clientY - r.top - r.height / 2) / (r.height * 0.34)); };
    spinEl.addEventListener("pointerdown", e => { if (state !== "aim" || turn !== 0) return; e.preventDefault(); spinning = true; spinEl.setPointerCapture(e.pointerId); spinAt(e); });
    spinEl.addEventListener("pointermove", e => { if (spinning) spinAt(e); });
    ["pointerup", "pointercancel"].forEach(n => spinEl.addEventListener(n, () => { spinning = false; if (Math.hypot(spin.x, spin.y) < 0.18) setSpin(0, 0); }));
    spinEl.addEventListener("dblclick", () => setSpin(0, 0));
    const modesEl = $("plModes");
    modesEl.addEventListener("click", e => {
      const b = e.target.closest("[data-mode]"); if (!b) return;
      mode = b.dataset.mode;
      modesEl.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      Fun.sfx.pop();
    });
    let powering = false;
    const barPower = e => { const r = powerEl.getBoundingClientRect(); power = clamp((r.bottom - e.clientY) / r.height, 0, 1); };
    powerEl.addEventListener("pointerdown", e => { if (state !== "aim" || turn !== 0) return; e.preventDefault(); powering = true; powerEl.setPointerCapture(e.pointerId); barPower(e); });
    powerEl.addEventListener("pointermove", e => { if (powering) barPower(e); });
    ["pointerup", "pointercancel"].forEach(n => powerEl.addEventListener(n, () => {
      if (!powering) return;
      powering = false;
      if (state === "aim" && turn === 0 && power > 0.06) shoot(aim, power); else power = 0;
    }));
    canvas.tabIndex = 0;
    $("plCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("plCloseBtn"));
    playBtn.addEventListener("click", start);
    window.__pool = { get mode(){ return mode; }, set mode(v){ mode = v; }, spin: setSpin, get shots(){ return shots; }, get state(){ return state; }, get turn(){ return turn; }, get groups(){ return groups; }, balls: () => balls, shoot: (a, p) => shoot(a, p), get aim(){ return aim; }, set aim(v){ aim = v; } };

    return { open: openGame, close: closeGame };
  }
})();
