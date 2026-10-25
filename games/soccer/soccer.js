/* Blox Soccer: 4 against 4 football with the blocky Roblox-style players (games/blocky.js).
   You play with two bots and a keeper (blue) against the red team, in a stadium full of fans.
   Run into the ball to dribble it, hold Space to shoot (longer = harder), press E to pass,
   and run into whoever has the ball to tackle them. A match lasts 3 minutes: most goals wins. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "soccer", section: "games", title: "Blox Soccer", icon: "⚽",
    blurb: "4 against 4 football with the blocky Roblox players. Dribble, pass and score!",
    stat: () => store.soccerWins ? "Wins: " + store.soccerWins : "",
    badges: [
      { id: "soccerwin", icon: "⚽", name: "Match Winner", desc: "Win a match in Blox Soccer",            test: () => (store.soccerWins || 0) >= 1 },
      { id: "soccerhat", icon: "🎩", name: "Hat Trick",    desc: "Score 3 goals yourself in one match", test: () => (store.soccerBestGoals || 0) >= 3 }
    ],
    mount
  });

  /* ---------------- the pitch: x is across, z is along (blue attacks +z), y is up ---------------- */
  const HALF_W = 16, END = 25, GOAL_W = 3.6, GOAL_H = 2.6, NET = 2.2, BOX_W = 9, BOX_D = 7;
  const MATCH_TIME = 180;
  const RUN = 8.4, BOT_RUN = 7.1, KEEPER_RUN = 5.6, BALL_R = 0.35, GRAVITY = 20;
  const { clamp } = Hub.util;
  const BLUE = { shirt: "#2f7bff", pants: "#f4f6fb" }, RED = { shirt: "#e8332b", pants: "#1b1f2a" };

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="soOverlay" hidden aria-label="Blox Soccer">
      <div class="game-box">
        <div class="game-hud">
          <h2>⚽ Blox Soccer</h2>
          <span class="mono game-stat" id="soScore">🔵 0 : 0 🔴</span>
          <span class="mono game-stat" id="soTime">⏱ 3:00</span>
          <span class="mono game-stat" id="soGoals">⚽ ×0</span>
          <button class="btn ghost small" id="soCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="soCanvas" width="960" height="540"></canvas>
          <!-- on phones and tablets: a joystick to run with, and big PASS and SHOOT buttons over the pitch -->
          <div class="so-stick" id="soStick" aria-label="Joystick: drag to run"><div class="so-knob" id="soKnob"></div></div>
          <div class="so-btns">
            <button class="so-btn so-pass" data-sokey="pass" type="button" aria-label="Pass">PASS</button>
            <button class="so-btn so-shoot" data-sokey="shoot" type="button" aria-label="Shoot">SHOOT</button>
          </div>
          <div class="game-panel so-panel" id="soPanel">
            <div class="game-panel-title" id="soPanelTitle">Blox Soccer</div>
            <div class="game-panel-text" id="soPanelText"></div>
            <button class="btn" id="soPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">W A S D or the arrow keys to run (run into the ball to dribble) · hold Space to shoot, longer = harder · E to pass · run into the red player with the ball to tackle</div>

      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("soOverlay"), canvas = $("soCanvas"), ctx = canvas.getContext("2d");
    const panel = $("soPanel"), panelTitle = $("soPanelTitle"), panelText = $("soPanelText"), playBtn = $("soPlayBtn");
    const scoreEl = $("soScore"), timeEl = $("soTime"), goalsEl = $("soGoals");

    const W = 960, H = 540;
    const B = Blocky(ctx, W, H, { back: 11, up: 7.5, pitch: 0.36 }), { cam, polyPath, line3 } = B;

    let open = false, running = false, last = 0, clock = 0, frameDt = 1 / 60;
    let phase = "ready", phaseT = 0, timeLeft = MATCH_TIME, kickoffTeam = 0;
    let you = null, players = [], ball = null, score = [0, 0], yourGoals = 0;
    let charging = false, charge = 0, camYaw = 0, cheer = 0;
    let banner = { text: "", sub: "", t: 0 };
    const keys = { left: false, right: false, up: false, down: false };
    const stick = { x: 0, y: 0, on: false };   // the touch joystick: x right, y down, each -1 to 1
    const fx = Fun.pops();

    /* ----- the players ----- */
    function makePlayer(o){
      return Object.assign({ x: 0, y: 0, z: 0, vx: 0, vz: 0, face: 0, walk: 0, noTouch: 0, think: 0, holdT: 0, react: 0, home: { x: 0, u: 0 } }, o);
    }
    const sideOf = p => p.team === 0 ? 1 : -1;     // which way that team attacks
    function reset(){
      you = makePlayer({ name: "You", team: 0, me: true, look: { ...BLUE, head: "#ffd23f" }, home: { x: 0, u: -2 } });
      players = [
        you,
        makePlayer({ name: "Noob_Max",      team: 0, look: { ...BLUE, head: "#ffd23f" }, home: { x: -8, u: -5 } }),
        makePlayer({ name: "PixelMia",      team: 0, look: { ...BLUE, head: "#f2c49b" }, home: { x: 6,  u: -13 } }),
        makePlayer({ name: "GK_Bob",        team: 0, keeper: true, look: { shirt: "#2fbf5a", pants: "#1b1f2a", head: "#a8704c" } }),
        makePlayer({ name: "xX_Striker_Xx", team: 1, look: { ...RED, head: "#ffd23f" }, home: { x: 0,  u: -2 } }),
        makePlayer({ name: "BaconHair_9",   team: 1, look: { ...RED, head: "#a8704c" }, home: { x: 8,  u: -5 } }),
        makePlayer({ name: "Guest_404",     team: 1, look: { ...RED, head: "#f2c49b" }, home: { x: -6, u: -13 } }),
        makePlayer({ name: "GK_Zara",       team: 1, keeper: true, look: { shirt: "#ff9f1c", pants: "#1b1f2a", head: "#ffd23f" } })
      ];
      ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, shot: false, passTo: null, spin: 0, lastTeam: -1, lastKicker: null };
      score = [0, 0]; yourGoals = 0; timeLeft = MATCH_TIME; clock = 0; cheer = 0;
      kickoff(0, true);
    }
    // everybody back to their own half; the team that let a goal in gets the ball in the middle
    function kickoff(team, first){
      kickoffTeam = team;
      players.forEach(p => {
        const s = sideOf(p);
        if (p.keeper) { p.x = 0; p.z = -s * (END - 0.9); }
        else { p.x = p.home.x; p.z = Math.min(p.home.u, -1.5) * s; }
        p.vx = p.vz = 0; p.face = s > 0 ? 0 : Math.PI; p.noTouch = 0; p.holdT = 0;
      });
      const taker = players.find(p => p.team === team && !p.keeper && p.home.u === -2);
      taker.x = 0; taker.z = -sideOf(taker) * 0.9;
      Object.assign(ball, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: taker, held: false, shot: false, passTo: null, lastTeam: team, lastKicker: taker });
      phase = "ready"; phaseT = first ? 2.6 : 1.4;
      charging = false; charge = 0;
      camYaw = 0;
      banner = first ? { text: "Kick off! ⚽", sub: "Blue (you) against Red · 3 minutes", t: 2.4 } : { text: "Kick off!", sub: team === 0 ? "Your ball" : "Red's ball", t: 1.3 };
    }

    /* ----- moving ----- */
    function keepIn(p){
      p.x = clamp(p.x, -HALF_W + 0.5, HALF_W - 0.5);
      p.z = clamp(p.z, -END + 0.5, END - 0.5);
    }
    function moveBody(b, wantX, wantZ, speed, dt){
      const len = Math.hypot(wantX, wantZ);
      const tx = len > 0.01 ? wantX / len * speed : 0, tz = len > 0.01 ? wantZ / len * speed : 0;
      const k = Math.min(1, dt * 10);
      b.vx += (tx - b.vx) * k; b.vz += (tz - b.vz) * k;
      b.x += b.vx * dt; b.z += b.vz * dt;
      const sp = Math.hypot(b.vx, b.vz);
      let want = null;
      if (sp > 0.6) { want = Math.atan2(b.vx, b.vz); b.walk += dt * sp * 1.6; }
      else if (!b.me) want = Math.atan2(ball.x - b.x, ball.z - b.z);    // standing still: watch the ball
      if (want !== null) {
        const d = ((want - b.face) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        b.face += d * Math.min(1, dt * 12);
      }
      keepIn(b);
    }
    // go to a spot, slowing down as you get there so you don't wobble about
    function goTo(p, tx, tz, speed, dt){
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { moveBody(p, 0, 0, 0, dt); return; }
      moveBody(p, dx, dz, d < 2 ? Math.max(1.5, speed * d / 2) : speed, dt);
    }

    /* ----- kicking ----- */
    function kick(p, dx, dz, speed, vy, shot){
      const l = Math.hypot(dx, dz) || 1;
      ball.owner = null; ball.held = false;
      ball.vx = dx / l * speed; ball.vz = dz / l * speed; ball.vy = vy;
      ball.y = Math.max(ball.y, 0.05);
      ball.shot = shot; ball.passTo = null;
      ball.lastTeam = p.team; ball.lastKicker = p;
      p.noTouch = 0.35;
      Fun.sfx.thunk();
    }
    function pass(p, mate){
      const d = Math.hypot(mate.x - ball.x, mate.z - ball.z);
      const speed = clamp(8 + d * 0.7, 10, 18), lead = d / speed * 0.8;
      kick(p, mate.x + mate.vx * lead - ball.x, mate.z + mate.vz * lead - ball.z, speed, d > 14 ? 4 : 1.2, false);
      ball.passTo = mate;
    }
    // where a shot should go: the way you face, nudged onto the goal if you're roughly aiming at it
    function shoot(p, power){
      let dx = Math.sin(p.face), dz = Math.cos(p.face);
      const gz = sideOf(p) * END, toLine = gz - ball.z;
      if (toLine * dz > 0 && Math.abs(toLine) < 24) {
        const hitX = ball.x + dx / dz * toLine;
        if (Math.abs(hitX) < GOAL_W + 4.5) {
          const tx = clamp(hitX, -GOAL_W + 0.6, GOAL_W - 0.6);
          dx = tx - ball.x; dz = toLine;
        }
      }
      kick(p, dx, dz, 13 + 11 * power, 1.5 + 4 * power, true);
      const sp = B.at(ball.x, 2, ball.z);
      if (sp && power > 0.75) fx.pop(p.me ? "BOOM! 💥" : "Shot!", sp[0], sp[1], "#ffe14d", p.me ? 34 : 22);
    }
    // the best team-mate to pass to: free of opponents, and further up the pitch is better
    function bestMate(p){
      const s = sideOf(p);
      let best = null, bestScore = -Infinity;
      players.forEach(m => {
        if (m === p || m.team !== p.team || m.keeper) return;
        const d = Math.hypot(m.x - p.x, m.z - p.z);
        if (d > 24 || d < 3) return;
        let free = 8;
        players.forEach(q => { if (q.team !== p.team) free = Math.min(free, Math.hypot(q.x - m.x, q.z - m.z)); });
        const sc = free + (m.z - p.z) * s * 0.25 + (m.me ? 1.5 : 0);   // bots like passing to you
        if (sc > bestScore) { bestScore = sc; best = m; }
      });
      return best;
    }
    // you press E: pass to the team-mate most in the way you're facing
    function yourPass(){
      if (ball.owner !== you || phase !== "play") return;
      const fx_ = Math.sin(you.face), fz = Math.cos(you.face);
      let best = null, bestScore = -Infinity;
      players.forEach(m => {
        if (m === you || m.team !== 0 || m.keeper) return;
        const dx = m.x - you.x, dz = m.z - you.z, d = Math.hypot(dx, dz) || 1;
        const sc = (dx * fx_ + dz * fz) / d - d / 40;
        if (sc > bestScore) { bestScore = sc; best = m; }
      });
      if (best) pass(you, best);
    }
    function startCharge(){
      if (!running || phase !== "play") return;
      charging = true; charge = 0;
    }
    function releaseShot(){
      if (!charging) return;
      charging = false;
      if (phase !== "play") return;
      const d = Math.hypot(ball.x - you.x, ball.z - you.z);
      // a loose ball right next to you can be blasted too
      if (ball.owner === you || (!ball.owner && d < 1.8 && ball.y < 1.2 && you.noTouch <= 0)) shoot(you, charge);
    }

    /* ----- the ball ----- */
    const inBox = (team, x, z) => Math.abs(x) < BOX_W && z * -(team === 0 ? 1 : -1) > END - BOX_D;
    function stepBall(dt){
      const o = ball.owner;
      if (o) {
        if (ball.held) {
          ball.x = o.x + Math.sin(o.face) * 0.6; ball.z = o.z + Math.cos(o.face) * 0.6; ball.y = 1.3;
        } else {
          const lead = 0.85 + Math.min(0.35, Math.hypot(o.vx, o.vz) * 0.04);
          ball.x = o.x + Math.sin(o.face) * lead; ball.z = o.z + Math.cos(o.face) * lead; ball.y = 0;
        }
        ball.vx = o.vx; ball.vz = o.vz; ball.vy = 0;
        ball.lastTeam = o.team; ball.lastKicker = o;
        ball.x = clamp(ball.x, -HALF_W + BALL_R, HALF_W - BALL_R);
      } else {
        ball.vy -= GRAVITY * dt;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
        if (ball.y < 0) { ball.y = 0; ball.vy = ball.vy < -2 ? -ball.vy * 0.45 : 0; }
        if (ball.y === 0) { const f = Math.exp(-1.1 * dt); ball.vx *= f; ball.vz *= f; }
        const lim = HALF_W - BALL_R;
        if (Math.abs(ball.x) > lim) { ball.x = Math.sign(ball.x) * lim; ball.vx = -ball.vx * 0.6; if (Math.abs(ball.vx) > 3) Fun.sfx.thunk(); }
      }
      ball.spin += Math.hypot(ball.vx, ball.vz) * dt * 2;
      // the end lines: into the goal, off the post, or bounce off the wall
      const az = Math.abs(ball.z), sz = Math.sign(ball.z);
      if (az > END) {
        // in the net
        ball.x = clamp(ball.x, -(GOAL_W - BALL_R), GOAL_W - BALL_R);
        if (ball.y > GOAL_H - BALL_R) { ball.y = GOAL_H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.3; }
        if (az > END + NET - BALL_R) { ball.z = sz * (END + NET - BALL_R); ball.vz *= -0.2; ball.vx *= 0.5; }
        if (az > END + 0.4 && phase === "play") goal(sz > 0 ? 0 : 1);
      } else if (az > END - BALL_R) {
        const mouth = Math.abs(ball.x) < GOAL_W - BALL_R && ball.y < GOAL_H - BALL_R;
        if (!mouth) {
          const post = Math.abs(ball.x) < GOAL_W + BALL_R && ball.y < GOAL_H + BALL_R;
          ball.z = sz * (END - BALL_R);
          if (o) return;
          if (post && Math.abs(ball.vz) > 6 && phase === "play") {
            const sp = B.at(ball.x, 2.5, ball.z);
            if (sp) fx.pop("POST! 😱", sp[0], sp[1], "#ffffff", 28);
            Fun.sfx.ding();
          } else if (Math.abs(ball.vz) > 3) Fun.sfx.thunk();
          ball.vz = -ball.vz * 0.6;
        }
      }
    }
    // who gets the ball: pick it up, catch it, block it, or tackle for it
    function touchBall(dt){
      if (phase !== "play") return;
      const o = ball.owner;
      if (o) {
        if (ball.held) return;   // nobody takes it out of the keeper's hands
        for (const p of players) {
          if (p.team === o.team || p.noTouch > 0) continue;
          if (Math.hypot(p.x - ball.x, p.z - ball.z) > 1.0) continue;
          const rate = p.me ? 5 : o.me ? 1.6 : 2.2;
          if (Math.random() < rate * dt) {
            ball.owner = p; o.noTouch = 0.8; p.think = 0.3;
            const sp = B.at(p.x, 3.4, p.z);
            if (sp) fx.pop(p.me ? "TACKLE! 💪" : o.me ? "Stolen! 😤" : "Tackle!", sp[0], sp[1], p.me ? "#7bd68a" : "#ffffff", p.me || o.me ? 28 : 18);
            Fun.sfx.bonk();
            return;
          }
        }
        return;
      }
      const sp = Math.hypot(ball.vx, ball.vz);
      let best = null, bestD = Infinity;
      players.forEach(p => {
        if (p.noTouch > 0) return;
        const d = Math.hypot(p.x - ball.x, p.z - ball.z);
        const hands = p.keeper && inBox(p.team, p.x, p.z);
        const reach = hands ? 1.4 : ball.passTo === p ? 1.5 : 0.95;
        if (d < reach && ball.y < (hands ? GOAL_H + 0.3 : 0.9) && d < bestD) { best = p; bestD = d; }
      });
      if (!best) return;
      const where = B.at(best.x, 3.4, best.z);
      if (best.keeper && inBox(best.team, best.x, best.z)) {
        const save = ball.shot && ball.lastTeam !== best.team;
        ball.owner = best; ball.held = true; ball.shot = false; ball.passTo = null;
        best.holdT = 1;
        if (save) {
          if (where) fx.pop(best.team === 0 ? "SAVED! 🧤" : "Saved… 😩", where[0], where[1], best.team === 0 ? "#7bd68a" : "#ffffff", 30);
          Fun.sfx.thunk();
        }
        return;
      }
      if (ball.shot && sp > 13 && ball.lastTeam !== best.team) {
        // a hard shot right at you bounces off
        ball.vx = -ball.vx * 0.35 + (Math.random() - 0.5) * 4; ball.vz = -ball.vz * 0.35; ball.vy = 3;
        ball.shot = false; best.noTouch = 0.3;
        if (where) fx.pop("BLOCKED!", where[0], where[1], "#ffffff", 22);
        Fun.sfx.bonk();
        return;
      }
      ball.owner = best; ball.held = false; ball.shot = false; ball.passTo = null;
      best.think = 0.3;
    }
    function goal(team){
      score[team]++;
      kickoffTeam = 1 - team;   // the team that let it in kicks off
      const scorer = ball.lastTeam === team ? ball.lastKicker : null;
      if (scorer === you) yourGoals++;
      ball.owner = null; ball.held = false; ball.passTo = null;
      phase = "goal"; phaseT = 3; cheer = 3;
      const name = scorer ? (scorer.me ? "You scored!" : scorer.name + " scored") : "Own goal! 🙈";
      banner = team === 0 ? { text: "GOOOAL!!! ⚽", sub: name + ` · ${score[0]} : ${score[1]}`, t: 2.8 }
                          : { text: "Red scored 😬", sub: name + ` · ${score[0]} : ${score[1]}`, t: 2.8 };
      if (team === 0) { Fun.sfx.tada(); fx.burst(W / 2, H * 0.3, "#ffe14d", 30, 260); fx.burst(W / 2, H * 0.3, "#2f7bff", 30, 260); }
      else Fun.sfx.wah();
      Fun.shake(canvas);
    }

    /* ----- the bots ----- */
    // who on a team goes for the ball (the closest, and a second one to press when the other team has it)
    function chasers(team){
      const list = players.filter(p => p.team === team && !p.keeper)
        .map(p => ({ p, d: Math.hypot(p.x - ball.x, p.z - ball.z) })).sort((a, b) => a.d - b.d);
      const out = [list[0].p];
      if (ball.owner && ball.owner.team !== team && list[0].p.me) out.push(list[1].p);
      return out;
    }
    function stepBot(p, dt, chase){
      if (p.keeper) { stepKeeper(p, dt); return; }
      const o = ball.owner, s = sideOf(p);
      if (o === p) { botDribble(p, dt); return; }
      const teamHas = o && o.team === p.team;
      if (ball.passTo === p && !o) {
        goTo(p, ball.x + ball.vx * 0.3, ball.z + ball.vz * 0.3, BOT_RUN, dt);
      } else if (!teamHas && chase.includes(p)) {
        goTo(p, ball.x + ball.vx * 0.25, ball.z + ball.vz * 0.25, BOT_RUN, dt);
      } else {
        // hold a spot in the formation that moves up and down with the ball
        const u = clamp(p.home.u + ball.z * s * 0.55 + (teamHas ? 6 : 0), -END + 4, END - 5);
        goTo(p, clamp(p.home.x * 0.85 + ball.x * 0.25, -HALF_W + 2, HALF_W - 2), u * s, BOT_RUN * 0.9, dt);
      }
    }
    function botDribble(p, dt){
      const s = sideOf(p), gz = s * END;
      const toGoal = Math.hypot(p.x, gz - p.z);
      let threat = null, td = Infinity;
      players.forEach(q => {
        if (q.team === p.team || q.keeper) return;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < td) { td = d; threat = q; }
      });
      p.think -= dt;
      if (p.think <= 0) {
        p.think = 0.25;
        if (toGoal < 8 || (toGoal < 16 && Math.random() < 0.3)) { botShoot(p); return; }
        if (td < 2 && Math.random() < 0.25) { const m = bestMate(p); if (m) { pass(p, m); return; } }
        // your team-mates pass to you when you're further up the pitch
        if (p.team === 0 && Math.random() < 0.2 && (you.z - p.z) > 2 && Math.hypot(you.x - p.x, you.z - p.z) < 22) { pass(p, you); return; }
      }
      // run at the goal, swerving round the closest opponent
      let wx = -p.x * 0.08, wz = s;
      if (threat && td < 4) {
        wx += (p.x - threat.x) / td * (4 - td) * 0.6;
        wz += (p.z - threat.z) / td * (4 - td) * 0.2;
      }
      if (wz * s < 0.3) wz = s * 0.3;
      moveBody(p, wx, wz, BOT_RUN, dt);
    }
    function botShoot(p){
      const keeper = players.find(q => q.keeper && q.team !== p.team);
      const side = keeper.x > 0 ? -1 : 1;          // the side the keeper isn't on
      const tx = side * (1.4 + Math.random() * 1.8) + (Math.random() - 0.5) * 1.6;
      kick(p, tx - ball.x, sideOf(p) * END - ball.z, 14 + Math.random() * 5, 1.5 + Math.random() * 2.5, true);
      const sp = B.at(p.x, 3.4, p.z);
      if (sp) fx.pop("Shot!", sp[0], sp[1], "#ffffff", 20);
    }
    function stepKeeper(k, dt){
      const s = sideOf(k), lineZ = -s * (END - 0.9);
      if (ball.owner === k) {
        moveBody(k, 0, 0, 0, dt);
        k.face = s > 0 ? 0 : Math.PI;
        k.holdT -= dt;
        if (k.holdT <= 0) {
          const m = bestMate(k);
          if (m) pass(k, m); else kick(k, 0, s, 16, 4, false);
        }
        return;
      }
      let tx = clamp(ball.x * 0.5, -GOAL_W + 0.6, GOAL_W - 0.6), tz = lineZ, speed = KEEPER_RUN;
      const coming = !ball.owner && ball.vz * -s > 4;
      if (coming) {
        // a shot coming in: after a moment to react, dive to where it will cross the line
        k.react += dt;
        if (k.react > 0.18) { const t = (lineZ - ball.z) / ball.vz; tx = clamp(ball.x + ball.vx * t, -GOAL_W, GOAL_W); speed = KEEPER_RUN * 1.25; }
      } else {
        k.react = 0;
        const bs = Math.hypot(ball.vx, ball.vz);
        if (inBox(k.team, ball.x, ball.z) && (!ball.owner ? bs < 7 : ball.owner.team !== k.team)) {
          // a loose ball or an attacker in the box: come out for it
          tx = ball.x; tz = ball.z;
        }
      }
      const boxZ = s * -(END - BOX_D + 1);
      tz = s > 0 ? Math.min(tz, boxZ) : Math.max(tz, boxZ);
      goTo(k, clamp(tx, -BOX_W + 1, BOX_W - 1), tz, speed, dt);
    }

    /* ----- you ----- */
    function stepYou(dt){
      if (phase !== "play") { moveBody(you, 0, 0, 0, dt); return; }
      let fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), push = 1;
      // the joystick: push it a little to jog, all the way to sprint
      const m = Math.hypot(stick.x, stick.y);
      if (stick.on && m > 0.15) { fwd = -stick.y; side = stick.x; push = Math.min(1, 0.35 + m * 0.75); }
      // the keys go the way the camera looks
      moveBody(you, side * cam.c + fwd * cam.s, -side * cam.s + fwd * cam.c, (ball.owner === you ? RUN * 0.92 : RUN) * push, dt);
      if (charging) charge = Math.min(1, charge + dt / 0.7);
    }

    function step(dt){
      clock += dt;
      if (banner.t > 0) banner.t -= dt;
      if (cheer > 0) cheer -= dt;
      players.forEach(p => { if (p.noTouch > 0) p.noTouch -= dt; });
      if (phase === "ready") {
        phaseT -= dt;
        if (phaseT <= 0) { phase = "play"; Fun.sfx.zap(); fx.pop("GO!", W / 2, H * 0.4, "#7bd68a", 56); }
        stepBall(dt);
        return;
      }
      if (phase === "goal") {
        phaseT -= dt;
        stepBall(dt);
        // the scorers jump about
        players.forEach(p => moveBody(p, 0, 0, 0, dt));
        if (phaseT <= 0) kickoff(kickoffTeam);
        return;
      }
      timeLeft -= dt;
      if (timeLeft <= 0) { fullTime(); return; }
      stepYou(dt);
      const chase = [chasers(0), chasers(1)];
      players.forEach(p => { if (!p.me) stepBot(p, dt, chase[p.team]); });
      // nobody stands inside anybody else
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
      // follow the ball; when you have it, look at the goal you're shooting at
      if (phase === "play" || phase === "goal") {
        if (ball.owner === you) camYaw = Math.atan2(-you.x * 0.4, END - you.z);
        else if (Math.hypot(ball.x - you.x, ball.z - you.z) > 3) camYaw = Math.atan2(ball.x - you.x, ball.z - you.z);
      }
      B.follow(you, camYaw, dt);
    }

    // the fans: rows of blocky heads round the stands, in random team colours
    const FANS = (() => {
      const list = [], cols = ["#2f7bff", "#e8332b", "#ffd23f", "#ffffff", "#2fbf5a", "#ff9f1c", "#b46bff"];
      const row = (x0, z0, x1, z1, out) => {
        const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6);
        for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          list.push({ x: x0 + (x1 - x0) * t + out[0] * (2.2 + r * 2), z: z0 + (z1 - z0) * t + out[1] * (2.2 + r * 2), y: 1.6 + r * 1.4, c: cols[(i * 7 + r * 3) % cols.length], hop: Math.random() * 6 });
        }
      };
      row(-HALF_W - 1, -END - 3, -HALF_W - 1, END + 3, [-1, 0]);
      row(HALF_W + 1, -END - 3, HALF_W + 1, END + 3, [1, 0]);
      row(-HALF_W - 1, END + NET + 1, HALF_W + 1, END + NET + 1, [0, 1]);
      row(-HALF_W - 1, -END - NET - 1, HALF_W + 1, -END - NET - 1, [0, -1]);
      return list;
    })();
    function quad(pts, colour){ if (polyPath(pts)) { ctx.fillStyle = colour; ctx.fill(); } }

    function drawPitch(){
      quad([[-80, 0, -90], [80, 0, -90], [80, 0, 90], [-80, 0, 90]], "#3f8f3f");
      // stripes of light and dark grass
      for (let i = 0; i < 10; i++) {
        const z0 = -END + i * END / 5, z1 = z0 + END / 5;
        quad([[-HALF_W, 0, z0], [HALF_W, 0, z0], [HALF_W, 0, z1], [-HALF_W, 0, z1]], i % 2 ? "#4fae4a" : "#5cbc55");
      }
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5; ctx.beginPath();
      const rect = (x0, z0, x1, z1) => { line3([x0, 0.02, z0], [x1, 0.02, z0]); line3([x1, 0.02, z0], [x1, 0.02, z1]); line3([x1, 0.02, z1], [x0, 0.02, z1]); line3([x0, 0.02, z1], [x0, 0.02, z0]); };
      rect(-HALF_W + 0.5, -END, HALF_W - 0.5, END);
      line3([-HALF_W + 0.5, 0.02, 0], [HALF_W - 0.5, 0.02, 0]);
      [-1, 1].forEach(s => { rect(-BOX_W, s * END, BOX_W, s * (END - BOX_D)); rect(-GOAL_W - 1.5, s * END, GOAL_W + 1.5, s * (END - 2.5)); });
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2, b = (i + 1) / 24 * Math.PI * 2;
        line3([Math.cos(a) * 4.5, 0.02, Math.sin(a) * 4.5], [Math.cos(b) * 4.5, 0.02, Math.sin(b) * 4.5]);
      }
      ctx.stroke();
      // the walls round the pitch, with a gap for each goal
      const wall = (x0, z0, x1, z1) => quad([[x0, 0, z0], [x1, 0, z1], [x1, 1, z1], [x0, 1, z0]], "#2f6fd6");
      [-1, 1].forEach(s => {
        wall(s * HALF_W, -END, s * HALF_W, END);
        wall(-HALF_W, s * END, -GOAL_W, s * END); wall(GOAL_W, s * END, HALF_W, s * END);
      });
    }
    function drawStands(){
      const slab = (pts, colour) => ({ pts, colour, d: B.depth(...pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0])) });
      const W1 = HALF_W + 1, W2 = HALF_W + 9, E1 = END + NET + 1, E2 = E1 + 8;
      const slabs = [
        slab([[-W1, 1, -E1], [-W1, 1, E1], [-W2, 6, E1], [-W2, 6, -E1]], "#6b7280"),
        slab([[W1, 1, -E1], [W1, 1, E1], [W2, 6, E1], [W2, 6, -E1]], "#6b7280"),
        slab([[-W1, 1, E1], [W1, 1, E1], [W1, 6, E2], [-W1, 6, E2]], "#7a8190"),
        slab([[-W1, 1, -E1], [W1, 1, -E1], [W1, 6, -E2], [-W1, 6, -E2]], "#7a8190")
      ].filter(s => s.d > 0);
      slabs.sort((a, b) => b.d - a.d).forEach(s => quad(s.pts, s.colour));
      // fans bob about, and jump up and down after a goal
      FANS.forEach(f => {
        const hop = cheer > 0 ? Math.abs(Math.sin(clock * 9 + f.hop)) * 0.8 : Math.abs(Math.sin(clock * 1.5 + f.hop)) * 0.12;
        const p = B.at(f.x, f.y + hop, f.z);
        if (!p) return;
        const r = Math.min(14, 260 / Math.max(1, B.depth(f.x, f.y, f.z)));
        ctx.fillStyle = f.c; ctx.fillRect(p[0] - r * 0.6, p[1] - r * 0.2, r * 1.2, r * 1.2);
        ctx.fillStyle = "#ffd23f"; ctx.fillRect(p[0] - r * 0.4, p[1] - r * 0.9, r * 0.8, r * 0.75);
      });
    }
    function drawNets(){
      [-1, 1].forEach(s => {
        const z0 = s * END, z1 = s * (END + NET);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        [[[-GOAL_W, 0, z1], [GOAL_W, 0, z1], [GOAL_W, GOAL_H, z1], [-GOAL_W, GOAL_H, z1]],
         [[-GOAL_W, 0, z0], [-GOAL_W, 0, z1], [-GOAL_W, GOAL_H, z1], [-GOAL_W, GOAL_H, z0]],
         [[GOAL_W, 0, z0], [GOAL_W, 0, z1], [GOAL_W, GOAL_H, z1], [GOAL_W, GOAL_H, z0]],
         [[-GOAL_W, GOAL_H, z0], [GOAL_W, GOAL_H, z0], [GOAL_W, GOAL_H, z1], [-GOAL_W, GOAL_H, z1]]
        ].forEach(pts => { if (polyPath(pts)) ctx.fill(); });
        ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = -GOAL_W; x <= GOAL_W + 0.01; x += 0.6) { line3([x, 0, z1], [x, GOAL_H, z1]); line3([x, GOAL_H, z0], [x, GOAL_H, z1]); }
        for (let y = 0; y <= GOAL_H + 0.01; y += 0.6) { line3([-GOAL_W, y, z1], [GOAL_W, y, z1]); line3([-GOAL_W, y, z0], [-GOAL_W, y, z1]); line3([GOAL_W, y, z0], [GOAL_W, y, z1]); }
        ctx.stroke();
      });
    }
    function goalFrame(s){
      const list = [], body = { x: 0, y: 0, z: s * END, face: 0 };
      B.part(list, body, -GOAL_W, 0, 0, 0.25, GOAL_H, 0.25, "#ffffff");
      B.part(list, body, GOAL_W, 0, 0, 0.25, GOAL_H, 0.25, "#ffffff");
      B.part(list, body, 0, GOAL_H - 0.25, 0, GOAL_W * 2 + 0.25, 0.25, 0.25, "#ffffff");
      return list;
    }
    function drawBall(){
      const c = B.at(ball.x, ball.y + BALL_R, ball.z), e = B.at(ball.x + BALL_R * cam.c, ball.y + BALL_R, ball.z - BALL_R * cam.s);
      if (!c || !e) return;
      const r = Math.max(2, Math.hypot(e[0] - c[0], e[1] - c[1]));
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.clip();
      ctx.fillStyle = "#1b1f2a";
      for (let i = 0; i < 4; i++) {
        const a = ball.spin + i * Math.PI / 2, px = c[0] + Math.cos(a) * r * 0.6, py = c[1] + Math.sin(a * 0.7) * r * 0.5;
        ctx.beginPath(); ctx.arc(px, py, r * 0.28, 0, 7); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.stroke();
    }

    let scale = 1;
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 3); }
    function draw(){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      B.sky(clock);
      drawPitch();
      drawStands();
      drawNets();
      // a yellow ring under you so you can always find yourself
      const ring = [];
      for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; ring.push([you.x + Math.cos(t) * 0.9, 0.03, you.z + Math.sin(t) * 0.9]); }
      if (polyPath(ring)) { ctx.strokeStyle = "#ffe14d"; ctx.lineWidth = 3; ctx.stroke(); }
      players.forEach(p => B.shadow(p.x, p.z, 0.7, 0.3));
      B.shadow(ball.x, ball.z, BALL_R / (1 + ball.y * 0.3), 0.35 / (1 + ball.y * 0.5));
      // people, the ball and the goal frames, farthest first
      const things = players.map(p => ({ p, d: B.depth(p.x, 1, p.z) }));
      things.push({ ball: true, d: B.depth(ball.x, ball.y, ball.z) });
      [-1, 1].forEach(s => things.push({ frame: s, d: B.depth(0, 1, s * END) }));
      things.filter(t => t.d > B.NEAR || t.frame).sort((a, b) => b.d - a.d).forEach(t => {
        if (t.ball) drawBall();
        else if (t.frame) B.paint(goalFrame(t.frame));
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
        B.label(p.x, 3.1, p.z, (ball.owner === p ? "⚽ " : "") + p.name, p.me ? "#ffe14d" : p.team === 0 ? "#bcd6ff" : "#ffb3ab", 15);
      });
      // the power bar while you hold Space
      if (charging) {
        const bw = 220, bx = W / 2 - bw / 2, by = H - 40;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(bx - 4, by - 4, bw + 8, 22);
        ctx.fillStyle = charge > 0.85 ? "#ff4a3d" : charge > 0.5 ? "#ffb447" : "#7bd68a";
        ctx.fillRect(bx, by, bw * charge, 14);
        ctx.font = "800 14px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
        ctx.fillText("POWER", W / 2, by - 8);
      }
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
    // a little map of the pitch in the corner: red's goal is at the top
    function drawMap(){
      const mw = 72, mh = 112, ox = W - mw - 14, oy = 14, sx = mw / (HALF_W * 2), sz = mh / (END * 2);
      const mx = x => ox + (x + HALF_W) * sx, my = z => oy + (END - z) * sz;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
      ctx.fillStyle = "#4fae4a"; ctx.fillRect(ox, oy, mw, mh);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, mw, mh); ctx.beginPath(); ctx.moveTo(ox, oy + mh / 2); ctx.lineTo(ox + mw, oy + mh / 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.fillRect(mx(-GOAL_W), oy - 3, GOAL_W * 2 * sx, 3); ctx.fillRect(mx(-GOAL_W), oy + mh, GOAL_W * 2 * sx, 3);
      const dot = (x, z, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx(x), my(z), r, 0, 7); ctx.fill(); };
      players.forEach(p => { if (!p.me) dot(p.x, p.z, p.look.shirt, 2.6); });
      dot(you.x, you.z, "#ffe14d", 3.6);
      dot(ball.x, ball.z, "#ffffff", 2.2);
    }

    function updateHud(){
      scoreEl.textContent = `🔵 ${score[0]} : ${score[1]} 🔴`;
      const t = Math.max(0, Math.ceil(timeLeft));
      timeEl.textContent = "⏱ " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
      timeEl.classList.toggle("low", phase === "play" && timeLeft < 20);
      goalsEl.textContent = "⚽ ×" + yourGoals;
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
      running = false;
      charging = false;
      const won = score[0] > score[1], draw = score[0] === score[1];
      if (won) store.soccerWins = (store.soccerWins || 0) + 1;
      if (yourGoals > (store.soccerBestGoals || 0)) store.soccerBestGoals = yourGoals;
      Hub.saveStore(); Hub.checkBadges();
      if (won) { Fun.sfx.tada(); Hub.confettiBurst(playBtn); } else Fun.sfx.wah();
      panelTitle.textContent = won ? "🏆 You won!" : draw ? "🤝 It's a draw!" : "😩 Red won this time";
      panelText.textContent = `Full time: Blue ${score[0]} : ${score[1]} Red. `
        + (yourGoals ? `You scored ${yourGoals} ${yourGoals === 1 ? "goal" : "goals"}${yourGoals >= 3 ? " — a HAT TRICK! 🎩" : "!"}` : "You didn't score yourself this time.")
        + (store.soccerWins ? ` Wins so far: ${store.soccerWins}.` : "");
      playBtn.textContent = "▶ Play again";
      panel.hidden = false;
      playBtn.focus();
    }
    function openGame(){
      open = true; running = false;
      reset(); placeCamera(0);
      Fun.screen(overlay, true);
      panelTitle.textContent = "⚽ Blox Soccer";
      panelText.textContent = "You're the yellow-headed player on the blue team, with Noob_Max, PixelMia and GK_Bob in goal. Run into the ball to dribble, hold Space to shoot (longer = harder), press E to pass, and run into a red player with the ball to tackle. Most goals in 3 minutes wins!"
        + (store.soccerWins ? ` Wins so far: ${store.soccerWins}.` : "");
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
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) startCharge(); return; }
      if (e.code === "KeyE") { e.preventDefault(); yourPass(); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => {
      if (e.code === "Space" && open) { releaseShot(); return; }
      const k = KEYMAP[e.code]; if (k) keys[k] = false;
    });
    window.addEventListener("blur", () => { Fun.release(keys); charging = false; stick.on = false; });
    // the joystick follows your thumb (it can go a little outside the ring) and springs back when you let go
    const stickEl = $("soStick"), knob = $("soKnob");
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
    host.querySelectorAll("[data-sokey]").forEach(btn => {
      const k = btn.dataset.sokey;
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (k === "shoot") startCharge(); else if (k === "pass") yourPass(); else keys[k] = true;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => {
        if (k === "shoot") releaseShot(); else if (k !== "pass") keys[k] = false;
      }));
    });
    canvas.tabIndex = 0;

    $("soCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("soCloseBtn"));
    playBtn.addEventListener("click", start);

    return { open: openGame, close: closeGame };
  }
})();
