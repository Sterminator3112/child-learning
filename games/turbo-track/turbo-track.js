/* Turbo Track: a toy-car race seen from above, on an orange track floating high in the sky.
   Pick your car and its colour, then race three robot cars for 3 laps against the clock.
   Speed boosters, a ramp jump over a gap, a loop-the-loop and sharp turns. Too slow for the
   jump or the loop and you have to go back and try again! The course is in track.js and the sky in sky.js. */
(function(){
  "use strict";
  const store = Hub.store;
  if (!store.turbo) store.turbo = {};
  const T = store.turbo;
  // best times are kept per track now; the old single best was on the first track
  if (!T.bestTimes) T.bestTimes = T.bestTime ? { sky: T.bestTime } : {};
  if (!T.bestLaps) T.bestLaps = T.bestLap ? { sky: T.bestLap } : {};
  const fmtTime = s => Math.floor(s / 60) + ":" + (s % 60).toFixed(1).padStart(4, "0");

  Hub.register({
    id: "turbo", section: "games", title: "Turbo Track", icon: "🏎️",
    blurb: "Race robot cars round an orange toy track, with loops, jumps and speed boosters!",
    stat: () => T.wins ? `🏆 ${T.wins} ${T.wins === 1 ? "win" : "wins"}` : "",
    badges: [
      { id: "turbo1",    icon: "🏎️", name: "Turbo Winner",  desc: "Win a race on Turbo Track",   test: () => (T.wins || 0) >= 1 },
      { id: "turbo5",    icon: "🏆", name: "Track Champ",   desc: "Win 5 races on Turbo Track",  test: () => (T.wins || 0) >= 5 },
      { id: "turboHard", icon: "🤖", name: "Robot Crusher", desc: "Beat the Hard robots",        test: () => (T.hardWins || 0) >= 1 },
      { id: "turboLap",  icon: "⚡", name: "Lightning Lap", desc: "Drive a super-fast lap on any track",
        test: () => COURSES.some(k => (T.bestLaps[k.C.layout.id] || Infinity) < k.C.parLap * 1.05) }
    ],
    mount
  });

  /* ---------------- cars and colours ---------------- */
  const MODELS = [
    { id: "muscle",  name: "Muscle",  emoji: "🔥", speed: 5, turn: 3 },
    { id: "formula", name: "Formula", emoji: "⚡", speed: 4, turn: 4 },
    { id: "shark",   name: "Shark",   emoji: "🦈", speed: 5, turn: 3 },
    { id: "monster", name: "Monster", emoji: "💪", speed: 3, turn: 5 },
    { id: "bubble",  name: "Bubble",  emoji: "🫧", speed: 3, turn: 5 }
  ];
  const COLOURS = [
    { id: "red", hex: "#e8262b" }, { id: "orange", hex: "#ff7a00" }, { id: "yellow", hex: "#ffd21f" },
    { id: "lime", hex: "#6be03a" }, { id: "blue", hex: "#1f6bff" }, { id: "aqua", hex: "#20d0e0" },
    { id: "purple", hex: "#8a3cff" }, { id: "pink", hex: "#ff4fb0" }, { id: "black", hex: "#2a2d34" },
    { id: "white", hex: "#f2f2f2" }, { id: "gold", hex: "#e0b232" }, { id: "rainbow", hex: "#ff4d4d" }
  ];
  const ROBOTS = [
    { id: "easy",   label: "🐢 Easy",   skill: 0.8 },
    { id: "medium", label: "🚗 Medium", skill: 0.91 },
    { id: "hard",   label: "🚀 Hard",   skill: 1.0 }
  ];
  const LAPS = 3;

  // the paint for a car: plain colours, or gradients for gold and rainbow
  function paint(ctx, colour, len){
    if (colour === "rainbow") {
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff"].forEach((c, i) => g.addColorStop(i / 5, c));
      return g;
    }
    if (colour === "gold") {
      const g = ctx.createLinearGradient(0, -12, 0, 12);
      g.addColorStop(0, "#fff1a8"); g.addColorStop(0.45, "#e0b232"); g.addColorStop(1, "#8a6512");
      return g;
    }
    return (COLOURS.find(c => c.id === colour) || COLOURS[0]).hex;
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // a car seen from above, pointing along +x, about 46 long and 24 wide
  function drawCar(ctx, model, colour, flame){
    const body = paint(ctx, colour, 46);
    const ink = "#14161b", glass = "#9fdde0";
    const wheel = (x, y, w, h) => { ctx.fillStyle = ink; roundRect(ctx, x - w / 2, y - h / 2, w, h, 2); ctx.fill(); };
    if (flame) {
      ctx.fillStyle = "rgba(255,160,40,0.9)";
      ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(-34 - Math.random() * 10, 0); ctx.lineTo(-22, 6); ctx.fill();
      ctx.fillStyle = "rgba(255,240,120,0.95)";
      ctx.beginPath(); ctx.moveTo(-22, -3); ctx.lineTo(-28 - Math.random() * 6, 0); ctx.lineTo(-22, 3); ctx.fill();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ink;
    if (model === "formula") {
      wheel(13, -11, 10, 6); wheel(13, 11, 10, 6); wheel(-13, -12, 11, 7); wheel(-13, 12, 11, 7);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(10, -5); ctx.lineTo(-18, -7); ctx.lineTo(-18, 7); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundRect(ctx, 18, -11, 5, 22, 1); ctx.fill(); ctx.stroke();      // front wing
      roundRect(ctx, -24, -12, 6, 24, 1); ctx.fill(); ctx.stroke();     // back wing
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(-2, 0, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(4, -1, 14, 2);
    } else if (model === "monster") {
      wheel(13, -12, 15, 9); wheel(13, 12, 15, 9); wheel(-13, -12, 15, 9); wheel(-13, 12, 15, 9);
      ctx.fillStyle = body; roundRect(ctx, -19, -9, 38, 18, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = glass; roundRect(ctx, -3, -7, 10, 14, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillRect(-16, -6, 8, 12);
    } else if (model === "bubble") {
      wheel(11, -11, 9, 5); wheel(11, 11, 9, 5); wheel(-11, -11, 9, 5); wheel(-11, 11, 9, 5);
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 21, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = glass; ctx.beginPath(); ctx.ellipse(1, 0, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.ellipse(4, -3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (model === "shark") {
      wheel(10, -11, 9, 5); wheel(10, 11, 9, 5); wheel(-12, -11, 10, 6); wheel(-12, 11, 10, 6);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(25, 0); ctx.quadraticCurveTo(14, -12, -20, -11); ctx.lineTo(-22, 11); ctx.quadraticCurveTo(14, 12, 25, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(0, -7); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-20, -3); ctx.lineTo(-20, 3); ctx.closePath(); ctx.fill(); // fin
      ctx.fillStyle = "#fff"; [14, 17, 20].forEach(x => ctx.fillRect(x, -6 + (x - 14) / 3, 1.5, 3));                    // gills
    } else { // muscle
      wheel(12, -11, 10, 6); wheel(12, 11, 10, 6); wheel(-12, -11, 11, 7); wheel(-12, 11, 11, 7);
      ctx.fillStyle = body; roundRect(ctx, -22, -11, 45, 22, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(-22, -3.5, 45, 2.5); ctx.fillRect(-22, 1, 45, 2.5); // racing stripes
      ctx.fillStyle = glass; roundRect(ctx, -6, -9, 12, 18, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; roundRect(ctx, 10, -4, 7, 8, 1.5); ctx.fill();                                          // hood scoop
    }
  }

  /* ---------------- the courses: every track is built once, and each race picks one ---------------- */
  // the track drawn as paths: the road (without the gap), the part of the loop that crosses over, the middle line
  function trackPath(course, filter){
    const p = new Path2D();
    let open = false;
    for (let i = 0; i <= course.N; i++) {
      const s = course.samples[i % course.N];
      if (filter(s)) { if (open) p.lineTo(s.x, s.y); else { p.moveTo(s.x, s.y); open = true; } }
      else open = false;
    }
    return p;
  }
  const COURSES = TurboTrackCourse.layouts.map(layout => {
    const C = TurboTrackCourse.build(layout);
    return {
      C,
      ROAD: trackPath(C, s => s.kind !== "gap"),
      DECK: trackPath(C, s => s.deck),
      LINE: trackPath(C, s => s.kind === "road" || s.kind === "loop"),
      // where the track pieces clip together, every 40 samples (not on the ramp or over the gap)
      JOINTS: C.samples.map((s, i) => i).filter(i => i % 40 === 20 && (C.samples[i].kind === "road" || C.samples[i].kind === "loop"))
    };
  });
  // the track being raced right now
  let C, samples, N, L, DS, HALF, wrap, ROAD, DECK, LINE, JOINTS;
  function useCourse(course){
    ({ C, ROAD, DECK, LINE, JOINTS } = course);
    ({ samples, N, L, DS, HALF, wrap } = C);
  }
  useCourse(COURSES[0]);

  // shiny orange plastic: a faint speckle, so the track doesn't look flat
  let plastic = null;
  function plasticPattern(ctx){
    if (plastic) return plastic;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#ff7a00"; g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 900; k++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(255,190,90,0.18)" : "rgba(170,60,0,0.14)";
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    plastic = ctx.createPattern(c, "repeat");
    return plastic;
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="ttOverlay" hidden aria-label="Turbo Track">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏎️ Turbo Track</h2>
          <span class="mono game-stat" id="ttTime">⏱ 0:00.0</span>
          <span class="mono game-stat" id="ttLap">Lap 1/${LAPS}</span>
          <span class="mono game-stat" id="ttPos">🏁 1st</span>
          <button class="btn ghost small" id="ttCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="ttCanvas" width="960" height="540"></canvas>
          <div class="game-panel tt-panel" id="ttPanel">
            <div class="game-panel-title" id="ttPanelTitle">🏎️ Turbo Track</div>
            <div class="game-panel-text" id="ttPanelText"></div>
            <div class="tt-results" id="ttResults" hidden></div>
            <div class="tt-garage" id="ttGarage">
              <canvas class="tt-preview" id="ttPreview" width="300" height="150" aria-hidden="true"></canvas>
              <div class="tt-models" id="ttModels" role="group" aria-label="Car"></div>
              <div class="tt-stats" id="ttStats"></div>
              <div class="tt-colours" id="ttColours" role="group" aria-label="Colour"></div>
              <div class="tt-robots"><span>Robots:</span><div class="segmented" id="ttRobots" role="group" aria-label="Robot drivers"></div></div>
            </div>
            <div class="tt-actions">
              <button class="btn" id="ttPlayBtn" type="button">▶ Race!</button>
              <button class="btn ghost" id="ttGarageBtn" type="button" hidden>🚗 Change car</button>
            </div>
          </div>
        </div>
        <div class="game-help">↑ or W to drive · ↓ or S to brake · ← → or A D to steer · C to switch camera · hit the ⚡ boosters before the jump and the loop!</div>
        <div class="game-touch">
          <button class="btn ghost fun-dpad" data-key="left" type="button" aria-label="Steer left">◀</button>
          <button class="btn ghost fun-dpad" data-key="right" type="button" aria-label="Steer right">▶</button>
          <button class="btn ghost fun-dpad" data-key="brake" type="button" aria-label="Brake">🛑</button>
          <button class="btn" data-key="gas" type="button" aria-label="Drive">⛽ GO</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("ttOverlay"), canvas = $("ttCanvas");
    let ctx = canvas.getContext("2d");
    const panel = $("ttPanel"), panelTitle = $("ttPanelTitle"), panelText = $("ttPanelText");
    const results = $("ttResults"), garage = $("ttGarage"), playBtn = $("ttPlayBtn"), garageBtn = $("ttGarageBtn");
    const timeEl = $("ttTime"), lapEl = $("ttLap"), posEl = $("ttPos");
    const W = canvas.width, H = canvas.height;
    let ZOOM = 0.78;

    if (!T.model) T.model = "muscle";
    if (!T.colour) T.colour = "red";
    if (!T.robots) T.robots = "easy";

    /* ---------------- the garage: pick a car, a colour and the robots ---------------- */
    const preview = $("ttPreview"), pctx = preview.getContext("2d");
    function drawPreview(){
      pctx.clearRect(0, 0, preview.width, preview.height);
      pctx.save();
      pctx.translate(150, 78);
      pctx.scale(2.6, 2.6);
      pctx.fillStyle = "rgba(0,0,0,0.3)";
      pctx.beginPath(); pctx.ellipse(2, 5, 25, 14, 0, 0, Math.PI * 2); pctx.fill();
      drawCar(pctx, T.model, T.colour, false);
      pctx.restore();
    }
    function renderGarage(){
      const models = $("ttModels"); models.innerHTML = "";
      MODELS.forEach(m => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn ghost small";
        b.textContent = `${m.emoji} ${m.name}`;
        b.setAttribute("aria-pressed", String(m.id === T.model));
        b.addEventListener("click", () => { T.model = m.id; Hub.saveStore(); renderGarage(); });
        models.appendChild(b);
      });
      const m = MODELS.find(x => x.id === T.model) || MODELS[0];
      $("ttStats").textContent = `Speed ${"●".repeat(m.speed)}${"○".repeat(5 - m.speed)}   Turning ${"●".repeat(m.turn)}${"○".repeat(5 - m.turn)}`;
      const colours = $("ttColours"); colours.innerHTML = "";
      COLOURS.forEach(c => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tt-swatch tt-" + c.id;
        b.style.background = c.id === "rainbow" ? "" : c.id === "gold" ? "" : c.hex;
        b.setAttribute("aria-label", c.id);
        b.setAttribute("aria-pressed", String(c.id === T.colour));
        b.addEventListener("click", () => { T.colour = c.id; Hub.saveStore(); renderGarage(); });
        colours.appendChild(b);
      });
      const robots = $("ttRobots"); robots.innerHTML = "";
      ROBOTS.forEach(r => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = r.label;
        b.setAttribute("aria-pressed", String(r.id === T.robots));
        b.addEventListener("click", () => { T.robots = r.id; Hub.saveStore(); renderGarage(); });
        robots.appendChild(b);
      });
      drawPreview();
    }

    /* ---------------- the race ---------------- */
    let clock = 0;
    let open = false, state = "garage"; // garage · countdown · racing · done
    let last = 0, raceT = 0, countT = 0, cars = [], me = null, sparks = [], msg = null;
    const keys = { left: false, right: false, gas: false, brake: false };
    const fx = Fun.pops();
    let bonkT = 0, scrapeT = 0, lastPos = null, lastLit = 0;
    const popMid = (text, colour, size, y) => fx.pop(text, W / 2, y || H * 0.62, colour, size || 38);

    function makeCar(opts, row, lane){
      const prog = -50 - row * 70;
      const p = C.at(prog, lane);
      return Object.assign({
        prog, i: wrap(Math.floor(prog / DS)), x: p.x, y: p.y, angle: p.angle, v: 0, lat: lane, z: 0,
        boostT: 0, rail: null, finishT: null, lapStart: 0, lapsDone: 0, bestLap: Infinity
      }, opts);
    }

    // a random track, but not the one you just raced
    let lastRaced = null;
    function newRace(preview){
      const choices = COURSES.filter(k => k.C.layout.id !== lastRaced);
      useCourse(choices[Math.floor(Math.random() * choices.length)]);
      if (preview !== true) lastRaced = C.layout.id;
      const skill = (ROBOTS.find(r => r.id === T.robots) || ROBOTS[0]).skill;
      const m = MODELS.find(x => x.id === T.model) || MODELS[0];
      const others = COLOURS.filter(c => c.id !== T.colour && c.id !== "rainbow" && c.id !== "gold");
      const pickColour = () => others.splice(Math.floor(Math.random() * others.length), 1)[0].id;
      const botModels = MODELS.map(x => x.id).sort(() => Math.random() - 0.5);
      me = makeCar({ name: "You", me: true, model: m.id, colour: T.colour,
        maxV: 470 + m.speed * 16, turnRate: 2.4 + m.turn * 0.22 }, 1, -36);
      cars = [
        makeCar({ name: "Robo Max", model: botModels[0], colour: pickColour(), skill, phase: 0 }, 0, -36),
        makeCar({ name: "Robo Zip", model: botModels[1], colour: pickColour(), skill: skill * 0.97, phase: 2 }, 0, 36),
        makeCar({ name: "Robo Bolt", model: botModels[2], colour: pickColour(), skill: skill * 0.94, phase: 4 }, 1, 36),
        me
      ];
      cars.forEach(c => { if (!c.me) { c.robot = true; c.lane = c.lat; c.maxV = 540 * c.skill; } });
      sparks = []; msg = null; raceT = 0; countT = 3.2; lastLit = 0; lastPos = null; camA = null; fx.clear();
      say(`${C.layout.emoji} ${C.layout.name}`, 3.2);
      state = "countdown";
      panel.hidden = true;
      canvas.focus();
    }

    function say(text, secs){ msg = { text, t: secs || 1.6 }; }

    // a car riding the loop or the jump by itself
    function rideRail(c, dt){
      c.prog += c.v * dt;
      const rel = c.prog - c.rail.from;
      if (c.rail.zone.kind === "loop") c.lat *= Math.pow(0.02, dt);
      if (rel >= c.rail.len) {
        c.rail = null;
        if (c.me) { say(c.lastZone === "loop" ? "🌀 LOOP!" : "🚀 Nice jump!", 1.1); popMid(c.lastZone === "loop" ? "WHEEE!" : "AIR TIME!", "#7fe3ff"); Fun.sfx.boing(); }
      }
      const p = C.at(c.prog, c.lat);
      c.x = p.x; c.y = p.y; c.angle = p.angle; c.z = c.rail ? p.z : 0;
      c.i = p.i;
    }

    function startRail(c, zone){
      const from = zone.start * DS + Math.floor(c.prog / L) * L;
      c.rail = { zone, from, len: (zone.end - zone.start + 1) * DS };
      c.prog = from;
      c.lastZone = zone.kind;
    }

    function driveMe(dt){
      Fun.stickKeys(stick, keys, { left: "left", right: "right", up: "gas", down: "brake" });
      const c = me;
      if (c.rail) { rideRail(c, dt); return; }
      const top = c.boostT > 0 ? c.maxV * 1.45 : c.maxV;
      if (keys.gas) c.v = Math.min(top, c.v + (c.v < top ? 430 : -300) * dt);
      else if (keys.brake) c.v = c.v > 0 ? Math.max(0, c.v - 800 * dt) : Math.max(-160, c.v - 260 * dt);
      else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 170 * dt);
      if (c.v > top) c.v = Math.max(top, c.v - 300 * dt); // boost wearing off
      const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      c.angle += steer * c.turnRate * Math.min(1, Math.abs(c.v) / 180) * Math.sign(c.v) * dt;
      c.x += Math.cos(c.angle) * c.v * dt;
      c.y += Math.sin(c.angle) * c.v * dt;

      // which bit of track are we on? look near where we were
      let best = c.i, bestD = Infinity;
      for (let k = -25; k <= 40; k++) {
        const j = wrap(c.i + k), s = samples[j];
        const d = (s.x - c.x) ** 2 + (s.y - c.y) ** 2;
        if (d < bestD) { bestD = d; best = j; }
      }
      let step = best - c.i;
      if (step > N / 2) step -= N; else if (step < -N / 2) step += N;
      c.prog += step * DS;
      c.i = best;
      const s = samples[best];

      // the orange walls: scrape along them and slow down
      const lat = (c.x - s.x) * s.nx + (c.y - s.y) * s.ny, room = HALF - 13;
      if (Math.abs(lat) > room) {
        const push = lat - Math.sign(lat) * room;
        c.x -= s.nx * push; c.y -= s.ny * push;
        c.v *= Math.pow(0.25, dt);
        let da = s.angle - c.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < Math.PI / 2) c.angle += da * Math.min(1, 6 * dt);
        if (Math.abs(c.v) > 220 && scrapeT <= 0) { scrapeT = 3; popMid("Scrrrch!", "#ffb15c", 28, H * 0.7); }
        if (Math.abs(c.v) > 120 && Math.random() < 0.6) sparks.push({ x: c.x - s.nx * Math.sign(lat) * 10, y: c.y - s.ny * Math.sign(lat) * 10, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0.35 });
      }
      c.lat = (c.x - s.x) * s.nx + (c.y - s.y) * s.ny;

      if (s.boost && c.v > 0) { if (c.boostT <= 0) { say("⚡ BOOST!", 0.8); popMid("ZOOM!", "#ffe14d", 44); Fun.sfx.zap(); } c.boostT = 1.4; }

      // the jump and the loop: fast enough and you ride it, too slow and you go back for another try
      const zone = s.zone;
      if (zone) {
        const into = wrap(best - zone.start);
        if (into < 8 && c.v > 0) {
          if (c.v >= zone.min) startRail(c, zone);
          else {
            say(zone.kind === "loop" ? "😬 Too slow for the loop! Hit the ⚡ booster first." : "😬 Too slow to jump! Hit the ⚡ booster first.", 2.2);
            backTo(c, zone.start - 60);
            Fun.sfx.nope(); popMid("Oopsie!", "#ff8a8a", 34);
          }
        } else if (into >= 8 && into < zone.end - zone.start - 6) {
          backTo(c, zone.start - 60); // drove in backwards
        }
      }
    }

    function backTo(c, index){
      const lapBase = Math.floor(c.prog / L) * L;
      c.prog = lapBase + index * DS;
      const p = C.at(c.prog, 0);
      c.x = p.x; c.y = p.y; c.angle = p.angle; c.i = p.i; c.v = 0; c.lat = 0;
    }

    function driveRobot(c, dt){
      const s = samples[wrap(Math.floor(c.prog / DS))];
      if (s.boost) c.boostT = 1.4;
      let target = Math.min(s.safe * c.skill, c.boostT > 0 ? c.maxV * 1.35 : c.maxV);
      // stay in the race: a little slower when far ahead of you, a little faster when far behind
      const gap = c.prog - me.prog;
      if (gap > 700) target *= 0.93; else if (gap < -900) target *= 1.06;
      c.v = c.v < target ? Math.min(target, c.v + 400 * dt) : Math.max(target, c.v - 900 * dt);
      if (c.rail) { rideRail(c, dt); return; }
      if (s.zone && wrap(Math.floor(c.prog / DS) - s.zone.start) < 8) { startRail(c, s.zone); rideRail(c, dt); return; }
      c.prog += c.v * dt;
      c.lat += ((c.lane + 16 * Math.sin(raceT * 0.6 + c.phase)) - c.lat) * Math.min(1, 2 * dt);
      const p = C.at(c.prog, c.lat);
      c.x = p.x; c.y = p.y; c.angle = p.angle; c.i = p.i; c.z = 0;
    }

    function bumpCars(){
      cars.forEach(a => cars.forEach(b => {
        if (a === b || !a.me || Math.abs(a.z - b.z) > 0.2 || a.rail || b.rail) return;
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < 30) {
          a.x += dx / d * (30 - d); a.y += dy / d * (30 - d);
          a.v *= 0.92; b.v *= 0.95;
          if (bonkT <= 0) { bonkT = 1.2; popMid(["BONK!", "BUMP!", "Oi!"][Math.floor(Math.random() * 3)], "#ff9f43", 34); Fun.sfx.bonk(); }
        }
      }));
    }

    function lapsAndFinish(c){
      const done = Math.floor(c.prog / L);
      if (done > c.lapsDone && c.finishT === null) {
        const lapTime = raceT - c.lapStart;
        c.lapStart = raceT;
        c.lapsDone = done;
        c.bestLap = Math.min(c.bestLap, lapTime);
        if (done >= LAPS) c.finishT = raceT;
        else if (c.me) say(done === LAPS - 1 ? "🔔 Final lap!" : `Lap ${done + 1}! (${fmtTime(lapTime)})`, 1.4);
      }
    }

    function standings(){
      return cars.slice().sort((a, b) => {
        if (a.finishT !== null || b.finishT !== null) return (a.finishT ?? Infinity) - (b.finishT ?? Infinity);
        return b.prog - a.prog;
      });
    }
    const ordinal = n => n + (["st", "nd", "rd"][n - 1] || "th");

    function step(dt){
      if (state === "countdown") {
        countT -= dt;
        const lit = Math.min(3, Math.floor(3.2 - countT) + 1);
        if (lit !== lastLit) { lastLit = lit; Fun.sfx.beep(); }
        if (countT <= 0) { state = "racing"; say("GO GO GO! 🏁", 1); Fun.sfx.honk(); lastPos = null; }
        return;
      }
      if (state !== "racing" && state !== "done") return;
      if (state === "racing") raceT += dt;
      cars.forEach(c => {
        c.boostT -= dt;
        if (c.me && state === "racing") driveMe(dt);
        else if (c.robot) driveRobot(c, dt);
        else if (c.me) { c.v *= Math.pow(0.3, dt); c.x += Math.cos(c.angle) * c.v * dt; c.y += Math.sin(c.angle) * c.v * dt; }
        lapsAndFinish(c);
      });
      bumpCars();
      bonkT -= dt; scrapeT -= dt;
      if (state === "racing" && me) {
        const pos = standings().indexOf(me);
        if (lastPos !== null && pos < lastPos) { popMid(pos === 0 ? "1st PLACE! 🥇" : "PASSED! 😎", "#7bd68a", 36, H * 0.5); Fun.sfx.coin(); }
        else if (lastPos !== null && pos > lastPos) { popMid("Beep beep! 🤖", "#ffffff", 28, H * 0.5); Fun.sfx.honk(); }
        lastPos = pos;
      }
      sparks.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; });
      sparks = sparks.filter(p => p.t > 0);
      if (msg && (msg.t -= dt) <= 0) msg = null;
      if (state === "racing" && me.finishT !== null) finish();
    }

    function finish(){
      state = "done";
      const order = standings();
      // robots still racing: guess when they'd finish
      order.forEach(c => { if (c.finishT === null) c.guessT = raceT + (LAPS * L - c.prog) / Math.max(200, c.v || 200); });
      order.sort((a, b) => (a.finishT ?? a.guessT) - (b.finishT ?? b.guessT));
      const place = order.indexOf(me) + 1;
      const won = place === 1;
      if (won) { Fun.sfx.tada(); popMid("WINNER! 🏆", "#ffe14d", 50, H * 0.45); } else Fun.sfx.ding();
      const id = C.layout.id;
      const newBest = !T.bestTimes[id] || me.finishT < T.bestTimes[id];
      if (won) { T.wins = (T.wins || 0) + 1; if (T.robots === "hard") T.hardWins = (T.hardWins || 0) + 1; }
      if (newBest) T.bestTimes[id] = me.finishT;
      if (me.bestLap < (T.bestLaps[id] || Infinity)) T.bestLaps[id] = me.bestLap;
      Hub.saveStore();
      Hub.checkBadges();

      panelTitle.textContent = won ? "🏆 You won!" : `🏁 You came ${ordinal(place)}!`;
      panelText.textContent = `${C.layout.emoji} ${C.layout.name} · your time ${fmtTime(me.finishT)} · best lap ${fmtTime(me.bestLap)}`
        + (newBest ? " · a new best on this track! 🎉" : ` · your best here is ${fmtTime(T.bestTimes[id])}`);
      results.innerHTML = "";
      order.forEach((c, k) => {
        const row = document.createElement("div");
        row.className = "tt-row" + (c.me ? " me" : "");
        row.textContent = `${["🥇", "🥈", "🥉", "4."][k]} ${c.name}  ${fmtTime(c.finishT ?? c.guessT)}`;
        results.appendChild(row);
      });
      results.hidden = false;
      garage.hidden = true;
      garageBtn.hidden = false;
      playBtn.textContent = "▶ Race again";
      panel.hidden = false;
      if (won) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }

    /* ---------------- drawing ---------------- */
    /* ---------------- the 3D chase camera ----------------
       The track is drawn from straight above into a hidden picture, turned so you always drive "up" it.
       Then that picture is laid down as a floor in perspective, one screen row at a time (the trick old
       racing games used), and the cars are stood up on it with a shadow and some thickness. */
    const K = 0.7;  // the hidden picture is drawn a bit smaller than the screen needs, which is plenty and much quicker
    const OW = 1200 * K, OH = 1200 * K, OCX = 600 * K, OCY = 960 * K, MZ = 0.62 * K;
    // chase: up behind your car; cockpit: down in the driver's seat, looking over the bonnet
    const FOC = 480;
    let HZ = 140, CAMH = 118 * K, BACK = 230 * K, wheelTurn = 0;
    const off = document.createElement("canvas"); off.width = OW; off.height = OH;
    const octx = off.getContext("2d");
    let camA = null, frameDt = 1 / 60;
    // puffy clouds far below the track, fixed in the world so they slide past
    const BELOW = Array.from({ length: 70 }, (_, i) => ({ x: ((i * 7919) % 97) / 97 * 6000 - 1500, y: ((i * 104729) % 89) / 89 * 6000 - 1500, r: 90 + (i * 37) % 120 }));
    function draw3D(){
      const focus = me || cars[0];
      if (!focus) return;
      const want = focus.angle, cockpit = T.view === "cockpit";
      if (cockpit) { HZ = 215; CAMH = (30 + focus.z * 80) * K; BACK = 4 * K; }
      else { HZ = 140; CAMH = 118 * K; BACK = 230 * K; }
      if (camA === null) camA = want;
      camA += Math.atan2(Math.sin(want - camA), Math.cos(want - camA)) * Math.min(1, frameDt * (cockpit ? 16 : 4.5));
      const th = -camA - Math.PI / 2, cs = Math.cos(th), sn = Math.sin(th);
      const fx0 = focus.x, fy0 = focus.y;

      // 1) the world from above, into the hidden picture
      const main = ctx;
      ctx = octx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#b8e2ff"; ctx.fillRect(0, 0, OW, OH);
      ctx.setTransform(MZ * cs, MZ * sn, -MZ * sn, MZ * cs, OCX, OCY);
      ctx.translate(-fx0, -fy0);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      BELOW.forEach(b => {
        const x = b.x + clock * 6, y = b.y;
        if (Math.abs(x - fx0) > 2600 || Math.abs(y - fy0) > 2600) return;
        ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.arc(x + b.r * 0.8, y + 20, b.r * 0.7, 0, 7); ctx.arc(x - b.r * 0.7, y + 25, b.r * 0.6, 0, 7); ctx.fill();
      });
      ctx.lineJoin = "round"; ctx.lineCap = "butt";
      ctx.save(); ctx.translate(34, 46); ctx.strokeStyle = "rgba(30,60,110,0.22)"; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(ROAD); ctx.restore();
      drawRoad(ROAD);
      ctx.strokeStyle = "rgba(255,225,170,0.6)"; ctx.lineWidth = 3; ctx.setLineDash([26, 22]); ctx.stroke(LINE); ctx.setLineDash([]);
      drawJoints(false);
      drawSpecials();
      ctx.save(); ctx.translate(16, 22); ctx.strokeStyle = "rgba(40,20,0,0.35)"; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(DECK); ctx.restore();
      drawRoad(DECK);
      drawJoints(true);
      sparks.forEach(p => { ctx.fillStyle = p.t > 0.2 ? "#fff3a0" : "#ff9f1c"; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); });
      ctx = main;

      // 2) the sky above the horizon, with clouds that slide as you turn
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, HZ + 40);
      sky.addColorStop(0, "#3f8fe8"); sky.addColorStop(1, "#cdeaff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HZ + 40);
      const sun = (((-camA * 300) % (W * 2)) + W * 2) % (W * 2) - W / 2;
      const sg = ctx.createRadialGradient(sun, 50, 4, sun, 50, 90);
      sg.addColorStop(0, "rgba(255,250,220,1)"); sg.addColorStop(0.2, "rgba(255,240,180,0.8)"); sg.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = sg; ctx.fillRect(sun - 90, 0, 180, 140);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let k = 0; k < 9; k++) {
        const x = ((((k * 260 - camA * 500) % (W + 300)) + W + 300) % (W + 300)) - 150, y = 40 + (k * 37) % 70, r = 22 + (k * 13) % 20;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y + 6, r * 0.8, 0, 7); ctx.arc(x - r, y + 8, r * 0.7, 0, 7); ctx.fill();
      }
      // a floating island or two on the horizon
      ctx.fillStyle = "#6fbf5a";
      [0.4, 2.3, 4.1].forEach((p, k) => {
        const x = ((((p * 400 - camA * 420) % (W + 400)) + W + 400) % (W + 400)) - 200, w = 70 + k * 20;
        ctx.fillStyle = "#8a6a4a"; ctx.beginPath(); ctx.moveTo(x - w / 2, HZ - 14); ctx.lineTo(x + w / 2, HZ - 14); ctx.lineTo(x, HZ + 14); ctx.fill();
        ctx.fillStyle = "#6fbf5a"; ctx.fillRect(x - w / 2, HZ - 20, w, 7);
      });

      // 3) the floor in perspective
      ctx.fillStyle = "#cdeaff"; ctx.fillRect(0, HZ, W, H - HZ);
      ctx.imageSmoothingEnabled = true;
      for (let y = HZ + 1; y < H; y++) {
        const z = CAMH * FOC / (y - HZ), z2 = CAMH * FOC / (y + 1 - HZ);
        const row = OCY + BACK - z;
        if (row < 0) continue;
        const half = (W / 2) * z / FOC;
        ctx.drawImage(off, OCX - half, row, half * 2, Math.max(1, z - z2), 0, y, W, 1);
      }
      const haze = ctx.createLinearGradient(0, HZ, 0, HZ + 90);
      haze.addColorStop(0, "rgba(205,234,255,1)"); haze.addColorStop(1, "rgba(205,234,255,0)");
      ctx.fillStyle = haze; ctx.fillRect(0, HZ, W, 90);

      // 4) the cars, stood up on the floor: far ones first
      const shown = [];
      cars.forEach(c => {
        const dx = c.x - fx0, dy = c.y - fy0;
        const ox = OCX + MZ * (dx * cs - dy * sn), oy = OCY + MZ * (dx * sn + dy * cs);
        const z = OCY + BACK - oy;
        if (z < 30) return;
        shown.push({ c, z, sx: W / 2 + (ox - OCX) * FOC / z, sy: HZ + CAMH * FOC / z, s: FOC / z * MZ });
      });
      shown.sort((a, b) => b.z - a.z).forEach(({ c, sx, sy, s }) => {
        const lift = c.z * 70 * s;
        ctx.fillStyle = `rgba(0,0,0,${0.32 - c.z * 0.15})`;
        ctx.beginPath(); ctx.ellipse(sx, sy + 4 * s, 26 * s, 13 * s * 0.6, 0, 0, 7); ctx.fill();
        if (cockpit) {
          // down in the driver's seat you see the other cars from behind, not from above
          ctx.save(); ctx.translate(sx, sy - lift); ctx.scale(s, s); drawCarBack(ctx, c); ctx.restore();
          if (s > 0.3) {
            const fs = Math.round(Math.min(18, Math.max(11, 12 * s)));
            ctx.font = `800 ${fs}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = "center";
            ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.fillStyle = "#fff";
            ctx.strokeText("🤖 " + c.name, sx, sy - lift - 40 * s); ctx.fillText("🤖 " + c.name, sx, sy - lift - 40 * s);
          }
          return;
        }
        // the car's sides: a dark copy of its shape a little lower, then the car on top
        const place = dy => { ctx.translate(sx, sy - lift + dy - 6 * s); ctx.scale(s, s * 0.5); ctx.rotate(c.angle + th); };
        ctx.save(); place(7 * s);
        ctx.fillStyle = "rgba(20,22,30,0.85)"; roundRect(ctx, -23, -12, 46, 24, 7); ctx.fill();
        ctx.restore();
        ctx.save(); place(0); drawCar(ctx, c.model, c.colour, c.boostT > 0); ctx.restore();
        // a little driver's head peeking out, and a name tag over the robots
        ctx.fillStyle = c.me ? "#ffd21f" : "#c8ccd4";
        ctx.beginPath(); ctx.arc(sx, sy - lift - 14 * s, 5 * s, 0, 7); ctx.fill();
        if (!c.me && s > 0.35) {
          ctx.font = `800 ${Math.round(Math.max(11, 16 * s))}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = "center";
          ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.fillStyle = "#fff";
          ctx.strokeText("🤖 " + c.name, sx, sy - lift - 26 * s); ctx.fillText("🤖 " + c.name, sx, sy - lift - 26 * s);
        }
      });
      // speed lines at the sides when you're flying along
      if (me && me.v > 420) {
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.6, (me.v - 420) / 300)})`; ctx.lineWidth = 3;
        for (let k = 0; k < 10; k++) {
          const side = k % 2 ? 1 : -1, y = HZ + 60 + ((k * 53 + clock * 900) % (H - HZ - 60));
          const x = W / 2 + side * (W * 0.42 + (y - HZ) * 0.15);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 40, y + 30); ctx.stroke();
        }
      }
    }

    // a car seen from behind, standing on the road at (0, 0); it's 46 wide like the cars from above
    function drawCarBack(ctx, c){
      ctx.fillStyle = "#111318";
      [-1, 1].forEach(side => { roundRect(ctx, side * 23 - (side > 0 ? 8 : 0), -11, 8, 11, 2); ctx.fill(); });
      const body = ctx.createLinearGradient(0, -24, 0, -4);
      body.addColorStop(0, c.colour); body.addColorStop(1, "#1a1a1a");
      ctx.fillStyle = body; roundRect(ctx, -21, -22, 42, 16, 4); ctx.fill();
      // the cabin, the back window and the driver's helmet
      ctx.fillStyle = c.colour;
      ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(-10, -33); ctx.lineTo(10, -33); ctx.lineTo(14, -22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#a9d4ff"; ctx.beginPath(); ctx.moveTo(-11, -23); ctx.lineTo(-8, -31); ctx.lineTo(8, -31); ctx.lineTo(11, -23); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#c8ccd4"; ctx.beginPath(); ctx.arc(0, -26, 4.5, Math.PI, 0); ctx.fill();
      // a spoiler and the red back lights
      ctx.fillStyle = "#222"; ctx.fillRect(-20, -27, 40, 3);
      ctx.fillStyle = "#ff3030"; ctx.fillRect(-19, -18, 7, 4); ctx.fillRect(12, -18, 7, 4);
      ctx.fillStyle = "#333"; ctx.fillRect(-6, -11, 12, 4);   // number plate
      if (c.boostT > 0) {
        const f = 6 + Math.random() * 6;
        ctx.fillStyle = "#ffb11f"; ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(0, -8 + f); ctx.fill();
      }
    }
    // inside the car: the bonnet, the dashboard with a real speed dial, and your hands on the wheel
    function drawCockpit(){
      if (!me) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const steer = state === "racing" ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
      wheelTurn += (steer * 0.9 - wheelTurn) * Math.min(1, frameDt * 9);
      const shake = Math.abs(me.v) > 300 ? (Math.random() - 0.5) * Math.min(3, (Math.abs(me.v) - 300) / 80) : 0;
      ctx.save(); if (!Hub.lessMotion()) ctx.translate(shake, shake * 0.5);
      // the bonnet in your car's colour, with a shine down the middle
      const hood = ctx.createLinearGradient(0, 380, 0, 470);
      hood.addColorStop(0, me.colour); hood.addColorStop(1, "#111");
      ctx.fillStyle = hood;
      ctx.beginPath(); ctx.moveTo(150, H); ctx.quadraticCurveTo(250, 392, W / 2, 386); ctx.quadraticCurveTo(W - 250, 392, W - 150, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath(); ctx.moveTo(W / 2 - 40, 392); ctx.quadraticCurveTo(W / 2, 388, W / 2 + 40, 392); ctx.lineTo(W / 2 + 70, 450); ctx.lineTo(W / 2 - 70, 450); ctx.closePath(); ctx.fill();
      // the window frame on both sides
      ctx.fillStyle = "#16181f";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(70, 0); ctx.lineTo(10, H); ctx.lineTo(0, H); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - 70, 0); ctx.lineTo(W - 10, H); ctx.lineTo(W, H); ctx.fill();
      ctx.fillRect(0, 0, W, 14);
      // the dashboard
      const dash = ctx.createLinearGradient(0, 440, 0, H);
      dash.addColorStop(0, "#2b2f3a"); dash.addColorStop(1, "#0c0d12");
      ctx.fillStyle = dash;
      ctx.beginPath(); ctx.moveTo(0, 470); ctx.quadraticCurveTo(W / 2, 425, W, 470); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // the speed dial
      const kmh = Math.abs(me.v) / 4, top = 200, dx = W / 2 + 230, dy = 500;
      ctx.fillStyle = "#07080c"; ctx.beginPath(); ctx.arc(dx, dy, 48, 0, 7); ctx.fill();
      ctx.strokeStyle = "#3a3f4d"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "#9aa3b2"; ctx.lineWidth = 2;
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * 0.75 + k / 10 * Math.PI * 1.5;
        ctx.beginPath(); ctx.moveTo(dx + Math.cos(a) * 38, dy + Math.sin(a) * 38); ctx.lineTo(dx + Math.cos(a) * 45, dy + Math.sin(a) * 45); ctx.stroke();
      }
      const na = Math.PI * 0.75 + Math.min(1, kmh / top) * Math.PI * 1.5;
      ctx.strokeStyle = me.boostT > 0 ? "#ffe14d" : "#ff4a3d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(na) * 40, dy + Math.sin(na) * 40); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "700 13px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(Math.round(kmh), dx, dy + 26);
      // a boost light
      ctx.fillStyle = me.boostT > 0 ? "#ffe14d" : "#3a3420";
      ctx.beginPath(); ctx.arc(W / 2 - 230, 492, 9, 0, 7); ctx.fill();
      ctx.fillStyle = "#9aa3b2"; ctx.font = "700 11px 'IBM Plex Mono', monospace"; ctx.fillText("BOOST", W / 2 - 230, 516);
      // the steering wheel, turning with your hands on it
      ctx.translate(W / 2, H + 30); ctx.rotate(wheelTurn);
      ctx.strokeStyle = "#1b1d24"; ctx.lineWidth = 24;
      ctx.beginPath(); ctx.arc(0, 0, 140, 0, 7); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 148, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.strokeStyle = "#23262f"; ctx.lineWidth = 18;   // the spokes and the middle
      ctx.beginPath(); ctx.moveTo(-135, 0); ctx.lineTo(135, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 135); ctx.stroke();
      ctx.fillStyle = "#2c2f3a"; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill();
      ctx.fillStyle = "#c62828"; ctx.fillRect(-6, -152, 12, 24);   // the mark at the top of the wheel
      [-1, 1].forEach(side => {
        const a = Math.PI * 1.5 + side * 0.75, hx = Math.cos(a) * 140, hy = Math.sin(a) * 140;
        ctx.fillStyle = "#2a2a30";   // racing gloves gripping the rim
        ctx.beginPath(); ctx.ellipse(hx, hy, 30, 24, a + Math.PI / 2, 0, 7); ctx.fill();
        ctx.fillStyle = "#454552";
        ctx.beginPath(); ctx.ellipse(hx - side * 4, hy - 8, 16, 9, a + Math.PI / 2, 0, 7); ctx.fill();
      });
      ctx.restore();
    }

    function draw(){
      if (T.view !== "top") { draw3D(); if (T.view === "cockpit") drawCockpit(); drawOverlay(); return; }
      const focus = me || cars[0];
      ZOOM = canvas.clientWidth && canvas.clientWidth < 600 ? 1.05 : 0.78; // closer up on small screens, so the cars aren't tiny
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      let camX = C.start[0], camY = C.start[1];
      if (focus) {
        camX = focus.x + Math.cos(focus.angle) * Math.min(160, Math.abs(focus.v) * 0.3);
        camY = focus.y + Math.sin(focus.angle) * Math.min(160, Math.abs(focus.v) * 0.3);
      }

      // the sky far below, then the track floating above it
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      TurboTrackSky.drawBelow(ctx, { x: camX, y: camY }, ZOOM, W, H, clock, C.layout.islands);
      ctx.setTransform(ZOOM, 0, 0, ZOOM, W / 2 - camX * ZOOM, H / 2 - camY * ZOOM);

      ctx.lineJoin = "round"; ctx.lineCap = "butt";
      ctx.save(); ctx.translate(34, 46); ctx.strokeStyle = "rgba(30,60,110,0.2)"; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(ROAD); ctx.restore();
      drawRoad(ROAD);
      ctx.strokeStyle = "rgba(255,225,170,0.6)"; ctx.lineWidth = 3; ctx.setLineDash([26, 22]); ctx.stroke(LINE); ctx.setLineDash([]);
      drawJoints(false);
      drawSpecials();
      // the loop's top crosses over the road, so it's drawn again on top
      ctx.save(); ctx.translate(16, 22); ctx.strokeStyle = "rgba(40,20,0,0.35)"; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(DECK); ctx.restore();
      drawRoad(DECK);
      drawJoints(true);

      // cars: low ones first, so cars up the loop or in the air go on top
      cars.slice().sort((a, b) => a.z - b.z).forEach(c => {
        const sc = 1 + c.z * 0.45;
        ctx.save();
        ctx.translate(c.x + 4 + c.z * 30, c.y + 6 + c.z * 36);
        ctx.rotate(c.angle);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath(); ctx.ellipse(0, 0, 24 * sc, 13 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.scale(sc, sc);
        drawCar(ctx, c.model, c.colour, c.boostT > 0);
        ctx.restore();
        if (c.me) {
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
          ctx.font = "800 22px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
          ctx.strokeText("YOU", c.x, c.y - 30 * sc); ctx.fillText("YOU", c.x, c.y - 30 * sc);
        }
      });
      sparks.forEach(p => { ctx.fillStyle = p.t > 0.2 ? "#fff3a0" : "#ff9f1c"; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); });
      drawBanner();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      TurboTrackSky.drawAbove(ctx, { x: camX, y: camY }, ZOOM, W, H, clock);
      drawOverlay();
    }
    // what goes on top in both views: the map, the lights, words and the speed
    function drawOverlay(){
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawMinimap();
      if (state === "countdown") drawLights();
      fx.draw(ctx, frameDt);
      if (msg) {
        ctx.font = "800 30px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.fillStyle = "#fff";
        ctx.strokeText(msg.text, W / 2, 70); ctx.fillText(msg.text, W / 2, 70);
      }
      if (me && state === "racing" && T.view !== "cockpit") {
        const kmh = Math.round(Math.abs(me.v) / 4);
        ctx.font = "800 26px 'IBM Plex Mono', monospace"; ctx.textAlign = "left";
        ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.fillStyle = me.boostT > 0 ? "#ffe14d" : "#fff";
        ctx.strokeText(kmh + " km/h", 16, H - 18); ctx.fillText(kmh + " km/h", 16, H - 18);
      }
    }

    // one stretch of track: dark outer edge, a light raised rail each side, speckled orange plastic, a soft shine
    function drawRoad(path){
      ctx.strokeStyle = "#a84200"; ctx.lineWidth = HALF * 2 + 12; ctx.stroke(path);
      ctx.strokeStyle = "#ffab55"; ctx.lineWidth = HALF * 2 + 4; ctx.stroke(path);
      ctx.strokeStyle = "#d85f00"; ctx.lineWidth = HALF * 2 - 2; ctx.stroke(path);
      ctx.strokeStyle = plasticPattern(ctx); ctx.lineWidth = HALF * 2 - 6; ctx.stroke(path);
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = HALF * 0.9; ctx.stroke(path);
    }

    // the blue clips joining the track pieces, and the thin seam between them
    function drawJoints(deck){
      JOINTS.forEach(i => {
        const s = samples[i];
        if (!!s.deck !== deck) return;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
        ctx.fillStyle = "rgba(120,40,0,0.35)"; ctx.fillRect(-1, -HALF + 2, 2, HALF * 2 - 4);
        [-1, 1].forEach(side => {
          ctx.fillStyle = "#2f5fd8"; ctx.fillRect(-9, side * (HALF + 2) - 5, 18, 10);
          ctx.fillStyle = "#6f9bff"; ctx.fillRect(-9, side * (HALF + 2) - 5, 18, 3);
        });
        ctx.restore();
      });
    }

    // the START banner over the line, held up by two posts
    function drawBanner(){
      const s = samples[0];
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(12, -HALF - 6, 20, HALF * 2 + 12); // its shadow on the track
      [-1, 1].forEach(side => {
        ctx.fillStyle = "#555b66"; ctx.beginPath(); ctx.arc(0, side * (HALF + 20), 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#9aa3b2"; ctx.beginPath(); ctx.arc(-3, side * (HALF + 20) - 3, 5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.translate(-4, -6);
      ctx.fillStyle = "#1c2230"; roundRect(ctx, -12, -HALF - 24, 24, HALF * 2 + 48, 5); ctx.fill();
      for (let k = 0; k < 2; k++) for (let r = 0; r < 22; r++) {
        ctx.fillStyle = (r + k) % 2 ? "#fff" : "#1c2230";
        ctx.fillRect(-10 + k * 16, -HALF - 22 + r * (HALF * 2 + 44) / 22, 4, (HALF * 2 + 44) / 22);
      }
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#ffe14d"; ctx.font = "800 15px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("★ START ★", 0, 1);
      ctx.restore();
    }

    // boosters, the ramp and landing, and the checkered start line
    function drawSpecials(){
      const glow = 0.65 + 0.35 * Math.sin(clock * 8);
      for (let i = 0; i < N; i++) {
        const s = samples[i];
        if (s.boost && i % 3 === 0) {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
          ctx.globalAlpha = glow;
          ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-20, -HALF + 4, 34, HALF * 2 - 8);
          ctx.globalAlpha = 1;
          ctx.fillStyle = (i / 3) % 2 ? "#ffe14d" : "#20d0e0";
          ctx.beginPath(); ctx.moveTo(-6, -50); ctx.lineTo(12, 0); ctx.lineTo(-6, 50); ctx.lineTo(-18, 50); ctx.lineTo(0, 0); ctx.lineTo(-18, -50); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        if ((s.kind === "ramp" || s.kind === "land") && i % 2 === 0) {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
          const z = s.kind === "ramp" ? C.heightAt(i) : 0;
          ctx.fillStyle = s.kind === "ramp" ? `rgb(${255},${150 + z * 300},${60 + z * 200})` : "#ff9a3c";
          ctx.fillRect(-6, -HALF, 13, HALF * 2);
          if (i % 6 === 0) { ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(-2, -HALF, 4, HALF * 2); }
          ctx.restore();
        }
        if (s.kind === "gap" && samples[wrap(i - 1)].kind !== "gap") {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 5;
          ctx.font = "800 26px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "left";
          ctx.strokeText("JUMP!", 20, -HALF - 18); ctx.fillText("JUMP!", 20, -HALF - 18);
          ctx.restore();
        }
      }
      const s = samples[0];
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      for (let r = 0; r < 12; r++) for (let k = 0; k < 2; k++) {
        ctx.fillStyle = (r + k) % 2 ? "#111" : "#fff";
        ctx.fillRect(k * 12 - 12, -HALF + r * HALF / 6, 12, HALF / 6);
      }
      ctx.restore();
    }

    // the whole track, small, in the corner, with a dot for every car
    const MINI = { w: 170, h: 115 };
    function drawMinimap(){
      const miniScale = Math.min(MINI.w / C.world.w, MINI.h / C.world.h);
      ctx.save();
      ctx.translate(W - MINI.w - 12 + (MINI.w - C.world.w * miniScale) / 2, 12 + (MINI.h - C.world.h * miniScale) / 2);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, -6, -6, C.world.w * miniScale + 12, C.world.h * miniScale + 12, 8); ctx.fill();
      ctx.scale(miniScale, miniScale);
      ctx.strokeStyle = "#ff7a00"; ctx.lineWidth = 2.2 / miniScale; ctx.stroke(ROAD);
      cars.forEach(c => {
        ctx.fillStyle = c.me ? "#fff" : paint(ctx, c.colour, 46);
        ctx.beginPath(); ctx.arc(c.x, c.y, (c.me ? 5 : 3.5) / miniScale, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    function drawLights(){
      const lit = Math.min(3, Math.floor(3.2 - countT) + 1);
      ctx.save();
      ctx.translate(W / 2, 120);
      ctx.fillStyle = "#222"; roundRect(ctx, -105, -38, 210, 76, 14); ctx.fill();
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k < lit ? (lit === 3 && countT < 0.4 ? "#4dd66b" : "#ff3b3b") : "#444";
        ctx.beginPath(); ctx.arc(-62 + k * 62, 0, 24, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function updateHud(){
      timeEl.textContent = "⏱ " + fmtTime(raceT);
      if (!me) return;
      lapEl.textContent = `Lap ${Math.min(LAPS, Math.max(1, me.lapsDone + 1))}/${LAPS}`;
      posEl.textContent = "🏁 " + ordinal(standings().indexOf(me) + 1);
    }

    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      clock = now / 1000;
      last = now; frameDt = dt;
      step(dt);
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function showGarage(){
      state = "garage";
      panelTitle.textContent = "🏎️ Turbo Track";
      panelText.textContent = `Pick your car and colour, then race the robots for ${LAPS} laps. 🎲 Every race is on a random track: there are ${COURSES.length} to discover!`;
      results.hidden = true;
      garage.hidden = false;
      garageBtn.hidden = true;
      playBtn.textContent = "▶ Race!";
      panel.hidden = false;
      renderGarage();
      playBtn.focus();
    }

    function openGame(){
      open = true;
      Fun.screen(overlay, true);
      if (!cars.length) newPreviewRace();
      showGarage();
      last = performance.now();
      requestAnimationFrame(loop);
    }
    // cars parked on the grid behind the garage panel
    function newPreviewRace(){
      newRace(true);
      msg = null;
      state = "garage";
      panel.hidden = false;
    }
    function closeGame(){
      open = false;
      Fun.screen(overlay, false);
      Fun.release(keys);
      if (state !== "garage") { newPreviewRace(); state = "garage"; }
    }

    /* ---------------- controls ---------------- */
    const stick = Fun.joystick(canvas.parentElement);   // on phones: steer, push up for gas, down to brake
    const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake", Space: "brake" };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const k = KEYMAP[e.code];
      if (!k || !panel.hidden) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    host.querySelectorAll(".game-touch [data-key]").forEach(btn => {
      const k = btn.dataset.key;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); keys[k] = true; });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => btn.addEventListener(ev, () => { keys[k] = false; }));
    });
    canvas.tabIndex = 0;

    $("ttCloseBtn").addEventListener("click", () => Hub.leave());
    // the camera: chasing behind your car in 3D, or looking straight down
    const viewBtn = document.createElement("button");
    viewBtn.type = "button"; viewBtn.className = "btn ghost small";
    // three cameras: in the driver's seat, chasing behind, or looking straight down
    const VIEWS = { cockpit: "🎥 Driver", "3d": "🎥 Chase", top: "🎥 Top" };
    const NEXT_VIEW = { cockpit: "3d", "3d": "top", top: "cockpit" };
    if (!VIEWS[T.view] || !T.seenCockpit) { T.view = "cockpit"; T.seenCockpit = true; }   // try the new driver's seat first
    const showView = () => { viewBtn.textContent = VIEWS[T.view]; viewBtn.title = "Switch the camera (C)"; };
    const switchView = () => { T.view = NEXT_VIEW[T.view] || "cockpit"; camA = null; Hub.saveStore(); showView(); canvas.focus(); };
    viewBtn.addEventListener("click", switchView);
    window.addEventListener("keydown", e => { if (open && e.code === "KeyC" && !e.repeat) switchView(); });
    showView();
    $("ttCloseBtn").before(viewBtn);
    Fun.soundButton($("ttCloseBtn"));
    playBtn.addEventListener("click", newRace);
    garageBtn.addEventListener("click", () => { newPreviewRace(); showGarage(); });

    return { open: openGame, close: closeGame };
  }
})();
