/* Block World: a Minecraft-style sandbox. Walk, jump, swim and fly around a world made of blocks, dig them
   out and build whatever you like. In Creative every block is yours to build with; in Survival you collect
   what you dig, build with what you have, and craft new things at a crafting table and a furnace.
   The picture comes from gl.js (WebGL, or soft.js on a device without it), the Survival rules from items.js
   and the inventory screens from inventory.js; this file is the game itself: moving, digging, building,
   the hotbar and saving. Your builds are saved (only the blocks you changed, not the whole world). */
(function(){
  "use strict";
  const store = Hub.store;
  const BW = window.BlockWorld;
  const { WW, WH, WD, world, at, ID, K, TEX, FACE, KIND, IS_SOLID, HOTBAR, BLOCKS, generate, spawnPoint, skyState, TORCH_DIR, wallTorch, IS_OPAQUE, isFurnace, furnaceFacing, T } = BW;
  const SV = BW.Survival;
  const CYCLE = 360;              // a whole day and night takes 6 minutes
  // the times the clock button jumps to
  const TIMES = [{ t: 0.04, icon: "🌅", name: "Morning" }, { t: 0.25, icon: "☀️", name: "Day" }, { t: 0.47, icon: "🌇", name: "Sunset" }, { t: 0.75, icon: "🌙", name: "Night" }];
  const WORLD_VERSION = 2; // bumped when the terrain changed shape, so an old save doesn't land in the wrong place

  Hub.register({
    id: "blocks", section: "games", title: "Block World", icon: "⛏️",
    blurb: "Dig, build and explore a world made of blocks. Make anything you can imagine!",
    stat: () => store.blocksPlaced ? "Built " + store.blocksPlaced + " blocks" : "",
    badges: [
      { id: "blockBuild", icon: "🧱", name: "Builder",  desc: "Place 50 blocks in Block World", test: () => (store.blocksPlaced || 0) >= 50 },
      { id: "blockDig",   icon: "⛏️", name: "Miner",    desc: "Dig up 100 blocks",              test: () => (store.blocksBroken || 0) >= 100 },
      { id: "blockHigh",  icon: "☁️", name: "Sky High", desc: "Climb up to the clouds",         test: () => (store.blocksHigh || 0) >= 26 }
    ],
    mount
  });

  // what the pointer can land on: everything but air and water
  const HIT = new Uint8Array(256);
  BLOCKS.forEach((b, id) => { if (b && b.kind !== K.WATER) HIT[id] = 1; });

  function mount(host){
    BW.textures();
    host.innerHTML = `
    <section class="game-screen" id="blOverlay" hidden aria-label="Block World">
      <div class="game-box">
        <div class="game-hud">
          <h2>⛏️ Block World</h2>
          <span class="mono game-stat" id="blPos">📍 0 0 0</span>
          <button class="mono game-stat bl-time" id="blTime" type="button" title="Change the time of day">☀️ Day</button>
          <span class="mono game-stat" id="blMode">🚶 Walking</span>
          <button class="btn ghost small" id="blCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="blCanvas" width="960" height="540"></canvas>
          <div class="bl-water" id="blWater" hidden></div>
          <div class="bl-cross" aria-hidden="true"></div>
          <div class="bl-name" id="blName" aria-live="polite"></div>
          <div class="bl-hotbar" id="blHotbar"></div>
          <div class="game-panel bl-panel" id="blPanel">
            <div class="game-panel-title">⛏️ Block World</div>
            <div class="game-panel-text" id="blPanelText"></div>
            <div class="segmented bl-modes" role="group" aria-label="Game mode">
              <button type="button" data-mode="creative">🎨 Creative</button>
              <button type="button" data-mode="survival">⛏️ Survival</button>
            </div>
            <button class="btn" id="blPlayBtn" type="button">▶ Play</button>
            <button class="btn ghost small" id="blNewBtn" type="button">🌱 New world</button>
          </div>
        </div>
        <div class="game-help">W A S D to move · mouse or ← → ↑ ↓ to look · Space to jump or swim up · left click to dig · right click to build · 1–9, 0, – or the mouse wheel to pick a block · F to fly (Space up, Shift down) · E for your inventory · T for another time of day · Esc or P to pause and free your mouse</div>
        <div class="game-touch bl-touch">
          <button class="btn ghost fun-dpad" data-bkey="left" type="button" aria-label="Step left">◀</button>
          <button class="btn ghost fun-dpad" data-bkey="forward" type="button" aria-label="Walk forward">▲</button>
          <button class="btn ghost fun-dpad" data-bkey="back" type="button" aria-label="Walk back">▼</button>
          <button class="btn ghost fun-dpad" data-bkey="right" type="button" aria-label="Step right">▶</button>
          <button class="btn" data-bkey="jump" type="button" aria-label="Jump">JUMP</button>
          <button class="btn" data-bkey="mine" type="button" aria-label="Dig">⛏</button>
          <button class="btn" data-bkey="place" type="button" aria-label="Build">🧱</button>
          <button class="btn ghost" data-bkey="fly" type="button" aria-label="Fly or walk">✈</button>
          <button class="btn ghost" data-bkey="bag" type="button" aria-label="Inventory">🎒</button>
        </div>
      </div>
    </section>`;

    let canvas = document.getElementById("blCanvas");
    // the real picture needs WebGL; if that's missing, fall back to the plain ray-caster on a fresh canvas
    let renderer = null;
    try { renderer = BW.createGL(canvas); } catch (e) { renderer = null; }
    if (!renderer) {
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
      renderer = BW.createSoft(canvas);
    }
    const gpu = !!renderer.gl;

    const overlay = document.getElementById("blOverlay");
    const panel = document.getElementById("blPanel");
    const panelText = document.getElementById("blPanelText");
    const playBtn = document.getElementById("blPlayBtn");
    const newBtn = document.getElementById("blNewBtn");
    const posEl = document.getElementById("blPos");
    const modeEl = document.getElementById("blMode");
    const hotbar = document.getElementById("blHotbar");
    const nameEl = document.getElementById("blName");
    const waterEl = document.getElementById("blWater");
    const timeEl = document.getElementById("blTime");

    const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62, REACH = 6;
    const GRAVITY = 26, JUMP = 8.2, WALK = 4.6, FLY = 10;
    const approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);

    let isOpen = false, running = false, last = 0, frame = 0, loadedSeed = 0;
    const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, fly: false, wet: false };
    let yaw = 0, pitch = 0, sel = 0, mineT = 0, saveT = 0, swing = 0, nameT = 0;
    let dayT = typeof store.blockTime === "number" ? store.blockTime : 0.1;  // 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight
    let target = null;
    const bits = []; // the flying bits of a dug block, and the flames
    const torches = new Set(); // where the torches are, for the flames
    const isTorch = id => KIND[id] === K.TORCH;
    // Creative or Survival, the bag, and the furnaces (each world keeps its own)
    let survival = store.blockMode === "survival";
    const bag = () => store.blockInv;
    let mining = null;        // the block you're digging in Survival, and how far along you are
    let furnSaveT = 0;
    const keys = { forward: false, back: false, left: false, right: false, jump: false, down: false, mine: false, lookL: false, lookR: false, lookU: false, lookD: false };

    /* ---------------- the world around you ---------------- */
    const idAt = (x, y, z) => (x < 0 || x >= WW || z < 0 || z >= WD || y < 0 || y >= WH) ? 0 : world[at(x, y, z)];
    function solidAt(x, y, z){
      if (y < 0 || x < 0 || x >= WW || z < 0 || z >= WD) return true; // the floor and the edges are walls
      if (y >= WH) return false;
      return IS_SOLID[world[at(x, y, z)]] === 1;
    }
    // would a body standing with its feet here be inside a block?
    function collides(x, y, z){
      const x0 = Math.floor(x - HALF), x1 = Math.floor(x + HALF), z0 = Math.floor(z - HALF), z1 = Math.floor(z + HALF);
      const y0 = Math.floor(y), y1 = Math.floor(y + HEIGHT - 0.001);
      for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (solidAt(xx, yy, zz)) return true;
      return false;
    }
    // the first block along a line, and which side of it the line came in through
    function cast(ox, oy, oz, dx, dy, dz, max){
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
      let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : 1e30;
      let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : 1e30;
      let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : 1e30;
      let nx = 0, ny = 0, nz = 0;
      for (let n = 0; n < 64; n++) {
        if (x >= 0 && x < WW && y >= 0 && y < WH && z >= 0 && z < WD && HIT[world[at(x, y, z)]]) return { x, y, z, nx, ny, nz };
        let t;
        if (tmx < tmy) {
          if (tmx < tmz) { t = tmx; tmx += tdx; x += sx; nx = -sx; ny = 0; nz = 0; } else { t = tmz; tmz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
        } else if (tmy < tmz) { t = tmy; tmy += tdy; y += sy; nx = 0; ny = -sy; nz = 0; } else { t = tmz; tmz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
        if (t > max) return null;
      }
      return null;
    }
    function aim(){
      const cp = Math.cos(pitch);
      return cast(p.x, p.y + EYE, p.z, cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw), REACH);
    }

    /* ---------------- digging and building ---------------- */
    function saveSoon(){ clearTimeout(saveT); saveT = setTimeout(Hub.saveStore, 600); }
    function setBlock(x, y, z, id){
      const i = at(x, y, z);
      world[i] = id;
      store.blockEdits[i] = id;
      if (isTorch(id)) torches.add(i); else torches.delete(i);
      renderer.updateBlock(x, y, z);
    }
    function inPlayer(x, y, z){
      return p.x + HALF > x && p.x - HALF < x + 1 && p.y + HEIGHT > y && p.y < y + 1 && p.z + HALF > z && p.z - HALF < z + 1;
    }
    // a little shower of bits in the colours of the block
    function debris(x, y, z, id){
      const tex = TEX[FACE[id * 3]];
      for (let n = 0; n < 14; n++) {
        const c = tex[(Math.random() * 256) | 0];
        if ((c >>> 24) < 128) continue;
        bits.push({
          x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
          vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1, vz: (Math.random() - 0.5) * 3,
          r: (c & 255) / 255 * 0.92, g: ((c >> 8) & 255) / 255 * 0.92, b: ((c >> 16) & 255) / 255 * 0.92,
          size: 0.07 + Math.random() * 0.07, life: 0.5 + Math.random() * 0.5
        });
      }
    }
    // is this torch still stuck to something? (a standing one needs a block under it, a hanging one a block behind it)
    function torchSupported(x, y, z, id){
      const d = TORCH_DIR[id];
      const sx = d ? x + d[0] : x, sy = d ? y : y - 1, sz = d ? z + d[1] : z;
      const sid = idAt(sx, sy, sz);
      return IS_SOLID[sid] === 1 && IS_OPAQUE[sid] === 1;
    }
    // a little message above the hotbar ("+1 Log", "Your bag is full")
    function tell(text){
      nameEl.textContent = text;
      nameEl.classList.add("show");
      nameT = 1.6;
    }
    // in Survival, what you dig goes in your bag
    function collect(list){
      list.forEach(([id, n]) => {
        const left = SV.addItem(bag(), id, n);
        tell(left > 0 ? "Your bag is full!" : "+" + n + " " + SV.nameOf(id));
      });
      refreshHotbar();
    }
    // a block goes: what it drops, the torches it was holding up, and a furnace's contents
    function breakAt(t){
      const id = world[at(t.x, t.y, t.z)];
      if (survival) {
        collect(SV.drops(id, heldId()));
        if (isFurnace(id)) {
          const f = store.blockFurnaces[at(t.x, t.y, t.z)];
          if (f) collect([f.input, f.fuel, f.output].filter(Boolean).map(s => [s.id, s.n]));
        }
      }
      if (isFurnace(id)) delete store.blockFurnaces[at(t.x, t.y, t.z)];
      setBlock(t.x, t.y, t.z, 0);
      debris(t.x, t.y, t.z, id);
      // torches it was holding up fall off (and in Survival you catch them)
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
        const tx = t.x + dx, ty = t.y + dy, tz = t.z + dz, tid = idAt(tx, ty, tz);
        if (!isTorch(tid) || torchSupported(tx, ty, tz, tid)) continue;
        setBlock(tx, ty, tz, 0);
        debris(tx, ty, tz, tid);
        if (survival) collect([[ID.TORCH, 1]]);
      }
    }
    function dig(){
      if (pokeMob()) return;
      const t = aim();
      if (!t || t.y === 0) return; // the very bottom layer can't be dug
      breakAt(t);
      Fun.sfx.pop();
      swing = 0.001;
      store.blocksBroken = (store.blocksBroken || 0) + 1;
      Hub.checkBadges(); saveSoon();
    }
    // Survival digging takes time (less with the right tool): hold the button down and the cracks spread
    function mineStep(dt){
      if (!keys.mine) { mining = null; return; }
      if (!survival) { mineT -= dt; if (mineT <= 0) { dig(); mineT = 0.22; } return; }
      if (pokeMob()) { mining = null; return; }
      const t = aim();
      if (!t || t.y === 0) { mining = null; return; }
      const i = at(t.x, t.y, t.z);
      if (!mining || mining.i !== i) mining = { i, x: t.x, y: t.y, z: t.z, t: 0, need: SV.digTime(world[i], heldId()) };
      mining.t += dt;
      if (swing === 0) swing = 0.001;
      if (mining.t >= mining.need) { dig(); mining = null; }
    }
    // right-clicking a crafting table or a furnace opens it instead of building
    function useBlock(t){
      const id = world[at(t.x, t.y, t.z)];
      if (id === ID.CRAFTING) { openScreen(() => survival ? ui.openCrafting() : ui.openBook()); return true; }
      if (isFurnace(id)) {
        if (!survival) { tell("Furnaces work in Survival"); return true; }
        const k = at(t.x, t.y, t.z);
        const f = store.blockFurnaces[k] || (store.blockFurnaces[k] = SV.newFurnace());
        openScreen(() => ui.openFurnace(f));
        return true;
      }
      return false;
    }
    function build(){
      const t = aim();
      if (!t) return;
      if (useBlock(t)) return;
      const hit = world[at(t.x, t.y, t.z)];
      // pointing at a flower or a torch: the new block takes its place
      const replace = KIND[hit] === K.PLANT || isTorch(hit);
      const x = replace ? t.x : t.x + t.nx, y = replace ? t.y : t.y + t.ny, z = replace ? t.z : t.z + t.nz;
      if (x < 0 || x >= WW || y < 0 || y >= WH || z < 0 || z >= WD) return;
      const there = world[at(x, y, z)];
      if (there && KIND[there] !== K.PLANT && KIND[there] !== K.WATER && !isTorch(there)) return;
      if (inPlayer(x, y, z)) return;
      let id = heldId();
      const it = SV.ITEMS[id];
      if (!id || (survival && !(it && it.block))) return;   // a tool, a stick or an empty hand doesn't build
      if (id === ID.TORCH) {
        // a torch goes on top of a block (standing) or on the side of one (hanging), but not under one
        if (replace || t.ny === 1) id = ID.TORCH;
        else if (t.ny === 0) id = wallTorch(-t.nx, -t.nz);
        else return;
        if (!torchSupported(x, y, z, id)) return;
      }
      if (id === ID.FURNACE) { // its front faces you
        id = furnaceFacing(p.x - (x + 0.5), p.z - (z + 0.5));
        store.blockFurnaces[at(x, y, z)] = SV.newFurnace();
      }
      if (survival) {
        const slot = bag()[sel];
        if (--slot.n <= 0) bag()[sel] = null;
        refreshHotbar();
      }
      setBlock(x, y, z, id);
      Fun.sfx.thunk();
      swing = 0.001;
      store.blocksPlaced = (store.blocksPlaced || 0) + 1;
      Hub.checkBadges(); saveSoon();
    }

    /* ---------------- the animals: pigs and chickens wander about (poke one and it runs off squealing!) ---------------- */
    const mobs = [];
    const MOB = {
      pig:     { half: 0.38, h: 0.95, speed: 1.3, sound: "oink",  say: ["Oink!", "Oink oink!", "Snort!", "Hey, that tickles!"], emoji: "🐷", colour: [0.94, 0.62, 0.66] },
      chicken: { half: 0.24, h: 0.95, speed: 1.6, sound: "cluck", say: ["Bawk!", "Cluck cluck!", "Bok bok!", "BAWK?!"],          emoji: "🐔", colour: [0.97, 0.97, 0.97] }
    };
    let pokeCd = 0, chatT = 8, mobCheckT = 0;
    window.__blockMobs = mobs;   // for tests
    function mobCollides(m, x, y, z){
      const H = MOB[m.kind].half, hh = MOB[m.kind].h;
      for (let yy = Math.floor(y); yy <= Math.floor(y + hh - 0.001); yy++)
        for (let zz = Math.floor(z - H); zz <= Math.floor(z + H); zz++)
          for (let xx = Math.floor(x - H); xx <= Math.floor(x + H); xx++) if (solidAt(xx, yy, zz)) return true;
      return false;
    }
    // a grassy spot to stand on, or -1
    function grassAt(x, z){
      for (let y = WH - 1; y > 0; y--) {
        const id = idAt(x, y, z);
        if (!id || KIND[id] === K.PLANT) continue;
        return id === ID.GRASS ? y + 1 : -1;
      }
      return -1;
    }
    function placeMob(m){
      for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 20;
        const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
        if (x < 1 || z < 1 || x >= WW - 1 || z >= WD - 1) continue;
        const g = grassAt(x, z);
        if (g < 0) continue;
        Object.assign(m, { x: x + 0.5, y: g, z: z + 0.5, vy: 0, yaw: Math.random() * 6.28, want: Math.random() * 6.28, walk: 0, moving: false, t: Math.random() * 3, flee: 0, hurt: 0, squash: 1, flap: false, onGround: true });
        return true;
      }
      return false;
    }
    function spawnMobs(){
      mobs.length = 0;
      for (let k = 0; k < 8; k++) { const m = { kind: k % 2 ? "chicken" : "pig" }; if (placeMob(m)) mobs.push(m); }
    }
    function updateMobs(dt){
      pokeCd = Math.max(0, pokeCd - dt);
      // animals left far behind come back near you
      if ((mobCheckT -= dt) <= 0) { mobCheckT = 3; mobs.forEach(m => { if (Math.hypot(m.x - p.x, m.z - p.z) > 60 || m.y < 1) placeMob(m); }); }
      mobs.forEach(m => {
        const M = MOB[m.kind];
        m.hurt -= dt; m.flee -= dt; m.t -= dt;
        m.squash += (1 - m.squash) * Math.min(1, dt * 10);
        if (m.flee > 0) { m.want = Math.atan2(m.x - p.x, m.z - p.z); m.moving = true; }
        else if (m.t <= 0) { m.t = 2 + Math.random() * 4; m.moving = Math.random() < 0.6; m.want = Math.random() * Math.PI * 2; }
        const da = Math.atan2(Math.sin(m.want - m.yaw), Math.cos(m.want - m.yaw));
        m.yaw += da * Math.min(1, dt * (m.flee > 0 ? 10 : 4));
        const speed = m.moving ? (m.flee > 0 ? 4.2 : M.speed) : 0;
        if (speed) {
          const nx = m.x + Math.sin(m.yaw) * speed * dt, nz = m.z + Math.cos(m.yaw) * speed * dt;
          // don't wander into water or off the edge of the world
          const wet = idAt(Math.floor(nx), Math.floor(m.y), Math.floor(nz)) === ID.WATER || idAt(Math.floor(nx), Math.floor(m.y) - 1, Math.floor(nz)) === ID.WATER;
          if (wet || nx < 1 || nz < 1 || nx > WW - 1 || nz > WD - 1) { m.want = m.yaw + Math.PI; m.t = 1.5; }
          else {
            const tryMove = (x, z) => {
              if (!mobCollides(m, x, m.y, z)) { m.x = x; m.z = z; return; }
              if (m.onGround && !mobCollides(m, x, m.y + 1.05, z)) { m.vy = 6.6; m.onGround = false; return; }   // hop up a step
              m.want = m.yaw + Math.PI * (0.5 + Math.random()); m.t = 1;
            };
            tryMove(nx, m.z); tryMove(m.x, nz);
          }
          m.walk += dt * speed * 5;
        }
        // falling (a chicken flaps and floats down)
        m.vy -= 22 * dt;
        m.flap = m.kind === "chicken" && !m.onGround && m.vy < 0;
        if (m.flap && m.vy < -2) m.vy = -2;
        if (m.flap) m.walk += dt * 12;
        const ny = m.y + m.vy * dt;
        if (mobCollides(m, m.x, ny, m.z)) {
          if (m.vy < 0) { if (m.vy < -6) m.squash = 1.3; m.y = Math.floor(ny) + 1; m.onGround = true; }
          m.vy = 0;
        } else { m.y = ny; m.onGround = false; }
      });
      // now and then an animal near you says something
      if ((chatT -= dt) <= 0) {
        chatT = 7 + Math.random() * 9;
        const near = mobs.filter(m => Math.hypot(m.x - p.x, m.z - p.z) < 12);
        if (near.length) { const m = near[Math.floor(Math.random() * near.length)], M = MOB[m.kind]; tell(`${M.emoji} ${M.say[Math.floor(Math.random() * 2)]}`); Fun.sfx[M.sound](); }
      }
    }
    // is the crosshair on an animal (nearer than any block)? Then give it a poke: it jumps and runs away.
    function pokeMob(){
      const cp = Math.cos(pitch), dx = cp * Math.sin(yaw), dy = Math.sin(pitch), dz = cp * Math.cos(yaw);
      const ox = p.x, oy = p.y + EYE, oz = p.z;
      const t = aim();
      const blockD = t ? Math.hypot(t.x + 0.5 - ox, t.y + 0.5 - oy, t.z + 0.5 - oz) - 0.5 : REACH;
      let best = null, bestT = Math.min(REACH, blockD);
      mobs.forEach(m => {
        const H = MOB[m.kind].half + 0.05, lo = [m.x - H, m.y, m.z - H], hi = [m.x + H, m.y + MOB[m.kind].h, m.z + H];
        let t0 = 0, t1 = bestT;
        const o = [ox, oy, oz], d = [dx, dy, dz];
        for (let i = 0; i < 3; i++) {
          if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) { t1 = -1; break; } continue; }
          let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i];
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        }
        if (t1 >= t0 && t0 < bestT) { bestT = t0; best = m; }
      });
      if (!best) return false;
      if (pokeCd > 0) return true;
      pokeCd = 0.35;
      const M = MOB[best.kind];
      best.flee = 3; best.vy = 5.5; best.onGround = false; best.hurt = 0.25; best.squash = 0.8;
      tell(`${M.emoji} ${M.say[Math.floor(Math.random() * M.say.length)]}`);
      Fun.sfx[M.sound]();
      swing = 0.001;
      for (let n = 0; n < 10; n++) bits.push({ x: best.x, y: best.y + 0.6, z: best.z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1, vz: (Math.random() - 0.5) * 3,
        r: M.colour[0], g: M.colour[1], b: M.colour[2], size: 0.06 + Math.random() * 0.05, life: 0.4 + Math.random() * 0.3 });
      return true;
    }

    // little flames rising off every torch near you
    let flameT = 0;
    function flames(dt){
      flameT += dt;
      if (flameT < 0.09) return;
      flameT = 0;
      for (const i of torches) {
        if (bits.length > 600) break;
        const x = i % WW, z = Math.floor(i / WW) % WD, y = Math.floor(i / (WW * WD));
        if (Math.abs(x + 0.5 - p.x) > 18 || Math.abs(z + 0.5 - p.z) > 18 || Math.abs(y - p.y) > 18) continue;
        const d = TORCH_DIR[world[i]];
        const hot = Math.random() < 0.5;
        bits.push({
          x: x + 0.5 + (d ? d[0] * 0.12 : 0) + (Math.random() - 0.5) * 0.07, y: y + (d ? 0.8 : 0.64), z: z + 0.5 + (d ? d[1] * 0.12 : 0) + (Math.random() - 0.5) * 0.07,
          vx: (Math.random() - 0.5) * 0.18, vy: 0.5 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.18, grav: -0.3,
          r: 1, g: hot ? 0.9 : 0.55, b: hot ? 0.45 : 0.12,
          size: -(0.035 + Math.random() * 0.03), life: 0.3 + Math.random() * 0.3   // a negative size means it glows by itself
        });
      }
    }

    /* ---------------- moving ---------------- */
    function move(h){
      // gravity is part of every little step, so standing on the floor is felt on each one
      if (!p.fly) p.vy = Math.max(p.vy - (p.wet ? GRAVITY * 0.2 : GRAVITY) * h, p.wet ? -3.2 : -32);
      let nx = p.x + p.vx * h;
      if (collides(nx, p.y, p.z)) { nx = p.vx > 0 ? Math.floor(nx + HALF) - HALF - 0.001 : Math.floor(nx - HALF) + 1 + HALF + 0.001; p.vx = 0; }
      p.x = nx;
      let nz = p.z + p.vz * h;
      if (collides(p.x, p.y, nz)) { nz = p.vz > 0 ? Math.floor(nz + HALF) - HALF - 0.001 : Math.floor(nz - HALF) + 1 + HALF + 0.001; p.vz = 0; }
      p.z = nz;
      let ny = p.y + p.vy * h;
      p.onGround = false;
      if (collides(p.x, ny, p.z)) {
        if (p.vy < 0) { ny = Math.floor(ny) + 1; p.onGround = true; }   // land on top of the block
        else ny = Math.floor(ny + HEIGHT) - HEIGHT - 0.001;             // bump your head
        p.vy = 0;
      }
      p.y = ny;
    }

    function step(dt){
      Fun.stickKeys(stick, keys, { left: "left", right: "right", up: "forward", down: "back" });
      yaw += ((keys.lookR ? 1 : 0) - (keys.lookL ? 1 : 0)) * 2 * dt;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + ((keys.lookU ? 1 : 0) - (keys.lookD ? 1 : 0)) * 1.6 * dt));
      p.wet = !p.fly && idAt(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === ID.WATER;
      const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0), s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      let wx = sy * f + cy * s, wz = cy * f - sy * s;
      const len = Math.hypot(wx, wz);
      if (len > 1) { wx /= len; wz /= len; }
      const speed = p.fly ? FLY : p.wet ? WALK * 0.55 : WALK, acc = (p.onGround || p.fly || p.wet ? 45 : 22) * dt;
      p.vx = approach(p.vx, wx * speed, acc);
      p.vz = approach(p.vz, wz * speed, acc);
      if (p.fly) p.vy = approach(p.vy, ((keys.jump ? 1 : 0) - (keys.down ? 1 : 0)) * FLY * 0.8, 40 * dt);
      else if (p.wet) { if (keys.jump) p.vy = approach(p.vy, 3.6, 30 * dt); } // kick to swim up
      else if (keys.jump && p.onGround) { p.vy = JUMP; p.onGround = false; }
      for (let k = 0; k < 3; k++) move(dt / 3); // little steps, so you can't fall through a block
      if (p.fly && p.y > 70) p.y = 70;
      mineStep(dt);
      updateMobs(dt);
      const high = Math.floor(p.y);
      if (high > (store.blocksHigh || 0)) { store.blocksHigh = high; Hub.checkBadges(); saveSoon(); }
    }

    /* ---------------- the hotbar: little 3D block icons, like the real one ---------------- */
    const atlas = BW.atlasCanvas();
    function icon(id){
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      const tile = k => k === 0 && isFurnace(id) ? T.FURN_FRONT : FACE[id * 3 + k];
      if (id >= 100) { // a tool, a stick, coal...: its picture, big and crisp
        const t = SV.ITEMS[id].tile, sx = (t % 6) * 16, sy = Math.floor(t / 6) * 16;
        g.drawImage(atlas, sx, sy, 16, 16, 4, 4, 56, 56);
        return c;
      }
      if (isTorch(id)) { // a torch is drawn as itself, big, with a little dark edge so it shows on any slot
        const t = tile(0), sx = (t % 6) * 16, sy = Math.floor(t / 6) * 16;
        g.drawImage(atlas, sx + 3, sy + 3, 10, 13, 12, 6, 40, 52);
        return c;
      }
      // each face is the 16 × 16 texture squashed into a diamond or a slanted square
      const faces = [
        { k: 1, m: [1.75, -0.875, 1.75, 0.875, 4, 18], dark: 0,    poly: [[32, 4], [60, 18], [32, 32], [4, 18]] },
        { k: 0, m: [1.75, 0.875, 0, 1.75, 4, 18],      dark: 0.26, poly: [[4, 18], [32, 32], [32, 60], [4, 46]] },
        { k: 2, m: [1.75, -0.875, 0, 1.75, 32, 32],    dark: 0.46, poly: [[32, 32], [60, 18], [60, 46], [32, 60]] }
      ];
      faces.forEach(f => {
        const t = f.k === 2 ? FACE[id * 3] : tile(f.k), sx = (t % 6) * 16, sy = Math.floor(t / 6) * 16;   // (2: the right-hand side, never the front)
        g.setTransform(f.m[0], f.m[1], f.m[2], f.m[3], f.m[4], f.m[5]);
        g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (f.dark) {
          g.fillStyle = `rgba(0,0,0,${f.dark})`;
          g.beginPath(); f.poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
        }
      });
      return c;
    }
    const iconURLs = new Map();
    const iconURL = id => { if (!iconURLs.has(id)) iconURLs.set(id, icon(id).toDataURL()); return iconURLs.get(id); };
    const slotCount = () => survival ? 9 : HOTBAR.length;
    // what's in your hand: in Creative the hotbar block, in Survival whatever is in that slot of your bag
    const heldId = () => survival ? (bag()[sel] ? bag()[sel].id : 0) : HOTBAR[sel];
    function buildHotbar(){
      hotbar.innerHTML = "";
      for (let i = 0; i < slotCount(); i++) {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "bl-slot";
        btn.innerHTML = "<img alt='' draggable='false'><span class='bl-key'></span><span class='bl-count'></span>";
        btn.querySelector(".bl-key").textContent = i < 9 ? String(i + 1) : i === 9 ? "0" : "–";
        btn.addEventListener("pointerdown", e => { e.preventDefault(); select(i); });
        hotbar.appendChild(btn);
      }
      hotbar.classList.toggle("survival", survival);
      refreshHotbar();
    }
    function refreshHotbar(){
      [...hotbar.children].forEach((btn, i) => {
        const s = survival ? bag()[i] : null, id = survival ? (s ? s.id : 0) : HOTBAR[i];
        const img = btn.querySelector("img");
        if (id) { img.src = iconURL(id); img.hidden = false; } else img.hidden = true;
        btn.querySelector(".bl-count").textContent = s && s.n > 1 ? String(s.n) : "";
        const name = id ? SV.nameOf(id) : "Empty";
        btn.title = name; btn.setAttribute("aria-label", name);
        btn.classList.toggle("sel", i === sel);
      });
      renderer.setSelected(heldId());
    }
    function select(i, quiet){
      const n = slotCount();
      sel = ((i % n) + n) % n;
      mining = null;
      refreshHotbar();
      if (quiet) return;
      tell(heldId() ? SV.nameOf(heldId()) : "Empty hand");
    }

    // morning, day, sunset or night, as a name for the clock button
    function timeLabel(){
      const t = dayT % 1;
      if (t < 0.06 || t >= 0.96) return "🌅 Sunrise";
      if (t < 0.42) return "☀️ Day";
      if (t < 0.56) return "🌇 Sunset";
      return "🌙 Night";
    }
    // jump to the next time of day: morning, day, sunset, night, and round again
    function nextTime(){
      const t = dayT % 1;
      const next = TIMES.find(x => x.t > t + 0.02) || TIMES[0];
      dayT = next.t;
      store.blockTime = dayT;
      saveSoon();
      timeEl.textContent = next.icon + " " + next.name;
    }
    timeEl.addEventListener("click", () => nextTime());

    function toggleFly(){
      if (survival) { tell("No flying in Survival!"); return; }
      p.fly = !p.fly;
      p.vy = 0;
      showMode();
    }
    function showMode(){ modeEl.textContent = survival ? "⛏️ Survival" : p.fly ? "🕊️ Flying" : "🚶 Walking"; }

    const ui = BW.createInventoryUI({
      stage: overlay.querySelector(".game-stage"),
      getInv: bag,
      icon,
      onChange(){ refreshHotbar(); saveSoon(); },
      onCraft(){ store.blocksCrafted = (store.blocksCrafted || 0) + 1; }
    });
    // open one of the screens: the mouse is let go so you can click on things
    function openScreen(how){
      releaseKeys(); mining = null;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      how();
    }
    function toggleBag(){
      if (ui.isOpen()) { ui.close(); return; }
      openScreen(() => survival ? ui.openInventory() : ui.openBook());
    }

    // Creative or Survival, chosen on the start screen
    const modeBtns = [...overlay.querySelectorAll(".bl-modes button")];
    function setMode(m){
      survival = m === "survival";
      store.blockMode = m;
      if (survival) p.fly = false;
      sel = Math.min(sel, slotCount() - 1);
      modeBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
      overlay.querySelector('[data-bkey="fly"]').hidden = survival;
      showMode();
      buildHotbar();
      panelText.textContent = survival
        ? "Survival: hold the left button to dig, and what you dig goes in your bag (press E or 🎒). Build with what you have, and craft new things: start by punching a tree for logs, make planks, then a crafting table. Stone needs a pickaxe!"
        : "Creative: dig, build and explore with every block! Left click digs a block and right click puts one down. Pick what to build with in the bar at the bottom. Swim in the lakes, and press F to fly.";
      saveSoon();
    }
    modeBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));

    /* ---------------- starting and stopping ---------------- */
    function spawn(){
      const s = spawnPoint();
      p.x = s[0] + 0.5; p.y = s[1]; p.z = s[2] + 0.5;
      p.vx = p.vy = p.vz = 0; yaw = 0; pitch = -0.15;
    }
    function ensureWorld(){
      if (store.blockVer !== WORLD_VERSION) { // an older world: start fresh rather than land builds in the wrong place
        store.blockVer = WORLD_VERSION; store.blockSeed = 0; store.blockEdits = {}; store.blockPos = null;
      }
      if (!store.blockSeed) store.blockSeed = 1 + Math.floor(Math.random() * 99999);
      if (!store.blockEdits) store.blockEdits = {};
      if (!Array.isArray(store.blockInv) || store.blockInv.length !== SV.SLOTS) store.blockInv = SV.newInventory();
      if (!store.blockFurnaces) store.blockFurnaces = {};
      if (loadedSeed === store.blockSeed) return;
      generate(store.blockSeed, store.blockEdits);
      torches.clear();
      Object.keys(store.blockEdits).forEach(k => { if (isTorch(world[+k])) torches.add(+k); });
      renderer.rebuildAll();
      loadedSeed = store.blockSeed;
      const s = store.blockPos;
      spawn();
      if (s && s.length === 5 && !collides(s[0], s[1], s[2])) { p.x = s[0]; p.y = s[1]; p.z = s[2]; yaw = s[3]; pitch = s[4]; }
      spawnMobs();
    }
    function lockMouse(){
      if (document.pointerLockElement === canvas || matchMedia("(pointer: coarse)").matches) return;   // touch screens: no mouse to lock, and a lock would swallow the joystick
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    }
    function releaseKeys(){ Fun.release(keys); }

    function start(){
      running = true;
      panel.hidden = true;
      releaseKeys();
      canvas.focus();
      lockMouse();
    }
    newBtn.addEventListener("click", () => {
      if (!confirm("Start a brand new world? The one you've built will be gone.")) return;
      store.blockSeed = 1 + Math.floor(Math.random() * 99999);
      store.blockEdits = {};
      store.blockPos = null;
      store.blockInv = SV.newInventory();
      store.blockFurnaces = {};
      Hub.saveStore();
      ensureWorld();
      p.fly = false; showMode(); refreshHotbar();
      panelText.textContent = "A brand new world is ready. Have fun!";
    });
    playBtn.addEventListener("click", start);

    function open(){
      isOpen = true; running = false;
      ensureWorld();
      Fun.screen(overlay, true);
      releaseKeys();
      setMode(store.blockMode === "survival" ? "survival" : "creative");
      playBtn.textContent = store.blocksPlaced || store.blocksBroken ? "▶ Continue" : "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function close(){
      ui.close();
      isOpen = false; running = false;
      Fun.screen(overlay, false);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      store.blockPos = [p.x, p.y, p.z, yaw, pitch];
      store.blockTime = dayT;
      clearTimeout(saveT);
      Hub.saveStore();
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last);
      last = now; frame++;
      if (running && !ui.isOpen()) step(dt);
      else if (running) { for (let k = 0; k < 3; k++) move(dt / 3); }   // with a screen open you stand still, but you still fall
      if (running) {
        dayT = (dayT + dt / CYCLE) % 1;
        // every furnace keeps cooking, even when you're not looking at it
        let busy = false;
        for (const k in store.blockFurnaces) { const f = store.blockFurnaces[k]; SV.tickFurnace(f, dt); if (f.burn > 0 || f.cook > 0) busy = true; }
        if (busy && (furnSaveT += dt) > 4) { furnSaveT = 0; saveSoon(); }
        ui.tick();
      }
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy -= (b.grav === undefined ? 16 : b.grav) * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
        if (b.life <= 0) bits.splice(i, 1);
      }
      if (swing > 0) { swing += dt / 0.26; if (swing >= 1) swing = 0; }
      if (running) flames(dt);
      if (nameT > 0 && (nameT -= dt) <= 0) nameEl.classList.remove("show");
      if (gpu) { // draw at the screen's real size, so every block texture is sharp
        const w = Math.min(1920, Math.round(canvas.clientWidth * (Fun.quality() === "low" ? 1 : Math.min(window.devicePixelRatio || 1, 2))));
        if (w > 0 && canvas.width !== w) { canvas.width = w; canvas.height = Math.round(w * 9 / 16); }
      }
      target = aim();
      const eyeY = p.y + EYE;
      const under = idAt(Math.floor(p.x), Math.floor(eyeY), Math.floor(p.z)) === ID.WATER;
      const sky = skyState(dayT);
      waterEl.hidden = !under;
      waterEl.style.opacity = String(0.3 + 0.7 * sky.day);
      renderer.draw({
        eye: [p.x, eyeY, p.z], yaw, pitch, time: now / 1000, swing, held: true, underwater: under, sky,
        target: target && !ui.isOpen() ? [target.x, target.y, target.z] : null, particles: bits, mobs,
        crack: mining && mining.t > 0 ? { x: mining.x, y: mining.y, z: mining.z, progress: Math.min(1, mining.t / mining.need) } : null
      });
      if (frame % 8 === 0) {
        posEl.textContent = `📍 ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`;
        const lbl = timeLabel();
        if (timeEl.textContent !== lbl) timeEl.textContent = lbl;
        store.blockTime = dayT;
      }
      requestAnimationFrame(loop);
    }

    /* ---------------- controls ---------------- */
    const KEYMAP = {
      KeyW: "forward", KeyS: "back", KeyA: "left", KeyD: "right", Space: "jump",
      ShiftLeft: "down", ShiftRight: "down",
      ArrowLeft: "lookL", ArrowRight: "lookR", ArrowUp: "lookU", ArrowDown: "lookD"
    };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (ui.isOpen()) ui.close();
        else if (running) pause();
        else if (performance.now() - unlockedAt > 400) Hub.leave();   // (not the same Esc that just let the mouse go)
        return;
      }
      if (e.code === "KeyP" && running && !ui.isOpen()) { pause(); return; }
      if (!running) return;
      if (e.code === "KeyE") { if (!e.repeat) toggleBag(); return; }
      if (ui.isOpen()) return;   // the screen has the mouse; keys wait
      if (e.code === "KeyF") { if (!e.repeat) toggleFly(); return; }
      if (e.code === "KeyT") { if (!e.repeat) nextTime(); return; }
      if (e.code === "Minus") { if (!survival) select(10); return; }
      const digit = /^Digit([0-9])$/.exec(e.code);
      if (digit) { if (survival && digit[1] === "0") return; select((+digit[1] + 9) % 10); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => {
      const k = KEYMAP[e.code];
      if (k) keys[k] = false;
    });
    window.addEventListener("blur", releaseKeys);

    // mouse: once the pointer is locked, moving it turns you; left digs, right builds
    let lockedAt = 0, unlockedAt = 0;
    const tip = Fun.hint(canvas.parentElement);
    const stick = Fun.joystick(canvas.parentElement);   // on phones: walk and step; drag the world to look
    document.addEventListener("pointerlockchange", () => {
      lockedAt = performance.now();
      if (ui.isOpen() && document.pointerLockElement === canvas) document.exitPointerLock(); // a screen is open: keep the mouse free
      if (document.pointerLockElement === canvas) tip.show("🖱️ Press Esc to get your mouse back");
      else {
        unlockedAt = performance.now(); tip.hide();
        // the mouse got let go (Esc, or another window): pause, like Minecraft does
        if (isOpen && running && !ui.isOpen()) pause();
      }
    });
    function pause(){
      running = false;
      releaseKeys(); mining = null;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      playBtn.textContent = "▶ Keep playing";
      panelText.textContent = "⏸ Paused. Your mouse is free again! Press ▶ Keep playing to jump back in, or ✕ Exit to leave.";
      panel.hidden = false;
      playBtn.focus();
    }
    document.addEventListener("mousemove", e => {
      if (!isOpen || !running || document.pointerLockElement !== canvas) return;
      // some browsers send one huge fake movement just as the pointer locks: skip it
      if (performance.now() - lockedAt < 250 || Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      yaw += e.movementX * 0.0025;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.0025));
    });
    let lookId = null, lookX = 0, lookY = 0;
    canvas.addEventListener("pointerdown", e => {
      if (!running) return;
      if (e.pointerType === "touch") { // a finger dragging on the picture turns you
        lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      e.preventDefault();
      if (e.button === 2) build();
      else if (survival) { keys.mine = true; mining = null; }
      else { dig(); keys.mine = true; mineT = 0.3; }
      if (!ui.isOpen()) lockMouse();   // (not when the click opened a crafting table or a furnace: you need the mouse for that)
    });
    canvas.addEventListener("pointermove", e => {
      if (e.pointerId !== lookId) return;
      yaw += (e.clientX - lookX) / canvas.clientWidth * 3.2;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - lookY) / canvas.clientHeight * 2.4));
      lookX = e.clientX; lookY = e.clientY;
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, e => {
      if (e.pointerId === lookId) lookId = null;
      else keys.mine = false;
    }));
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    overlay.addEventListener("wheel", e => {
      if (!running) return;
      e.preventDefault();
      select(sel + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
    canvas.tabIndex = 0;

    host.querySelectorAll("[data-bkey]").forEach(btn => {
      const k = btn.dataset.bkey;
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (!running) return;
        if (k === "place") build();
        else if (k === "fly") toggleFly();
        else if (k === "bag") toggleBag();
        else if (k === "mine") { if (!survival) dig(); keys.mine = true; mineT = 0.3; mining = null; }
        else keys[k] = true;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => {
        if (k === "mine") keys.mine = false;
        else if (k !== "place" && k !== "fly" && k !== "bag") keys[k] = false;
      }));
    });

    document.getElementById("blCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton(document.getElementById("blCloseBtn"));

    return { open, close };
  }
})();
