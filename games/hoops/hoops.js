/* Blox Hoops: 3 against 3 basketball with the blocky Roblox-style players (games/blocky.js).
   You play on the blue team with two bots against the red team, on a wooden court full of fans.
   Run with the ball to dribble, hold Space and let go in the green to shoot, press Space right
   under the hoop to SLAM DUNK, E to pass. Without the ball, Space jumps (to block a shot!) and
   running into the dribbler steals it. Shots from behind the big line are worth 3. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "hoops", section: "games", title: "Blox Hoops", icon: "🏀",
    blurb: "3 against 3 basketball with the blocky Roblox players. Shoot, block and SLAM DUNK!",
    stat: () => store.hoopsWins ? "Wins: " + store.hoopsWins : "",
    badges: [
      { id: "hoopswin",   icon: "🏀", name: "Ballin'",       desc: "Win a game of Blox Hoops",       test: () => (store.hoopsWins || 0) >= 1 },
      { id: "hoopsdunk",  icon: "🔥", name: "Slam Dunk",     desc: "Dunk the ball in Blox Hoops",    test: () => (store.hoopsDunks || 0) >= 1 },
      { id: "hoopsthree", icon: "🎯", name: "From Downtown", desc: "Make a 3-pointer in Blox Hoops", test: () => (store.hoopsThrees || 0) >= 1 }
    ],
    mount
  });

  /* ---------------- the court: x is across, z is along (blue attacks +z), y is up ---------------- */
  const HALF_W = 9, END = 15, HOOP_Z = 13.4, HOOP_Y = 4.2, RIM_R = 0.55, BALL_R = 0.28, THREE = 7;
  const KEY_W = 1.8, KEY_D = 5.8, GAME_TIME = 180;
  const RUN = 8, BOT_RUN = 6.8, GRAVITY = 28, JUMP = 9, BALL_G = 18;
  const { clamp } = Hub.util;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const BLUE = { shirt: "#2f7bff", pants: "#2f7bff" }, RED = { shirt: "#e8332b", pants: "#e8332b" };
  const OFFENCE = [{ x: 0, u: 10.5 }, { x: -5.5, u: 8 }, { x: 5.5, u: 8 }];   // where each slot stands to attack

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="hpOverlay" hidden aria-label="Blox Hoops">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏀 Blox Hoops</h2>
          <span class="mono game-stat" id="hpScore">🔵 0 : 0 🔴</span>
          <span class="mono game-stat" id="hpTime">⏱ 3:00</span>
          <span class="mono game-stat" id="hpPoints">🏀 0 pts</span>
          <button class="btn ghost small" id="hpCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="hpCanvas" width="960" height="540"></canvas>
          <!-- on phones and tablets: a joystick to run with, and big PASS and SHOOT buttons over the court -->
          <div class="hp-stick" id="hpStick" aria-label="Joystick: drag to run"><div class="hp-knob" id="hpKnob"></div></div>
          <div class="hp-btns">
            <button class="hp-btn hp-pass" data-hpkey="pass" type="button" aria-label="Pass">PASS</button>
            <button class="hp-btn hp-shoot" data-hpkey="shoot" type="button" aria-label="Shoot or jump">SHOOT</button>
          </div>
          <div class="game-panel hp-panel" id="hpPanel">
            <div class="game-panel-title" id="hpPanelTitle">Blox Hoops</div>
            <div class="game-panel-text" id="hpPanelText"></div>
            <button class="btn" id="hpPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">W A S D or the arrow keys to run · hold Space and let go in the green to shoot (right under the hoop: DUNK!) · E to pass · no ball? Space jumps to block, run into the dribbler to steal</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("hpOverlay"), canvas = $("hpCanvas"), ctx = canvas.getContext("2d");
    const panel = $("hpPanel"), panelTitle = $("hpPanelTitle"), panelText = $("hpPanelText"), playBtn = $("hpPlayBtn");
    const scoreEl = $("hpScore"), timeEl = $("hpTime"), pointsEl = $("hpPoints");

    const W = 960, H = 540;
    const B = Blocky(ctx, W, H, { back: 10, up: 7, pitch: 0.34 }), { cam, polyPath, line3 } = B;

    let open = false, running = false, last = 0, clock = 0, frameDt = 1 / 60;
    let phase = "ready", phaseT = 0, timeLeft = GAME_TIME, nextBall = 0;
    let you = null, players = [], ball = null, score = [0, 0], yourPoints = 0;
    let charging = false, charge = 0, camYaw = 0, cheer = 0;
    let banner = { text: "", sub: "", t: 0 };
    const keys = { left: false, right: false, up: false, down: false };
    const stick = { x: 0, y: 0, on: false };   // the touch joystick: x right, y down, each -1 to 1
    const fx = Fun.pops();

    /* ----- the players ----- */
    function makePlayer(o){
      return Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: 0, walk: 0, noTouch: 0, think: 0 }, o);
    }
    const sideOf = p => p.team === 0 ? 1 : -1;               // which way that team attacks
    const hoopOf = team => team === 0 ? HOOP_Z : -HOOP_Z;    // the z of the hoop a team shoots at
    function reset(){
      you = makePlayer({ name: "You", team: 0, slot: 0, me: true, look: { ...BLUE, head: "#ffd23f" } });
      players = [
        you,
        makePlayer({ name: "Noob_Max",    team: 0, slot: 1, look: { ...BLUE, head: "#ffd23f" } }),
        makePlayer({ name: "PixelMia",    team: 0, slot: 2, look: { ...BLUE, head: "#f2c49b" } }),
        makePlayer({ name: "xX_Dunker_Xx", team: 1, slot: 0, look: { ...RED, head: "#a8704c" } }),
        makePlayer({ name: "BaconHair_9", team: 1, slot: 1, look: { ...RED, head: "#ffd23f" } }),
        makePlayer({ name: "Guest_404",   team: 1, slot: 2, look: { ...RED, head: "#f2c49b" } })
      ];
      ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, owner: null, live: false, shooter: null, three: false, shotT: 0, passTo: null, spin: 0, lastTeam: 0 };
      score = [0, 0]; yourPoints = 0; timeLeft = GAME_TIME; clock = 0; cheer = 0;
      inbound(0, true);
    }
    // a team gets the ball: at the start in the middle, after a basket from under the hoop they defend
    function inbound(team, first){
      nextBall = team;
      players.forEach(p => {
        const s = sideOf(p), spot = p.team === team ? [{ x: 0, u: -4 }, { x: -4, u: -1 }, { x: 4, u: -1 }][p.slot] : [{ x: 0, u: -10 }, { x: -3.5, u: -7 }, { x: 3.5, u: -7 }][p.slot];
        p.x = spot.x; p.z = spot.u * s; p.y = 0; p.vx = p.vy = p.vz = 0;
        p.face = s > 0 ? 0 : Math.PI; p.noTouch = 0;
      });
      // a bot throws it in from under the hoop (and on your team, usually to you)
      const taker = players.find(p => p.team === team && p.slot === (first ? 0 : 1));
      if (!first) { taker.z = -sideOf(taker) * (END - 2.5); taker.x = 1.5; taker.think = 0; }
      Object.assign(ball, { vx: 0, vy: 0, vz: 0, owner: taker, live: false, shooter: null, passTo: null, lastTeam: team });
      phase = "ready"; phaseT = first ? 2.6 : 1.2;
      charging = false; charge = 0; camYaw = taker.team === 0 ? 0 : Math.PI;
      if (first) banner = { text: "Tip off! 🏀", sub: "Blue (you) against Red · 3 minutes", t: 2.4 };
    }

    /* ----- moving ----- */
    function moveBody(b, wantX, wantZ, speed, dt){
      const len = Math.hypot(wantX, wantZ);
      const tx = len > 0.01 ? wantX / len * speed : 0, tz = len > 0.01 ? wantZ / len * speed : 0;
      const k = Math.min(1, dt * (b.y > 0 ? 3 : 10));
      b.vx += (tx - b.vx) * k; b.vz += (tz - b.vz) * k;
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.vy -= GRAVITY * dt; b.y += b.vy * dt;
      if (b.y <= 0) { b.y = 0; b.vy = 0; }
      const sp = Math.hypot(b.vx, b.vz);
      let want = null;
      if (ball.owner === b && (b.dunk || charging && b.me)) want = Math.atan2(-b.x, hoopOf(b.team) - b.z);
      else if (sp > 0.6) { want = Math.atan2(b.vx, b.vz); if (b.y === 0) b.walk += dt * sp * 1.6; }
      else if (!b.me) want = Math.atan2(ball.x - b.x, ball.z - b.z);    // standing still: watch the ball
      if (want !== null) {
        const d = ((want - b.face) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        b.face += d * Math.min(1, dt * 12);
      }
      b.x = clamp(b.x, -HALF_W + 0.5, HALF_W - 0.5);
      b.z = clamp(b.z, -END + 0.5, END - 0.5);
    }
    function goTo(p, tx, tz, speed, dt){
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { moveBody(p, 0, 0, 0, dt); return; }
      moveBody(p, dx, dz, d < 2 ? Math.max(1.5, speed * d / 2) : speed, dt);
    }
    const jump = p => { if (p.y === 0) p.vy = JUMP; };
    const toHoop = p => Math.hypot(p.x, hoopOf(p.team) - p.z);

    /* ----- shooting, dunking and passing ----- */
    // how far a shot lands from the middle of the rim for each bit your timing is off
    const errScale = d => 3 * (1 + d / 12);
    const PERFECT = 0.78;
    function shoot(p, errLong, errSide){
      const hz = hoopOf(p.team), d = toHoop(p);
      const ux = -p.x / (d || 1), uz = (hz - p.z) / (d || 1);
      const tx = ux * errLong - uz * errSide, tz = hz + uz * errLong + ux * errSide;
      const y0 = 2.6 + p.y, T = 0.55 + d * 0.07;
      ball.owner = null; ball.x = p.x + ux * 0.4; ball.z = p.z + uz * 0.4; ball.y = y0;
      ball.vx = (tx - ball.x) / T; ball.vz = (tz - ball.z) / T; ball.vy = (HOOP_Y - y0 + 0.5 * BALL_G * T * T) / T;
      ball.live = true; ball.shooter = p; ball.three = d > THREE; ball.shotT = 0; ball.passTo = null; ball.lastTeam = p.team;
      p.noTouch = 0.5;
      jump(p);
      // defenders close by jump to block it
      players.forEach(q => { if (q.team !== p.team && !q.me && Math.hypot(q.x - p.x, q.z - p.z) < 2.5 && Math.random() < 0.45) jump(q); });
      Fun.sfx.whoosh();
    }
    function dunk(p){
      const hz = hoopOf(p.team);
      p.dunk = 0.5; p.vy = 11;
      ball.owner = null; ball.x = 0; ball.z = hz; ball.y = HOOP_Y + 0.35; ball.vx = ball.vz = 0; ball.vy = -4;
      ball.live = true; ball.shooter = p; ball.three = false; ball.shotT = 1; ball.dunked = true; ball.lastTeam = p.team;
      p.noTouch = 0.6;
      const sp = B.at(p.x, 4.5, p.z);
      if (sp) fx.pop(p.me ? "SLAM DUNK! 🔥" : "DUNK!", sp[0], sp[1], "#ff9f1c", p.me ? 40 : 26);
      Fun.sfx.boing();
    }
    function pass(p, mate){
      const d = Math.hypot(mate.x - p.x, mate.z - p.z), speed = clamp(8 + d * 0.6, 10, 15), lead = d / speed * 0.8;
      const tx = mate.x + mate.vx * lead, tz = mate.z + mate.vz * lead, l = Math.hypot(tx - p.x, tz - p.z) || 1, T = l / speed;
      ball.owner = null; ball.y = 1.5;
      ball.vx = (tx - p.x) / T; ball.vz = (tz - p.z) / T; ball.vy = 0.5 * BALL_G * T;   // a chest pass that arrives at the same height
      ball.live = false; ball.passTo = mate; ball.lastTeam = p.team;
      p.noTouch = 0.35;
      Fun.sfx.thunk();
    }
    function bestMate(p){
      let best = null, bestScore = -Infinity;
      players.forEach(m => {
        if (m === p || m.team !== p.team) return;
        let free = 6;
        players.forEach(q => { if (q.team !== p.team) free = Math.min(free, Math.hypot(q.x - m.x, q.z - m.z)); });
        const sc = free - toHoop(m) * 0.3 + (m.me ? 1.5 : 0);   // bots like passing to you
        if (sc > bestScore) { bestScore = sc; best = m; }
      });
      return best;
    }
    function yourPass(){
      if (ball.owner !== you || phase !== "play") return;
      const fx_ = Math.sin(you.face), fz = Math.cos(you.face);
      let best = null, bestScore = -Infinity;
      players.forEach(m => {
        if (m === you || m.team !== 0) return;
        const dx = m.x - you.x, dz = m.z - you.z, d = Math.hypot(dx, dz) || 1;
        const sc = (dx * fx_ + dz * fz) / d - d / 30;
        if (sc > bestScore) { bestScore = sc; best = m; }
      });
      if (best) { charging = false; pass(you, best); }
    }
    // Space down: dunk if you're right under the hoop, start the shot meter if you have the ball, or jump
    function pressShoot(){
      if (!running || phase !== "play") return;
      if (ball.owner === you) {
        if (toHoop(you) < 2.4) dunk(you);
        else { charging = true; charge = 0; }
      } else jump(you);
    }
    function releaseShoot(){
      if (!charging) return;
      charging = false;
      if (phase !== "play" || ball.owner !== you) return;
      const off = charge - PERFECT, d = toHoop(you);
      shoot(you, off * errScale(d), 0);
      const sp = B.at(you.x, 4, you.z);
      if (sp) fx.pop(Math.abs(off) * errScale(d) < RIM_R - BALL_R ? "Perfect! ✨" : off < 0 ? "Too soft…" : "Too hard…", sp[0], sp[1], Math.abs(off) * errScale(d) < RIM_R - BALL_R ? "#7bd68a" : "#ffffff", 22);
    }

    /* ----- the ball ----- */
    function stepBall(dt){
      const o = ball.owner;
      if (o) {
        const side = Math.cos(o.face) * 0.45, fwd = 0.45;
        ball.x = o.x + Math.sin(o.face) * fwd + side; ball.z = o.z + Math.cos(o.face) * fwd - Math.sin(o.face) * 0.45;
        // bounce it while you run; hold it up high while you aim
        ball.y = (o.me && charging) ? 2.9 + o.y : o.y > 0 ? 2.6 + o.y : 0.3 + Math.abs(Math.sin(clock * 8 + o.slot)) * 1.0;
        ball.vx = o.vx; ball.vz = o.vz; ball.vy = 0;
        ball.lastTeam = o.team;
        ball.spin += dt * 6;
        return;
      }
      const prevY = ball.y, prevZ = ball.z;
      ball.shotT += dt;
      ball.vy -= BALL_G * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
      ball.spin += Math.hypot(ball.vx, ball.vz) * dt * 2;
      if (ball.y < BALL_R) {
        ball.y = BALL_R;
        if (ball.vy < -1.5) { ball.vy = -ball.vy * 0.7; if (ball.vy > 3) Fun.sfx.thunk(); } else ball.vy = 0;
        const f = Math.exp(-0.8 * dt); ball.vx *= f; ball.vz *= f;
        ball.live = false;
      }
      if (Math.abs(ball.x) > HALF_W - BALL_R) { ball.x = Math.sign(ball.x) * (HALF_W - BALL_R); ball.vx *= -0.6; }
      if (Math.abs(ball.z) > END - BALL_R) { ball.z = Math.sign(ball.z) * (END - BALL_R); ball.vz *= -0.6; }
      [-1, 1].forEach(s => {
        const hz = s * HOOP_Z, board = s * (HOOP_Z + RIM_R + 0.2);
        // the backboard
        if ((prevZ - board) * (ball.z - board) <= 0 && Math.abs(ball.x) < 1.6 && ball.y > HOOP_Y - 0.4 && ball.y < HOOP_Y + 1.7) {
          ball.z = board - s * 0.01; ball.vz *= -0.55; Fun.sfx.thunk();
        }
        // the rim: dropping through the middle is a basket, clipping the edge bounces it off
        if (prevY >= HOOP_Y && ball.y < HOOP_Y) {
          const d = Math.hypot(ball.x, ball.z - hz);
          if (d < RIM_R - BALL_R * 0.5) {
            ball.vx *= 0.15; ball.vz *= 0.15; ball.vy = Math.min(ball.vy, -2);
            if (phase === "play" && ball.shooter) basket(s > 0 ? 0 : 1);
          } else if (d < RIM_R + BALL_R) {
            const nx = ball.x / (d || 1), nz = (ball.z - hz) / (d || 1), v = 1.5 + Math.random() * 2.5;
            ball.y = HOOP_Y; ball.vy = Math.abs(ball.vy) * 0.4 + 1.5;
            ball.vx = nx * v + (Math.random() - 0.5); ball.vz = nz * v + (Math.random() - 0.5);
            const sp = B.at(ball.x, HOOP_Y + 1, ball.z);
            if (sp && phase === "play") fx.pop("CLANK!", sp[0], sp[1], "#ffb447", 20);
            Fun.sfx.ding();
          }
        }
      });
    }
    function basket(team){
      const p = ball.shooter, pts = ball.three ? 3 : 2;
      score[team] += pts;
      if (p && p.me && p.team === team) {
        yourPoints += pts;
        if (ball.dunked) store.hoopsDunks = (store.hoopsDunks || 0) + 1;
        if (ball.three) store.hoopsThrees = (store.hoopsThrees || 0) + 1;
      }
      const what = ball.dunked ? "SLAM DUNK" : ball.three ? "THREE!" : ["Swish!", "Bucket!", "Nothing but net!"][Math.floor(Math.random() * 3)];
      banner = team === 0
        ? { text: `${what} +${pts} 🏀`, sub: `${p && p.me ? "You" : p ? p.name : "Blue"} scored · ${score[0]} : ${score[1]}`, t: 1.6 }
        : { text: `Red +${pts} 😬`, sub: `${p ? p.name : "Red"} scored · ${score[0]} : ${score[1]}`, t: 1.6 };
      if (team === 0) { Fun.sfx.tada(); const sp = B.at(0, HOOP_Y, ball.z); if (sp) { fx.burst(sp[0], sp[1], "#ffe14d", 24, 220); fx.burst(sp[0], sp[1], "#2f7bff", 24, 220); } cheer = 2; }
      else Fun.sfx.wah();
      ball.shooter = null; ball.live = false; ball.dunked = false;
      phase = "scored"; phaseT = 1.8; nextBall = 1 - team;
    }
    function touchBall(dt){
      if (phase !== "play") return;
      const o = ball.owner;
      if (o) {
        for (const p of players) {
          if (p.team === o.team || p.noTouch > 0) continue;
          if (Math.hypot(p.x - ball.x, p.z - ball.z) > 1.0) continue;
          const rate = p.me ? 4 : o.me ? 0.9 : 1.8;
          if (Math.random() < rate * dt) {
            ball.owner = p; o.noTouch = 0.8; p.think = 0.4;
            if (o.me) charging = false;
            const sp = B.at(p.x, 3.6, p.z);
            if (sp) fx.pop(p.me ? "STEAL! 💪" : o.me ? "Stolen! 😤" : "Steal!", sp[0], sp[1], p.me ? "#7bd68a" : "#ffffff", p.me || o.me ? 28 : 18);
            Fun.sfx.bonk();
            return;
          }
        }
        return;
      }
      // a shot can be blocked just after it leaves the shooter's hands, by a defender in the air
      if (ball.live && ball.shotT < 0.35 && !ball.dunked) {
        for (const q of players) {
          if (q.team === ball.lastTeam || q.y < 0.5) continue;
          if (Math.hypot(q.x - ball.x, q.z - ball.z) < 1.3 && ball.y < q.y + 3.2) {
            ball.vx *= -0.4; ball.vz *= -0.4; ball.vy = 2; ball.live = false; ball.shooter = null;
            const sp = B.at(q.x, 4.5, q.z);
            if (sp) fx.pop(q.me ? "BLOCKED! 🚫" : "Blocked!", sp[0], sp[1], q.me ? "#7bd68a" : "#ffffff", q.me ? 34 : 22);
            Fun.sfx.bonk();
            return;
          }
        }
      }
      if (ball.live && ball.y > 2.4) return;   // up in the air on the way to the hoop
      let best = null, bestD = Infinity;
      players.forEach(p => {
        if (p.noTouch > 0) return;
        const d = Math.hypot(p.x - ball.x, p.z - ball.z), reach = ball.passTo === p ? 1.5 : 1.0;
        if (d < reach && ball.y < 2.6 + p.y && d < bestD) { best = p; bestD = d; }
      });
      if (!best) return;
      if (ball.y > 1.8 && ball.passTo !== best) {
        const sp = B.at(best.x, 3.6, best.z);
        if (sp) fx.pop("Rebound!", sp[0], sp[1], "#ffffff", 18);
      }
      ball.owner = best; ball.live = false; ball.shooter = null; ball.passTo = null; best.think = 0.3;
    }

    /* ----- the bots ----- */
    function chaser(team){
      let best = null, bestD = Infinity;
      players.forEach(p => { if (p.team !== team) return; const d = Math.hypot(p.x - ball.x, p.z - ball.z); if (d < bestD) { bestD = d; best = p; } });
      return best;
    }
    function stepBot(p, dt, chase){
      const o = ball.owner, s = sideOf(p);
      if (o === p) { botDribble(p, dt); return; }
      if (ball.passTo === p && !o) { goTo(p, ball.x + ball.vx * 0.3, ball.z + ball.vz * 0.3, BOT_RUN, dt); return; }
      if (!o) {
        // a loose ball or a shot in the air: the closest one goes for it (for a rebound, under the hoop)
        if (chase === p) {
          const land = ball.live ? { x: ball.x * 0.5, z: Math.sign(ball.z) * (HOOP_Z - 1.5) } : { x: ball.x + ball.vx * 0.25, z: ball.z + ball.vz * 0.25 };
          goTo(p, land.x, land.z, BOT_RUN, dt);
          if (!ball.live && ball.y > 1.6 && Math.hypot(ball.x - p.x, ball.z - p.z) < 1.5 && Math.random() < dt * 3) jump(p);
          return;
        }
      } else if (o.team !== p.team && chase === p) {
        goTo(p, o.x, o.z, BOT_RUN, dt);   // go and steal it
        return;
      }
      if (o && o.team === p.team || (!o && ball.lastTeam === p.team)) {
        const spot = OFFENCE[p.slot];
        goTo(p, spot.x, spot.u * s, BOT_RUN * 0.85, dt);
      } else {
        // defend: stay between your opponent and your hoop
        const opp = players.find(q => q.team !== p.team && q.slot === p.slot), own = hoopOf(1 - p.team);
        goTo(p, opp.x * 0.75, opp.z + (own - opp.z) * 0.3, BOT_RUN * 0.9, dt);
      }
    }
    function botDribble(p, dt){
      const s = sideOf(p), hz = hoopOf(p.team), d = toHoop(p);
      let threat = null, td = Infinity;
      players.forEach(q => { if (q.team === p.team) return; const e = Math.hypot(q.x - p.x, q.z - p.z); if (e < td) { td = e; threat = q; } });
      p.think -= dt;
      if (p.think <= 0) {
        p.think = 0.3;
        if (d < 2.3) {
          if (Math.random() < 0.55) dunk(p); else shoot(p, gauss() * 0.6, gauss() * 0.2);
          return;
        }
        const open_ = td > 2.2;
        if (d < 7.5 && Math.random() < (open_ ? 0.3 : 0.12)) { shoot(p, gauss() * 1.2 * (1 + d / 10), gauss() * 0.3); return; }
        if (d > THREE && d < 9 && open_ && Math.random() < 0.06) { shoot(p, gauss() * 1.3 * (1 + d / 10), gauss() * 0.35); return; }
        if (td < 1.5 && Math.random() < 0.3) { const m = bestMate(p); if (m) { pass(p, m); return; } }
        if (p.team === 0 && Math.random() < 0.15 && toHoop(you) < d - 1) { pass(p, you); return; }
        // the inbounder under the hoop passes it in straight away
        if (Math.abs(p.z) > END - 4 && (p.z - hoopOf(p.team)) * s < 0 && toHoop(p) > 20) { const m = p.team === 0 ? you : bestMate(p); if (m) { pass(p, m); return; } }
      }
      // drive to the hoop, swerving round whoever's in the way
      let wx = -p.x, wz = hz - p.z;
      const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l;
      if (threat && td < 3) { wx += (p.x - threat.x) / td * (3 - td) * 0.5; wz += (p.z - threat.z) / td * (3 - td) * 0.15; }
      moveBody(p, wx, wz, BOT_RUN * 0.95, dt);
    }

    /* ----- you ----- */
    function stepYou(dt){
      if (phase !== "play") { moveBody(you, 0, 0, 0, dt); return; }
      let fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), push = 1;
      // the joystick: push it a little to jog, all the way to sprint
      const m = Math.hypot(stick.x, stick.y);
      if (stick.on && m > 0.15) { fwd = -stick.y; side = stick.x; push = Math.min(1, 0.35 + m * 0.75); }
      moveBody(you, side * cam.c + fwd * cam.s, -side * cam.s + fwd * cam.c, (charging ? RUN * 0.35 : RUN) * push, dt);
      if (charging) charge = Math.min(1.15, charge + dt / 0.9);
    }

    function step(dt){
      clock += dt;
      if (banner.t > 0) banner.t -= dt;
      if (cheer > 0) cheer -= dt;
      players.forEach(p => { if (p.noTouch > 0) p.noTouch -= dt; if (p.dunk > 0) p.dunk -= dt; });
      if (phase === "ready") {
        phaseT -= dt;
        if (phaseT <= 0) { phase = "play"; Fun.sfx.zap(); fx.pop("GO!", W / 2, H * 0.4, "#7bd68a", 56); }
        players.forEach(p => moveBody(p, 0, 0, 0, dt));
        stepBall(dt);
        return;
      }
      if (phase === "scored") {
        phaseT -= dt;
        players.forEach(p => moveBody(p, 0, 0, 0, dt));
        stepBall(dt);
        if (phaseT <= 0) inbound(nextBall, false);
        return;
      }
      timeLeft -= dt;
      if (timeLeft <= 0) { fullTime(); return; }
      stepYou(dt);
      const chase = [chaser(0), chaser(1)];
      players.forEach(p => {
        if (p.me) return;
        if (p.dunk > 0) { moveBody(p, 0, 0, 0, dt); return; }
        // on your team you go for the ball yourself, so the closest bot only helps when you're far away
        let c = chase[p.team];
        if (p.team === 0 && c === you) c = Math.hypot(you.x - ball.x, you.z - ball.z) > 4 ? players.filter(q => q.team === 0 && !q.me).sort((a, b) => Math.hypot(a.x - ball.x, a.z - ball.z) - Math.hypot(b.x - ball.x, b.z - ball.z))[0] : null;
        stepBot(p, dt, c);
      });
      for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= 0.9 || d === 0) continue;
        const push = (0.9 - d) / 2;
        a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
      }
      stepBall(dt);
      touchBall(dt);
    }

    /* ----- 3D drawing ----- */
    function placeCamera(dt){
      if (phase === "play" || phase === "scored") {
        if (ball.owner === you) camYaw = Math.atan2(-you.x * 0.4, HOOP_Z - you.z);
        else if (Math.hypot(ball.x - you.x, ball.z - you.z) > 3) camYaw = Math.atan2(ball.x - you.x, ball.z - you.z);
      }
      B.follow(you, camYaw, dt);
    }

    const FANS = (() => {
      const list = [], cols = ["#2f7bff", "#e8332b", "#ffd23f", "#ffffff", "#2fbf5a", "#ff9f1c", "#b46bff"];
      const row = (x0, z0, x1, z1, out) => {
        const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4);
        for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          list.push({ x: x0 + (x1 - x0) * t + out[0] * (2 + r * 1.8), z: z0 + (z1 - z0) * t + out[1] * (2 + r * 1.8), y: 1.4 + r * 1.3, c: cols[(i * 5 + r * 3) % cols.length], hop: Math.random() * 6 });
        }
      };
      row(-HALF_W - 1, -END - 1, -HALF_W - 1, END + 1, [-1, 0]);
      row(HALF_W + 1, -END - 1, HALF_W + 1, END + 1, [1, 0]);
      row(-HALF_W - 1, END + 1, HALF_W + 1, END + 1, [0, 1]);
      row(-HALF_W - 1, -END - 1, HALF_W + 1, -END - 1, [0, -1]);
      return list;
    })();
    function quad(pts, colour){ if (polyPath(pts)) { ctx.fillStyle = colour; ctx.fill(); } }

    function drawCourt(){
      quad([[-70, 0, -80], [70, 0, -80], [70, 0, 80], [-70, 0, 80]], "#2b3a55");
      // wooden planks
      for (let i = 0; i < 12; i++) {
        const x0 = -HALF_W + i * HALF_W / 6, x1 = x0 + HALF_W / 6;
        quad([[x0, 0, -END], [x1, 0, -END], [x1, 0, END], [x0, 0, END]], i % 2 ? "#d9a066" : "#e0aa72");
      }
      // the painted keys under each hoop
      [-1, 1].forEach(s => quad([[-KEY_W, 0.01, s * END], [KEY_W, 0.01, s * END], [KEY_W, 0.01, s * (END - KEY_D)], [-KEY_W, 0.01, s * (END - KEY_D)]], s > 0 ? "#c0392b" : "#2f6fd6"));
      ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 2.5; ctx.beginPath();
      line3([-HALF_W, 0.02, -END], [HALF_W, 0.02, -END]); line3([HALF_W, 0.02, -END], [HALF_W, 0.02, END]);
      line3([HALF_W, 0.02, END], [-HALF_W, 0.02, END]); line3([-HALF_W, 0.02, END], [-HALF_W, 0.02, -END]);
      line3([-HALF_W, 0.02, 0], [HALF_W, 0.02, 0]);
      const circle = (cx, cz, r, a0, a1, n) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n; line3([cx + Math.sin(a) * r, 0.02, cz + Math.cos(a) * r], [cx + Math.sin(b) * r, 0.02, cz + Math.cos(b) * r]); } };
      circle(0, 0, 2, 0, Math.PI * 2, 20);
      [-1, 1].forEach(s => {
        const hz = s * HOOP_Z;
        // the three-point line: a half circle round the hoop, then straight to the end line
        circle(0, hz, THREE, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2, 24);
        [-THREE, THREE].forEach(x => line3([x, 0.02, hz], [x, 0.02, s * END]));
        circle(0, s * (END - KEY_D), KEY_W, 0, Math.PI * 2, 16);
      });
      ctx.stroke();
    }
    function drawStands(){
      const W1 = HALF_W + 1, W2 = HALF_W + 8, E1 = END + 1, E2 = END + 8;
      const slab = (pts, colour) => ({ pts, colour, d: B.depth(...pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0])) });
      [
        slab([[-W1, 0.6, -E1], [-W1, 0.6, E1], [-W2, 5.5, E1], [-W2, 5.5, -E1]], "#5b6170"),
        slab([[W1, 0.6, -E1], [W1, 0.6, E1], [W2, 5.5, E1], [W2, 5.5, -E1]], "#5b6170"),
        slab([[-W1, 0.6, E1], [W1, 0.6, E1], [W1, 5.5, E2], [-W1, 5.5, E2]], "#6b7280"),
        slab([[-W1, 0.6, -E1], [W1, 0.6, -E1], [W1, 5.5, -E2], [-W1, 5.5, -E2]], "#6b7280")
      ].filter(s => s.d > 0).sort((a, b) => b.d - a.d).forEach(s => quad(s.pts, s.colour));
      FANS.forEach(f => {
        const hop = cheer > 0 ? Math.abs(Math.sin(clock * 9 + f.hop)) * 0.8 : Math.abs(Math.sin(clock * 1.5 + f.hop)) * 0.12;
        const p = B.at(f.x, f.y + hop, f.z);
        if (!p) return;
        const r = Math.min(14, 240 / Math.max(1, B.depth(f.x, f.y, f.z)));
        ctx.fillStyle = f.c; ctx.fillRect(p[0] - r * 0.6, p[1] - r * 0.2, r * 1.2, r * 1.2);
        ctx.fillStyle = "#ffd23f"; ctx.fillRect(p[0] - r * 0.4, p[1] - r * 0.9, r * 0.8, r * 0.75);
      });
    }
    // a hoop: the pole behind the end line, the arm, the backboard, then the orange rim and the net
    function drawHoop(s){
      const list = [], hz = s * HOOP_Z, boardZ = s * (HOOP_Z + RIM_R + 0.25);
      B.part(list, { x: 0, y: 0, z: s * (END + 0.8), face: 0 }, 0, 0, 0, 0.35, HOOP_Y + 1.2, 0.35, "#4b5563");
      B.part(list, { x: 0, y: 0, z: (boardZ + s * (END + 0.8)) / 2, face: 0 }, 0, HOOP_Y + 0.6, 0, 0.25, 0.25, Math.abs(s * (END + 0.8) - boardZ), "#4b5563");
      B.part(list, { x: 0, y: 0, z: boardZ + s * 0.06, face: 0 }, 0, HOOP_Y - 0.4, 0, 3.2, 2.1, 0.1, "#ffffff");
      B.paint(list);
      // the little square on the board
      ctx.strokeStyle = s > 0 ? "#c0392b" : "#2f6fd6"; ctx.lineWidth = 2; ctx.beginPath();
      const bz = boardZ - s * 0.01;
      line3([-0.6, HOOP_Y, bz], [0.6, HOOP_Y, bz]); line3([0.6, HOOP_Y, bz], [0.6, HOOP_Y + 0.9, bz]);
      line3([0.6, HOOP_Y + 0.9, bz], [-0.6, HOOP_Y + 0.9, bz]); line3([-0.6, HOOP_Y + 0.9, bz], [-0.6, HOOP_Y, bz]);
      ctx.stroke();
      // the net hangs down from the rim and gets narrower
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        line3([Math.cos(a) * RIM_R, HOOP_Y, hz + Math.sin(a) * RIM_R], [Math.cos(a + 0.5) * RIM_R * 0.6, HOOP_Y - 0.8, hz + Math.sin(a + 0.5) * RIM_R * 0.6]);
      }
      ctx.stroke();
      ctx.strokeStyle = "#ff6a00"; ctx.lineWidth = 3.5; ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2;
        line3([Math.cos(a) * RIM_R, HOOP_Y, hz + Math.sin(a) * RIM_R], [Math.cos(b) * RIM_R, HOOP_Y, hz + Math.sin(b) * RIM_R]);
      }
      ctx.stroke();
    }
    function drawBall(){
      const c = B.at(ball.x, ball.y, ball.z), e = B.at(ball.x + BALL_R * cam.c, ball.y, ball.z - BALL_R * cam.s);
      if (!c || !e) return;
      const r = Math.max(2, Math.hypot(e[0] - c[0], e[1] - c[1]));
      ctx.fillStyle = "#f07a1a"; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill();
      ctx.strokeStyle = "#3a1c06"; ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.stroke();
      // the black seams, turning as it spins
      ctx.save(); ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.clip();
      const k = Math.cos(ball.spin);
      ctx.beginPath(); ctx.moveTo(c[0] - r, c[1]); ctx.lineTo(c[0] + r, c[1]);
      ctx.moveTo(c[0] + k * r * 0.5, c[1] - r); ctx.lineTo(c[0] + k * r * 0.5, c[1] + r);
      ctx.stroke(); ctx.restore();
    }

    let scale = 1;
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 3); }
    function draw(){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      B.sky(clock);
      drawCourt();
      drawStands();
      const ring = [];
      for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; ring.push([you.x + Math.cos(t) * 0.9, 0.03, you.z + Math.sin(t) * 0.9]); }
      if (polyPath(ring)) { ctx.strokeStyle = "#ffe14d"; ctx.lineWidth = 3; ctx.stroke(); }
      players.forEach(p => B.shadow(p.x, p.z, 0.7 / (1 + p.y * 0.3), 0.3 / (1 + p.y * 0.4)));
      B.shadow(ball.x, ball.z, BALL_R / (1 + ball.y * 0.2), 0.3 / (1 + ball.y * 0.3));
      const things = players.map(p => ({ p, d: B.depth(p.x, 1, p.z) }));
      things.push({ ball: true, d: B.depth(ball.x, ball.y, ball.z) - 0.3 });
      [-1, 1].forEach(s => things.push({ hoop: s, d: B.depth(0, HOOP_Y, s * HOOP_Z) }));
      things.filter(t => t.d > B.NEAR || t.hoop).sort((a, b) => b.d - a.d).forEach(t => {
        if (t.ball) drawBall();
        else if (t.hoop) drawHoop(t.hoop);
        else {
          // anyone between the camera and you goes see-through, so they don't hide the game
          const list = [], meD = B.depth(you.x, 1, you.z);
          ctx.globalAlpha = t.p.me || t.d > meD ? 1 : clamp((t.d - 1.5) / 4, 0.25, 1);
          B.avatar(list, t.p, t.p.look); B.paint(list);
          ctx.globalAlpha = 1;
        }
      });
      players.forEach(p => {
        if (B.depth(p.x, 3, p.z) < B.NEAR) return;
        B.label(p.x, p.y + 3.1, p.z, (ball.owner === p ? "🏀 " : "") + p.name, p.me ? "#ffe14d" : p.team === 0 ? "#bcd6ff" : "#ffb3ab", 15);
      });
      if (charging) drawMeter();
      fx.draw(ctx, frameDt);
      if (phase === "ready" && running && phaseT < 2) {
        const n = Math.ceil(phaseT);
        ctx.font = "900 80px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.strokeText(String(n), W / 2, H * 0.42);
        ctx.fillStyle = "#ffe14d"; ctx.fillText(String(n), W / 2, H * 0.42);
      }
      if (banner.t > 0) {
        ctx.globalAlpha = Math.min(1, banner.t * 2);
        ctx.textAlign = "center"; ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.font = "800 44px 'Bricolage Grotesque', sans-serif";
        ctx.strokeText(banner.text, W / 2, 74); ctx.fillStyle = "#fff"; ctx.fillText(banner.text, W / 2, 74);
        ctx.font = "700 20px 'Bricolage Grotesque', sans-serif";
        ctx.strokeText(banner.sub, W / 2, 106); ctx.fillText(banner.sub, W / 2, 106);
        ctx.globalAlpha = 1;
      }
      drawMap();
    }
    // the shot meter: let go while the marker is in the green (it's narrower further away)
    function drawMeter(){
      const bw = 240, bx = W / 2 - bw / 2, by = H - 42, full = 1.15;
      const band = (RIM_R - BALL_R * 0.5) / errScale(toHoop(you));
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(bx - 4, by - 4, bw + 8, 24);
      ctx.fillStyle = "#3a4254"; ctx.fillRect(bx, by, bw, 16);
      ctx.fillStyle = "#3fd16a"; ctx.fillRect(bx + (PERFECT - band) / full * bw, by, band * 2 / full * bw, 16);
      const mx = bx + Math.min(charge, full) / full * bw;
      ctx.fillStyle = "#fff"; ctx.fillRect(mx - 2, by - 6, 4, 28);
      ctx.font = "800 14px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      ctx.fillText(toHoop(you) > THREE ? "3-POINTER! Let go in the green" : "Let go in the green!", W / 2, by - 10);
    }
    function drawMap(){
      const mw = 64, mh = 106, ox = W - mw - 14, oy = 14, sx = mw / (HALF_W * 2), sz = mh / (END * 2);
      const mx = x => ox + (x + HALF_W) * sx, my = z => oy + (END - z) * sz;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
      ctx.fillStyle = "#d9a066"; ctx.fillRect(ox, oy, mw, mh);
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, mw, mh); ctx.beginPath(); ctx.moveTo(ox, oy + mh / 2); ctx.lineTo(ox + mw, oy + mh / 2); ctx.stroke();
      const dot = (x, z, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx(x), my(z), r, 0, 7); ctx.fill(); };
      dot(0, HOOP_Z, "#ff6a00", 3); dot(0, -HOOP_Z, "#ff6a00", 3);
      players.forEach(p => { if (!p.me) dot(p.x, p.z, p.look.shirt, 2.6); });
      dot(you.x, you.z, "#ffe14d", 3.6);
      dot(ball.x, ball.z, "#3a1c06", 2);
    }

    function updateHud(){
      scoreEl.textContent = `🔵 ${score[0]} : ${score[1]} 🔴`;
      const t = Math.max(0, Math.ceil(timeLeft));
      timeEl.textContent = "⏱ " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
      timeEl.classList.toggle("low", phase === "play" && timeLeft < 20);
      pointsEl.textContent = "🏀 " + yourPoints + " pts";
    }
    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now; frameDt = dt;
      if (running) step(dt);
      else clock += dt;
      placeCamera(dt);
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function start(){
      reset();
      placeCamera(0);
      running = true;
      panel.hidden = true;
      Fun.release(keys);
      dropStick();
      canvas.focus();
    }
    function fullTime(){
      running = false; charging = false;
      const won = score[0] > score[1], tie = score[0] === score[1];
      if (won) store.hoopsWins = (store.hoopsWins || 0) + 1;
      Hub.saveStore(); Hub.checkBadges();
      if (won) { Fun.sfx.tada(); Hub.confettiBurst(playBtn); } else Fun.sfx.wah();
      panelTitle.textContent = won ? "🏆 You won!" : tie ? "🤝 It's a tie!" : "😩 Red won this time";
      panelText.textContent = `Final score: Blue ${score[0]} : ${score[1]} Red. You scored ${yourPoints} ${yourPoints === 1 ? "point" : "points"}.`
        + (store.hoopsWins ? ` Wins so far: ${store.hoopsWins}.` : "");
      playBtn.textContent = "▶ Play again";
      panel.hidden = false;
      playBtn.focus();
    }
    function openGame(){
      open = true; running = false;
      reset(); placeCamera(0);
      Fun.screen(overlay, true);
      panelTitle.textContent = "🏀 Blox Hoops";
      panelText.textContent = "You're the yellow-headed player on the blue team with Noob_Max and PixelMia. Hold Space and let go when the marker is in the green to shoot, or press Space right under the hoop to SLAM DUNK! E passes. Without the ball, Space jumps to block, and running into the dribbler steals it. Shots from behind the big line are worth 3. Most points in 3 minutes wins!"
        + (store.hoopsWins ? ` Wins so far: ${store.hoopsWins}.` : "");
      playBtn.textContent = "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      open = false; running = false;
      Fun.screen(overlay, false);
    }

    const KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down"
    };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!running) return;
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) pressShoot(); return; }
      if (e.code === "KeyE") { e.preventDefault(); yourPass(); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => {
      if (e.code === "Space" && open) { releaseShoot(); return; }
      const k = KEYMAP[e.code]; if (k) keys[k] = false;
    });
    window.addEventListener("blur", () => { Fun.release(keys); charging = false; dropStick(); });
    // the joystick follows your thumb and springs back when you let go
    const stickEl = $("hpStick"), knob = $("hpKnob");
    function moveStick(e){
      const r = stickEl.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      stick.x = dx; stick.y = dy;
      knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
    }
    function dropStick(){ stick.on = false; stick.x = stick.y = 0; knob.style.transform = ""; stickEl.classList.remove("on"); }
    stickEl.addEventListener("pointerdown", e => { e.preventDefault(); stick.on = true; stickEl.classList.add("on"); stickEl.setPointerCapture(e.pointerId); moveStick(e); });
    stickEl.addEventListener("pointermove", e => { if (stick.on) moveStick(e); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => stickEl.addEventListener(ev, dropStick));
    host.querySelectorAll("[data-hpkey]").forEach(btn => {
      const k = btn.dataset.hpkey;
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (k === "shoot") pressShoot(); else if (k === "pass") yourPass(); else keys[k] = true;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => {
        if (k === "shoot") releaseShoot(); else if (k !== "pass") keys[k] = false;
      }));
    });
    canvas.tabIndex = 0;

    $("hpCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("hpCloseBtn"));
    playBtn.addEventListener("click", start);

    return { open: openGame, close: closeGame };
  }
})();
