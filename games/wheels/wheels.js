/* Stunt Wheels: a side-on stunt racer on bright orange toy track, in the style of the old Hot Wheels games.
   Hold GAS to race, BRAKE to slow down or back up, and NITRO for a burst of flames. Boost pads fling you
   forward, loops need speed (too slow and you fall off the top), and over jumps you tilt the car with GAS
   (nose up) and BRAKE (nose down) to land on your wheels: flips earn coins and a perfect landing fills nitro.
   Crash and you go back to the last flag. Eight tracks with up to 3 stars each; stars unlock new cars.
   The fuel gauge drains as you drive: grab the red fuel tanks to fill it up (and for 100 points), or you
   roll to a stop and start again from the last flag. Points come from coins, fuel tanks, flips, perfect
   landings, big air and boost pads, plus a time bonus at the finish; the best score of every track is kept.
   The original hypnotic soundtrack is in music.js. */
(function(){
  "use strict";
  const store = Hub.store;
  const W8 = () => (store.wheels = store.wheels || { stars: {}, best: {}, car: "flame", music: true });

  /* ---------------- the cars ---------------- */
  const CARS = [
    { id: "flame",   name: "Flame Racer",  body: "#ff3b1f", trim: "#ffd400", stars: 0,  maxV: 1150, acc: 950,  style: "rod" },
    { id: "shark",   name: "Shark Bite",   body: "#2f7bff", trim: "#bfe3ff", stars: 3,  maxV: 1200, acc: 1000, style: "fin" },
    { id: "bones",   name: "Bone Rattler", body: "#f2f2f2", trim: "#1a1a24", stars: 6,  maxV: 1230, acc: 1050, style: "rod" },
    { id: "comet",   name: "Neon Comet",   body: "#24e07a", trim: "#ff4df0", stars: 9,  maxV: 1280, acc: 1100, style: "wedge" },
    { id: "rocket",  name: "Rocket Rod",   body: "#8b3dff", trim: "#ffe14d", stars: 13, maxV: 1320, acc: 1150, style: "fin" },
    { id: "monster", name: "Monster Mash", body: "#ff8a00", trim: "#1a1a24", stars: 17, maxV: 1250, acc: 1250, style: "truck" },
    { id: "gold",    name: "Gold Rush",    body: "#ffc400", trim: "#ff3b1f", stars: 21, maxV: 1400, acc: 1250, style: "wedge" }
  ];

  /* ---------------- the tracks, written as a list of pieces ---------------- */
  const THEMES = {
    room:    { sky: ["#6fc3ff", "#d8f0ff"], far: "#9fb7d9", near: "#7a95c2", floor: "#c98a5a", kind: "city" },
    desert:  { sky: ["#ffb35c", "#ffe7b0"], far: "#e09a5a", near: "#c47a3e", floor: "#d9a066", kind: "mesa" },
    night:   { sky: ["#0b1030", "#3a2a7a"], far: "#251a55", near: "#1a1240", floor: "#2a2240", kind: "city" },
    volcano: { sky: ["#3a0a0a", "#ff6a2a"], far: "#5a1a14", near: "#3a0f0c", floor: "#2a0d0a", kind: "peaks" },
    ice:     { sky: ["#9fd8ff", "#f2fbff"], far: "#cfe8ff", near: "#a8cce8", floor: "#e8f6ff", kind: "peaks" },
    space:   { sky: ["#05051a", "#1b1650"], far: "#2a2266", near: "#14103a", floor: "#191536", kind: "stars" }
  };
  const LEVELS = [
    { name: "First Lap", theme: "room", plan: [["flat", 500, "c"], ["slope", 400, 120], ["flat", 250], ["hill", 500, 110, "c"], ["flat", 250], ["check"], ["boost", 220], ["flat", 200], ["kick", 220, 70], ["gap", 320, 40], ["flat", 300, "c"], ["slope", 300, 80], ["flat", 200], ["finish"]] },
    { name: "Loop School", theme: "room", plan: [["flat", 300], ["boost", 300], ["flat", 150, "c"], ["loop", 140], ["flat", 350, "c"], ["check"], ["slope", 300, 120], ["boost", 260], ["flat", 120], ["loop", 160], ["flat", 300], ["hill", 400, 90, "c"], ["flat", 150], ["finish"]] },
    { name: "Big Air", theme: "desert", plan: [["flat", 250], ["boost", 260], ["kick", 260, 100], ["gap", 520, 80], ["flat", 250, "c"], ["check"], ["slope", 300, 160], ["boost", 220], ["kick", 240, 120], ["gap", 600, 60], ["flat", 300, "c"], ["check"], ["hill", 450, 130], ["boost", 200], ["kick", 200, 90], ["gap", 420, 120], ["flat", 250], ["finish"]] },
    { name: "Hill Climber", theme: "desert", plan: [["flat", 250], ["slope", 500, -180, "c"], ["flat", 200], ["slope", 400, 140], ["check"], ["hill", 500, 180, "c"], ["boost", 200], ["slope", 500, -220], ["flat", 150], ["check"], ["slope", 350, 200], ["boost", 240], ["loop", 150], ["flat", 250, "c"], ["hill", 400, 120], ["flat", 200], ["finish"]] },
    { name: "Double Loop", theme: "night", plan: [["flat", 250], ["boost", 320], ["loop", 150], ["flat", 60], ["boost", 120], ["loop", 150], ["flat", 300, "c"], ["check"], ["slope", 350, 150], ["boost", 260], ["kick", 220, 90], ["gap", 450, 40], ["flat", 200, "c"], ["boost", 200], ["loop", 180], ["flat", 250], ["finish"]] },
    { name: "Lava Canyon", theme: "volcano", plan: [["flat", 200], ["boost", 280], ["kick", 240, 110], ["gap", 560, 140], ["flat", 220, "c"], ["check"], ["boost", 220], ["kick", 220, 90], ["gap", 500, -40], ["flat", 220], ["slope", 400, 200, "c"], ["check"], ["boost", 260], ["loop", 170], ["flat", 150], ["kick", 220, 120], ["gap", 640, 100], ["flat", 250], ["finish"]] },
    { name: "Ice Run", theme: "ice", plan: [["flat", 200], ["slope", 600, 260, "c"], ["boost", 200], ["loop", 160], ["flat", 200], ["check"], ["hill", 500, 160, "c"], ["slope", 300, 120], ["boost", 260], ["kick", 260, 130], ["gap", 620, 60], ["flat", 250, "c"], ["check"], ["slope", 450, -200], ["flat", 150], ["slope", 400, 260], ["boost", 220], ["loop", 170], ["flat", 100], ["boost", 120], ["loop", 170], ["flat", 250], ["finish"]] },
    { name: "Mega Track", theme: "space", plan: [["flat", 200], ["boost", 300], ["loop", 160], ["flat", 150, "c"], ["kick", 240, 100], ["gap", 520, 40], ["flat", 200], ["check"], ["slope", 400, 180, "c"], ["boost", 240], ["loop", 180], ["flat", 80], ["boost", 120], ["loop", 180], ["flat", 250], ["check"], ["hill", 500, 170, "c"], ["boost", 260], ["kick", 260, 140], ["gap", 700, 120], ["flat", 250, "c"], ["check"], ["slope", 500, -220], ["slope", 450, 300], ["boost", 260], ["loop", 200], ["flat", 150], ["kick", 220, 100], ["gap", 480, 60], ["flat", 250], ["finish"]] }
  ];
  // four more worlds of eight tracks each, made from the same pieces and harder world by world:
  // bigger loops and gaps, steeper hills, more of everything. A seeded random number keeps every track the same each time.
  const WORLDS = [
    { name: "Starter Tracks", icon: "🏁" },
    { name: "Desert Dash", icon: "🌵", theme: "desert", words: ["Dune", "Cactus", "Mesa", "Sandstorm", "Canyon", "Mirage", "Scorpion", "Sunbaked"] },
    { name: "Neon Nights", icon: "🌃", theme: "night", words: ["Neon", "Skyline", "Midnight", "Laser", "Rooftop", "Glow", "Turbo", "Arcade"] },
    { name: "Volcano Valley", icon: "🌋", theme: "volcano", words: ["Magma", "Ember", "Lava", "Inferno", "Ash", "Cinder", "Blaze", "Eruption"] },
    { name: "Frozen Space", icon: "🚀", theme: ["ice", "space"], words: ["Glacier", "Comet", "Blizzard", "Orbit", "Avalanche", "Nebula", "Polar", "Galaxy"] }
  ];
  const ENDS = ["Run", "Rush", "Loop", "Leap", "Dash", "Drop", "Blast", "Madness"];
  function makeLevel(world, k){
    const w = WORLDS[world], n = (world - 1) * 8 + k, hard = Math.min(0.8, n / 38);   // 0 for the first new track, 1 for the last
    let seed = 1234 + n * 977; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const plan = [["flat", 250]], count = 6 + Math.round(hard * 5);
    for (let e = 0; e < count; e++) {
      const pick = rnd();
      if (pick < 0.22) plan.push(["hill", 300 + rnd() * 300, 60 + hard * 120, "c"], ["flat", 120]);
      else if (pick < 0.38) plan.push(["slope", 300 + rnd() * 200, 80 + hard * 160, "c"], ["flat", 120]);
      else if (pick < 0.5) plan.push(["boost", 200], ["slope", 380 + rnd() * 200, -(60 + hard * 130)], ["flat", 150, "c"]);
      else if (pick < 0.72) plan.push(["boost", 260], ["flat", 80], ["loop", 130 + hard * 70], ["flat", 220, "c"]);
      else if (pick < 0.9) plan.push(["boost", 240], ["kick", 220, 70 + hard * 70], ["gap", 300 + hard * 320 + rnd() * 80, Math.round(-30 + rnd() * 140)], ["flat", 260, "c"]);
      else if (hard > 0.35) plan.push(["boost", 280], ["loop", 150 + hard * 40], ["flat", 60], ["boost", 120], ["loop", 150 + hard * 40], ["flat", 220]);
      else plan.push(["hill", 400, 100, "c"], ["flat", 150]);
      if (e % 3 === 2) plan.push(["check"]);
    }
    plan.push(["flat", 200], ["finish"]);
    const theme = Array.isArray(w.theme) ? w.theme[k % 2] : w.theme;
    return { name: `${w.words[k]} ${ENDS[(k * 3 + world) % ENDS.length]}`, theme, plan, world };
  }
  LEVELS.forEach(L => { L.world = 0; });
  for (let world = 1; world < WORLDS.length; world++) for (let k = 0; k < 8; k++) LEVELS.push(makeLevel(world, k));
  const MAX_STARS = LEVELS.length * 3;

  Hub.register({
    id: "wheels", section: "games", title: "Stunt Wheels", icon: "🏎️",
    blurb: "Race hot rods on orange track: loops, jumps, flips and nitro, to a hypnotic soundtrack!",
    stat: () => { const n = totalStars(); return n ? `⭐ ${n} / ${MAX_STARS}` : ""; },
    badges: [
      { id: "wheels1",    icon: "🏁", name: "First Finish",  desc: "Finish a Stunt Wheels track",           test: () => totalStars() >= 1 },
      { id: "wheels3",    icon: "⭐", name: "Three Stars",   desc: "Get 3 stars on a Stunt Wheels track",   test: () => Object.values((store.wheels || {}).stars || {}).some(s => s >= 3) },
      { id: "wheelsflip", icon: "🔄", name: "Double Flip",   desc: "Do a double flip in one jump",          test: () => !!(store.wheels && store.wheels.doubleFlip) },
      { id: "wheelsall",  icon: "🏆", name: "Track Master",  desc: "Finish all eight Starter Tracks in Stunt Wheels", test: () => LEVELS.slice(0, 8).every((_, i) => ((store.wheels || {}).stars || {})[i] >= 1) },
      { id: "wheelslegend", icon: "👑", name: "Stunt Legend", desc: "Finish all 40 Stunt Wheels tracks",       test: () => LEVELS.every((_, i) => ((store.wheels || {}).stars || {})[i] >= 1) }
    ],
    mount
  });
  function totalStars(){ const s = (store.wheels || {}).stars || {}; return Object.values(s).reduce((a, b) => a + b, 0); }

  /* ---------------- building a track from its plan ---------------- */
  const G = 1500, CAR_H = 15, CAR_DRAW = 1.35;
  function buildTrack(L){
    const pieces = [], coins = [], checks = [], boosts = [], fuels = [];
    let lastFuel = 0;
    let cur = [[0, 0]], x = 0, y = 0, minY = 0, maxY = 0, finishX = 0;
    const P = (px, py) => { cur.push([px, py]); x = px; y = py; minY = Math.min(minY, py); maxY = Math.max(maxY, py); };
    const coinAt = (cx, cy) => coins.push({ x: cx, y: cy, got: false });
    const curve = (len, f, withCoins) => {
      const x0 = x, y0 = y, n = Math.max(2, Math.ceil(len / 18));
      for (let i = 1; i <= n; i++) {
        const t = i / n; P(x0 + len * t, y0 + f(t));
        if (withCoins && i % 5 === 0) coinAt(x, y - 46);
        if (x - lastFuel > 2400 && Math.abs(f(t) - f(Math.max(0, t - 1 / n))) < 6) { fuels.push({ x, y: y - 58, got: false }); lastFuel = x; }   // a fuel tank now and then, on a flattish bit
      }
    };
    // every track is its plan stretched out, twice over with a flag in between
    const stretch = st => st.map(([op, a, b, c]) => ["flat", "slope", "hill", "boost", "gap"].includes(op) ? [op, a * (op === "gap" ? 1 : 1.5), b, c] : [op, a, b, c]);
    const body = L.plan.filter(st => st[0] !== "finish");
    const plan = [...stretch(body), ["flat", 200], ["check"], ...stretch(body), ["finish"]];
    plan.forEach(([op, a, b, c]) => {
      if (op === "flat") curve(a, () => 0, b === "c");
      else if (op === "slope") curve(a, t => b * (1 - Math.cos(Math.PI * t)) / 2, c === "c");
      else if (op === "hill") curve(a, t => -b * (1 - Math.cos(Math.PI * 2 * t)) / 2, c === "c");
      else if (op === "kick") curve(a, t => -b * (1 - Math.cos(Math.PI / 2 * t)) * 1.0, false);
      else if (op === "boost") { const x0 = x; curve(a, () => 0, false); boosts.push({ piece: pieces.length, x0, x1: x }); }
      else if (op === "check") { checks.push({ piece: pieces.length, x: x }); fuels.push({ x: x + 90, y: y - 58, got: false }); lastFuel = x + 90; }
      else if (op === "loop") {
        const cx = x, cy = y - a, n = Math.ceil(a * Math.PI * 2 / 14);
        for (let i = 1; i <= n; i++) { const th = i / n * Math.PI * 2; P(cx + a * Math.sin(th), cy + a * Math.cos(th)); }
        for (let i = 0; i < 6; i++) coinAt(cx + a * Math.sin(i / 6 * Math.PI * 2 + 0.5), cy + (a - 40) * Math.cos(i / 6 * Math.PI * 2 + 0.5));
      }
      else if (op === "gap") {
        // the track stops at the lip of the ramp: a line of coins arcs over to where it starts again
        const x0 = x, y0 = y; pieces.push(cur);
        for (let i = 1; i < 6; i++) { const t = i / 6; coinAt(x0 + a * t, y0 + b * t - 60 - Math.sin(Math.PI * t) * (90 + a * 0.12)); }
        cur = [[x0 + a, y0 + b]]; x = x0 + a; y = y0 + b; maxY = Math.max(maxY, y);
      }
      else if (op === "finish") { finishX = x + 60; curve(600, () => 0, false); }
    });
    pieces.push(cur);
    // lengths, directions and how much the track bends at every point
    const out = pieces.map(pts => {
      const s = [0], tan = [], nrm = [];
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy) || 1e-6;
        s.push(s[i - 1] + l); tan.push([dx / l, dy / l]); nrm.push([dy / l, -dx / l]);
      }
      const kap = pts.map((_, i) => {
        if (i === 0 || i >= pts.length - 1) return 0;
        const a = tan[i - 1], b2 = tan[i], cross = a[0] * b2[1] - a[1] * b2[0], dot = a[0] * b2[0] + a[1] * b2[1];
        return -Math.atan2(cross, dot) / ((s[i + 1] - s[i - 1]) / 2);
      });
      const smooth = kap.map((_, i) => { let t = 0, n = 0; for (let j = i - 2; j <= i + 2; j++) if (kap[j] !== undefined) { t += kap[j]; n++; } return t / n; });
      return { pts, s, tan, nrm, kap: smooth, len: s[s.length - 1] };
    });
    return { pieces: out, coins, checks, boosts, fuels, minY, maxY, finishX, floor: maxY + 380, length: x };
  }
  // where you are at distance s along a piece: the point, its direction, its up side and its bend
  function at(pc, s){
    s = Math.max(0, Math.min(pc.len, s));
    let lo = 0, hi = pc.s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pc.s[m] <= s) lo = m; else hi = m; }
    const seg = Math.min(lo, pc.tan.length - 1), u = (s - pc.s[seg]) / ((pc.s[seg + 1] - pc.s[seg]) || 1);
    const a = pc.pts[seg], b = pc.pts[seg + 1];
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, t: pc.tan[seg], n: pc.nrm[seg], k: pc.kap[seg] + (pc.kap[seg + 1] - pc.kap[seg]) * u, seg };
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="swOverlay" hidden aria-label="Stunt Wheels">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏎️ Stunt Wheels</h2>
          <span class="mono game-stat" id="swTrack">Track 1</span>
          <span class="mono game-stat" id="swTime">⏱ 0.0</span>
          <button class="btn ghost small" id="swMusic" type="button" aria-label="Music on or off">🎵</button>
          <button class="btn ghost small" id="swCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="swCanvas" width="960" height="540"></canvas>
          <div class="sw-pedals">
            <button class="sw-pedal sw-brake" data-swkey="brake" type="button" aria-label="Brake, and nose down in the air">◀ BRAKE</button>
            <button class="sw-pedal sw-nitro" data-swkey="nitro" type="button" aria-label="Nitro">🔥 NITRO</button>
            <button class="sw-pedal sw-gas" data-swkey="gas" type="button" aria-label="Gas, and nose up in the air">GAS ▶</button>
          </div>
          <div class="game-panel sw-panel" id="swPanel">
            <div class="game-panel-title" id="swPanelTitle">Stunt Wheels</div>
            <div class="game-panel-text" id="swPanelText"></div>
            <button class="btn" id="swPlayBtn" type="button">▶ Race</button>
            <div class="sw-pick"><span>World</span><div class="sw-worlds" id="swWorlds"></div><div class="sw-levels" id="swLevels"></div></div>
            <div class="sw-pick"><span>Car</span><div class="sw-cars" id="swCars"></div></div>
          </div>
        </div>
        <div class="game-help">→ or D: gas (nose up in the air) · ← or A: brake / back up (nose down in the air) · Space: nitro · R: back to the last flag · land on your wheels!</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("swOverlay"), canvas = $("swCanvas"), ctx = canvas.getContext("2d");
    const panel = $("swPanel"), panelTitle = $("swPanelTitle"), panelText = $("swPanelText"), playBtn = $("swPlayBtn");
    const fx = Fun.pops(), music = WheelsMusic();
    const W = 960, H = 540;

    let open = false, running = false, last = 0, clock = 0, scale = 1;
    let lvl = 0, T = null, car = null, cam = { x: 0, y: 0, z: 1 }, time = 0, coins = 0, nitro = 0.5, state = "ready", crashT = 0;
    let lastCheck = null, flipAcc = 0, bits = [], score = 0, fuel = 1, outT = 0, shake = 0, bounce = 0, dust = [];
    const keys = { gas: false, brake: false, nitro: false };
    let carDef = CARS[0];

    /* ---------------- the car ---------------- */
    function spawn(check){
      const pc = check ? check.piece : 0, pcs = T.pieces[pc];
      let s = 40;
      if (check) { // the distance along the piece where the flag stands
        let best = 0, bd = 1e9; pcs.pts.forEach((p, i) => { const d = Math.abs(p[0] - check.x); if (d < bd) { bd = d; best = i; } });
        s = pcs.s[best];
      }
      const a = at(pcs, s);
      car = { on: true, piece: pc, s, v: check ? 380 : 0, x: a.x + a.n[0] * CAR_H, y: a.y + a.n[1] * CAR_H, vx: 0, vy: 0, ang: Math.atan2(a.t[1], a.t[0]), spin: 0, wheel: 0, air: 0, flips: 0 };
      flipAcc = 0;
    }
    function startLevel(i){
      lvl = i; T = buildTrack(LEVELS[i]); time = 0; coins = 0; nitro = 0.5; lastCheck = null; bits = []; score = 0; fuel = 1; outT = 0; shake = 0; bounce = 0; dust = [];
      carDef = CARS.find(c => c.id === W8().car && totalStars() >= c.stars) || CARS[0];
      spawn(null); state = "count"; crashT = 0; clock = 0;
      cam.x = car.x; cam.y = car.y; fx.clear();
    }

    // points, with a little pop-up under the score
    function points(n, label, colour){
      score += n;
      if (label) fx.pop(`+${n} ${label}`, 150, 92, colour || "#ffffff", 22);
    }
    function crash(){
      if (state !== "race") return;
      state = "crash"; crashT = 0;
      Fun.sfx.crash(); fx.pop("CRASH!", W / 2, H * 0.35, "#ff6b6b", 48);
      for (let i = 0; i < 24; i++) bits.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 600, vy: -Math.random() * 600, t: 0, col: i % 3 ? carDef.body : "#333" });
    }
    function land(pcIndex, s, seg){
      const pc = T.pieces[pcIndex], a = at(pc, s);
      const trackAng = Math.atan2(a.t[1], a.t[0]);
      const diff = Math.atan2(Math.sin(car.ang - trackAng), Math.cos(car.ang - trackAng));
      const slack = carDef.style === "truck" ? 1.05 : 0.9;
      if (Math.abs(diff) > slack) { crash(); return; }
      car.on = true; car.piece = pcIndex; car.s = s; car.v = car.vx * a.t[0] + car.vy * a.t[1];
      const flips = Math.floor(Math.abs(flipAcc) / (Math.PI * 2) + 0.15);
      if (flips >= 1) {
        const word = flips >= 3 ? "TRIPLE FLIP!" : flips === 2 ? "DOUBLE FLIP!" : "FLIP!";
        fx.pop(word, W / 2, H * 0.3, "#ffe14d", 44); points(250 * flips * flips, flips >= 2 ? "COMBO" : "FLIP", "#ffe14d"); nitro = Math.min(1, nitro + 0.25 * flips); Fun.sfx.tada();
        if (flips >= 2) { W8().doubleFlip = true; Hub.saveStore(); Hub.checkBadges(); }
      }
      if (car.air > 1) points(Math.round(car.air * 6) * 10, "BIG AIR", "#4df2ff");
      if (Math.abs(diff) < 0.22 && car.air > 0.5) { fx.pop("PERFECT LANDING!", W / 2, H * 0.4, "#7dff9a", 32); points(150); nitro = Math.min(1, nitro + 0.2); Fun.sfx.ding(); }
      if (car.air > 0.3) {   // a thump: the car squashes on its springs, the screen shakes and dust flies
        shake = Math.min(12, car.air * 9); bounce = 1;
        for (let i = 0; i < 10; i++) dust.push({ x: car.x + (Math.random() - 0.5) * 60, y: car.y + 10, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 160, t: 0 });
      }
      else if (car.air > 0.35) Fun.sfx.thunk();
      car.air = 0; flipAcc = 0;
    }
    function step(h){
      const d = carDef;
      if (car.on) {
        const pc = T.pieces[car.piece], a = at(pc, car.s);
        let acc = 0;
        if (keys.gas && fuel > 0) acc += d.acc * Math.max(0, 1 - car.v / d.maxV);
        if (keys.brake) acc -= car.v > 30 ? 1700 : 600 * (1 + car.v / 300);
        if (keys.nitro && nitro > 0 && fuel > 0) { acc += 1500 * Math.max(0, 1 - car.v / (d.maxV * 1.35)); nitro = Math.max(0, nitro - h * 0.35); }
        const boost = T.boosts.find(b => b.piece === car.piece && a.x >= b.x0 && a.x <= b.x1 && a.t[0] > 0.7);
        if (boost) { acc += 2600 * Math.max(0, 1 - car.v / 1750); if (!car.boosted) { car.boosted = true; Fun.sfx.zap(); fx.pop("BOOST!", W * 0.65, H * 0.3, "#4df2ff", 30); points(25); } } else car.boosted = false;
        car.v += (acc + G * a.t[1] - car.v * 0.06) * h;
        car.v = Math.max(-420, car.v);
        // does the track push hard enough to hold the car, or does it fly off?
        const need = car.v * car.v * a.k - G * a.n[1];
        car.s += car.v * h;
        const b = at(pc, car.s);
        car.ang = Math.atan2(b.t[1], b.t[0]);
        car.x = b.x + b.n[0] * CAR_H; car.y = b.y + b.n[1] * CAR_H;
        car.wheel += car.v * h / 14;
        const offEnd = car.s >= pc.len && car.piece < T.pieces.length - 1;
        if (need < -40 || offEnd || (car.s <= 0 && car.v < 0 && car.piece > 0)) {
          car.on = false; car.vx = car.v * b.t[0]; car.vy = car.v * b.t[1]; car.spin = 0; car.air = 0; flipAcc = 0;
        }
        if (car.s <= 0 && car.v < 0) { car.s = 0; car.v = 0; }
      } else {
        car.vy += G * h; car.x += car.vx * h; car.y += car.vy * h; car.air += h;
        const tilt = 7.5;
        if (keys.gas) car.spin -= tilt * h; if (keys.brake) car.spin += tilt * h;
        car.spin *= Math.pow(0.35, h);
        car.ang += car.spin * h * 1.0 + (keys.gas ? -2.6 : keys.brake ? 2.6 : 0) * h;
        flipAcc += (car.spin * h * 1.0 + (keys.gas ? -2.6 : keys.brake ? 2.6 : 0) * h);
        car.wheel += (keys.gas ? 30 : 6) * h;
        // touching down: the car crosses a piece of track from above
        for (let pi = 0; pi < T.pieces.length; pi++) {
          const pc = T.pieces[pi];
          for (let i = 0; i < pc.tan.length; i++) {
            const p0 = pc.pts[i], p1 = pc.pts[i + 1];
            if (car.x < Math.min(p0[0], p1[0]) - 20 || car.x > Math.max(p0[0], p1[0]) + 20) continue;
            const n = pc.nrm[i], t = pc.tan[i];
            const dist = (car.x - p0[0]) * n[0] + (car.y - p0[1]) * n[1];
            const along = (car.x - p0[0]) * t[0] + (car.y - p0[1]) * t[1], segLen = pc.s[i + 1] - pc.s[i];
            if (along < -2 || along > segLen + 2) continue;
            const into = car.vx * n[0] + car.vy * n[1];
            if (dist < CAR_H && dist > -18 && into < 0) { land(pi, pc.s[i] + Math.max(0, Math.min(segLen, along)), i); return; }
          }
        }
        if (car.y > T.floor) crash();
      }
      // coins
      T.coins.forEach(c => { if (!c.got && Math.hypot(c.x - car.x, c.y - car.y) < 38) { c.got = true; coins++; points(10); Fun.sfx.coin(); } });
      T.fuels.forEach(f => { if (!f.got && Math.hypot(f.x - car.x, f.y - car.y) < 48) { f.got = true; fuel = Math.min(1, fuel + 0.4); points(100, "FUEL", "#ff6b4a"); Fun.sfx.ding(); } });
      fuel = Math.max(0, fuel - h * (keys.gas || keys.nitro ? 0.1 : 0.04));
      // flags
      T.checks.forEach(c => { if (c !== lastCheck && car.on && car.piece === c.piece && car.x > c.x && (!lastCheck || c.x > lastCheck.x || c.piece > lastCheck.piece)) { lastCheck = c; Fun.sfx.ding(); fx.pop("CHECKPOINT", W / 2, 90, "#ffffff", 26); } });
      // the finish line
      if (car.on && car.piece === T.pieces.length - 1 && car.x > T.finishX) finish();
    }
    function finish(){
      state = "done";
      const S = W8(), L = T.length, t3 = L / 900, t2 = L / 650;
      const stars = time <= t3 ? 3 : time <= t2 ? 2 : 1;
      const was = S.stars[lvl] || 0, best = S.best[lvl];
      const bonus = Math.max(0, Math.round((t2 - time) * 10) * 10);
      score += bonus;
      S.score = S.score || {};
      const topScore = !S.score[lvl] || score > S.score[lvl];
      if (topScore) S.score[lvl] = score;
      S.stars[lvl] = Math.max(was, stars);
      if (!best || time < best) S.best[lvl] = Math.round(time * 10) / 10;
      store.wheelsFinishes = (store.wheelsFinishes || 0) + 1;
      Hub.saveStore(); Hub.checkBadges();
      Fun.sfx.tada(); Hub.confettiBurst(canvas);
      const unlocked = CARS.filter(c => c.stars > totalStars() - (S.stars[lvl] - was) && c.stars <= totalStars());
      panelTitle.textContent = `🏁 ${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}`;
      panelText.textContent = `${LEVELS[lvl].name} in ${time.toFixed(1)} s. Score ${score.toLocaleString("en")} (time bonus ${bonus})${topScore ? ": new best! 🏆" : `, best ${S.score[lvl].toLocaleString("en")}`}.` + (stars < 3 ? ` 3 stars: under ${t3.toFixed(1)} s.` : " Perfect run!") + (unlocked.length ? ` New car: ${unlocked.map(c => c.name).join(", ")}! 🎉` : "");
      setTimeout(() => showPanel(lvl < LEVELS.length - 1 && S.stars[lvl] ? "▶ Next track" : "▶ Race again", lvl < LEVELS.length - 1 ? lvl + 1 : lvl), 1300);
    }

    /* ---------------- drawing ---------------- */
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 2); }
    const sx = x => (x - cam.x) * cam.z + W * 0.38, sy = y => (y - cam.y) * cam.z + H * 0.55;
    function drawBackground(){
      const th = THEMES[LEVELS[lvl].theme];
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (th.kind === "stars" || LEVELS[lvl].theme === "night") { ctx.fillStyle = "#fff"; for (let i = 0; i < 90; i++) { const x = ((i * 137 - cam.x * 0.05) % W + W) % W, y = (i * 59) % (H * 0.7); ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(clock + i)); ctx.fillRect(x, y, 2, 2); } ctx.globalAlpha = 1; }
      // two layers of scenery that slide slower than the track (parallax)
      [[0.15, th.far, 0.62, 1], [0.3, th.near, 0.72, 1.6]].forEach(([par, col, base, size]) => {
        ctx.fillStyle = col;
        const off = -cam.x * par;
        for (let i = -1; i < 14; i++) {
          const w = 110 * size, x = ((i * w + off) % (W + w * 2) + W + w * 2) % (W + w * 2) - w, hgt = (60 + ((i * 37) % 70)) * size, by = H * base - (cam.y - (T ? T.maxY : 0)) * par * 0.3;
          ctx.beginPath();
          if (th.kind === "city") { ctx.rect(x, by - hgt, w * 0.8, hgt + H); }
          else if (th.kind === "mesa") { ctx.moveTo(x, by + H); ctx.lineTo(x + w * 0.1, by - hgt); ctx.lineTo(x + w * 0.7, by - hgt); ctx.lineTo(x + w * 0.8, by + H); }
          else { ctx.moveTo(x - w * 0.3, by + H); ctx.lineTo(x + w * 0.4, by - hgt * 1.3); ctx.lineTo(x + w * 1.1, by + H); }
          ctx.fill();
        }
      });
      if (LEVELS[lvl].theme === "volcano") { ctx.fillStyle = "rgba(255,120,40,0.18)"; ctx.fillRect(0, H * 0.6, W, H); }
      // the floor the track stands on
      const fy = sy(T.floor);
      if (fy < H) { ctx.fillStyle = th.floor; ctx.fillRect(0, fy, W, H - fy); ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, fy, W, 6); }
    }
    function drawTrack(){
      const fy = sy(T.floor);
      // stands holding the track up
      ctx.strokeStyle = "#8a93a8"; ctx.lineWidth = 6 * cam.z;
      T.pieces.forEach(pc => pc.pts.forEach((p, i) => { if (i % 12 === 0 && pc.nrm[Math.min(i, pc.nrm.length - 1)][1] < -0.6) { const x = sx(p[0]); if (x > -20 && x < W + 20) { ctx.beginPath(); ctx.moveTo(x, sy(p[1]) + 8 * cam.z); ctx.lineTo(x, fy); ctx.stroke(); } } }));
      // boost pads glow under the track
      T.boosts.forEach(b => {
        const pc = T.pieces[b.piece], y = pc.pts.find(p => p[0] >= b.x0)[1];
        const x0 = sx(b.x0), x1 = sx(b.x1); if (x1 < 0 || x0 > W) return;
        ctx.fillStyle = `rgba(77,242,255,${0.25 + 0.15 * Math.sin(clock * 10)})`; ctx.fillRect(x0, sy(y) - 26 * cam.z, x1 - x0, 26 * cam.z);
      });
      // the orange track: a dark edge, the bright top, and a white stripe
      [[22, "#a83c00"], [16, "#ff7a00"], [3, "rgba(255,255,255,0.65)"]].forEach(([w, col], k) => {
        ctx.strokeStyle = col; ctx.lineWidth = w * cam.z; ctx.lineJoin = "round"; ctx.lineCap = "round";
        if (k === 2) ctx.setLineDash([18 * cam.z, 18 * cam.z]);
        T.pieces.forEach(pc => { ctx.beginPath(); pc.pts.forEach((p, i) => { const x = sx(p[0]) + (k === 2 ? 0 : 0), y = sy(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); });
        ctx.setLineDash([]);
      });
      // blue connectors joining the pieces of track, like the real toy
      ctx.fillStyle = "#1f6bff"; ctx.strokeStyle = "#0b2f80"; ctx.lineWidth = 1.5;
      T.pieces.forEach(pc => pc.pts.forEach((p, i) => {
        if (i % 11 !== 5 || i >= pc.tan.length) return;
        const X = sx(p[0]), Y = sy(p[1]); if (X < -20 || X > W + 20) return;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.atan2(pc.tan[i][1], pc.tan[i][0]));
        ctx.fillRect(-5 * cam.z, -10 * cam.z, 10 * cam.z, 20 * cam.z); ctx.strokeRect(-5 * cam.z, -10 * cam.z, 10 * cam.z, 20 * cam.z);
        ctx.restore();
      }));
      // chevrons on the boost pads
      T.boosts.forEach(b => {
        const pc = T.pieces[b.piece];
        for (let x = b.x0 + 20; x < b.x1; x += 40) {
          const p = pc.pts.find(q => q[0] >= x); if (!p) continue;
          const X = sx(x), Y = sy(p[1]) - 2 * cam.z; if (X < -20 || X > W + 20) continue;
          ctx.fillStyle = (Math.floor(clock * 8 - x / 40) % 3 === 0) ? "#ffffff" : "#ffe14d";
          ctx.beginPath(); ctx.moveTo(X - 8 * cam.z, Y - 6 * cam.z); ctx.lineTo(X + 4 * cam.z, Y); ctx.lineTo(X - 8 * cam.z, Y + 6 * cam.z); ctx.lineTo(X - 4 * cam.z, Y); ctx.closePath(); ctx.fill();
        }
      });
      // flags and the finish arch
      T.checks.forEach(c => { const p = T.pieces[c.piece].pts.find(q => q[0] >= c.x); if (!p) return; flag(sx(c.x), sy(p[1]), c === lastCheck ? "#7dff9a" : "#ffffff"); });
      const fp = T.pieces[T.pieces.length - 1].pts.find(q => q[0] >= T.finishX);
      if (fp) {
        const X = sx(T.finishX), Y = sy(fp[1]), hgt = 130 * cam.z;
        ctx.fillStyle = "#333"; ctx.fillRect(X - 4, Y - hgt, 8, hgt); ctx.fillRect(X + 90 * cam.z - 4, Y - hgt, 8, hgt);
        for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? "#111" : "#fff"; ctx.fillRect(X + i * 7.5 * cam.z, Y - hgt + j * 9 * cam.z, 7.5 * cam.z, 9 * cam.z); }
        ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(16 * cam.z)}px "Bricolage Grotesque", system-ui`; ctx.textAlign = "center"; ctx.fillText("FINISH", X + 45 * cam.z, Y - hgt - 8 * cam.z);
      }
    }
    function flag(x, y, col){
      ctx.strokeStyle = "#444"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 60 * cam.z); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 60 * cam.z); ctx.lineTo(x + 26 * cam.z, y - 52 * cam.z); ctx.lineTo(x, y - 44 * cam.z); ctx.closePath(); ctx.fill();
    }
    // a red fuel can, bobbing and glowing
    function drawFuels(){
      T.fuels.forEach(f => {
        if (f.got) return;
        const X = sx(f.x), Y = sy(f.y) + Math.sin(clock * 3 + f.x) * 4 * cam.z; if (X < -40 || X > W + 40) return;
        const k = cam.z;
        const g = ctx.createRadialGradient(X, Y, 2, X, Y, 34 * k); g.addColorStop(0, "rgba(255,120,80,0.45)"); g.addColorStop(1, "rgba(255,120,80,0)");
        ctx.fillStyle = g; ctx.fillRect(X - 34 * k, Y - 34 * k, 68 * k, 68 * k);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.sin(clock * 2 + f.x) * 0.15); ctx.scale(k, k);
        ctx.lineJoin = "round"; ctx.lineWidth = 2.5; ctx.strokeStyle = "#140a20";
        ctx.fillStyle = "#e8241b"; ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(9, -14); ctx.lineTo(14, -9); ctx.lineTo(14, 16); ctx.lineTo(-13, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffcc00"; ctx.fillRect(10, -21, 5, 8); ctx.strokeRect(10, -21, 5, 8);
        ctx.strokeStyle = "#140a20"; ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(-9, -20); ctx.lineTo(3, -20); ctx.lineTo(3, -14); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(8, 10); ctx.moveTo(8, -6); ctx.lineTo(-8, 10); ctx.stroke();
        ctx.restore();
      });
    }
    function drawCoins(){
      T.coins.forEach(c => {
        if (c.got) return;
        const X = sx(c.x), Y = sy(c.y); if (X < -30 || X > W + 30) return;
        const r = 11 * cam.z, w = Math.abs(Math.cos(clock * 4 + c.x * 0.01)) * r + 1.5;
        ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.ellipse(X, Y, w, r, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(X - w * 0.3, Y - r * 0.5, Math.max(1, w * 0.25), r * 0.6);
      });
    }
    // a hot rod seen from the side, facing right
    function drawCar(d, x, y, ang, wheel, flame){
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(cam.z, cam.z);
      // drawn 1.35x bigger, grown from the track line (CAR_H below the car's centre) so the wheels stay on the road
      ctx.translate(0, CAR_H); ctx.scale(CAR_DRAW, CAR_DRAW); ctx.translate(0, -CAR_H);
      const truck = d.style === "truck", lift = truck ? -12 : 0, rr = truck ? 19 : 15, fr = truck ? 19 : 12;
      // flames out of the back
      if (flame) {
        const len = flame * (24 + Math.random() * 18);
        const g = ctx.createLinearGradient(-48, 0, -48 - len, 0); g.addColorStop(0, keys.nitro && nitro > 0 ? "#bff4ff" : "#fff3a0"); g.addColorStop(0.4, keys.nitro && nitro > 0 ? "#3aa8ff" : "#ff8a00"); g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-44, -12 + lift); ctx.lineTo(-48 - len, -6 + lift); ctx.lineTo(-44, 0 + lift); ctx.fill();
      }
      ctx.translate(0, lift);
      // body
      ctx.lineJoin = "round"; ctx.lineWidth = 2.5; ctx.strokeStyle = "#140a20";
      ctx.fillStyle = d.body; ctx.beginPath();
      if (d.style === "wedge") { ctx.moveTo(-46, 2); ctx.lineTo(-46, -14); ctx.lineTo(-20, -18); ctx.quadraticCurveTo(-4, -30, 14, -16); ctx.lineTo(50, -4); ctx.lineTo(50, 2); }
      else { ctx.moveTo(-46, 3); ctx.lineTo(-46, -11); ctx.lineTo(-34, -15); ctx.lineTo(-16, -15); ctx.quadraticCurveTo(-8, -31, 8, -17); ctx.lineTo(40, -11); ctx.quadraticCurveTo(50, -8, 49, 3); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // the flame paint job
      ctx.fillStyle = d.trim; ctx.beginPath(); ctx.moveTo(44, -4); ctx.quadraticCurveTo(20, -14, 6, -6); ctx.quadraticCurveTo(14, -10, 0, -12); ctx.quadraticCurveTo(-10, -6, -20, -8); ctx.quadraticCurveTo(-6, -1, 16, 0); ctx.quadraticCurveTo(30, -2, 44, -4); ctx.fill();
      // the cockpit glass and the driver
      ctx.fillStyle = "#9be3ff"; ctx.beginPath(); ctx.ellipse(-3, -20, 10, 7, -0.15, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd84d"; ctx.fillRect(-7, -24, 7, 6);
      // engine and pipes on the rod, a fin on the others
      if (d.style === "rod" || d.style === "truck") { ctx.fillStyle = "#c9ced8"; ctx.fillRect(-32, -24, 14, 10); ctx.strokeRect(-32, -24, 14, 10); ctx.fillStyle = "#7f8695"; ctx.fillRect(-30, -29, 3, 6); ctx.fillRect(-24, -29, 3, 6); }
      if (d.style === "fin") { ctx.fillStyle = d.trim; ctx.beginPath(); ctx.moveTo(-44, -12); ctx.lineTo(-40, -32); ctx.lineTo(-28, -14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = "#140a20"; ctx.fillRect(-49, -17, 9, 4);
      ctx.translate(0, -lift);
      // wheels: big at the back, spinning
      [[-28, rr], [32, fr]].forEach(([wx, r]) => {
        ctx.save(); ctx.translate(wx, 3 + (truck ? 2 : 0)); ctx.rotate(wheel);
        ctx.fillStyle = "#16161d"; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.fillStyle = "#c9ced8"; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.fill();
        ctx.strokeStyle = "#7f8695"; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); }
        ctx.stroke();
        ctx.fillStyle = d.trim; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, 7); ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }
    function drawHud(){
      ctx.font = '800 18px "Bricolage Grotesque", system-ui'; ctx.textBaseline = "middle"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.fillStyle = "#fff";
      // the score, the coins and the fuel gauge
      ctx.textAlign = "left"; ctx.font = '900 26px "Bricolage Grotesque", system-ui';
      ctx.strokeText(score.toLocaleString("en"), 16, 26); ctx.fillText(score.toLocaleString("en"), 16, 26);
      ctx.font = '800 15px "Bricolage Grotesque", system-ui';
      ctx.strokeText(`🪙 ${coins}`, 16, 52); ctx.fillText(`🪙 ${coins}`, 16, 52);
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(84, 44, 120, 16);
      ctx.fillStyle = fuel > 0.5 ? "#38d96b" : fuel > 0.25 ? "#ffcc00" : "#ff4b3a"; ctx.fillRect(86, 46, 116 * fuel, 12);
      ctx.fillStyle = "#fff"; ctx.font = "800 11px system-ui"; ctx.fillText("⛽ FUEL", 90, 52);
      if (fuel < 0.25 && state === "race" && Math.floor(clock * 4) % 2) { ctx.font = '900 20px "Bricolage Grotesque", system-ui'; ctx.textAlign = "center"; ctx.fillStyle = "#ff6b4a"; ctx.strokeText(fuel <= 0 ? "OUT OF FUEL!" : "LOW FUEL!", W / 2, 60); ctx.fillText(fuel <= 0 ? "OUT OF FUEL!" : "LOW FUEL!", W / 2, 60); }
      ctx.font = '800 18px "Bricolage Grotesque", system-ui'; ctx.fillStyle = "#fff";
      const kmh = Math.round(Math.abs(car.on ? car.v : Math.hypot(car.vx, car.vy)) * 0.16);
      ctx.textAlign = "right"; ctx.strokeText(`${kmh} km/h`, W - 16, 24); ctx.fillText(`${kmh} km/h`, W - 16, 24);
      // the nitro tank
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(W / 2 - 100, 14, 200, 18);
      const ng = ctx.createLinearGradient(W / 2 - 100, 0, W / 2 + 100, 0); ng.addColorStop(0, "#3aa8ff"); ng.addColorStop(1, "#bff4ff");
      ctx.fillStyle = ng; ctx.fillRect(W / 2 - 98, 16, 196 * nitro, 14);
      ctx.fillStyle = "#fff"; ctx.font = "800 12px system-ui"; ctx.textAlign = "center"; ctx.fillText("NITRO", W / 2, 23);
      // progress along the track
      const prog = Math.max(0, Math.min(1, car.x / T.finishX));
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(W / 2 - 160, H - 18, 320, 6); ctx.fillStyle = "#ff7a00"; ctx.fillRect(W / 2 - 160, H - 18, 320 * prog, 6);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2 - 160 + 320 * prog, H - 15, 6, 0, 7); ctx.fill();
      if (state === "count") {
        const n = 3 - Math.floor(clock / 0.7);
        ctx.font = '900 96px "Bricolage Grotesque", system-ui'; ctx.lineWidth = 8; ctx.strokeStyle = "#140a20"; ctx.fillStyle = n > 0 ? "#ffe14d" : "#7dff9a";
        const txt = n > 0 ? String(n) : "GO!"; ctx.strokeText(txt, W / 2, H * 0.4); ctx.fillText(txt, W / 2, H * 0.4);
      }
      ctx.textBaseline = "alphabetic";
    }
    function draw(dt){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (!T) { ctx.fillStyle = "#6fc3ff"; ctx.fillRect(0, 0, W, H); return; }
      if (shake > 0 && !Hub.lessMotion()) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBackground();
      // speed lines when you're really going
      const sp = car.on ? Math.abs(car.v) : Math.hypot(car.vx, car.vy);
      if (sp > 950) {
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.5, (sp - 950) / 900)})`; ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const y = (i * 71 + 30) % H, x = W - ((clock * sp * 1.3 + i * 173) % (W + 300)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 80 + (i % 3) * 40, y); ctx.stroke(); }
      }
      drawTrack(); drawCoins(); drawFuels();
      const squash = bounce > 0 ? Math.sin(bounce * Math.PI * 3) * bounce * 6 : 0;
      if (state !== "crash") drawCar(carDef, sx(car.x), sy(car.y) + squash, car.ang, car.wheel, (keys.gas || (keys.nitro && nitro > 0)) && fuel > 0 && state === "race" ? (keys.nitro && nitro > 0 ? 1.6 : 0.8) : 0);
      dust.forEach(d2 => { ctx.fillStyle = `rgba(230,220,200,${0.6 - d2.t})`; ctx.beginPath(); ctx.arc(sx(d2.x), sy(d2.y), (4 + d2.t * 14) * cam.z, 0, 7); ctx.fill(); });
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt; b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.t > 1.2) { bits.splice(i, 1); continue; } ctx.fillStyle = b.col; ctx.fillRect(sx(b.x) - 4, sy(b.y) - 4, 8, 8); }
      fx.draw(ctx, dt);
      drawHud();
    }
    let lastHud = "";
    function hud(){
      const t = `${lvl}|${Math.floor(time * 10)}`;
      if (t === lastHud) return; lastHud = t;
      $("swTrack").textContent = `Track ${lvl + 1}: ${LEVELS[lvl].name}`;
      $("swTime").textContent = `⏱ ${time.toFixed(1)}`;
    }
    function update(dt){
      clock += dt;
      if (state === "count") { if (clock > 2.1) { state = "race"; Fun.sfx.whoosh(); } }
      else if (state === "race") {
        time += dt;
        const n = 4; for (let i = 0; i < n && state === "race"; i++) step(dt / n);
        // out of fuel: once the car has rolled to a stop, back to the last flag with some fuel
        if (state === "race" && fuel <= 0 && car.on && Math.abs(car.v) < 25) {
          outT += dt;
          if (outT > 1.2) { outT = 0; fx.pop("OUT OF FUEL!", W / 2, H * 0.35, "#ff6b4a", 44); Fun.sfx.wah(); spawn(lastCheck); fuel = 0.6; time += 3; }
        } else outT = 0;
      } else if (state === "crash") {
        crashT += dt;
        if (crashT > 1.1) { spawn(lastCheck); state = "race"; time += 1; fuel = Math.max(fuel, 0.35); }
      } else if (state === "done") { if (car.on) { car.v *= Math.pow(0.3, dt); car.s += car.v * dt; const a = at(T.pieces[car.piece], car.s); car.x = a.x + a.n[0] * CAR_H; car.y = a.y + a.n[1] * CAR_H; car.wheel += car.v * dt / 14; } }
      shake = Math.max(0, shake - dt * 30); bounce = Math.max(0, bounce - dt * 3);
      for (let i = dust.length - 1; i >= 0; i--) { const d2 = dust[i]; d2.t += dt; d2.x += d2.vx * dt; d2.y += d2.vy * dt; d2.vy += 400 * dt; if (d2.t > 0.6) dust.splice(i, 1); }
      // the camera looks ahead when you're fast, and zooms out a little
      const sp = car.on ? Math.abs(car.v) : Math.hypot(car.vx, car.vy);
      const big = canvas.clientWidth && canvas.clientWidth < 700 ? 1.25 : 1;   // closer on a small phone screen
      const tz = big * Math.max(0.68, 1.08 - sp / 3000), lead = Math.min(220, sp * 0.16);
      cam.z += (tz - cam.z) * Math.min(1, dt * 1.5);
      cam.x += (car.x + lead - cam.x) * Math.min(1, dt * 6);
      cam.y += (car.y - cam.y) * Math.min(1, dt * 4);
      if (W8().music !== false && store.sound !== false) music.engine(Math.min(1, sp / 1400), state === "race" || state === "count");
    }
    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now;
      if (running) update(dt); else clock += dt;
      draw(dt); if (T) hud();
      requestAnimationFrame(loop);
    }

    /* ---------------- the start panel: tracks and the garage ---------------- */
    let pickLvl = 0;
    function showPanel(label, nextLvl){
      running = state === "done" ? running : false;
      if (nextLvl !== undefined) pickLvl = nextLvl;
      const S = W8(), stars = totalStars();
      const unlockedAt = i => i === 0 || (S.stars[i - 1] || 0) >= 1, world = LEVELS[pickLvl].world;
      $("swWorlds").innerHTML = WORLDS.map((w, wi) => {
        const first = LEVELS.findIndex(L => L.world === wi), done = LEVELS.filter((L, i) => L.world === wi && S.stars[i]).length;
        return `<button type="button" class="sw-world${wi === world ? " on" : ""}" data-world="${wi}" ${unlockedAt(first) ? "" : "disabled"}>${unlockedAt(first) ? w.icon : "🔒"} ${w.name} <small>${done}/8</small></button>`;
      }).join("");
      $("swLevels").innerHTML = LEVELS.map((L, i) => {
        if (L.world !== world) return "";
        const open2 = unlockedAt(i), st = S.stars[i] || 0;
        return `<button type="button" class="sw-lvl${i === pickLvl ? " on" : ""}" data-lvl="${i}" ${open2 ? "" : "disabled"} aria-label="Track ${i + 1}: ${L.name}${open2 ? "" : " (locked)"}"><b>${open2 ? i + 1 : "🔒"}</b><span>${L.name}</span><i>${"★".repeat(st)}${"☆".repeat(3 - st)}</i>${S.score && S.score[i] ? `<em>${S.score[i].toLocaleString("en")}</em>` : ""}</button>`;
      }).join("");
      $("swCars").innerHTML = CARS.map(c => {
        const got = stars >= c.stars, on = (S.car || "flame") === c.id;
        return `<button type="button" class="sw-car${on ? " on" : ""}" data-car="${c.id}" ${got ? "" : "disabled"} style="--c:${c.body};--t:${c.trim}" aria-label="${c.name}${got ? "" : `, needs ${c.stars} stars`}"><i></i><span>${got ? c.name : `🔒 ${c.stars} ⭐`}</span></button>`;
      }).join("");
      playBtn.textContent = label || "▶ Race";
      panel.hidden = false; playBtn.focus();
    }
    $("swWorlds").addEventListener("click", e => {
      const b = e.target.closest("[data-world]"); if (!b || b.disabled) return;
      const wi = +b.dataset.world, S = W8(), inWorld = LEVELS.map((L, i) => i).filter(i => LEVELS[i].world === wi);
      pickLvl = inWorld.find(i => !(S.stars[i] >= 1) && (i === 0 || S.stars[i - 1] >= 1)) ?? inWorld[0];
      Fun.sfx.pop(); showPanel(playBtn.textContent, pickLvl);
    });
    $("swLevels").addEventListener("click", e => { const b = e.target.closest("[data-lvl]"); if (!b || b.disabled) return; pickLvl = +b.dataset.lvl; Fun.sfx.pop(); showPanel(playBtn.textContent, pickLvl); });
    $("swCars").addEventListener("click", e => { const b = e.target.closest("[data-car]"); if (!b || b.disabled) return; W8().car = b.dataset.car; Hub.saveStore(); Fun.sfx.pop(); showPanel(playBtn.textContent, pickLvl); });

    function start(){
      startLevel(pickLvl);
      running = true; panel.hidden = true;
      Fun.release(keys);
      if (W8().music !== false && store.sound !== false) music.start();
      canvas.focus();
    }
    function setMusicBtn(){ $("swMusic").textContent = W8().music !== false ? "🎵" : "🔇🎵"; }
    $("swMusic").addEventListener("click", () => {
      W8().music = W8().music === false; Hub.saveStore(); setMusicBtn();
      if (W8().music && running && store.sound !== false) music.start(); else { music.stop(); }
    });
    function openGame(){
      open = true; running = false; state = "ready";
      if (!T) { T = buildTrack(LEVELS[0]); lvl = 0; spawn(null); cam.x = car.x; cam.y = car.y; }
      Fun.screen(overlay, true);
      const S = W8();
      pickLvl = Math.min(LEVELS.length - 1, LEVELS.findIndex((_, i) => !(S.stars[i] >= 1)) === -1 ? 0 : LEVELS.findIndex((_, i) => !(S.stars[i] >= 1)));
      panelTitle.textContent = "🏎️ Stunt Wheels";
      panelText.textContent = "Race hot rods on orange toy track! Hold GAS, hit the boost pads to make it round the loops, and over jumps tilt with GAS and BRAKE to land on your wheels. Flips earn coins, perfect landings fill your nitro. Stars unlock new cars.";
      setMusicBtn(); showPanel("▶ Race");
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeGame(){ open = false; running = false; Fun.screen(overlay, false); music.stop(); }

    /* ---------------- controls ---------------- */
    const KEYMAP = { ArrowRight: "gas", KeyD: "gas", ArrowUp: "gas", KeyW: "gas", ArrowLeft: "brake", KeyA: "brake", ArrowDown: "brake", KeyS: "brake", Space: "nitro", ShiftLeft: "nitro", KeyN: "nitro" };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!running) return;
      if (e.code === "KeyR" && state === "race") { state = "crash"; crashT = 1; return; }
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault(); keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => Fun.release(keys));
    Fun.holdButtons(host.querySelectorAll("[data-swkey]"), keys, "swkey");
    canvas.tabIndex = 0;
    $("swCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("swCloseBtn"));
    playBtn.addEventListener("click", start);
    window.__wheels = { get score(){ return score; }, get fuel(){ return fuel; }, keys, get state(){ return state; }, get car(){ return car; }, get time(){ return time; }, level: i => { pickLvl = i; start(); }, get T(){ return T; } };

    return { open: openGame, close: closeGame };
  }
})();
