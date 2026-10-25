/* Egg Heist: a game like Steal An Egg, one of the biggest games on Roblox.
   Eggs ride along a conveyor belt in the middle of the map. Buy them and get them home to your
   base, and they make money every second. Then the fun part: sneak into the other players' bases, grab their
   best one and run home with it before they catch you! They'll try the same on you, so lock your door and
   keep a bat handy. The engine (makeHeist) takes the things to collect as a config (EGG_GAME).
   Everything is drawn on a plain 2D canvas through a small 3D camera behind your blocky Roblox-style player. */
(function(){
  "use strict";
  const store = Hub.store;
  const money = n => "$" + (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : Math.floor(n).toLocaleString("en"));
  const REBIRTH_COST = 1000000;

  /* ---------------- the map ----------------
     The conveyor runs along z in the middle. Four bases, two on each side, open towards it.
     A base has its own little coordinates: u from the back wall (0) to the door (16), v from side to side (-9 to 9). */
  const BELT_HALF = 2.4, BELT_END = 46, BELT_SPEED = 3;
  const BASES = [
    { ox: -15, oz: -20, s: 1,  floor: "#4a7fd9" },
    { ox: -15, oz: 20,  s: 1,  floor: "#e0883a" },
    { ox: 15,  oz: -20, s: -1, floor: "#3fae5a" },
    { ox: 15,  oz: 20,  s: -1, floor: "#b8509e" }
  ];
  const toWorld = (B, u, v) => [B.ox + B.s * (u - 8), B.oz + v];
  const toLocal = (B, x, z) => [(x - B.ox) * B.s + 8, z - B.oz];
  const inside = (B, x, z) => { const [u, v] = toLocal(B, x, z); return u > 0.4 && u < 15.6 && v > -8.6 && v < 8.6; };
  const PEDESTALS = [[4, -7], [9.5, -7], [4, -4], [9.5, -4], [4, 4], [9.5, 4], [4, 7], [9.5, 7]];
  const LOCK_SPOT = [13.5, -6.5], SELL_SPOT = [13.5, 6.5];
  // the walls of a base, as boxes in world space (the door is a gap in the front wall)
  function wallBoxes(B){
    const parts = [[0, 0.4, -9, 9], [0, 16, -9, -8.6], [0, 16, 8.6, 9], [15.6, 16, -9, -3], [15.6, 16, 3, 9]];
    return parts.map(([u0, u1, v0, v1]) => {
      const [xa, za] = toWorld(B, u0, v0), [xb, zb] = toWorld(B, u1, v1);
      return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) };
    });
  }
  function doorBox(B){
    const [xa, za] = toWorld(B, 15.6, -3), [xb, zb] = toWorld(B, 16, 3);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) };
  }
  const darken = (hex, f) => "#" + [16, 8, 0].map(sh => Math.round(((parseInt(hex.slice(1), 16) >> sh) & 255) * f).toString(16).padStart(2, "0")).join("");
  BASES.forEach(B => { B.walls = wallBoxes(B); B.door = doorBox(B); B.wallCol = darken(B.floor, 0.7); });

  /* ---------------- Egg Heist: eggs that hatch into pets ---------------- */
  const EGG_GAME = {
    id: "egg-heist", key: "eggHeist", pfx: "eh", title: "Egg Heist", icon: "🥚", kind: "egg", hatch: true, walkHome: false,
    word: "egg", start: "chicken",
    bots: [["chicken", "duck", "frog", null, "bunny"], ["quail", "ice", null, "chicken", null, "lava"], ["duck", null, "galaxy", "frog"]],
    blurb: "Like Steal An Egg on Roblox: buy eggs, earn cash, and steal the best eggs from other players' bases!",
    intro: "Eggs ride along the belt in the middle. Walk up and press E to buy one, then carry it home: it makes money every second, and even more once it hatches! Then sneak into the other bases, STEAL their best eggs and run home before they catch you. Lock your door, and bonk thieves with your bat! 🏏",
    tip: "🥚 Buy eggs on the belt with E, then carry them home!",
    rarity: {
      common:    { name: "Common",    colour: "#e6e6e6", weight: 55 },
      uncommon:  { name: "Uncommon",  colour: "#5fd36b", weight: 22 },
      rare:      { name: "Rare",      colour: "#4da6ff", weight: 12 },
      epic:      { name: "Epic",      colour: "#c27bff", weight: 6 },
      legendary: { name: "Legendary", colour: "#ffc93c", weight: 3.2 },
      mythic:    { name: "Mythic",    colour: "#ff4d6d", weight: 1.4 },
      secret:    { name: "SECRET",    colour: "#ffffff", weight: 0.4, rainbow: true }
    },
    rank: ["common", "uncommon", "rare", "epic", "legendary", "mythic", "secret"],
    items: [
      { id: "chicken", name: "Chicken Egg",      r: "common",    price: 25,      income: 1,     shell: ["#fff8ec", "#e3d5bd"], pet: "🐥" },
      { id: "duck",    name: "Duck Egg",         r: "common",    price: 60,      income: 2,     shell: ["#eef9ff", "#b3d6ea"], pet: "🦆" },
      { id: "quail",   name: "Quail Egg",        r: "common",    price: 110,     income: 4,     shell: ["#f3e6d0", "#c9b08a"], spots: "#6b4a2a", pet: "🐦" },
      { id: "frog",    name: "Frog Egg",         r: "uncommon",  price: 300,     income: 9,     shell: ["#c4f7b0", "#5fbf4a"], spots: "#2f7a2a", pet: "🐸" },
      { id: "bunny",   name: "Bunny Egg",        r: "uncommon",  price: 550,     income: 15,    shell: ["#ffe6f2", "#ff9ccd"], stripes: "#ffffff", pet: "🐰" },
      { id: "ice",     name: "Ice Egg",          r: "rare",      price: 1400,    income: 34,    shell: ["#f0fdff", "#7fd8ff"], stripes: "#ffffff", pet: "🐧" },
      { id: "lava",    name: "Lava Egg",         r: "rare",      price: 2400,    income: 55,    shell: ["#ffb347", "#c62a00"], spots: "#ffe14d", pet: "🦎" },
      { id: "galaxy",  name: "Galaxy Egg",       r: "epic",      price: 7000,    income: 140,   shell: ["#7a6bff", "#1b1450"], stars: true, pet: "🦊" },
      { id: "ninja",   name: "Ninja Egg",        r: "epic",      price: 11000,   income: 210,   shell: ["#55555f", "#121218"], band: "#e8262b", pet: "🐼" },
      { id: "golden",  name: "Golden Egg",       r: "legendary", price: 30000,   income: 520,   shell: ["#fff4b8", "#d4a017"], shine: true, pet: "🦁" },
      { id: "dragon",  name: "Dragon Egg",       r: "legendary", price: 50000,   income: 800,   shell: ["#a8f27f", "#2e8b57"], spots: "#ffd84d", pet: "🐉" },
      { id: "rainbow", name: "Rainbow Egg",      r: "mythic",    price: 150000,  income: 2200,  rainbow: true, pet: "🦄" },
      { id: "robot",   name: "Robot Egg",        r: "mythic",    price: 240000,  income: 3300,  shell: ["#eef2f8", "#8a97ad"], bolts: true, pet: "🤖" },
      { id: "cosmic",  name: "Cosmic Egg",       r: "secret",    price: 800000,  income: 9000,  shell: ["#3a0f63", "#05010f"], stars: true, glow: "#c77dff", pet: "👽" },
      { id: "banana",  name: "Banana Disco Egg", r: "secret",    price: 1500000, income: 15000, shell: ["#fff36b", "#f2c200"], disco: true, pet: "🕺" }
    ],
    badges: [
      { id: "ehSteal",   icon: "🥷", name: "Egg Thief",  desc: "Steal an egg in Egg Heist",       test: g => (g.S().steals || 0) >= 1 },
      { id: "ehLegend",  icon: "🌟", name: "Legendary!", desc: "Own a Legendary egg (or better)", test: g => g.owns(d => g.rankOf(d) >= 4) },
      { id: "ehSecret",  icon: "🌌", name: "SECRET!!",   desc: "Own a Secret egg in Egg Heist",   test: g => g.owns(d => d.r === "secret") },
      { id: "ehRebirth", icon: "🔁", name: "Reborn",     desc: "Rebirth in Egg Heist",            test: g => (g.S().rebirths || 0) >= 1 }
    ]
  };

  makeHeist(EGG_GAME);

  function makeHeist(cfg){
    const S = () => (store[cfg.key] = store[cfg.key] || { cash: 100, slots: null, rebirths: 0, steals: 0, earned: 0 });
    const RARITY = cfg.rarity, RANK = cfg.rank, EGGS = cfg.items;
    const EGG = Object.fromEntries(EGGS.map(e => [e.id, e]));
    const HATCH_TIME = 60, HATCH_BOOST = 3;
    const rankOf = def => RANK.indexOf(def.r);
    const earnOf = slot => slot.def.income * (slot.hatched ? HATCH_BOOST : 1);
    const owns = test => (S().slots || []).some(s => s && EGG[s.id] && test(EGG[s.id]));
    const G = { S, owns, rankOf };
    Hub.register({
      id: cfg.id, section: "games", title: cfg.title, icon: cfg.icon, blurb: cfg.blurb,
      stat: () => S().earned ? `Earned ${money(S().earned)}` : "",
      badges: cfg.badges.map(b => ({ id: b.id, icon: b.icon, name: b.name, desc: b.desc, test: () => b.test(G) })),
      mount
    });

    function pickEgg(){
      let w = Math.random() * RANK.reduce((a, r) => a + RARITY[r].weight, 0);
      let r = RANK[0];
      for (const k of RANK) { w -= RARITY[k].weight; if (w <= 0) { r = k; break; } }
      const list = EGGS.filter(e => e.r === r);
      return list[Math.floor(Math.random() * list.length)];
    }

    function mount(host){
      const P = cfg.pfx;
      host.innerHTML = `
      <section class="game-screen eh-screen" id="${P}Overlay" hidden aria-label="${cfg.title}">
        <div class="game-box">
          <div class="game-hud">
            <h2>${cfg.icon} ${cfg.title}</h2>
            <span class="mono game-stat eh-cash" id="${P}Cash">$0</span>
            <span class="mono game-stat" id="${P}Income">+$0/s</span>
            <button class="btn ghost small eh-rebirth" id="${P}Rebirth" type="button" hidden>🔁 Rebirth</button>
            <button class="btn ghost small" id="${P}CloseBtn" type="button">✕ Exit</button>
          </div>
          <div class="game-stage">
            <canvas class="eh-canvas" id="${P}Canvas" width="960" height="540"></canvas>
            <div class="game-panel eh-panel" id="${P}Panel">
              <div class="game-panel-title" id="${P}Title">${cfg.icon} ${cfg.title}</div>
              <div class="game-panel-text" id="${P}Text"></div>
              <button class="btn" id="${P}PlayBtn" type="button">▶ Play</button>
            </div>
          </div>
          <div class="game-help">W A S D to walk · ← → or the mouse to turn (click the game to use the mouse, Esc to let go) · E to buy, steal, lock or sell · click or F to swing your bat · Space to jump</div>
          <div class="game-touch eh-touch">
            <button class="btn ghost fun-dpad" data-k="left" type="button" aria-label="Turn left">↶</button>
            <button class="btn ghost fun-dpad" data-k="up" type="button" aria-label="Walk">▲</button>
            <button class="btn ghost fun-dpad" data-k="down" type="button" aria-label="Back">▼</button>
            <button class="btn ghost fun-dpad" data-k="right" type="button" aria-label="Turn right">↷</button>
            <button class="btn" data-k="act" type="button" aria-label="Action">E</button>
            <button class="btn" data-k="bat" type="button" aria-label="Swing the bat">🏏</button>
          </div>
        </div>
      </section>`;
      const $ = id => document.getElementById(id);
      const overlay = $(P + "Overlay"), canvas = $(P + "Canvas"), ctx = canvas.getContext("2d");
      const panel = $(P + "Panel"), titleEl = $(P + "Title"), textEl = $(P + "Text"), playBtn = $(P + "PlayBtn");
      const cashEl = $(P + "Cash"), incomeEl = $(P + "Income"), rebirthBtn = $(P + "Rebirth");
      const W = 960, H = 540, FOC = 560, NEAR = 0.4;
      const fx = Fun.pops(), tip = Fun.hint(canvas.parentElement);

      let open = false, running = false, last = 0, clock = 0, saveT = 0;
      let chars = [], belt = [], beltT = 0, bases = [], walkers = [];   // walkers: things you bought walking home by themselves (when cfg.walkHome)
      let me = null, prompt = null, msg = null;
      const keys = { up: false, down: false, left: false, right: false, sleft: false, sright: false, jump: false };
      const stick = Fun.joystick(canvas.parentElement);   // on phones: push up to walk, sideways to turn

      /* ---------------- people: you and three robot players ---------------- */
      const LOOKS = [
        { name: "You",              head: "#f5cd30", shirt: "#1f6bff", pants: "#2fa84f", hat: null },
        { name: "BaconHair_77",     head: "#f2c49b", shirt: "#ff7a1a", pants: "#3a3f55", hat: "#6b3a1a" },
        { name: "xX_NoobSlayer_Xx", head: "#f5cd30", shirt: "#1b1d24", pants: "#d62b2b", hat: "#d62b2b" },
        { name: "Guest_1337",       head: "#f2c49b", shirt: "#f2f2f2", pants: "#2a2d34", hat: "#2a2d34" }
      ];
      function newChar(i){
        const B = bases[i], [x, z] = toWorld(B, 12, 0);
        return { i, look: LOOKS[i], x, z, y: 0, vy: 0, yaw: B.s > 0 ? Math.PI / 2 : -Math.PI / 2, walk: 0, moving: false,
          carry: null, bat: 0, stun: 0, path: [], plan: null, think: 2 + Math.random() * 3, speed: i ? 6.2 : 7.2, cd: 0 };
      }
      function newBase(i, saved){
        const B = BASES[i];
        return { ...B, owner: i, slots: PEDESTALS.map((p, k) => {
          const s = saved && saved[k];
          return s && EGG[s.id] ? { def: EGG[s.id], hatched: !!s.hatched, hatchT: s.hatchT || HATCH_TIME, cash: 0 } : null;
        }), locked: 0, lockCd: 0, cash: 0 };
      }
      const egg = (id, hatched) => ({ id, hatched: !!hatched, hatchT: HATCH_TIME });
      function reset(){
        const st = S();
        if (!Array.isArray(st.slots)) st.slots = [egg(cfg.start)];
        bases = [newBase(0, st.slots),
          ...cfg.bots.map((list, k) => newBase(k + 1, list.map(id => id && egg(id))))];
        // the robots get better eggs as you get richer, so there's always something worth stealing
        const best = Math.max(0, ...bases[0].slots.filter(Boolean).map(s => rankOf(s.def)));
        bases.slice(1).forEach((b, k) => {
          const r = Math.min(6, best + (k === 2 ? 1 : 0));
          if (r > 2) { const list = EGGS.filter(e => rankOf(e) === r); b.slots[7] = { def: list[k % list.length], hatched: false, hatchT: HATCH_TIME, cash: 0 }; }
          b.cash = 300 * (1 + best);
        });
        chars = [0, 1, 2, 3].map(newChar);
        me = chars[0];
        belt = [];
        for (let z = -BELT_END; z < BELT_END; z += 6) belt.push({ def: pickEgg(), z });
        fx.clear(); msg = null; homeBefore = true; walkers = [];
      }
      function save(){
        S().slots = bases[0].slots.map(s => s ? { id: s.def.id, hatched: s.hatched, hatchT: Math.round(s.hatchT) } : null);
        Hub.saveStore();
      }
      const incomeOf = b => b.slots.reduce((a, s) => a + (s ? earnOf(s) : 0), 0) * (b.owner === 0 ? 1 + (S().rebirths || 0) * 0.5 : 1);

      /* ---------------- moving about ---------------- */
      function pushOut(c, box){
        const r = 0.45;
        const nx = Math.max(box.x0, Math.min(box.x1, c.x)), nz = Math.max(box.z0, Math.min(box.z1, c.z));
        const dx = c.x - nx, dz = c.z - nz, d = Math.hypot(dx, dz);
        if (d >= r) return;
        if (d > 1e-6) { c.x = nx + dx / d * r; c.z = nz + dz / d * r; }
        else { // right inside: push out the short way
          const opts = [[box.x0 - r - c.x, 0], [box.x1 + r - c.x, 0], [0, box.z0 - r - c.z], [0, box.z1 + r - c.z]];
          const [mx, mz] = opts.reduce((a, b) => Math.abs(a[0]) + Math.abs(a[1]) < Math.abs(b[0]) + Math.abs(b[1]) ? a : b);
          c.x += mx; c.z += mz;
        }
      }
      function collide(c){
        bases.forEach(b => {
          b.walls.forEach(w => pushOut(c, w));
          if (b.locked > 0 && b.owner !== c.i) pushOut(c, b.door);   // a locked door: only the owner gets through
        });
        c.x = Math.max(-48, Math.min(48, c.x)); c.z = Math.max(-48, Math.min(48, c.z));
      }
      function stepChar(c, dt, mx, mz){
        c.stun = Math.max(0, c.stun - dt); c.bat = Math.max(0, c.bat - dt); c.cd = Math.max(0, c.cd - dt);
        const sp = c.stun > 0 ? 0 : c.speed * (c.carry ? 0.72 : 1);
        c.moving = (mx || mz) && sp > 0;
        c.x += mx * sp * dt; c.z += mz * sp * dt;
        if (c.moving) c.walk += dt * 9;
        collide(c);
        c.vy -= 30 * dt; c.y = Math.max(0, c.y + c.vy * dt); if (c.y === 0) c.vy = 0;
      }
      // walk along a list of points (through base doors)
      function routeTo(c, x, z){
        const pts = [];
        const from = bases.find(b => inside(b, c.x, c.z)), to = bases.find(b => inside(b, x, z));
        if (from && from !== to) { pts.push(toWorld(from, 13, 0), toWorld(from, 19, 0)); }
        if (to && to !== from) { pts.push(toWorld(to, 19, 0), toWorld(to, 13, 0)); }
        pts.push([x, z]);
        c.path = pts;
      }
      function followPath(c, dt){
        if (!c.path.length) { stepChar(c, dt, 0, 0); return true; }
        const [tx, tz] = c.path[0], dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { c.path.shift(); return !c.path.length; }
        const want = Math.atan2(dx, dz);
        c.yaw += Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)) * Math.min(1, dt * 8);
        stepChar(c, dt, dx / d, dz / d);
        return false;
      }

      /* ---------------- buying, stealing, placing ---------------- */
      // a free pedestal (one something is already walking to doesn't count)
      function emptySlot(b){ return b.slots.findIndex((s, i) => !s && !(b.owner === 0 && walkers.some(w => w.k === i))); }
      function placeAt(b, k, carry){ b.slots[k] = { def: carry.def, hatched: carry.hatched, hatchT: carry.hatchT, cash: 0 }; }
      function say(c, text, colour){ const p = proj(c.x, c.y + 3.6, c.z); if (p) fx.pop(text, p.x, p.y, colour || "#ffffff", 20); }
      // a stolen egg goes back where it came from
      function returnCarry(c){
        const k = c.carry;
        if (k.from) { const b = bases[k.from.b]; if (!b.slots[k.from.k]) placeAt(b, k.from.k, k); else { const e = emptySlot(b); if (e >= 0) placeAt(b, e, k); } }
        c.carry = null;
      }
      function act(){
        if (!running || me.stun > 0) return;
        const p = prompt;
        if (!p || !p.ok) { if (p && p.why) { msg = { text: p.why, t: 1.6 }; Fun.sfx.nope(); } return; }
        const st = S(), home = bases[0];
        if (p.kind === "buy") {
          st.cash -= p.egg.def.price;
          belt.splice(belt.indexOf(p.egg), 1);
          const col = RARITY[p.egg.def.r].rainbow ? "#ffe14d" : RARITY[p.egg.def.r].colour;
          if (cfg.walkHome) {
            // with cfg.walkHome it hops off the belt and walks home to a free pedestal by itself
            const w = { i: 0, x: Math.sign(me.x || 1) * (BELT_HALF + 0.4), z: p.egg.z, y: 0, vy: 0, yaw: 0, walk: 0, moving: false, carry: null,
              bat: 0, stun: 0, cd: 0, speed: 5.5, path: [], def: p.egg.def, k: emptySlot(home) };
            const [hx, hz] = toWorld(home, ...PEDESTALS[w.k]);
            routeTo(w, hx, hz);
            walkers.push(w);
            Fun.sfx.coin(); say(me, `Bought! ${p.egg.def.name} is walking home 🚶`, col);
          } else {
            me.carry = { def: p.egg.def, hatched: false, hatchT: HATCH_TIME, from: null };
            Fun.sfx.coin(); say(me, `Bought! ${p.egg.def.name}`, col);
          }
        } else if (p.kind === "steal") {
          const b = bases[p.b], s = b.slots[p.k];
          me.carry = { def: s.def, hatched: s.hatched, hatchT: s.hatchT, from: { b: p.b, k: p.k } };
          b.slots[p.k] = null;
          Fun.sfx.whoosh(); say(me, "GRABBED IT! RUN! 🏃", "#ffe14d");
          const owner = chars[p.b];
          say(owner, [`MY ${cfg.word.toUpperCase()}!!`, "HEY!! 😡", "come back!!", "THIEF!!"][Math.floor(Math.random() * 4)], "#ff8a8a");
          owner.plan = { kind: "chase" }; owner.think = 0;
        } else if (p.kind === "pick") {
          const s = home.slots[p.k];
          me.carry = { def: s.def, hatched: s.hatched, hatchT: s.hatchT, from: null, wait: 1.2 };
          st.cash += Math.floor(s.cash); home.slots[p.k] = null;
          msg = { text: "Put it on another pedestal, or take it to the 💲 pad to sell it", t: 2.5 };
          Fun.sfx.pop();
        } else if (p.kind === "lock") {
          home.locked = 30; home.lockCd = 60;
          Fun.sfx.beep(); say(me, "🔒 Base locked!", "#7fe3ff");
        }
        save();
      }
      function swing(){
        if (!running || me.bat > 0 || me.stun > 0) return;
        me.bat = 0.35;
        Fun.sfx.whoosh();
        const fxx = Math.sin(me.yaw), fzz = Math.cos(me.yaw);
        chars.forEach(c => {
          if (c === me) return;
          const dx = c.x - me.x, dz = c.z - me.z, d = Math.hypot(dx, dz);
          if (d > 2.6 || (dx * fxx + dz * fzz) / (d || 1) < 0.3) return;
          c.stun = 1.6; c.x += dx / d * 1.6; c.z += dz / d * 1.6; c.vy = 7; collide(c);
          Fun.sfx.bonk(); Fun.sfx.oof();
          say(c, ["OOF!", "ow!!", "hey!", "not fair 😭"][Math.floor(Math.random() * 4)], "#ffb3a8");
          if (c.carry) { say(c, "dropped it!", "#ffe14d"); returnCarry(c); c.plan = null; }
        });
      }

      // what's in reach right now, shown as a Roblox-style "E" prompt
      function findPrompt(){
        const st = S(), home = bases[0];
        let best = null, bestD = 2.6;
        const consider = (d, p) => { if (d < bestD) { bestD = d; best = p; } };
        if (!me.carry) {
          belt.forEach(e => {
            const d = Math.hypot(me.x, me.z - e.z) - 1.2;
            const full = cfg.walkHome && emptySlot(bases[0]) < 0;
            if (Math.abs(me.x) < BELT_HALF + 2.2) consider(Math.max(0, d), { kind: "buy", egg: e, x: 0, z: e.z, ok: st.cash >= e.def.price && !full,
              label: `Buy ${e.def.name}`, sub: money(e.def.price), why: full ? `Your base is full! Sell a ${cfg.word} on the 💲 pad first` : `Not enough cash! You need ${money(e.def.price)}` });
          });
          bases.forEach(b => b.slots.forEach((s, k) => {
            if (!s) return;
            const [x, z] = toWorld(b, ...PEDESTALS[k]), d = Math.hypot(me.x - x, me.z - z);
            if (b.owner === 0) consider(d + 0.3, { kind: "pick", k, x, z, ok: true, label: "Pick up", sub: s.def.name });
            else consider(d, { kind: "steal", b: b.owner, k, x, z, ok: true, label: "STEAL", sub: s.def.name });
          }));
        }
        const [lx, lz] = toWorld(home, ...LOCK_SPOT);
        consider(Math.hypot(me.x - lx, me.z - lz), { kind: "lock", x: lx, z: lz, ok: home.lockCd <= 0, label: home.locked > 0 ? `Locked ${Math.ceil(home.locked)}s` : "Lock base",
          sub: home.lockCd > 0 ? `ready in ${Math.ceil(home.lockCd)}s` : "30 seconds", why: "The lock needs a little rest first" });
        return best;
      }

      /* ---------------- the robot players ---------------- */
      function think(c){
        const b = bases[c.i], home = bases[0];
        c.think = 1.5 + Math.random() * 2;
        if (c.plan && c.plan.kind === "chase") return;
        // sometimes they come for YOUR eggs (not too often, and only once you have a few)
        const mine = home.slots.filter(Boolean).length;
        const stealing = chars.some(o => o !== c && o.plan && o.plan.kind === "steal");
        if (!c.carry && mine >= 2 && home.locked <= 0 && !stealing && Math.random() < 0.09) {
          const k = home.slots.reduce((bk, s, i) => s && (bk < 0 || earnOf(s) > earnOf(home.slots[bk])) ? i : bk, -1);
          const [x, z] = toWorld(home, ...PEDESTALS[k]);
          c.plan = { kind: "steal", k }; routeTo(c, x, z);
          say(c, ["hehe 😈", `nice ${cfg.word} you got there`, "*sneaks*", "brb"][Math.floor(Math.random() * 4)], "#ffffff");
          return;
        }
        // or buy one off the belt
        if (!c.carry && emptySlot(b) >= 0) {
          const afford = belt.filter(e => e.def.price <= b.cash && e.z < 20);
          if (afford.length) {
            const e = afford.reduce((a, x) => x.def.price > a.def.price ? x : a);
            c.plan = { kind: "buy", egg: e }; routeTo(c, Math.sign(b.ox) * (BELT_HALF + 0.9), e.z + 2);
            return;
          }
        }
        // or lock up when you're sniffing around
        if (b.locked <= 0 && b.lockCd <= 0 && inside(b, me.x, me.z) === false && Math.hypot(me.x - b.ox, me.z - b.oz) < 16 && Math.random() < 0.35) {
          b.locked = 20; b.lockCd = 50; say(c, "🔒 locked lol", "#7fe3ff");
        }
        // otherwise wander about at home
        const [x, z] = toWorld(b, 6 + Math.random() * 8, (Math.random() - 0.5) * 12);
        c.plan = { kind: "wander" }; routeTo(c, x, z);
      }
      function stepBot(c, dt){
        const b = bases[c.i], home = bases[0];
        if (c.stun > 0) { stepChar(c, dt, 0, 0); return; }
        const plan = c.plan;
        if (plan && plan.kind === "chase") {
          // you have their egg: chase you down!
          if (!me.carry || !me.carry.from || me.carry.from.b !== c.i) { c.plan = null; c.think = 1; stepChar(c, dt, 0, 0); return; }
          if (!c.path.length || Math.hypot(c.path[c.path.length - 1][0] - me.x, c.path[c.path.length - 1][1] - me.z) > 3) routeTo(c, me.x, me.z);
          c.speed = 6.9;
          followPath(c, dt);
          if (Math.hypot(c.x - me.x, c.z - me.z) < 1.1 && me.stun <= 0) {
            returnCarry(me); me.stun = 0.8; me.vy = 6;
            Fun.sfx.oof(); Fun.shake(canvas);
            say(me, "OOF!", "#ff8a8a"); say(c, ["got it back 😤", "nice try!", "mine!!"][Math.floor(Math.random() * 3)], "#ffffff");
            c.plan = null; c.speed = 6.2; c.think = 2;
          }
          return;
        }
        c.speed = 6.2;
        if (plan && plan.kind === "buy") {
          if (!belt.includes(plan.egg)) { c.plan = null; stepChar(c, dt, 0, 0); return; }
          // walk alongside the belt to the egg
          c.path = [[Math.sign(b.ox) * (BELT_HALF + 0.9), plan.egg.z + 0.6]];
          followPath(c, dt);
          if (Math.hypot(c.x - Math.sign(b.ox) * (BELT_HALF + 0.9), c.z - plan.egg.z) < 1.6 && b.cash >= plan.egg.def.price) {
            b.cash -= plan.egg.def.price;
            c.carry = { def: plan.egg.def, hatched: false, hatchT: HATCH_TIME, from: null };
            belt.splice(belt.indexOf(plan.egg), 1);
            if (rankOf(plan.egg.def) >= 2) say(c, ["ez 😎", "LETS GOOO", "yesss"][Math.floor(Math.random() * 3)], RARITY[plan.egg.def.r].colour);
            const [x, z] = toWorld(b, 12, 0); c.plan = { kind: "home" }; routeTo(c, x, z);
          }
          return;
        }
        if (plan && plan.kind === "steal") {
          if (home.locked > 0 && !inside(home, c.x, c.z)) { c.plan = null; say(c, "aw, locked 😒"); return; }
          const done = followPath(c, dt);
          if (done || Math.hypot(...[c.x, c.z].map((v, i) => v - toWorld(home, ...PEDESTALS[plan.k])[i])) < 1.2) {
            const s = home.slots[plan.k];
            if (!s) { c.plan = null; return; }
            c.carry = { def: s.def, hatched: s.hatched, hatchT: s.hatchT, from: { b: 0, k: plan.k } };
            home.slots[plan.k] = null; save();
            msg = { text: `😱 ${c.look.name} stole your ${s.def.name}! Bonk them with your bat!`, t: 3.5 };
            Fun.sfx.nope(); tip.show(`🏏 ${c.look.name} has your ${s.def.name}! Chase them and swing your bat!`, 4000);
            const [x, z] = toWorld(b, 12, 0); c.plan = { kind: "escape" }; routeTo(c, x, z);
          }
          return;
        }
        if (plan && (plan.kind === "home" || plan.kind === "escape")) {
          if (followPath(c, dt) || inside(b, c.x, c.z) && !c.path.length) {
            if (c.carry) {
              const k = emptySlot(b);
              if (k >= 0) placeAt(b, k, c.carry);
              if (plan.kind === "escape") { say(c, "MINE NOW 😂", "#ff8a8a"); msg = { text: `💔 ${c.look.name} got away with your ${cfg.word}. Steal it back!`, t: 3 }; Fun.sfx.wah(); }
              c.carry = null;
            }
            c.plan = null;
          }
          return;
        }
        if (plan && plan.kind === "wander") { if (followPath(c, dt)) c.plan = null; return; }
        stepChar(c, dt, 0, 0);
        c.think -= dt;
        if (c.think <= 0) think(c);
      }

      /* ---------------- one step of the game ---------------- */
      function step(dt){
        const st = S();
        clock += dt;
        // the belt
        belt.forEach(e => { e.z += BELT_SPEED * dt; });
        belt = belt.filter(e => e.z < BELT_END);
        beltT -= dt;
        if (beltT <= 0) { beltT = 2; belt.push({ def: pickEgg(), z: -BELT_END }); }
        // eggs make money and slowly hatch
        bases.forEach(b => {
          b.locked = Math.max(0, b.locked - dt); b.lockCd = Math.max(0, b.lockCd - dt);
          const mult = b.owner === 0 ? 1 + (st.rebirths || 0) * 0.5 : 1;
          b.slots.forEach((s, k) => {
            if (!s) return;
            if (b.owner === 0) s.cash += earnOf(s) * mult * dt; else b.cash += earnOf(s) * dt;
            if (cfg.hatch && !s.hatched && (s.hatchT -= dt) <= 0) {
              s.hatched = true;
              if (b.owner === 0) { const [x, z] = toWorld(b, ...PEDESTALS[k]), p = proj(x, 2.5, z); if (p) fx.pop(`🐣 Hatched! ${s.def.pet}`, p.x, p.y, "#ffe14d", 26); Fun.sfx.ding(); }
            }
          });
        });
        // you
        const turn = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (stick.on ? stick.x : 0)) * 2.6 * dt;
        me.yaw += turn;
        let f = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), sd = (keys.sright ? 1 : 0) - (keys.sleft ? 1 : 0);
        if (stick.on && Math.abs(stick.y) > 0.2) f = -stick.y;
        let mx = Math.sin(me.yaw) * f + Math.cos(me.yaw) * sd, mz = Math.cos(me.yaw) * f - Math.sin(me.yaw) * sd;
        const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
        if (keys.jump && me.y === 0 && me.stun <= 0) { me.vy = 9; Fun.sfx.pop(); }
        stepChar(me, dt, mx, mz);
        const home = bases[0];
        // walking over your pedestals collects their cash
        home.slots.forEach((s, k) => {
          if (!s || s.cash < 1) return;
          const [x, z] = toWorld(home, ...PEDESTALS[k]);
          if (Math.hypot(me.x - x, me.z - z) < 1.3) {
            const got = Math.floor(s.cash); s.cash -= got; st.cash += got; st.earned = (st.earned || 0) + got;
            const p = proj(x, 2.4, z); if (p) fx.pop(`+${money(got)}`, p.x, p.y, "#7bd68a", 24); Fun.sfx.coin();
          }
        });
        // carrying an egg home puts it on a free pedestal; carrying one onto the $ pad sells it
        if (me.carry) me.carry.wait = Math.max(0, (me.carry.wait || 0) - dt);
        const isHome = inside(home, me.x, me.z), wasHome = homeBefore; homeBefore = isHome;
        if (me.carry && isHome) {
          const [sx, sz] = toWorld(home, ...SELL_SPOT);
          if (Math.hypot(me.x - sx, me.z - sz) < 1.4) {
            const got = Math.floor(me.carry.def.price * 0.5); st.cash += got; st.earned = (st.earned || 0) + got;
            fx.pop(`Sold! +${money(got)}`, W / 2, H * 0.4, "#7bd68a", 30); Fun.sfx.coin(); me.carry = null; save();
          } else {
            // coming in through the door puts it on the first free pedestal; inside, walk up to a free one
            const near = home.slots.findIndex((s, i) => !s && Math.hypot(me.x - toWorld(home, ...PEDESTALS[i])[0], me.z - toWorld(home, ...PEDESTALS[i])[1]) < 1.6);
            const k = me.carry.wait > 0 ? -2 : !wasHome ? emptySlot(home) : near;
            if (k >= 0) {
              const stolen = !!me.carry.from;
              placeAt(home, k, me.carry); me.carry = null;
              if (stolen) { st.steals = (st.steals || 0) + 1; fx.pop("STOLEN! 😎", W / 2, H * 0.4, "#ffe14d", 44); Fun.sfx.tada(); }
              else Fun.sfx.thunk();
              save(); Hub.checkBadges();
            } else if (k === -1 && emptySlot(home) < 0 && (msgT -= dt) <= 0) { msgT = 3; msg = { text: `Your base is full! Carry a ${cfg.word} to the 💲 pad to sell it.`, t: 2.5 }; }
          }
        }
        // the robots
        chars.forEach(c => { if (c !== me) stepBot(c, dt); });
        // things walking home
        walkers = walkers.filter(w => {
          if (!followPath(w, dt)) return true;
          placeAt(home, w.k, { def: w.def, hatched: false, hatchT: HATCH_TIME });
          const p = proj(w.x, 2.6, w.z); if (p) fx.pop("🏠 Home!", p.x, p.y, "#7bd68a", 22);
          Fun.sfx.thunk(); save();
          return false;
        });
        prompt = findPrompt();
        if (msg && (msg.t -= dt) <= 0) msg = null;
        if ((saveT += dt) > 4) { saveT = 0; save(); }
        rebirthBtn.hidden = st.cash < REBIRTH_COST;
      }
      let msgT = 0, homeBefore = true;

      /* ---------------- the camera and drawing ---------------- */
      let cam = { x: 0, y: 0, z: 0, R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, 1] };
      function placeCam(){
        const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
        const cx = me.x - sy * 8.5, cz = me.z - cy * 8.5, ch = 5.6 + me.y * 0.4;
        const tx = me.x + sy * 4, ty = 1.3, tz = me.z + cy * 4;
        let F = [tx - cx, ty - ch, tz - cz]; const l = Math.hypot(...F); F = F.map(v => v / l);
        const R = [cy, 0, -sy];
        const U = [F[1] * R[2] - F[2] * R[1], F[2] * R[0] - F[0] * R[2], F[0] * R[1] - F[1] * R[0]];
        cam = { x: cx, y: ch, z: cz, R, U, F };
      }
      function camSpace(x, y, z){
        const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
        return [dx * cam.R[0] + dy * cam.R[1] + dz * cam.R[2], dx * cam.U[0] + dy * cam.U[1] + dz * cam.U[2], dx * cam.F[0] + dy * cam.F[1] + dz * cam.F[2]];
      }
      function proj(x, y, z){
        const q = camSpace(x, y, z);
        if (q[2] < NEAR) return null;
        return { x: W / 2 + q[0] * FOC / q[2], y: H / 2 - q[1] * FOC / q[2], s: FOC / q[2], d: q[2] };
      }
      // a flat shape in the world, cut where it goes behind the camera
      function path3(pts){
        const q = pts.map(p => camSpace(p[0], p[1], p[2])), out = [];
        for (let i = 0; i < q.length; i++) {
          const a = q[i], b = q[(i + 1) % q.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
          if (ain) out.push(a);
          if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
        }
        if (out.length < 3) return false;
        ctx.beginPath();
        out.forEach((p, i) => { const sx = W / 2 + p[0] * FOC / p[2], sy = H / 2 - p[1] * FOC / p[2]; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
        ctx.closePath();
        return true;
      }
      function quad(pts, fill, stroke){ if (!path3(pts)) return; ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } }
      const shadeCache = new Map();
      function shade(hex, f){
        const key = hex + f;
        if (!shadeCache.has(key)) {
          const n = parseInt(hex.slice(1), 16), c = v => Math.min(255, Math.round(v * f));
          shadeCache.set(key, `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`);
        }
        return shadeCache.get(key);
      }
      // a box (turned by yaw round its middle), only the faces that face the camera
      function box(cx, y0, cz, w, h, d, colour, yaw, onFront){
        const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
        const P = (lx, ly, lz) => [cx + lx * c + lz * s, y0 + ly, cz - lx * s + lz * c];
        const X = [-w / 2, w / 2], Y = [0, h], Z = [-d / 2, d / 2];
        const faces = [
          { n: [1, 0, 0], q: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], l: 0.78 }, { n: [-1, 0, 0], q: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]], l: 0.7 },
          { n: [0, 1, 0], q: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], l: 1 }, { n: [0, -1, 0], q: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], l: 0.5 },
          { n: [0, 0, 1], q: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]], l: 0.88, front: true }, { n: [0, 0, -1], q: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], l: 0.82 }
        ];
        faces.forEach(f => {
          const wn = [f.n[0] * c + f.n[2] * s, f.n[1], -f.n[0] * s + f.n[2] * c];
          const mid = P(f.n[0] ? X[(f.n[0] + 1) / 2] : 0, f.n[1] ? Y[(f.n[1] + 1) / 2] : h / 2, f.n[2] ? Z[(f.n[2] + 1) / 2] : 0);
          if (wn[0] * (cam.x - mid[0]) + wn[1] * (cam.y - mid[1]) + wn[2] * (cam.z - mid[2]) <= 0) return;
          if (!path3(f.q.map(([i, j, k]) => P(X[i], Y[j], Z[k])))) return;
          ctx.fillStyle = shade(colour, f.l); ctx.fill();
          ctx.strokeStyle = shade(colour, f.l * 0.75); ctx.lineWidth = 1; ctx.stroke();
          if (f.front && onFront) onFront(P, w, h, d);
        });
      }

      // a blocky Roblox-style person
      function drawChar(c){
        const L = c.look, sw = c.moving ? Math.sin(c.walk) * 0.35 : 0, y = c.y;
        const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
        const at = (lx, lz) => [c.x + lx * cy + lz * sy, c.z - lx * sy + lz * cy];
        const shadow = proj(c.x, 0.02, c.z);
        if (shadow) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 0.7 * shadow.s, 0.25 * shadow.s, 0, 0, 7); ctx.fill(); }
        const batUp = c.bat > 0 ? Math.sin((1 - c.bat / 0.35) * Math.PI) : 0;
        const holding = !!c.carry;
        const parts = [
          { l: [-0.25, sw * 0.5], y: 0, w: 0.48, h: 1.0, d: 0.5, col: L.pants },
          { l: [0.25, -sw * 0.5], y: 0, w: 0.48, h: 1.0, d: 0.5, col: L.pants },
          { l: [0, 0], y: 1.0, w: 1.0, h: 1.0, d: 0.5, col: L.shirt },
          { l: [-0.72, holding ? 0.2 : -sw * 0.5], y: holding ? 1.5 : 1.05, w: 0.42, h: holding ? 1.0 : 0.95, d: 0.45, col: L.head },
          { l: [0.72, holding ? 0.2 : sw * 0.5 + batUp * 0.5], y: holding ? 1.5 : 1.05 + batUp * 0.6, w: 0.42, h: holding ? 1.0 : 0.95, d: 0.45, col: L.head },
          { l: [0, 0], y: 2.0, w: 0.62, h: 0.62, d: 0.62, col: L.head, face: true }
        ];
        if (L.hat) parts.push({ l: [0, -0.03], y: 2.55, w: 0.68, h: 0.2, d: 0.68, col: L.hat });
        if (c.bat > 0 || c === me) parts.push({ l: [0.75, 0.35 + batUp * 0.6], y: 1.1 + batUp * 0.9, w: 0.16, h: 1.1, d: 0.16, col: "#a8743c" });
        parts.map(p => { const [x, z] = at(...p.l); return { p, x, z, d: camSpace(x, y + p.y + p.h / 2, z)[2] }; })
          .sort((a, b) => b.d - a.d)
          .forEach(({ p, x, z }) => box(x, y + p.y, z, p.w, p.h, p.d, c.stun > 0 && (Math.floor(clock * 12) % 2) ? "#ffffff" : p.col, c.yaw, p.face ? drawFace : null));
        if (c.carry) drawEggAt(c.carry, c.x, y + 3.15, c.z, 0.55);
      }
      function drawFace(P, w, h, d){
        const pt = (u, v) => { const q = P(u * w / 2, v * h, d / 2 + 0.01); return proj(...q); };
        const e1 = pt(-0.38, 0.62), e2 = pt(0.38, 0.62), m = pt(0, 0.3);
        if (!e1 || !e2 || !m) return;
        const r = Math.max(1.5, Math.hypot(e2.x - e1.x, e2.y - e1.y) * 0.13);
        ctx.fillStyle = "#1b1b1b";
        ctx.beginPath(); ctx.ellipse(e1.x, e1.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.ellipse(e2.x, e2.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = Math.max(1.2, r * 0.6); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(m.x, m.y - r * 2.2, r * 2.4, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); ctx.lineCap = "butt";
      }
      // an egg (or the pet that hatched out of it), standing upright, facing you
      function drawEggAt(e, x, y, z, size, walking){
        const p = proj(x, y, z);
        if (!p) return;
        const def = e.def, r = size * p.s;
        if (r < 1.5) return;
        if (e.hatched) {
          ctx.font = `${Math.round(r * 2.4)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const bob = Math.sin(clock * 3 + x) * r * 0.12;
          ctx.fillText(def.pet, p.x, p.y - r * 0.3 + bob);
          return;
        }
        const rank = rankOf(def);
        if (rank >= 4 || def.glow) { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4); g.addColorStop(0, (def.glow || "#fff6c0") + "aa"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.4, 0, 7); ctx.fill(); }
        ctx.save();
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.78, r, 0, 0, 7);
        let fill;
        if (def.rainbow || def.disco) {
          fill = ctx.createLinearGradient(p.x, p.y - r, p.x, p.y + r);
          const cols = def.disco ? ["#fff36b", "#ff6bd6", "#6bf0ff", "#fff36b"] : ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff"];
          cols.forEach((c, i) => fill.addColorStop((((i / (cols.length - 1)) + (def.disco ? clock * 0.5 : 0)) % 1 + 1) % 1, c));   // kept in 0..1 even if the clock goes below zero
        } else {
          fill = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.4, r * 0.1, p.x, p.y, r * 1.1);
          fill.addColorStop(0, def.shell[0]); fill.addColorStop(1, def.shell[1]);
        }
        ctx.fillStyle = fill; ctx.fill();
        ctx.clip();
        if (def.spots) { ctx.fillStyle = def.spots; [[-0.3, -0.3, 0.16], [0.25, 0.1, 0.2], [-0.1, 0.45, 0.13], [0.35, -0.5, 0.1]].forEach(([u, v, rr]) => { ctx.beginPath(); ctx.arc(p.x + u * r, p.y + v * r, rr * r, 0, 7); ctx.fill(); }); }
        if (def.stripes) { ctx.strokeStyle = def.stripes; ctx.lineWidth = r * 0.14; [-0.35, 0.15].forEach(v => { ctx.beginPath(); for (let k = -1; k <= 1; k += 0.25) ctx.lineTo(p.x + k * r, p.y + v * r + (Math.abs((k * 4) % 2) - 0.5) * r * 0.2); ctx.stroke(); }); }
        if (def.band) { ctx.fillStyle = def.band; ctx.fillRect(p.x - r, p.y - r * 0.25, r * 2, r * 0.22); }
        if (def.stars) { ctx.fillStyle = "#fff"; for (let k = 0; k < 7; k++) { const a = k * 2.4 + clock * 0.3, rr = (k % 3 + 1) * 0.22; ctx.fillRect(p.x + Math.cos(a) * rr * r, p.y + Math.sin(a * 1.3) * rr * r, Math.max(1, r * 0.07), Math.max(1, r * 0.07)); } }
        if (def.bolts) { ctx.fillStyle = "#5a6478"; [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.3], [0.4, 0.3]].forEach(([u, v]) => { ctx.beginPath(); ctx.arc(p.x + u * r, p.y + v * r, r * 0.08, 0, 7); ctx.fill(); }); ctx.fillStyle = "#6bf0ff"; ctx.fillRect(p.x - r * 0.35, p.y - r * 0.55, r * 0.7, r * 0.18); }
        if (def.shine || rank >= 5) { ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.ellipse(p.x - r * 0.3, p.y - r * 0.45, r * 0.15, r * 0.28, -0.4, 0, 7); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.78, r, 0, 0, 7); ctx.stroke();
        if (rank >= 4) { const a = clock * 4 + x; ctx.fillStyle = "#fff"; ctx.font = `${Math.round(r * 0.7)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("✦", p.x + Math.cos(a) * r * 1.2, p.y + Math.sin(a) * r * 1.1); }
      }
      function label(x, y, z, lines){
        const p = proj(x, y, z);
        if (!p || p.d > 26) return;
        const k = Math.max(0.6, Math.min(1.1, 9 / p.d));
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
        lines.forEach(([t, col, size], i) => {
          ctx.font = `800 ${Math.round(size * k)}px "Bricolage Grotesque", system-ui, sans-serif`;
          const yy = p.y - (lines.length - 1 - i) * size * k * 1.15;
          ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.strokeText(t, p.x, yy);
          if (col === "rainbow") { const g = ctx.createLinearGradient(p.x - 60, 0, p.x + 60, 0); ["#ff4d4d", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff"].forEach((c, j) => g.addColorStop(j / 4, c)); ctx.fillStyle = g; }
          else ctx.fillStyle = col;
          ctx.fillText(t, p.x, yy);
        });
      }
      const rarityCol = def => RARITY[def.r].rainbow ? "rainbow" : RARITY[def.r].colour;

      function draw(){
        placeCam();
        // the sky
        const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
        sky.addColorStop(0, "#58a8ff"); sky.addColorStop(1, "#cfe9ff");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        for (let k = 0; k < 7; k++) {
          const x = ((k * 190 - me.yaw * 260) % (W + 300) + W + 300) % (W + 300) - 150, y = 50 + (k * 41) % 90;
          ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.arc(x + 28, y + 6, 20, 0, 7); ctx.arc(x - 26, y + 8, 18, 0, 7); ctx.fill();
        }
        // the ground, the belt and the base floors (flat, so they go first)
        quad([[-120, 0, -120], [120, 0, -120], [120, 0, 120], [-120, 0, 120]], "#6cc04a");
        quad([[-50, 0.01, -50], [50, 0.01, -50], [50, 0.01, 50], [-50, 0.01, 50]], "#79cf55");
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        for (let g = -48; g <= 48; g += 4) { if (path3([[g, 0.02, -50], [g + 0.05, 0.02, -50], [g + 0.05, 0.02, 50], [g, 0.02, 50]])) ctx.stroke(); }
        quad([[-BELT_HALF - 0.3, 0.03, -BELT_END], [BELT_HALF + 0.3, 0.03, -BELT_END], [BELT_HALF + 0.3, 0.03, BELT_END], [-BELT_HALF - 0.3, 0.03, BELT_END]], "#5a5f6e");
        quad([[-BELT_HALF, 0.05, -BELT_END], [BELT_HALF, 0.05, -BELT_END], [BELT_HALF, 0.05, BELT_END], [-BELT_HALF, 0.05, BELT_END]], "#2c2f38");
        const off = (clock * BELT_SPEED) % 3;
        for (let z = -BELT_END + off; z < BELT_END; z += 3) quad([[-BELT_HALF, 0.06, z], [BELT_HALF, 0.06, z], [BELT_HALF, 0.06, z + 0.25], [-BELT_HALF, 0.06, z + 0.25]], "#ffcc33");
        bases.forEach(b => {
          quad([toWorld(b, 0, -9), toWorld(b, 16, -9), toWorld(b, 16, 9), toWorld(b, 0, 9)].map(([x, z]) => [x, 0.04, z]), shade(b.floor, 1), shade(b.floor, 0.8));
          const pad = (u, v, col) => quad([[u - 1, v - 1], [u + 1, v - 1], [u + 1, v + 1], [u - 1, v + 1]].map(([a, c]) => { const [x, z] = toWorld(b, a, c); return [x, 0.07, z]; }), col);
          if (b.owner === 0) { pad(...SELL_SPOT, "#2fa84f"); pad(...LOCK_SPOT, b.lockCd > 0 ? "#6b7280" : "#ff3b3b"); }
        });

        // everything standing up, far to near
        const items = [];
        const add = (x, y, z, fn) => { const q = camSpace(x, y, z); if (q[2] > NEAR - 1 && q[2] < 95) items.push({ d: q[2], fn }); };
        bases.forEach(b => {
          b.walls.forEach(w => {
            // long walls go in short pieces, so things in front and behind them sort right
            const along = w.x1 - w.x0 > w.z1 - w.z0, len = along ? w.x1 - w.x0 : w.z1 - w.z0, n = Math.max(1, Math.round(len / 2));
            for (let k = 0; k < n; k++) {
              const a = (k + 0.5) / n;
              const cx = along ? w.x0 + (w.x1 - w.x0) * a : (w.x0 + w.x1) / 2, cz = along ? (w.z0 + w.z1) / 2 : w.z0 + (w.z1 - w.z0) * a;
              const ww = along ? len / n : w.x1 - w.x0, dd = along ? w.z1 - w.z0 : len / n;
              add(cx, 1, cz, () => box(cx, 0, cz, ww + 0.01, 1.6, dd + 0.01, b.wallCol));
            }
          });
          if (b.locked > 0) {
            const d = b.door, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
            add(cx, 1, cz, () => {
              ctx.globalAlpha = 0.45 + 0.15 * Math.sin(clock * 10);
              quad([[cx, 0, d.z0], [cx, 0, d.z1], [cx, 2.2, d.z1], [cx, 2.2, d.z0]], "#ff2a2a");
              ctx.globalAlpha = 1;
              label(cx, 2.8, cz, [[`🔒 ${Math.ceil(b.locked)}s`, "#ffb3b3", 18]]);
            });
          }
          b.slots.forEach((s, k) => {
            const [x, z] = toWorld(b, ...PEDESTALS[k]);
            add(x, 0.5, z, () => {
              box(x, 0, z, 1.3, 0.8, 1.3, s ? (s.def.r === "secret" ? "#222233" : RARITY[s.def.r].colour) : walkers.some(w => b.owner === 0 && w.k === k) ? "#c9f7d4" : "#9aa3b2");
              if (s) {
                drawEggAt(s, x, 1.45, z, 0.55);
                const lines = [[s.def.name, rarityCol(s.def), 15], [`${money(earnOf(s) * (b.owner === 0 ? 1 + (S().rebirths || 0) * 0.5 : 1))}/s`, "#7bd68a", 14]];
                if (b.owner === 0 && s.cash >= 1) lines.push([money(s.cash), "#ffe14d", 17]);
                label(x, 2.5, z, lines);
              }
            });
          });
          if (b.owner === 0) {
            const [sx, sz] = toWorld(b, ...SELL_SPOT), [lx, lz] = toWorld(b, ...LOCK_SPOT);
            add(sx, 0.5, sz, () => label(sx, 0.9, sz, [["💲 SELL", "#7bd68a", 16]]));
            add(lx, 0.5, lz, () => label(lx, 0.9, lz, [[b.locked > 0 ? "🔒 LOCKED" : b.lockCd > 0 ? `🔒 ${Math.ceil(b.lockCd)}s` : "🔒 LOCK", "#ff9a9a", 16]]));
          }
          // the owner's name over the door
          const [nx, nz] = toWorld(b, 16, 0);
          if (!inside(b, me.x, me.z)) add(nx, 3, nz, () => label(nx, 3.4, nz, [[b.owner === 0 ? "⭐ YOUR BASE" : `${LOOKS[b.owner].name}'s base`, b.owner === 0 ? "#ffe14d" : "#ffffff", 18]]));
        });
        belt.forEach(e => add(0, 1, e.z, () => {
          drawEggAt(e, 0, 0.75, e.z, 0.6);
          label(0, 1.9, e.z, [[e.def.name, rarityCol(e.def), 15], [money(e.def.price), "#ffe14d", 15], [`${money(e.def.income)}/s`, "#7bd68a", 13]]);
        }));
        walkers.forEach(w => add(w.x, 1, w.z, () => {
          const sh = proj(w.x, 0.02, w.z); if (sh) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 0.6 * sh.s, 0.22 * sh.s, 0, 0, 7); ctx.fill(); }
          drawEggAt({ def: w.def }, w.x, 0.8, w.z, 0.6, true);
          label(w.x, 2.1, w.z, [[w.def.name, rarityCol(w.def), 14]]);
        }));
        chars.forEach(c => add(c.x, 1.3, c.z, () => { drawChar(c); if (c !== me) label(c.x, c.y + 3.1 + (c.carry ? 0.9 : 0), c.z, [[c.look.name, "#ffffff", 14]]); }));
        items.sort((a, b) => b.d - a.d).forEach(it => it.fn());

        // the "E" prompt, like Roblox's
        if (prompt && running) {
          const p = proj(prompt.x, 2.2, prompt.z);
          if (p) {
            const x = Math.max(90, Math.min(W - 90, p.x)), y = Math.max(40, Math.min(H - 60, p.y - 30));
            ctx.fillStyle = "rgba(15,18,30,0.82)"; roundRect(x - 85, y - 26, 170, 52, 10); ctx.fill();
            ctx.fillStyle = prompt.ok ? "#ffffff" : "#6b7280"; roundRect(x - 78, y - 17, 34, 34, 8); ctx.fill();
            ctx.fillStyle = "#111"; ctx.font = "900 20px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("E", x - 61, y + 1);
            ctx.textAlign = "left"; ctx.fillStyle = prompt.ok ? "#fff" : "#ff9a9a"; ctx.font = "800 15px 'Bricolage Grotesque', sans-serif"; ctx.fillText(prompt.label, x - 36, y - 7);
            ctx.fillStyle = "#c9cfe0"; ctx.font = "700 12px 'Karla', sans-serif"; ctx.fillText(prompt.sub || "", x - 36, y + 11);
          }
        }
        fx.draw(ctx, frameDt);
        if (msg) {
          ctx.font = "800 22px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.fillStyle = "#fff";
          ctx.strokeText(msg.text, W / 2, H - 40); ctx.fillText(msg.text, W / 2, H - 40);
        }
        if (me.carry) {
          ctx.font = "800 18px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
          ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.fillStyle = "#ffe14d";
          const t = me.carry.from ? `🏃 Run home with the ${me.carry.def.name}!` : `Take the ${me.carry.def.name} home to your base`;
          ctx.strokeText(t, W / 2, 30); ctx.fillText(t, W / 2, 30);
        }
      }
      function roundRect(x, y, w, h, r){
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      }

      function hud(){
        const st = S();
        cashEl.textContent = money(st.cash);
        incomeEl.textContent = `+${money(incomeOf(bases[0]))}/s` + (st.rebirths ? ` · 🔁×${st.rebirths}` : "");
      }

      /* ---------------- the loop ---------------- */
      let frameDt = 1 / 60, scale = 1;
      function fit(){
        const s = Fun.res(canvas.clientWidth, W, 2);
        if (Math.abs(s - scale) > 0.01) { scale = s; canvas.width = Math.round(W * s); canvas.height = Math.round(H * s); }
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
      }
      function loop(now){
        if (!open) return;
        const dt = Fun.dt(now, last);
        last = now; frameDt = dt;
        if (running) step(dt); else clock += dt;
        fit();
        draw();
        hud();
        requestAnimationFrame(loop);
      }
      function start(){
        running = true; panel.hidden = true;
        Fun.release(keys);
        stick.reset();
        canvas.focus();
        tip.show(cfg.tip, 4500);
      }
      function pause(){
        if (!running) return;
        running = false; save();
        titleEl.textContent = "⏸ Paused";
        textEl.textContent = "Your mouse is free. Press ▶ to keep playing!";
        playBtn.textContent = "▶ Keep playing";
        panel.hidden = false;
      }
      function openGame(){
        open = true; running = false;
        Fun.screen(overlay, true);
        reset();
        titleEl.textContent = `${cfg.icon} ${cfg.title}`;
        textEl.textContent = cfg.intro;
        playBtn.textContent = "▶ Play";
        panel.hidden = false;
        last = performance.now();
        requestAnimationFrame(loop);
        playBtn.focus();
      }
      function closeGame(){
        // things still on their way home get there straight away
        walkers.forEach(w => placeAt(bases[0], w.k, { def: w.def, hatched: false, hatchT: HATCH_TIME })); walkers = [];
        if (open && bases.length) save();
        open = false; running = false;
        Fun.screen(overlay, false);
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      }

      /* ---------------- controls ---------------- */
      const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyA: "sleft", KeyD: "sright", Space: "jump" };
      let unlockedAt = 0;
      const looking = () => document.pointerLockElement === canvas;
      window.addEventListener("keydown", e => {
        if (!open) return;
        if (e.key === "Escape") {
          if (looking() || performance.now() - unlockedAt < 400) { if (looking()) document.exitPointerLock(); return; }
          if (running) { pause(); return; }
          Hub.leave(); return;
        }
        if (!running) return;
        if (e.code === "KeyE") { e.preventDefault(); if (!e.repeat) act(); return; }
        if (e.code === "KeyF") { e.preventDefault(); swing(); return; }
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
      host.querySelectorAll(".eh-touch [data-k]").forEach(btn => {
        const k = btn.dataset.k;
        btn.addEventListener("pointerdown", e => {
          e.preventDefault();
          if (k === "act") { act(); return; }
          if (k === "bat") { swing(); return; }
          keys[k] = true;
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { if (k in keys) keys[k] = false; }));
      });
      canvas.tabIndex = 0;

      rebirthBtn.addEventListener("click", () => {
        const st = S();
        if (st.cash < REBIRTH_COST) return;
        if (!confirm(`Rebirth? You start again with $100 and one ${EGG[cfg.start].name}, but every ${cfg.word} earns ${1 + (st.rebirths + 1) * 0.5}× as much forever!`)) return;
        st.rebirths = (st.rebirths || 0) + 1; st.cash = 100; st.slots = [egg(cfg.start)];
        reset(); save(); Hub.checkBadges();
        fx.pop(`🔁 REBIRTH ×${st.rebirths}!`, W / 2, H * 0.4, "#ffe14d", 44); Fun.sfx.tada();
        canvas.focus();
      });
      $(P + "CloseBtn").addEventListener("click", () => Hub.leave());
      Fun.soundButton($(P + "CloseBtn"));
      playBtn.addEventListener("click", start);

      // for tests: peek at the game
      window["__" + cfg.key] = { state: () => ({ cash: S().cash, me: { x: me.x, z: me.z, yaw: me.yaw, carry: me.carry && me.carry.def.id }, prompt: prompt && prompt.kind, slots: bases[0].slots.map(s => s && s.def.id), bots: chars.slice(1).map(c => c.plan && c.plan.kind), botsAt: chars.slice(1).map(c => [c.x, c.z, c.carry && c.carry.def.id]), belt: belt.length }),
        put: (x, z, yaw) => { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; }, cash: n => { S().cash = n; } };

      return { open: openGame, close: closeGame };
    }
  }
})();
