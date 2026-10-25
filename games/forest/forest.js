/* 99 Nights: a game like "99 Nights in the Forest" on Roblox, drawn in real 3D with WebGL. Your campfire
   is the only safe place: its flickering light really lights up the trees, and the fog and the dark close
   in everywhere else. In the day, chop trees (TIMBER!), loot treasure chests, pick berries and carrots, and
   grab scrap for the crafting bench. Feed the fire: the bigger it is, the bigger its circle of light.
   At night wolves come out (and every fifth night, the Alpha Wolf), and the Deer, a tall shadow with red
   eyes, creeps up on anyone outside the light, then CHARGES. Shine your flashlight right at it and it runs
   away! Four lost kids are somewhere in the forest: bring them back to the fire. Survive 99 nights. */
(function(){
  "use strict";
  const store = Hub.store;
  const DAY = 55, NIGHT = 45, WORLD = 64;
  const S = () => (store.forest = store.forest || { night: 1, t: 4, fire: 60, health: 100, hunger: 100, battery: 100, scrap: 0, sack: [], up: {}, kids: [], best: 0, deer: 0, won: false });

  const ITEM = {
    log:    { name: "Log",       em: "🪵", fuel: 18 },
    coal:   { name: "Coal",      em: "🪨", fuel: 40 },
    berry:  { name: "Berries",   em: "🫐", food: 15 },
    carrot: { name: "Carrot",    em: "🥕", food: 20 },
    meat:   { name: "Raw meat",  em: "🍖", food: 10 },
    steak:  { name: "Steak",     em: "🥩", food: 45 },
    scrap:  { name: "Scrap",     em: "⚙️" }
  };
  const UPGRADES = [
    { id: "sack",  icon: "🎒", name: "Big Sack",          desc: "Carry 10 things instead of 5",             cost: 5 },
    { id: "axe",   icon: "🪓", name: "Good Axe",          desc: "Chop trees and bonk wolves twice as fast", cost: 8 },
    { id: "light", icon: "🔦", name: "Strong Flashlight", desc: "A wider beam that scares the Deer faster",  cost: 10 },
    { id: "pit",   icon: "🔥", name: "Stone Fire Pit",    desc: "The fire burns slower and shines further", cost: 12 }
  ];
  const KIDS = [
    { id: "dino",   name: "Dino Kid",   shirt: "#3fae4a", hat: "#2a7f33", a: 0.7 },
    { id: "kraken", name: "Kraken Kid", shirt: "#7d4bd6", hat: "#5a2fae", a: 2.3 },
    { id: "squid",  name: "Squid Kid",  shirt: "#ff6bae", hat: "#d63f86", a: 3.9 },
    { id: "koala",  name: "Koala Kid",  shirt: "#9aa3ad", hat: "#6d757e", a: 5.4 }
  ];
  function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  Hub.register({
    id: "forest", section: "games", title: "99 Nights", icon: "🌲",
    blurb: "Like 99 Nights in the Forest on Roblox, in real 3D: keep the campfire burning, scare off the Deer and survive 99 nights!",
    stat: () => S().best ? `Survived ${S().best} nights` : "",
    badges: [
      { id: "nfTen",  icon: "🌙", name: "Night Owl",   desc: "Survive 10 nights in 99 Nights",           test: () => S().best >= 10 },
      { id: "nfDeer", icon: "🦌", name: "Deer Scarer", desc: "Scare the Deer away with your flashlight", test: () => S().deer >= 1 },
      { id: "nfKids", icon: "🧒", name: "Rescuer",     desc: "Bring all 4 lost kids back to the fire",   test: () => S().kids.length >= 4 },
      { id: "nf99",   icon: "🏆", name: "99 Nights!",  desc: "Survive all 99 nights",                    test: () => !!S().won }
    ],
    mount
  });

  /* ---------------- little bits of 3D maths ---------------- */
  const hexCache = new Map();
  function rgb(hex){
    if (!hexCache.has(hex)) { const n = parseInt(hex.slice(1), 16); hexCache.set(hex, [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]); }
    return hexCache.get(hex);
  }
  // a place and a turn (yaw round the up axis, then pitch tipping +y towards +z): local points to the world
  function frame(x, y, z, yaw, pitch){
    const cy = Math.cos(yaw || 0), sy = Math.sin(yaw || 0), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
    return { o: [x, y, z], R: [cy, sy * sp, sy * cp, 0, cp, -sp, -sy, cy * sp, cy * cp] };
  }
  const apply = (T, x, y, z) => [T.o[0] + T.R[0] * x + T.R[1] * y + T.R[2] * z, T.o[1] + T.R[3] * x + T.R[4] * y + T.R[5] * z, T.o[2] + T.R[6] * x + T.R[7] * y + T.R[8] * z];
  const turn = (T, x, y, z) => [T.R[0] * x + T.R[1] * y + T.R[2] * z, T.R[3] * x + T.R[4] * y + T.R[5] * z, T.R[6] * x + T.R[7] * y + T.R[8] * z];
  // a growing list of triangles: position, normal, colour and glow
  function Mesh(){
    let a = new Float32Array(1 << 17), n = 0;
    const m = {
      get data(){ return a.subarray(0, n); }, get count(){ return n / 10; },
      clear(){ n = 0; },
      v(p, q, c, e){
        if (n + 10 > a.length) { const b = new Float32Array(a.length * 2); b.set(a); a = b; }
        a[n++] = p[0]; a[n++] = p[1]; a[n++] = p[2]; a[n++] = q[0]; a[n++] = q[1]; a[n++] = q[2]; a[n++] = c[0]; a[n++] = c[1]; a[n++] = c[2]; a[n++] = e;
      },
      tri(p0, p1, p2, q, c, e){ m.v(p0, q, c, e); m.v(p1, q, c, e); m.v(p2, q, c, e); },
      quad(p0, p1, p2, p3, q, c, e){ m.tri(p0, p1, p2, q, c, e); m.tri(p0, p2, p3, q, c, e); },
      // a box standing on (x, y, z) in T's frame
      box(T, x, y, z, w, h, d, hex, e){
        const c = typeof hex === "string" ? rgb(hex) : hex, ee = e || 0;
        const X = [x - w / 2, x + w / 2], Y = [y, y + h], Z = [z - d / 2, z + d / 2];
        const P = (i, j, k) => apply(T, X[i], Y[j], Z[k]);
        const F = [
          [[1, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
          [[0, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], [[0, -1, 0], [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
          [[0, 0, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[0, 0, -1], [1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
        ];
        F.forEach(([nn, a0, a1, a2, a3]) => m.quad(P(...a0), P(...a1), P(...a2), P(...a3), turn(T, ...nn), c, ee));
      },
      // a pointy cone with a few sides (pine trees, carrots); down: point at the bottom
      cone(T, x, y, z, r, h, sides, hex, e, down){
        const c = typeof hex === "string" ? rgb(hex) : hex, ee = e || 0;
        const tip = apply(T, x, down ? y : y + h, z), base = down ? y + h : y;
        for (let i = 0; i < sides; i++) {
          const a0 = i / sides * 6.283, a1 = (i + 1) / sides * 6.283;
          const p0 = apply(T, x + Math.cos(a0) * r, base, z + Math.sin(a0) * r), p1 = apply(T, x + Math.cos(a1) * r, base, z + Math.sin(a1) * r);
          const am = (a0 + a1) / 2, nl = turn(T, Math.cos(am) * h, down ? -r : r, Math.sin(am) * h), l = Math.hypot(...nl);
          m.tri(p0, tip, p1, nl.map(v => v / l), c, ee);
          m.tri(p1, apply(T, x, base, z), p0, turn(T, 0, down ? 1 : -1, 0), c, ee);
        }
      }
    };
    return m;
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen nf-screen" id="nfOverlay" hidden aria-label="99 Nights">
      <div class="game-box">
        <div class="game-hud">
          <h2>🌲 99 Nights</h2>
          <span class="mono game-stat nf-night" id="nfNight">Day 1</span>
          <button class="btn ghost small" id="nfCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas class="nf-canvas" id="nfCanvas" width="960" height="540"></canvas>
          <canvas class="nf-ui" id="nfUi" width="960" height="540"></canvas>
          <div class="nf-bench" id="nfBench" hidden>
            <div class="nf-bench-head"><b>🔨 Crafting Bench</b><span id="nfScrap"></span><button class="btn ghost small" id="nfBenchClose" type="button">✕</button></div>
            <div id="nfBenchList"></div>
          </div>
          <div class="game-panel nf-panel" id="nfPanel">
            <div class="game-panel-title" id="nfTitle">🌲 99 Nights</div>
            <div class="game-panel-text" id="nfText"></div>
            <button class="btn" id="nfPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">W A S D to walk · Shift to sprint · ← → or the mouse to turn (click the game to use the mouse, Esc to let go) · click or Space to swing the axe · E to pick up, open chests, feed the fire or rescue · Q to eat · F for the flashlight</div>
        <div class="game-touch nf-touch">
          <button class="btn ghost fun-dpad" data-k="left" type="button" aria-label="Turn left">↶</button>
          <button class="btn ghost fun-dpad" data-k="up" type="button" aria-label="Walk">▲</button>
          <button class="btn ghost fun-dpad" data-k="down" type="button" aria-label="Back">▼</button>
          <button class="btn ghost fun-dpad" data-k="right" type="button" aria-label="Turn right">↷</button>
          <button class="btn ghost" data-k="run" type="button" aria-label="Sprint">🏃</button>
          <button class="btn" data-k="act" type="button" aria-label="Pick up or use">E</button>
          <button class="btn" data-k="axe" type="button" aria-label="Swing the axe">🪓</button>
          <button class="btn" data-k="eat" type="button" aria-label="Eat">😋</button>
          <button class="btn" data-k="light" type="button" aria-label="Flashlight">🔦</button>
        </div>
      </div>
    </section>`;
    const $ = id => document.getElementById(id);
    const overlay = $("nfOverlay"), canvas = $("nfCanvas"), ui = $("nfUi"), ctx = ui.getContext("2d");
    const panel = $("nfPanel"), titleEl = $("nfTitle"), textEl = $("nfText"), playBtn = $("nfPlayBtn");
    const nightEl = $("nfNight"), benchEl = $("nfBench"), benchList = $("nfBenchList"), scrapEl = $("nfScrap");
    const W = 960, H = 540, FOV = 1.0;
    const fx = Fun.pops(), tip = Fun.hint(canvas.parentElement);

    let open = false, running = false, last = 0, clock = 0, saveT = 0;
    let trees = [], items = [], chests = [], wolves = [], deer = null, kids = [], falling = [], embers = [], flies = [], tufts = [], rocks = [];
    let prompt = null, hurt = 0, shakeT = 0, light = false, stamina = 100, tired = false, fogNight = false, beatT = 0, scare = 0;
    let staticDirty = true, deerWarned = false;
    const me = { x: 0, z: 6, yaw: Math.PI, walk: 0, moving: false, swing: 0, run: false };
    const keys = { up: false, down: false, left: false, right: false, sleft: false, sright: false, run: false };
    let stick = null;   // on phones: a joystick (push up to walk, sideways to turn)

    /* ---------------- WebGL ---------------- */
    let gl = null, prog = null, staticBuf = null, staticCount = 0, dynBuf = null;
    const U = {}, A = {};
    const statMesh = Mesh(), dyn = Mesh();
    function initGL(){
      try { gl = canvas.getContext("webgl", { antialias: Fun.quality() === "high", alpha: false }); } catch (e) { gl = null; }
      if (!gl) return false;
      const vs = `attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEm;
        uniform mat4 uVP; varying vec3 vPos; varying vec3 vNor; varying vec3 vCol; varying float vEm;
        void main(){ vPos = aPos; vNor = aNor; vCol = aCol; vEm = aEm; gl_Position = uVP * vec4(aPos, 1.0); }`;
      const fs = `precision highp float;
        varying vec3 vPos; varying vec3 vNor; varying vec3 vCol; varying float vEm;
        uniform vec3 uCam, uAmb, uSunDir, uSunCol, uFire, uFireCol, uFog, uSkyLo, uSkyHi, uLightPos, uLightDir;
        uniform float uFireR, uFireI, uFogD, uLightOn, uLightCos, uLightRange, uNight, uTime;
        void main(){
          if (vEm > 1.5) {
            vec3 s = mix(uSkyLo, uSkyHi, vCol.g);
            if (vCol.r > 1.5) s = mix(s, vec3(0.95, 0.93, 0.82), uNight);
            else if (vCol.r > 0.5) s += vec3(uNight * (0.55 + 0.45 * sin(uTime * 2.0 + vPos.x * 3.0)));
            gl_FragColor = vec4(s, 1.0); return;
          }
          vec3 n = normalize(vNor);
          vec3 li = uAmb + uSunCol * max(dot(n, uSunDir), 0.0);
          vec3 tf = uFire - vPos; float df = length(tf);
          float fa = (1.0 - smoothstep(uFireR * 0.6, uFireR * 1.08, df)) * uFireI * (0.55 + 0.45 * clamp(1.0 - df / (uFireR * 1.1), 0.0, 1.0));
          li += uFireCol * fa * (0.35 + 0.65 * max(dot(n, tf / max(df, 0.001)), 0.0));
          if (uLightOn > 0.5) {
            vec3 tl = vPos - uLightPos; float dl = length(tl); vec3 ld = tl / max(dl, 0.001);
            float sp = smoothstep(uLightCos, uLightCos + 0.05, dot(ld, uLightDir)) * clamp(1.0 - dl / uLightRange, 0.0, 1.0);
            li += vec3(1.0, 0.95, 0.8) * 2.2 * sp * (0.3 + 0.7 * max(dot(n, -ld), 0.0));
          }
          vec3 c = vCol * li + vCol * vEm * 1.6;
          float f = 1.0 - exp(-length(vPos - uCam) * uFogD);
          c = mix(c, uFog, f * (1.0 - min(vEm, 1.0) * 0.6));
          gl_FragColor = vec4(c, 1.0);
        }`;
      try {
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      } catch (e) { gl = null; return false; }
      gl.useProgram(prog);
      ["uVP", "uCam", "uAmb", "uSunDir", "uSunCol", "uFire", "uFireCol", "uFog", "uSkyLo", "uSkyHi", "uLightPos", "uLightDir",
        "uFireR", "uFireI", "uFogD", "uLightOn", "uLightCos", "uLightRange", "uNight", "uTime"].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
      ["aPos", "aNor", "aCol", "aEm"].forEach(k => { A[k] = gl.getAttribLocation(prog, k); gl.enableVertexAttribArray(A[k]); });
      staticBuf = gl.createBuffer(); dynBuf = gl.createBuffer();
      gl.enable(gl.DEPTH_TEST);
      return true;
    }
    function bindAttrs(buf){
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(A.aNor, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(A.aCol, 3, gl.FLOAT, false, 40, 24);
      gl.vertexAttribPointer(A.aEm, 1, gl.FLOAT, false, 40, 36);
    }

    /* ---------------- the forest ---------------- */
    const night = () => S().t >= DAY;
    const daylight = () => { const t = S().t; if (t < 6) return t / 6; if (t < DAY - 8) return 1; if (t < DAY) return (DAY - t) / 8; return 0; };
    const fireR = () => (4 + S().fire / 100 * 12) * (S().up.pit ? 1.25 : 1);
    const capacity = () => S().up.sack ? 10 : 5;
    const dmg = () => S().up.axe ? 2 : 1;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const FIRE = { x: 0, z: 0 }, BENCH = { x: -4.5, z: -2.5 };
    function build(){
      const r = rng(Date.now() & 0xffff);
      trees = [];
      const kidSpots = KIDS.map(k => ({ x: Math.cos(k.a) * 52, z: Math.sin(k.a) * 52 }));
      const LOW = Fun.quality() === "low";   // fewer trees and tufts of grass on slow devices
      for (let tries = 0; trees.length < (LOW ? 180 : 300) && tries < 8000; tries++) {
        const a = r() * 6.283, d = 9 + Math.sqrt(r()) * (WORLD + 6 - 9);
        const t = { x: Math.cos(a) * d, z: Math.sin(a) * d };
        if (trees.some(o => Math.abs(o.x - t.x) < 3 && Math.abs(o.z - t.z) < 3)) continue;
        if (kidSpots.some(k => dist(k, t) < 5)) continue;
        t.h = 4 + r() * 3.5; t.hp = 3; t.shake = 0; t.pine = r() < 0.65; t.col = ["#2f7d32", "#3a8f3a", "#2a6b30", "#4a9a3a", "#356f2c"][Math.floor(r() * 5)];
        trees.push(t);
      }
      tufts = []; for (let i = 0; i < (LOW ? 120 : 500); i++) { const a = r() * 6.283, d = 5 + r() * 66; tufts.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 0.25 + r() * 0.35, c: ["#4f8f3a", "#5c9e40", "#3f7f30"][Math.floor(r() * 3)] }); }
      rocks = []; for (let i = 0; i < 40; i++) { const a = r() * 6.283, d = 10 + r() * 60; rocks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.5 + r() * 1.2, yaw: r() * 3 }); }
      items = [];
      const scatter = (kind, n, lo, hi) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, d = lo + r() * (hi - lo); items.push({ kind, x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, yaw: r() * 6 }); } };
      scatter("log", 4, 4, 9); scatter("berry", 14, 10, 60); scatter("carrot", 10, 10, 60); scatter("scrap", 16, 12, 62); scatter("coal", 8, 25, 62);
      chests = []; for (let i = 0; i < 10; i++) addChest(r);
      kids = KIDS.map((k, i) => ({ ...k, x: kidSpots[i].x, z: kidSpots[i].z, home: { ...kidSpots[i] }, yaw: 0, walk: 0, moving: false,
        state: S().kids.includes(k.id) ? "safe" : "lost" }));
      kids.forEach((k, i) => { if (k.state === "safe") { const a = i * 1.57 + 0.4; k.x = Math.cos(a) * 3; k.z = Math.sin(a) * 3; } else k.yaw = Math.atan2(-k.x, -k.z); });
      wolves = []; deer = null; falling = []; embers = [];
      flies = []; for (let i = 0; i < 30; i++) flies.push({ a: r() * 6.283, d: 6 + r() * 20, h: 0.5 + r() * 2, s: 0.2 + r() * 0.4, ph: r() * 6 });
      staticDirty = true;
    }
    function addChest(r){
      r = r || Math.random;
      const a = r() * 6.283, d = 14 + r() * 48;
      chests.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, yaw: r() * 6, gold: r() < 0.2, open: 0 });
    }
    function dawnItems(){
      const r = Math.random;
      for (let i = 0; i < 8; i++) { const a = r() * 6.283, d = 10 + r() * 50; items.push({ kind: ["berry", "carrot", "scrap", "scrap", "coal", "berry", "carrot", "scrap"][i], x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, yaw: r() * 6 }); }
      chests = chests.filter(c => !c.open); addChest(); addChest();
    }
    function newWolf(x, z, alpha){ return { x, z, yaw: 0, hp: alpha ? 6 : 3, cd: 0, walk: 0, wander: Math.random() * 6.283, hit: 0, alpha }; }
    function startNight(){
      const st = S(), n = Math.min(8, 2 + Math.floor(st.night / 4));
      wolves = [];
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = 30 + Math.random() * 25; wolves.push(newWolf(Math.cos(a) * d, Math.sin(a) * d, false)); }
      const alpha = st.night % 5 === 0;
      if (alpha) { const a = Math.random() * 6.283; wolves.push(newWolf(Math.cos(a) * 40, Math.sin(a) * 40, true)); }
      fogNight = !alpha && st.night > 2 && Math.random() < 0.3;
      const a = me.yaw + Math.PI + (Math.random() - 0.5);
      deer = { x: me.x + Math.sin(a) * 34, z: me.z + Math.cos(a) * 34, yaw: 0, stun: 0, gone: 0, walk: 0, charge: 0, rest: 0 };
      fx.pop(alpha ? "🐺 ALPHA WOLF NIGHT!" : fogNight ? "🌫️ FOGGY NIGHT..." : `🌙 NIGHT ${st.night}`, W / 2, H * 0.35, alpha ? "#ff6b6b" : "#c9d7ff", 52);
      tip.show(st.night === 1 ? "🌙 Night is coming! Stay near the fire. If the Deer comes, shine your flashlight at it (F)"
        : alpha ? "🐺 The Alpha Wolf is out tonight. It's big and tough, but it drops lots of scrap!" : fogNight ? "🌫️ Thick fog tonight. Stay close to the fire!" : "🌙 Night " + st.night + ": keep the fire burning!", 5000);
      Fun.sfx.wah();
    }
    function dawn(){
      const st = S();
      fx.pop(`☀️ You survived Night ${st.night}!`, W / 2, H * 0.35, "#ffe14d", 44);
      fx.burst(W / 2, H * 0.35, "#ffe14d", 30, 220); Fun.sfx.tada();
      st.best = Math.max(st.best, st.night);
      if (st.night >= 99 && !st.won) { st.won = true; win(); }
      st.night++;
      wolves = []; deer = null; fogNight = false; scare = 0;
      dawnItems(); save(); Hub.checkBadges();
    }
    function win(){
      running = false;
      titleEl.textContent = "🏆 99 NIGHTS!";
      textEl.textContent = "You survived all 99 nights in the forest! You're a legend. Keep playing to see how far you can go!";
      playBtn.textContent = "▶ Keep going";
      panel.hidden = false;
      for (let i = 0; i < 6; i++) fx.burst(W * Math.random(), H * Math.random(), "#ffe14d", 30, 260);
      Hub.confettiBurst(canvas);
    }

    /* ---------------- doing things ---------------- */
    function findPrompt(){
      const st = S();
      let best = null, bd = 1e9;
      const consider = (d, max, p) => { if (d < max && d < bd) { bd = d; best = p; } };
      items.forEach(it => { if (it.y < 0.3) consider(dist(it, me), 1.9, { kind: "pick", it, text: st.sack.length >= capacity() && it.kind !== "scrap" ? `🎒 Sack full! (${capacity()})` : `E: pick up ${ITEM[it.kind].em} ${ITEM[it.kind].name}` }); });
      chests.forEach(c => { if (!c.open) consider(dist(c, me), 2.2, { kind: "chest", c, text: c.gold ? "E: open the GOLDEN chest! ✨" : "E: open the chest 📦" }); });
      kids.forEach(k => { if (k.state === "lost") consider(dist(k, me), 3, { kind: "kid", k, text: `E: rescue ${k.name}!` }); });
      const fuel = st.sack.filter(k => ITEM[k].fuel).length, meat = st.sack.filter(k => k === "meat").length;
      if (fuel || meat) consider(dist(FIRE, me), 3.6, { kind: "fire", text: `E: ${fuel ? `throw ${fuel} fuel on the fire 🔥` : ""}${fuel && meat ? " and " : ""}${meat ? `cook ${meat} meat 🥩` : ""}` });
      consider(dist(BENCH, me), 2.6, { kind: "bench", text: "E: use the crafting bench 🔨" });
      return best;
    }
    function drop(kind, x, z, up){ items.push({ kind, x, z, y: up ? 0.6 : 0, vy: up ? 5 + Math.random() * 3 : 0, vx: up ? (Math.random() - 0.5) * 4 : 0, vz: up ? (Math.random() - 0.5) * 4 : 0, yaw: Math.random() * 6 }); }
    function popAt(text, x, y, z, col, size){ const s = project(x, y, z); fx.pop(text, s ? s.x : W / 2, s ? s.y : H * 0.45, col, size); }
    function act(){
      if (!running) return;
      const st = S(), p = prompt;
      if (!p) return;
      if (p.kind === "pick") {
        if (p.it.kind === "scrap") { items.splice(items.indexOf(p.it), 1); st.scrap++; popAt("+1 ⚙️", p.it.x, 1, p.it.z, "#c9d7ff", 26); Fun.sfx.beep(); return; }
        if (st.sack.length >= capacity()) { Fun.sfx.nope(); fx.pop("Sack full! 🎒", W / 2, H * 0.6, "#ff9f43", 28); return; }
        items.splice(items.indexOf(p.it), 1);
        st.sack.push(p.it.kind); popAt(`+ ${ITEM[p.it.kind].em}`, p.it.x, 1, p.it.z, "#ffffff", 30); Fun.sfx.pop();
      } else if (p.kind === "chest") {
        const c = p.c; c.open = 0.01;
        const n = c.gold ? 7 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) drop("scrap", c.x, c.z, true);
        const extra = c.gold ? ["coal", "coal", "carrot", "berry"] : [["coal", "berry", "carrot"][Math.floor(Math.random() * 3)]];
        extra.forEach(k => drop(k, c.x, c.z, true));
        popAt(c.gold ? "✨ GOLDEN LOOT! ✨" : "📦 LOOT!", c.x, 1.6, c.z, c.gold ? "#ffe14d" : "#ffffff", c.gold ? 44 : 32);
        const s = project(c.x, 1, c.z); if (s) fx.burst(s.x, s.y, c.gold ? "#ffe14d" : "#c58a4a", 30, 220);
        if (c.gold) Fun.sfx.tada(); else Fun.sfx.coin();
      } else if (p.kind === "kid") {
        p.k.state = "follow"; Fun.sfx.tada();
        popAt(`${p.k.name}: "You found me! 😭"`, p.k.x, 2.4, p.k.z, "#ffe14d", 28);
        tip.show(`🧒 Take ${p.k.name} back to the campfire!`, 4000);
      } else if (p.kind === "fire") {
        let fuel = 0, cooked = 0;
        st.sack = st.sack.filter(k => { if (ITEM[k].fuel) { fuel += ITEM[k].fuel; return false; } return true; }).map(k => { if (k === "meat") { cooked++; return "steak"; } return k; });
        if (fuel) {
          st.fire = Math.min(100, st.fire + fuel);
          popAt(`🔥 WHOOSH! Fire ${Math.round(st.fire)}%`, 0, 2.5, 0, "#ff9f43", 38);
          for (let i = 0; i < 60; i++) embers.push({ x: (Math.random() - 0.5) * 1.2, y: 0.5, z: (Math.random() - 0.5) * 1.2, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 3, life: 1 + Math.random() });
          Fun.sfx.whoosh();
        }
        if (cooked) { fx.pop(`🥩 Cooked ${cooked} steak${cooked > 1 ? "s" : ""}!`, W / 2, H * 0.55, "#ffcf9f", 28); Fun.sfx.splat(); }
        save();
      } else if (p.kind === "bench") openBench();
    }
    function eat(){
      if (!running) return;
      const st = S();
      const foods = st.sack.map((k, i) => ({ k, i })).filter(f => ITEM[f.k].food).sort((a, b) => ITEM[b.k].food - ITEM[a.k].food);
      if (!foods.length) { fx.pop("No food! Find berries 🫐", W / 2, H * 0.6, "#ff9f43", 26); Fun.sfx.nope(); return; }
      if (st.hunger > 95) { fx.pop("You're full! 😌", W / 2, H * 0.6, "#ffffff", 26); return; }
      const f = foods.find(f => f.k !== "meat") || foods[0];
      st.sack.splice(f.i, 1);
      st.hunger = Math.min(100, st.hunger + ITEM[f.k].food);
      fx.pop(f.k === "meat" ? "Yuck, raw! 🤢 Cook it at the fire" : `${ITEM[f.k].em} Yum! +${ITEM[f.k].food}`, W / 2, H * 0.6, "#9be37a", 28);
      Fun.sfx.chomp();
    }
    function swing(){
      if (!running || me.swing > 0) return;
      me.swing = 0.35; Fun.sfx.whoosh();
      const fwd = [Math.sin(me.yaw), Math.cos(me.yaw)];
      const facing = o => { const dx = o.x - me.x, dz = o.z - me.z, d = Math.hypot(dx, dz); return d > 0.01 ? (dx * fwd[0] + dz * fwd[1]) / d : 1; };
      const wolf = wolves.find(w => dist(w, me) < (w.alpha ? 3.2 : 2.6) && facing(w) > 0.3);
      if (wolf) {
        wolf.hp -= dmg(); wolf.hit = 0.3;
        const d = dist(wolf, me) || 1; wolf.x += (wolf.x - me.x) / d * 2.5; wolf.z += (wolf.z - me.z) / d * 2.5;
        Fun.sfx.bonk(); shakeT = 0.15;
        if (wolf.hp <= 0) {
          wolves.splice(wolves.indexOf(wolf), 1);
          drop("meat", wolf.x, wolf.z, true);
          if (wolf.alpha) { drop("meat", wolf.x, wolf.z, true); for (let i = 0; i < 6; i++) drop("scrap", wolf.x, wolf.z, true); popAt("🐺 ALPHA DEFEATED!", wolf.x, 2, wolf.z, "#ffe14d", 44); Fun.sfx.tada(); }
          else popAt("POOF! 💨", wolf.x, 1.2, wolf.z, "#ffffff", 34);
          const s = project(wolf.x, 1, wolf.z); if (s) fx.burst(s.x, s.y, "#cccccc", 24, 180);
        } else popAt(["BONK!", "Yelp!", "Go away!"][Math.floor(Math.random() * 3)], wolf.x, 1.6, wolf.z, "#ffe14d", 28);
        return;
      }
      const tree = trees.find(t => t.hp > 0 && dist(t, me) < 2.3 && facing(t) > 0.4);
      if (!tree) return;
      tree.hp -= dmg(); tree.shake = 0.3; Fun.sfx.thunk();
      const s = project(tree.x, 2, tree.z); if (s) fx.burst(s.x, s.y, "#c58a4a", 8, 120);
      if (tree.hp <= 0) {
        // it falls over away from you, then: TIMBER!
        falling.push({ x: tree.x, z: tree.z, h: tree.h, pine: tree.pine, col: tree.col, yaw: me.yaw, p: 0, v: 0 });
        staticDirty = true;
        popAt("TIMBER! 🌲", tree.x, 3, tree.z, "#9be37a", 36);
      } else popAt("CHOP!", tree.x, 2, tree.z, "#ffffff", 24);
    }
    function faint(){
      const st = S();
      st.sack = []; st.health = 60; st.hunger = Math.max(st.hunger, 40);
      me.x = 0; me.z = 5; me.yaw = Math.PI; camPos = null;
      kids.forEach(k => { if (k.state === "follow") { k.state = "lost"; k.x = k.home.x; k.z = k.home.z; } });
      hurt = 1; Fun.sfx.wah(); Fun.shake(canvas);
      fx.pop("😵 You fainted!", W / 2, H * 0.4, "#ff6b6b", 46);
      tip.show("You woke up by the fire, but you dropped everything in your sack", 4000);
      if (deer) { deer.gone = 15; deer.charge = 0; }
      save();
    }

    /* ---------------- the crafting bench ---------------- */
    function openBench(){ benchEl.hidden = false; drawBench(); if (document.pointerLockElement === canvas) document.exitPointerLock(); }
    function drawBench(){
      const st = S();
      scrapEl.textContent = `⚙️ ${st.scrap} scrap`;
      benchList.innerHTML = UPGRADES.map(u => `<div class="nf-row${st.up[u.id] ? " nf-have" : ""}">
        <span class="nf-em">${u.icon}</span><span class="nf-name">${u.name}<small>${u.desc}</small></span>
        <button class="btn small" data-up="${u.id}" type="button" ${st.up[u.id] ? "disabled" : ""}>${st.up[u.id] ? "✓ Got it" : `⚙️ ${u.cost}`}</button></div>`).join("");
    }
    benchList.addEventListener("click", e => {
      const b = e.target.closest("[data-up]"); if (!b) return;
      const st = S(), u = UPGRADES.find(u => u.id === b.dataset.up);
      if (st.up[u.id]) return;
      if (st.scrap < u.cost) { Fun.sfx.nope(); b.textContent = `Need ${u.cost} ⚙️`; setTimeout(drawBench, 900); return; }
      st.scrap -= u.cost; st.up[u.id] = true; Fun.sfx.tada();
      fx.pop(`${u.icon} ${u.name}!`, W / 2, H * 0.35, "#ffe14d", 40);
      drawBench(); save();
    });
    $("nfBenchClose").addEventListener("click", () => { benchEl.hidden = true; canvas.focus(); });

    /* ---------------- each frame ---------------- */
    function step(dt){
      clock += dt;
      const st = S(), wasNight = night();
      st.t += dt;
      if (st.t >= DAY + NIGHT) { st.t -= DAY + NIGHT; dawn(); if (!running) return; }
      if (!wasNight && night()) startNight();
      // you
      const tw = (keys.left ? -1 : 0) + (keys.right ? 1 : 0) + (stick && stick.on ? stick.x : 0);
      me.yaw += tw * 2.6 * dt;
      let fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      const side = (keys.sright ? 1 : 0) - (keys.sleft ? 1 : 0);
      if (stick && stick.on && Math.abs(stick.y) > 0.2) fwd = -stick.y;
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
      let vx = sy * fwd + cy * side, vz = cy * fwd - sy * side;
      const l = Math.hypot(vx, vz);
      me.moving = l > 0;
      me.run = keys.run && me.moving && !tired && stamina > 0;
      if (me.run) { stamina = Math.max(0, stamina - dt * 28); if (stamina <= 0) { tired = true; fx.pop("Out of breath! 😮‍💨", W / 2, H * 0.62, "#ffffff", 24); } }
      else { stamina = Math.min(100, stamina + dt * 16); if (stamina > 30) tired = false; }
      const speed = (st.hunger > 0 ? 6.5 : 4.5) * (me.run ? 1.55 : 1);
      if (l) { vx /= l; vz /= l; me.x += vx * speed * dt; me.z += vz * speed * dt; me.walk += dt * (me.run ? 15 : 10); }
      trees.forEach(t => { const dx = me.x - t.x, dz = me.z - t.z, d = Math.hypot(dx, dz), R = t.hp > 0 ? 0.75 : 0.55; if (d < R && d > 0) { me.x = t.x + dx / d * R; me.z = t.z + dz / d * R; } });
      { const d = Math.hypot(me.x, me.z); if (d > WORLD) { me.x *= WORLD / d; me.z *= WORLD / d; } if (d < 1.5 && d > 0) { me.x *= 1.5 / d; me.z *= 1.5 / d; } }
      me.swing = Math.max(0, me.swing - dt);
      trees.forEach(t => { t.shake = Math.max(0, t.shake - dt); });
      // trees falling over
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.v += dt * 2.6; f.p += f.v * dt;
        if (f.p >= Math.PI / 2) {
          falling.splice(i, 1); shakeT = 0.35; Fun.sfx.crash();
          const s = project(f.x + Math.sin(f.yaw) * f.h * 0.5, 0.3, f.z + Math.cos(f.yaw) * f.h * 0.5);
          if (s) fx.burst(s.x, s.y, "#9be37a", 26, 200);
          for (let k = 1; k <= 3; k++) drop("log", f.x + Math.sin(f.yaw) * k * f.h / 3.5, f.z + Math.cos(f.yaw) * k * f.h / 3.5, false);
        }
      }
      // loot flying out of chests, and chest lids opening
      items.forEach(it => { if (it.vy || it.y > 0) { it.vy -= 18 * dt; it.y += it.vy * dt; it.x += (it.vx || 0) * dt; it.z += (it.vz || 0) * dt; if (it.y <= 0) { it.y = 0; it.vy = 0; it.vx = 0; it.vz = 0; } } });
      chests.forEach(c => { if (c.open) c.open = Math.min(1, c.open + dt * 3); });
      // the fire, food and the flashlight
      const safe = dist(me, FIRE) < fireR();
      st.fire = Math.max(0, st.fire - dt * (night() ? 1.0 : 0.55) * (st.up.pit ? 0.7 : 1));
      if (st.fire < 15 && Math.floor(clock * 0.2) !== Math.floor((clock - dt) * 0.2)) tip.show("🔥 The fire is going out! Bring logs (E at the fire)", 3500);
      st.hunger = Math.max(0, st.hunger - dt * 0.45);
      if (st.hunger <= 0) st.health -= dt * 2;
      else if (st.hunger > 50 && st.health < 100) st.health = Math.min(100, st.health + dt * (safe ? 2 : 0.6));
      if (light) { st.battery = Math.max(0, st.battery - dt * (st.up.light ? 3 : 5)); if (st.battery <= 0) { light = false; tip.show("🔋 Flashlight's empty! It charges by the fire", 3000); } }
      else st.battery = Math.min(100, st.battery + dt * (safe ? 12 : 1.5));
      // embers floating up from the fire
      if (st.fire > 0 && Math.random() < dt * (4 + st.fire / 8)) embers.push({ x: (Math.random() - 0.5) * 0.8, y: 0.8, z: (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.8, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 0.8, life: 1.5 + Math.random() });
      for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.vx += Math.sin(clock * 3 + i) * dt; e.life -= dt; if (e.life <= 0) embers.splice(i, 1); }
      // kids follow you home
      kids.forEach((k, i) => {
        if (k.state !== "follow") { k.moving = false; return; }
        const d = dist(k, me);
        if (d > 1.8) { const v = Math.min(d - 1.6, 9 * dt); k.x += (me.x - k.x) / d * v; k.z += (me.z - k.z) / d * v; k.yaw = Math.atan2(me.x - k.x, me.z - k.z); k.moving = true; k.walk += dt * 12; } else k.moving = false;
        if (dist(k, FIRE) < 5) {
          k.state = "safe"; st.kids.push(k.id);
          const a = i * 1.57 + 0.4; k.x = Math.cos(a) * 3; k.z = Math.sin(a) * 3; k.moving = false;
          fx.pop(`🎉 ${k.name} is safe!`, W / 2, H * 0.35, "#ffe14d", 42); fx.burst(W / 2, H * 0.35, "#ffe14d", 30, 220); Fun.sfx.tada();
          if (st.kids.length === 4) tip.show("🏆 You rescued all four kids!", 4000);
          save(); Hub.checkBadges();
        }
      });
      kids.forEach(k => { if (k.state === "safe") k.yaw = Math.atan2(-k.x, -k.z); });
      if (night()) nightThings(dt, safe); else scare = Math.max(0, scare - dt);
      if (st.health <= 0) faint();
      hurt = Math.max(0, hurt - dt * 1.5); shakeT = Math.max(0, shakeT - dt);
      prompt = findPrompt();
      saveT += dt;
      if (saveT > 5) { saveT = 0; save(); }
    }
    function nightThings(dt, safe){
      const st = S(), R = fireR();
      // wolves chase you outside the light, but they're scared of the fire
      wolves.forEach(w => {
        w.cd = Math.max(0, w.cd - dt); w.hit = Math.max(0, w.hit - dt);
        const d = dist(w, me);
        let tx, tz, sp;
        if (d < (w.alpha ? 22 : 17) && !safe) { tx = me.x; tz = me.z; sp = w.alpha ? 5.8 : 5.2; }
        else { w.wander += (Math.random() - 0.5) * dt * 2; tx = w.x + Math.sin(w.wander) * 5; tz = w.z + Math.cos(w.wander) * 5; sp = 2; }
        const dx = tx - w.x, dz = tz - w.z, l = Math.hypot(dx, dz);
        if (l > 0.5 && w.hit <= 0) { w.x += dx / l * sp * dt; w.z += dz / l * sp * dt; w.yaw = Math.atan2(dx, dz); w.walk += dt * sp * 2; }
        const fd = dist(w, FIRE);
        if (fd < R + 1) { w.x *= (R + 1) / fd; w.z *= (R + 1) / fd; }
        if (Math.hypot(w.x, w.z) > WORLD) w.wander += Math.PI;
        if (d < (w.alpha ? 1.9 : 1.4) && w.cd <= 0 && !safe) {
          w.cd = 1.2; st.health -= w.alpha ? 18 : 10; hurt = 0.6; shakeT = 0.2; Fun.sfx.oof();
          fx.pop(w.alpha ? "CHOMP!! 🐺" : "CHOMP! 🐺", W / 2, H * 0.5, "#ff6b6b", w.alpha ? 40 : 32);
        }
      });
      // the Deer: creeps up when you're out of the light, then charges; it runs from the flashlight
      if (!deer) return;
      if (deer.gone > 0) {
        deer.gone -= dt; scare = Math.max(0, scare - dt);
        if (deer.gone <= 0) { const a = me.yaw + Math.PI + (Math.random() - 0.5); deer.x = me.x + Math.sin(a) * 30; deer.z = me.z + Math.cos(a) * 30; deer.stun = 0; deer.charge = 0; }
        return;
      }
      const d = dist(deer, me);
      let tx = me.x, tz = me.z, sp = Math.min(5, 2.6 + st.night * 0.03);
      deer.rest = Math.max(0, deer.rest - dt);
      if (safe) {
        // it waits just outside the light, watching you
        deer.charge = 0;
        const a = Math.atan2(me.x, me.z) + Math.sin(clock * 0.3) * 0.6;
        tx = Math.sin(a) * (R + 6); tz = Math.cos(a) * (R + 6); sp = 2.2;
      } else if (deer.charge > 0) {
        deer.charge -= dt; sp = 9.5;
        if (deer.charge <= 0) deer.rest = 3;
      } else if (d < 10 && deer.rest <= 0) {
        deer.charge = 2.2; Fun.sfx.honk(); shakeT = 0.25;
        popAt("RUN!!! 😱", me.x, 2.6, me.z, "#ff4d4d", 44);
      }
      const dx = tx - deer.x, dz = tz - deer.z, l = Math.hypot(dx, dz);
      if (l > 0.3) { deer.x += dx / l * sp * dt; deer.z += dz / l * sp * dt; deer.yaw = Math.atan2(me.x - deer.x, me.z - deer.z); deer.walk += dt * sp; }
      const fd = dist(deer, FIRE);
      if (fd < R + 1.5) { deer.x *= (R + 1.5) / fd; deer.z *= (R + 1.5) / fd; }
      if (!safe && d < 14 && !deerWarned) { deerWarned = true; tip.show("🦌 THE DEER! Shine your flashlight at it (F) or run to the fire!", 4000); }
      if (d > 22) deerWarned = false;
      // your heart beats faster the closer it gets
      scare = !safe && d < 16 ? Math.min(1, (16 - d) / 12) : Math.max(0, scare - dt);
      if (scare > 0) { beatT -= dt; if (beatT <= 0) { beatT = 0.95 - scare * 0.6; Fun.sfx.thunk(); } }
      // shine the light right at it
      if (light && d < (st.up.light ? 22 : 18)) {
        const ang = Math.atan2(deer.x - me.x, deer.z - me.z), diff = Math.abs(((ang - me.yaw) % 6.283 + 9.425) % 6.283 - 3.1416);
        if (diff < (st.up.light ? 0.5 : 0.32)) {
          deer.stun += dt; deer.charge = Math.min(deer.charge, 0.2);
          if (deer.stun > (st.up.light ? 0.6 : 1.0)) {
            deer.gone = 25; st.deer++; Hub.checkBadges();
            popAt("🦌 The Deer ran away!", deer.x, 4, deer.z, "#ffe14d", 36); Fun.sfx.tada();
          }
        }
      } else deer.stun = Math.max(0, deer.stun - dt * 0.5);
      if (d < 2 && !safe) {
        st.health -= 30; hurt = 1; shakeT = 0.5; Fun.sfx.crash(); Fun.shake(canvas);
        fx.pop("😱 THE DEER GOT YOU!", W / 2, H * 0.4, "#ff4d4d", 40);
        const a = Math.random() * 6.283; deer.x = me.x + Math.sin(a) * 26; deer.z = me.z + Math.cos(a) * 26; deer.charge = 0; deer.rest = 4;
      }
    }
    function save(){ Hub.saveStore(); }

    /* ---------------- building the 3D world ---------------- */
    function treeMesh(m, t, T){
      m.box(T, 0, 0, 0, 0.55, t.h * 0.5, 0.55, "#5c3a1e");
      if (t.pine) { for (let k = 0; k < 3; k++) m.cone(T, 0, t.h * 0.3 + k * t.h * 0.22, 0, 2.0 - k * 0.5, t.h * 0.38, 7, t.col); }
      else { m.box(T, 0, t.h * 0.42, 0, 2.8, t.h * 0.42, 2.8, t.col); m.box(T, 0, t.h * 0.84, 0, 1.8, t.h * 0.18, 1.8, t.col); }
    }
    function buildStatic(){
      const m = statMesh; m.clear();
      const I = frame(0, 0, 0, 0, 0);
      // the ground: grassy squares, with a dirt clearing round the camp
      const G = 2.5, N = 30;
      for (let gx = -N; gx < N; gx++) for (let gz = -N; gz < N; gz++) {
        const x = gx * G, z = gz * G, d = Math.hypot(x + G / 2, z + G / 2);
        if (d > 80) continue;
        const nse = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453, f = (nse - Math.floor(nse)) * 0.12;
        const c = d < 7 ? [0.42 + f, 0.33 + f, 0.2] : d > WORLD + 4 ? [0.16 + f * 0.5, 0.28 + f, 0.14] : [0.22 + f, 0.42 + f, 0.18 + f * 0.5];
        m.quad([x, 0, z], [x, 0, z + G], [x + G, 0, z + G], [x + G, 0, z], [0, 1, 0], c, 0);
      }
      trees.forEach(t => {
        if (t.hp > 0) { treeMesh(m, t, frame(t.x, 0, t.z, 0, 0)); return; }
        if (falling.some(f => f.x === t.x && f.z === t.z)) return;
        m.box(I, t.x, 0, t.z, 0.8, 0.45, 0.8, "#8a5a2b"); m.box(I, t.x, 0.45, t.z, 0.6, 0.02, 0.6, "#d9b27c");
      });
      tufts.forEach(g => { m.cone(I, g.x, 0, g.z, 0.12, g.h, 4, g.c); m.cone(I, g.x + 0.15, 0, g.z + 0.1, 0.1, g.h * 0.8, 4, g.c); });
      rocks.forEach(r => m.box(frame(r.x, 0, r.z, r.yaw, 0), 0, 0, 0, r.s * 1.3, r.s * 0.7, r.s, "#7d828c"));
      // the camp: a ring of stones, the crafting bench and logs to sit on
      for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; m.box(frame(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, a, 0), 0, 0, 0, 0.55, 0.38, 0.45, "#8a8f99"); }
      const B = frame(BENCH.x, 0, BENCH.z, 0.4, 0);
      m.box(B, 0, 0.8, 0, 2.2, 0.2, 1.1, "#a8743c");
      [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([x, z]) => m.box(B, x, 0, z, 0.15, 0.8, 0.15, "#7a5230"));
      m.box(B, -0.4, 1.0, 0, 0.5, 0.12, 0.25, "#9aa3ad"); m.box(B, 0.4, 1.0, 0.1, 0.12, 0.12, 0.6, "#6b4423");
      [[5, 1.5, 0.3], [-1.5, 5, 1.6], [2, -5, -0.4]].forEach(([x, z, yaw]) => m.box(frame(x, 0.3, z, yaw, Math.PI / 2), 0, -1.2, 0, 0.6, 2.4, 0.6, "#6b4423"));
      // the lost kids' tents
      kids.forEach(k => {
        const a = Math.atan2(-k.home.x, -k.home.z), T = frame(k.home.x - Math.sin(a) * 2.2, 0, k.home.z - Math.cos(a) * 2.2, a, 0);
        m.quad(apply(T, -1.3, 0, -1.3), apply(T, -1.3, 0, 1.3), apply(T, 0, 1.8, 1.3), apply(T, 0, 1.8, -1.3), turn(T, -0.8, 0.6, 0), rgb("#c8553d"), 0);
        m.quad(apply(T, 1.3, 0, 1.3), apply(T, 1.3, 0, -1.3), apply(T, 0, 1.8, -1.3), apply(T, 0, 1.8, 1.3), turn(T, 0.8, 0.6, 0), rgb("#a8432f"), 0);
        m.tri(apply(T, -1.3, 0, -1.3), apply(T, 0, 1.8, -1.3), apply(T, 1.3, 0, -1.3), turn(T, 0, 0, -1), rgb("#8f3a28"), 0);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
      gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
      staticCount = m.count;
      staticDirty = false;
    }
    function person(m, c, look, scale){
      const s = scale || 1, sw = c.moving ? Math.sin(c.walk) * 0.55 : 0, T = frame(c.x, 0, c.z, c.yaw, 0);
      const chop = c.swing > 0 ? Math.sin((1 - c.swing / 0.35) * Math.PI) : 0;
      const leg = (x, a) => m.box(frame(...apply(T, x * s, 1.0 * s, 0), c.yaw, a), 0, -1.0 * s, 0, 0.48 * s, 1.0 * s, 0.5 * s, look.pants);
      leg(-0.25, sw); leg(0.25, -sw);
      m.box(T, 0, 1.0 * s, 0, 1.0 * s, 1.0 * s, 0.5 * s, look.shirt);
      m.box(frame(...apply(T, -0.72 * s, 2.0 * s, 0), c.yaw, -sw), 0, -0.95 * s, 0, 0.42 * s, 0.95 * s, 0.45 * s, look.skin);
      const AT = frame(...apply(T, 0.72 * s, 2.0 * s, 0), c.yaw, sw - chop * 2.2 - (look.axe ? 0.3 : 0));
      m.box(AT, 0, -0.95 * s, 0, 0.42 * s, 0.95 * s, 0.45 * s, look.skin);
      if (look.axe) { m.box(AT, 0, -0.95 * s, 0.45 * s, 0.12 * s, 0.12 * s, 1.0 * s, "#a8743c"); m.box(AT, 0, -1.15 * s, 0.85 * s, 0.1 * s, 0.45 * s, 0.3 * s, "#c9ced6"); }
      m.box(T, 0, 2.0 * s, 0, 0.62 * s, 0.62 * s, 0.62 * s, look.skin);
      // eyes and a mouth
      const f = 0.32 * s;
      m.box(T, -0.13 * s, 2.36 * s, f, 0.08 * s, 0.13 * s, 0.02, "#1b1b1b"); m.box(T, 0.13 * s, 2.36 * s, f, 0.08 * s, 0.13 * s, 0.02, "#1b1b1b");
      m.box(T, 0, 2.16 * s, f, look.scared ? 0.12 * s : 0.24 * s, look.scared ? 0.14 * s : 0.05 * s, 0.02, "#1b1b1b");
      if (look.hat) m.box(T, 0, 2.6 * s, -0.03 * s, 0.7 * s, 0.25 * s, 0.7 * s, look.hat);
    }
    function wolfMesh(m, w){
      const s = w.alpha ? 1.5 : 1, T = frame(w.x, 0, w.z, w.yaw, 0), leg = Math.sin(w.walk) * 0.5;
      const col = w.hit > 0 ? "#ffffff" : w.alpha ? "#3d3f46" : "#6d727a", dark = w.alpha ? "#24262b" : "#4a4e55";
      [[-0.3, 0.5, leg], [0.3, 0.5, -leg], [-0.3, -0.5, -leg], [0.3, -0.5, leg]].forEach(([x, z, a]) => m.box(frame(...apply(T, x * s, 0.6 * s, z * s), w.yaw, a), 0, -0.6 * s, 0, 0.22 * s, 0.6 * s, 0.22 * s, dark));
      m.box(T, 0, 0.55 * s, 0, 0.8 * s, 0.6 * s, 1.6 * s, col);
      m.box(T, 0, 0.8 * s, 1.0 * s, 0.6 * s, 0.55 * s, 0.6 * s, col);
      m.box(T, 0, 0.8 * s, 1.45 * s, 0.35 * s, 0.3 * s, 0.4 * s, dark);
      m.box(T, -0.2 * s, 1.35 * s, 1.0 * s, 0.14 * s, 0.25 * s, 0.14 * s, col); m.box(T, 0.2 * s, 1.35 * s, 1.0 * s, 0.14 * s, 0.25 * s, 0.14 * s, col);
      m.box(frame(...apply(T, 0, 1.0 * s, -0.8 * s), w.yaw, -2.2 + Math.sin(clock * 8) * 0.2), 0, 0, 0, 0.18 * s, 0.7 * s, 0.18 * s, col);
      const eye = w.alpha ? "#ff3030" : "#ffe14d";
      m.box(T, -0.15 * s, 1.12 * s, 1.31 * s, 0.1 * s, 0.08 * s, 0.02, eye, 1); m.box(T, 0.15 * s, 1.12 * s, 1.31 * s, 0.1 * s, 0.08 * s, 0.02, eye, 1);
    }
    // the Deer: very tall and thin, with huge antlers and glowing red eyes; it leans in when it charges
    function deerMesh(m, dr){
      const T = frame(dr.x, 0, dr.z, dr.yaw, 0), leg = Math.sin(dr.walk * 2) * 0.35, col = dr.stun > 0 ? "#5a3f2a" : "#2a1c14";
      [[-0.25, 0.45, leg], [0.25, 0.45, -leg], [-0.25, -0.45, -leg], [0.25, -0.45, leg]].forEach(([x, z, a]) => m.box(frame(...apply(T, x, 2.2, z), dr.yaw, a), 0, -2.2, 0, 0.16, 2.2, 0.16, col));
      m.box(T, 0, 2.1, 0, 0.7, 0.8, 1.4, col);
      const Nk = frame(...apply(T, 0, 2.7, 0.65), dr.yaw, dr.charge > 0 ? 0.35 : 0);
      m.box(Nk, 0, 0, 0, 0.35, 1.5, 0.35, col);
      m.box(Nk, 0, 1.4, 0.15, 0.5, 0.6, 0.75, col);
      [-1, 1].forEach(sd => {
        m.box(Nk, sd * 0.3, 1.95, 0.1, 0.08, 1.0, 0.08, col);
        m.box(Nk, sd * 0.6, 2.6, 0.1, 0.6, 0.08, 0.08, col);
        m.box(Nk, sd * 0.85, 2.6, 0.1, 0.08, 0.6, 0.08, col);
        m.box(Nk, sd * 0.45, 2.35, 0.1, 0.08, 0.45, 0.08, col);
        m.box(Nk, sd * 0.13, 1.7, 0.53, 0.12, 0.1, 0.02, "#ff2020", 1);
      });
    }
    function itemMesh(m, it){
      const bob = it.y > 0 ? it.y : 0.05 + Math.sin(clock * 3 + it.x) * 0.06, T = frame(it.x, bob, it.z, it.yaw + clock * 0.6, 0);
      switch (it.kind) {
        case "log": { const L = frame(it.x, 0.2 + (it.y || 0), it.z, it.yaw, Math.PI / 2); m.box(L, 0, -0.6, 0, 0.4, 1.2, 0.4, "#8a5a2b"); m.box(L, 0, 0.6, 0, 0.3, 0.01, 0.3, "#d9b27c"); break; }
        case "coal": m.box(T, 0, 0, 0, 0.5, 0.4, 0.45, "#2b2b30", 0.05); m.box(T, 0.15, 0.3, 0.1, 0.3, 0.25, 0.3, "#3a3a42", 0.05); break;
        case "berry": m.box(T, 0, 0, 0, 0.9, 0.6, 0.9, "#2f7d32"); [[-0.3, 0.6, 0.2], [0.25, 0.55, -0.2], [0, 0.65, 0.3], [0.3, 0.4, 0.35], [-0.2, 0.45, -0.38]].forEach(([x, y, z]) => m.box(T, x, y, z, 0.18, 0.18, 0.18, "#4d5bff", 0.15)); break;
        case "carrot": m.cone(T, 0, 0.1, 0, 0.18, 0.7, 6, "#ff8a1a", 0.05, true); m.cone(T, 0, 0.8, 0, 0.15, 0.4, 4, "#3fae4a"); break;
        case "meat": m.box(T, 0, 0, 0, 0.6, 0.35, 0.45, "#a33a2a"); m.box(T, 0, 0.12, 0.35, 0.12, 0.12, 0.4, "#f2f0e0"); break;
        case "scrap": m.box(T, 0, 0, 0, 0.45, 0.12, 0.45, "#8f9bb0", 0.12); m.box(T, 0.1, 0.12, 0, 0.12, 0.3, 0.12, "#b5bfd0", 0.12); m.box(frame(it.x, bob + 0.2, it.z, it.yaw - clock, 0.6), 0, 0, 0, 0.35, 0.08, 0.15, "#6f7b90", 0.12); break;
      }
    }
    function chestMesh(m, c){
      const T = frame(c.x, 0, c.z, c.yaw, 0), body = c.gold ? "#e0a800" : "#8a5a2b", trim = c.gold ? "#fff1a8" : "#c9ced6";
      const glow = c.open ? 0 : c.gold ? 0.35 : 0.1;
      m.box(T, 0, 0, 0, 1.2, 0.7, 0.8, body, glow);
      m.box(T, 0, 0.3, 0.41, 0.2, 0.2, 0.04, trim, glow);
      const L = frame(...apply(T, 0, 0.7, -0.4), c.yaw, -(c.open || 0) * 1.9);
      m.box(L, 0, 0, 0.4, 1.22, 0.3, 0.82, body, glow);
      m.box(L, 0, 0.3, 0.4, 1.0, 0.04, 0.1, trim, glow);
    }
    // a dome round the camera: coloured by height, with stars and the moon
    function sky(m, cx, cz){
      const R = 150, rings = 6, segs = 16, o = [0, 0, 0];
      for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
        const a0 = j / segs * 6.283, a1 = (j + 1) / segs * 6.283, e0 = i / rings * 1.5708 - 0.15, e1 = (i + 1) / rings * 1.5708 - 0.15;
        const P = (a, e) => [cx + Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, cz + Math.sin(a) * Math.cos(e) * R];
        const c0 = [0, i / rings, 0], c1 = [0, (i + 1) / rings, 0];
        m.v(P(a0, e0), o, c0, 2); m.v(P(a1, e0), o, c0, 2); m.v(P(a1, e1), o, c1, 2);
        m.v(P(a0, e0), o, c0, 2); m.v(P(a1, e1), o, c1, 2); m.v(P(a0, e1), o, c1, 2);
      }
      const r = rng(7), star = [1, 0.5, 0];
      for (let k = 0; k < 140; k++) {
        const a = r() * 6.283, e = 0.15 + r() * 1.3, s = 0.5 + r() * 0.6;
        const p = [cx + Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, cz + Math.sin(a) * Math.cos(e) * 140];
        m.v([p[0] - s, p[1], p[2]], o, star, 2); m.v([p[0], p[1] + s, p[2]], o, star, 2); m.v([p[0] + s, p[1], p[2]], o, star, 2);
        m.v([p[0] - s, p[1], p[2]], o, star, 2); m.v([p[0], p[1] - s, p[2]], o, star, 2); m.v([p[0] + s, p[1], p[2]], o, star, 2);
      }
      const mp = [cx + 90, 70, cz - 80], ms = 8, moon = [2, 0.5, 0];
      for (let k = 0; k < 12; k++) {
        const a0 = k / 12 * 6.283, a1 = (k + 1) / 12 * 6.283;
        m.v(mp, o, moon, 2); m.v([mp[0] + Math.cos(a0) * ms, mp[1] + Math.sin(a0) * ms, mp[2] + Math.cos(a0) * ms * 0.3], o, moon, 2); m.v([mp[0] + Math.cos(a1) * ms, mp[1] + Math.sin(a1) * ms, mp[2] + Math.cos(a1) * ms * 0.3], o, moon, 2);
      }
    }
    function buildDynamic(){
      const m = dyn; m.clear();
      sky(m, cam.eye[0], cam.eye[2]);
      const near = (x, z, r) => Math.hypot(x - me.x, z - me.z) < r;
      falling.forEach(f => treeMesh(m, f, frame(f.x, 0, f.z, f.yaw, f.p)));
      // a tree you're chopping wobbles (drawn again here, a little to the side)
      trees.forEach(t => { if (t.shake > 0 && t.hp > 0) treeMesh(m, t, frame(t.x + Math.sin(clock * 60) * 0.08, 0.002, t.z, 0, Math.sin(clock * 50) * 0.03)); });
      items.forEach(it => { if (near(it.x, it.z, 55)) itemMesh(m, it); });
      chests.forEach(c => { if (near(c.x, c.z, 55)) chestMesh(m, c); });
      kids.forEach(k => { if (near(k.x, k.z, 60)) person(m, k, { shirt: k.shirt, pants: "#3a3f55", skin: "#f5cd30", hat: k.hat, scared: k.state === "lost" }, 0.65); });
      wolves.forEach(w => wolfMesh(m, w));
      if (deer && deer.gone <= 0) deerMesh(m, deer);
      person(m, me, { shirt: "#1f6bff", pants: "#2fa84f", skin: "#f5cd30", hat: "#c8553d", axe: true });
      // the fire: logs, and flames that flicker and grow with the fire
      const F = frame(0, 0, 0, 0, 0);
      m.box(frame(0, 0.2, 0, 0.5, Math.PI / 2), 0, -0.9, 0, 0.35, 1.8, 0.35, "#4a2e18"); m.box(frame(0, 0.25, 0, -0.7, Math.PI / 2), 0, -0.9, 0, 0.35, 1.8, 0.35, "#4a2e18");
      const fl = S().fire / 100;
      if (fl > 0) {
        const n = 4 + Math.round(fl * 8);
        for (let i = 0; i < n; i++) {
          const a = i * 2.4 + clock * 1.3, ring = i % 3, r = (0.15 + ring * 0.18) * (0.6 + fl), hgt = (0.5 + fl * 1.6) * (0.6 + 0.4 * Math.sin(clock * 11 + i * 1.7)) * (1 - ring * 0.2);
          const col = ring === 0 ? "#ffe14d" : ring === 1 ? "#ff9f1a" : "#ff4d1a", w = 0.32 * (1 - ring * 0.2) * (0.7 + fl * 0.5);
          m.box(frame(Math.cos(a) * r, 0.2, Math.sin(a) * r, a, 0), 0, 0, 0, w, hgt, w, col, 1);
        }
      }
      embers.forEach(e => m.box(F, e.x, e.y, e.z, 0.07, 0.07, 0.07, e.life > 1 ? "#ffd04d" : "#ff7a1a", 1));
      // fireflies at night
      if (daylight() < 0.4) flies.forEach(f => { const a = f.a + clock * f.s; if (Math.sin(clock * 3 + f.ph * 5) > -0.3) m.box(F, Math.cos(a) * f.d, f.h + Math.sin(clock * 2 + f.ph) * 0.4, Math.sin(a) * f.d, 0.08, 0.08, 0.08, "#d9ff6b", 1); });
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.DYNAMIC_DRAW);
      return m.count;
    }

    /* ---------------- the camera ---------------- */
    let cam = { eye: [0, 4, 12], VP: new Float32Array(16), P5: 1 }, camPos = null;
    const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    function mul(a, b){ const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
    function placeCam(dt){
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
      const want = [me.x - sy * 6.5, 3.6, me.z - cy * 6.5];
      if (!camPos) camPos = want.slice();
      const k = Math.min(1, dt * 8);
      for (let i = 0; i < 3; i++) camPos[i] += (want[i] - camPos[i]) * k;
      const bob = me.moving ? Math.sin(me.walk) * (me.run ? 0.09 : 0.05) : 0, sh = Hub.lessMotion() ? 0 : shakeT * 0.6;
      const eye = [camPos[0] + (Math.random() - 0.5) * sh, camPos[1] + bob + (Math.random() - 0.5) * sh, camPos[2] + (Math.random() - 0.5) * sh];
      const target = [me.x + sy * 3, 1.5, me.z + cy * 3];
      const aspect = W / H, near = 0.1, far = 220, f = 1 / Math.tan((me.run ? FOV * 1.08 : FOV) / 2);
      const P = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
      const zz = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
      const xx = norm(cross([0, 1, 0], zz)), yy = cross(zz, xx);
      const V = [xx[0], yy[0], zz[0], 0, xx[1], yy[1], zz[1], 0, xx[2], yy[2], zz[2], 0, -dot(xx, eye), -dot(yy, eye), -dot(zz, eye), 1];
      cam = { eye, VP: mul(P, V), P5: f };
    }
    // where a point in the world shows up on the screen
    function project(x, y, z){
      const M = cam.VP, w = M[3] * x + M[7] * y + M[11] * z + M[15];
      if (w < 0.2) return null;
      const px = (M[0] * x + M[4] * y + M[8] * z + M[12]) / w, py = (M[1] * x + M[5] * y + M[9] * z + M[13]) / w;
      return { x: (px * 0.5 + 0.5) * W, y: (0.5 - py * 0.5) * H, s: H / 2 * cam.P5 / w, d: w };
    }

    function draw(dt){
      placeCam(dt);
      const st = S(), L = daylight(), N = 1 - L;
      if (staticDirty) buildStatic();
      const dynCount = buildDynamic();
      gl.viewport(0, 0, canvas.width, canvas.height);
      const fogC = [0.02 + 0.6 * L, 0.03 + 0.71 * L, 0.07 + 0.75 * L];
      gl.clearColor(fogC[0], fogC[1], fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.uVP, false, cam.VP);
      gl.uniform3fv(U.uCam, cam.eye);
      gl.uniform3f(U.uAmb, 0.05 + 0.42 * L, 0.06 + 0.43 * L, 0.11 + 0.4 * L);
      gl.uniform3fv(U.uSunDir, norm(L > 0 ? [0.4, 0.8, 0.3] : [-0.5, 0.7, -0.4]));
      gl.uniform3f(U.uSunCol, 0.1 + 0.65 * L, 0.12 + 0.58 * L, 0.2 + 0.4 * L);
      const fl = st.fire > 0 ? 1 + Math.sin(clock * 13) * 0.05 + Math.sin(clock * 7.3) * 0.04 : 0;
      gl.uniform3f(U.uFire, 0, 1.2, 0);
      gl.uniform3f(U.uFireCol, 1.0, 0.55, 0.2);
      gl.uniform1f(U.uFireR, Math.max(0.1, fireR() * fl));
      gl.uniform1f(U.uFireI, (st.fire > 0 ? 1 : 0) * (0.35 + 1.2 * N) * fl);
      gl.uniform3fv(U.uFog, fogC);
      gl.uniform1f(U.uFogD, (0.016 + 0.03 * N) * (fogNight ? 1.9 : 1));
      gl.uniform3f(U.uSkyLo, 0.05 + 0.75 * L, 0.07 + 0.82 * L, 0.16 + 0.78 * L);
      gl.uniform3f(U.uSkyHi, 0.01 + 0.36 * L, 0.02 + 0.6 * L, 0.06 + 0.82 * L);
      gl.uniform1f(U.uNight, N);
      gl.uniform1f(U.uTime, clock);
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
      gl.uniform1f(U.uLightOn, light && st.battery > 0 ? 1 : 0);
      gl.uniform3f(U.uLightPos, me.x + sy * 0.5, 1.5, me.z + cy * 0.5);
      // the beam looks a little wider than the bit that scares the Deer, so you can see where you're going
      gl.uniform3fv(U.uLightDir, norm([sy, -0.28, cy]));
      gl.uniform1f(U.uLightCos, Math.cos(st.up.light ? 0.6 : 0.45));
      gl.uniform1f(U.uLightRange, st.up.light ? 28 : 22);
      bindAttrs(staticBuf); gl.drawArrays(gl.TRIANGLES, 0, staticCount);
      bindAttrs(dynBuf); gl.drawArrays(gl.TRIANGLES, 0, dynCount);
      drawUi(dt);
    }

    /* ---------------- the things drawn over the 3D ---------------- */
    function bar(x, y, w, v, col, label){
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * v / 100), 10);
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(label, x + w + 6, y + 7);
    }
    const EMOJI_FONT = `system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    function drawUi(dt){
      const st = S(), N = 1 - daylight();
      ctx.clearRect(0, 0, W, H);
      // glowing eyes in the dark
      if (N > 0.3) {
        const glow = (x, y, z, col, r) => { const p = project(x, y, z); if (!p || p.d > 60) return; const R = r * p.s, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2); };
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = N;
        if (deer && deer.gone <= 0) { const n = [Math.sin(deer.yaw), Math.cos(deer.yaw)]; glow(deer.x + n[0] * 1.3, 4.3, deer.z + n[1] * 1.3, "rgba(255,40,40,0.9)", 0.6); }
        wolves.forEach(w => { const s = w.alpha ? 1.5 : 1, n = [Math.sin(w.yaw), Math.cos(w.yaw)]; glow(w.x + n[0] * 1.3 * s, 1.15 * s, w.z + n[1] * 1.3 * s, w.alpha ? "rgba(255,50,50,0.8)" : "rgba(255,225,80,0.7)", 0.35 * s); });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
      // red edges when the Deer is close, or when you get hurt
      if (scare > 0 || hurt > 0) {
        const a = Math.max(hurt * 0.6, scare * (0.35 + 0.25 * Math.sin(clock * (6 + scare * 8))));
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
        g.addColorStop(0, "rgba(120,0,0,0)"); g.addColorStop(1, `rgba(170,0,0,${a})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      fx.draw(ctx, dt);
      // health, hunger, fire, the flashlight and running
      ctx.fillStyle = "rgba(10,14,30,0.55)"; round(8, 8, 236, 132, 10); ctx.fill();
      bar(16, 16, 130, st.health, st.health < 30 ? "#ff4d4d" : "#6bd66b", "❤️ Health");
      bar(16, 36, 130, st.hunger, "#ffb347", "🍗 Hunger");
      bar(16, 56, 130, st.fire, "#ff7a1a", "🔥 Fire");
      bar(16, 76, 130, st.battery, "#ffe14d", light ? "🔦 ON" : "🔦 Light");
      bar(16, 96, 130, stamina, tired ? "#888888" : "#7fe3ff", "🏃 Run");
      ctx.font = "bold 13px system-ui"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`🧒 ${st.kids.length}/4 kids   ⚙️ ${st.scrap} scrap`, 16, 116);
      // the sack
      const n = capacity();
      ctx.fillStyle = "rgba(10,14,30,0.55)"; round(W - 18 - n * 30, 8, n * 30 + 10, 40, 10); ctx.fill();
      ctx.font = `20px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        const x = W - 13 - n * 30 + i * 30 + 15;
        ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x - 13, 14, 26, 28);
        if (st.sack[i]) { ctx.fillStyle = "#fff"; ctx.fillText(ITEM[st.sack[i]].em, x, 29); }
      }
      if (prompt) {
        ctx.font = "bold 18px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = ctx.measureText(prompt.text).width + 30;
        ctx.fillStyle = "rgba(10,14,30,0.7)"; round(W / 2 - w / 2, H - 58, w, 36, 10); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(prompt.text, W / 2, H - 40);
      }
      // which way the fire is, when you're far away
      const fd = Math.hypot(me.x, me.z);
      if (fd > 14) {
        const ang = Math.atan2(-me.x, -me.z) - me.yaw;
        ctx.save(); ctx.translate(W / 2, 74); ctx.rotate(-ang);
        ctx.fillStyle = "rgba(255,140,40,0.9)"; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 6); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.font = "bold 12px system-ui"; ctx.fillStyle = "#ffcf9f"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`🔥 ${Math.round(fd)}m`, W / 2, 92);
      }
    }
    function round(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function hud(){
      const st = S();
      nightEl.textContent = night() ? `🌙 Night ${st.night} / 99` : `☀️ Day ${st.night}`;
    }

    /* ---------------- the loop ---------------- */
    function fit(){
      const s = Fun.res(canvas.clientWidth, W, 2);
      const w = Math.round(W * s), h = Math.round(H * s);
      if (canvas.width !== w) { canvas.width = w; canvas.height = h; ui.width = w; ui.height = h; }
      ctx.setTransform(ui.width / W, 0, 0, ui.height / H, 0, 0);
    }
    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now;
      if (running) step(dt); else clock += dt;
      fit(); draw(dt); hud();
      requestAnimationFrame(loop);
    }
    function start(){
      if (!gl) return;
      running = true; panel.hidden = true;
      Fun.release(keys);
      if (stick) stick.reset();
      canvas.focus();
      tip.show("🪓 Chop trees (click or Space), grab the logs (E) and feed the fire!", 4500);
    }
    function pause(){
      if (!running) return;
      running = false; save();
      titleEl.textContent = "⏸ Paused";
      textEl.textContent = "Your mouse is free. The forest is waiting...";
      playBtn.textContent = "▶ Keep playing";
      panel.hidden = false;
    }
    function openGame(){
      open = true; running = false;
      Fun.screen(overlay, true);
      if (!gl && !initGL()) {
        titleEl.textContent = "🌲 99 Nights";
        textEl.textContent = "Sorry! This game needs 3D graphics (WebGL), and this browser doesn't have it turned on.";
        playBtn.hidden = true; panel.hidden = false;
        return;
      }
      const st = S();
      build();
      if (night()) startNight();
      me.x = 0; me.z = 5; me.yaw = Math.PI; light = false; hurt = 0; prompt = null; benchEl.hidden = true; camPos = null; stamina = 100; scare = 0;
      fx.clear();
      titleEl.textContent = "🌲 99 Nights";
      textEl.textContent = (st.night > 1 ? `Welcome back! Day ${st.night}. ` : "") +
        "Keep the campfire burning: chop trees and throw on logs. Loot chests, find food. At night, stay in the light! If the Deer 🦌 comes, shine your flashlight at it. Find the 4 lost kids and survive 99 nights!";
      playBtn.textContent = "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      if (open) save();
      open = false; running = false;
      Fun.screen(overlay, false);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    }

    /* ---------------- controls ---------------- */
    const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyA: "sleft", KeyD: "sright", ShiftLeft: "run", ShiftRight: "run" };
    let unlockedAt = 0;
    const looking = () => document.pointerLockElement === canvas;
    function toggleLight(){
      if (!running) return;
      if (!light && S().battery <= 2) { fx.pop("🔋 Empty! Charge it by the fire", W / 2, H * 0.6, "#ff9f43", 26); Fun.sfx.nope(); return; }
      light = !light; Fun.sfx.beep();
    }
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") {
        if (!benchEl.hidden) { benchEl.hidden = true; return; }
        if (looking() || performance.now() - unlockedAt < 400) { if (looking()) document.exitPointerLock(); return; }
        if (running) { pause(); return; }
        Hub.leave(); return;
      }
      if (!running) return;
      if (e.code === "KeyE") { e.preventDefault(); if (!e.repeat) act(); return; }
      if (e.code === "KeyQ") { e.preventDefault(); if (!e.repeat) eat(); return; }
      if (e.code === "KeyF") { e.preventDefault(); if (!e.repeat) toggleLight(); return; }
      if (e.code === "Space") { e.preventDefault(); swing(); return; }
      if (e.code === "KeyP") { pause(); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault(); keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => Fun.release(keys));
    document.addEventListener("pointerlockchange", () => {
      if (looking()) tip.show("🖱️ Press Esc to get your mouse back");
      else { unlockedAt = performance.now(); tip.hide(); }
    });
    let dragX = null;
    canvas.addEventListener("pointerdown", e => {
      if (!running) return;
      if (e.pointerType === "mouse") {
        if (!looking() && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {} }
        else swing();
        return;
      }
      dragX = e.clientX; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (looking()) { if (running) me.yaw += e.movementX * 0.0032; return; }
      if (dragX === null || !running) return;
      me.yaw += (e.clientX - dragX) / canvas.clientWidth * 4; dragX = e.clientX;
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { dragX = null; }));
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    host.querySelectorAll(".nf-touch [data-k]").forEach(btn => {
      const k = btn.dataset.k;
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (k === "act") { act(); return; }
        if (k === "axe") { swing(); return; }
        if (k === "eat") { eat(); return; }
        if (k === "light") { toggleLight(); return; }
        keys[k] = true;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { if (k in keys) keys[k] = false; }));
    });
    canvas.tabIndex = 0;
    stick = Fun.joystick(canvas.parentElement);
    $("nfCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("nfCloseBtn"));
    playBtn.addEventListener("click", start);

    // for tests: peek at the forest
    window.__forest = {
      state: () => { const st = S(); return { night: st.night, t: st.t, isNight: night(), fire: st.fire, health: st.health, hunger: st.hunger, sack: st.sack.slice(), scrap: st.scrap, kids: st.kids.slice(), me: [me.x, me.z, me.yaw], prompt: prompt && prompt.kind, wolves: wolves.length, deer: deer && { x: deer.x, z: deer.z, gone: deer.gone, charge: deer.charge }, trees: trees.length, falling: falling.length, chests: chests.length, items: items.length, light, gl: !!gl }; },
      put: (x, z, yaw) => { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; camPos = null; },
      time: t => { const st = S(), was = night(); st.t = t; if (!was && night()) startNight(); },
      nearestTree: () => { let b = null; trees.forEach(t => { if (t.hp > 0 && (!b || dist(t, me) < dist(b, me))) b = t; }); return b && { x: b.x, z: b.z }; },
      nearestChest: () => { let b = null; chests.forEach(c => { if (!c.open && (!b || dist(c, me) < dist(b, me))) b = c; }); return b && { x: b.x, z: b.z }; },
      kid: i => ({ x: kids[i].home.x, z: kids[i].home.z }), deerAt: (x, z) => { if (deer) { deer.x = x; deer.z = z; deer.gone = 0; deer.rest = 5; } },
      act, swing, eat, toggleLight
    };

    return { open: openGame, close: closeGame };
  }
})();
