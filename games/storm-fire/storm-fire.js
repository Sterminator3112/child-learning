/* Storm Fire: an upgrade game. Keep a campfire alive through 10 storms. Tap twigs to feed the fire, and the
   fire makes ✨ embers that buy bigger fuel (logs, pinecones, coal, lamp oil, a meteor rock, dragon breath)
   and upgrades (an axe, bellows, a beaver helper, a stone ring). Each storm needs a fire of a certain level
   to survive it, and the 10th storm needs a level 100 fire. Lose a storm and the fire shrinks a little
   (less with more stones), then try again. Progress is saved, so you can come back later.
   The wow bits: the fire evolves at levels 10, 25, 45, 70 and 100 (a flash, a shockwave and a new name, up to
   a Phoenix Fire with flapping flame wings and the Rainbow Fire), sparks and smoke rise from it, picking
   twigs quickly builds a combo, and every storm looks different: wind with flying leaves, bouncing hail,
   a blizzard, a hurricane, a tornado that crosses the field, and a red-sky MEGA STORM. */
(function(){
  "use strict";
  const store = Hub.store;
  const S = () => store.stormFire;

  const STORMS = [
    { need: 3, name: "Drizzle" }, { need: 8, name: "Rain Shower" }, { need: 15, name: "Windy Night" },
    { need: 22, name: "Thunderstorm" }, { need: 30, name: "Hailstorm" }, { need: 40, name: "Big Blizzard" },
    { need: 52, name: "Monsoon" }, { need: 65, name: "Hurricane" }, { need: 80, name: "Tornado" },
    { need: 100, name: "THE MEGA STORM" }
  ];
  // fuel you buy with embers: [id, icon, name, cost, fire XP, fire level it unlocks at]
  const FUELS = [
    ["log", "🪵", "Log", 10, 8, 1], ["cone", "🌰", "Pinecones", 35, 32, 5], ["coal", "⚫", "Coal", 120, 125, 15],
    ["oil", "🛢️", "Lamp oil", 400, 450, 30], ["meteor", "☄️", "Meteor rock", 1500, 1800, 50], ["dragon", "🐉", "Dragon breath", 5000, 6500, 70]
  ];
  // upgrades: [id, icon, name, what it does, first cost, cost growth, max]
  const UPGRADES = [
    ["axe", "🪓", "Axe", "twigs give more", 15, 2, 10], ["bellows", "🌬️", "Bellows", "+50% embers", 40, 2.3, 10],
    ["beaver", "🦫", "Beaver", "picks up twigs", 80, 2.5, 8], ["stones", "🪨", "Stone ring", "storms hurt less", 100, 3, 5]
  ];
  // what the fire is called as it grows
  const STAGES = [[1, "Campfire"], [10, "Bonfire"], [25, "Blaze"], [45, "Inferno"], [70, "Phoenix Fire"], [100, "Rainbow Fire"]];
  const stageOf = lv => STAGES.filter(st => lv >= st[0]).pop()[1];
  const upCost = (u, n) => Math.round(u[4] * Math.pow(u[5], n));
  const xpNeed = lv => 4 + lv * 3;           // fire XP from level lv to lv + 1

  Hub.register({
    id: "storm-fire", section: "games", title: "Storm Fire", icon: "🔥",
    blurb: "Grow your campfire with logs, coal and dragon breath, and survive 10 storms!",
    stat: () => store.stormFire && store.stormFire.storm ? `Storms: ${store.stormFire.storm}/10 · 🔥 ${store.stormFire.lv}` : "",
    badges: [
      { id: "sf-storm1", icon: "🌧️", name: "First Storm", desc: "Survive the first storm in Storm Fire", test: () => !!store.stormFire && store.stormFire.storm >= 1 },
      { id: "sf-storm5", icon: "⛈️", name: "Storm Chaser", desc: "Survive 5 storms in Storm Fire", test: () => !!store.stormFire && store.stormFire.storm >= 5 },
      { id: "sf-storm10", icon: "🏆", name: "Storm Master", desc: "Survive all 10 storms in Storm Fire", test: () => !!store.stormFire && store.stormFire.storm >= 10 },
      { id: "sf-fire100", icon: "🌈", name: "Rainbow Fire", desc: "Grow a level 100 fire in Storm Fire", test: () => !!store.stormFire && store.stormFire.best >= 100 }
    ],
    mount
  });

  function fresh(){ return { lv: 1, xp: 0, embers: 0, storm: 0, best: 1, axe: 0, bellows: 0, beaver: 0, stones: 0 }; }

  function mount(host){
    if (!store.stormFire) store.stormFire = fresh();
    host.innerHTML = `
    <section class="game-screen" id="sfOverlay" hidden aria-label="Storm Fire">
      <div class="game-box sf-box">
        <div class="game-hud">
          <h2>🔥 Storm Fire</h2>
          <span class="mono game-stat" id="sfLevel">🔥 Lv 1</span>
          <span class="mono game-stat" id="sfEmbers">✨ 0</span>
          <span class="mono game-stat" id="sfStorms">⛈️ 0/10</span>
          <button class="btn ghost small" id="sfCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="sfCanvas" width="960" height="540"></canvas>
          <button class="btn sf-storm-btn" id="sfStormBtn" type="button" hidden>⛈️ Face the storm!</button>
          <div class="game-panel sf-panel" id="sfPanel">
            <div class="game-panel-title" id="sfPanelTitle">🔥 Storm Fire</div>
            <div class="game-panel-text" id="sfPanelText"></div>
            <div class="sf-panel-btns">
              <button class="btn" id="sfPlayBtn" type="button">▶ Play</button>
              <button class="btn ghost" id="sfNewBtn" type="button" hidden>🔄 New fire</button>
            </div>
          </div>
        </div>
        <div class="sf-shop" id="sfShop"></div>
        <div class="game-help">Click the twigs 🌿 (or press Space) to feed the fire · buy fuel and upgrades with ✨ embers · face the storm when your fire is big enough!</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("sfOverlay"), canvas = $("sfCanvas"), ctx = canvas.getContext("2d");
    const panel = $("sfPanel"), panelTitle = $("sfPanelTitle"), panelText = $("sfPanelText"), playBtn = $("sfPlayBtn"), newBtn = $("sfNewBtn");
    const stormBtn = $("sfStormBtn"), shop = $("sfShop");
    const W = 960, H = 540, FX = 480, FY = 430;
    const fx = Fun.pops();

    let isOpen = false, running = false, last = 0, clock = 0, saveT = 0, shopT = 0;
    let twigs = [], twigT = 0, spawn = 0, beaverT = 0, flying = [], flames = [], rain = [];
    let storm = null;          // { t, i, flash } while a storm is on
    let shopHtml = "";
    let sparks = [], smoke = [], bits = [], shake = 0, evolve = null, combo = 0, comboT = 0, roar = 0;

    /* ----- the fire's level ----- */
    function feed(xp){
      const s = S();
      s.xp += xp;
      while (s.xp >= xpNeed(s.lv)) {
        s.xp -= xpNeed(s.lv); s.lv++;
        if (s.lv > s.best) s.best = s.lv;
        if (STAGES.some(st => st[0] === s.lv)) evolveTo(stageOf(s.lv));
        fx.pop("LEVEL " + s.lv + "!", FX, FY - flameSize() - 30, "#ffe14d", 30);
        if (s.lv % 10 === 0) { Fun.sfx.tada(); fx.burst(FX, FY - 60, "#ffd84d", 30, 220); } else Fun.sfx.ding();
        if (s.lv === 100) fx.pop("🌈 RAINBOW FIRE!", W / 2, 120, "#fff", 44);
      }
      Hub.checkBadges();
    }
    // the big moment when the fire grows into its next form
    function evolveTo(name){
      evolve = { t: 0, name };
      fx.pop("🔥 FIRE EVOLVED!", W / 2, 130, "#fff", 44); fx.pop(name.toUpperCase() + "!", W / 2, 185, "#ffd84d", 36);
      fx.burst(FX, FY - 60, "#fff", 40, 320); shake = 0.6;
      Fun.sfx.tada(); Fun.sfx.whoosh();
    }
    const flameSize = () => 40 + 20 * Math.log2(S().lv + 1);
    // the fire changes colour as it grows: orange, yellow, blue, purple, green, then a rainbow at level 100
    function flameHue(k){
      const lv = S().lv;
      if (lv >= 100) return (k * 60 + clock * 200) % 360;
      return lv >= 80 ? 120 : lv >= 60 ? 285 : lv >= 40 ? 205 : lv >= 20 ? 48 : 25;
    }
    const embersPerSec = () => 0.4 * S().lv * (1 + 0.5 * S().bellows);

    /* ----- twigs on the ground ----- */
    function spawnTwig(){
      if (twigs.length >= 7) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      twigs.push({ x: FX + side * (140 + Math.random() * 300), y: 400 + Math.random() * 110, rot: Math.random() * 6, t: 0 });
    }
    function pickTwig(tw){
      twigs.splice(twigs.indexOf(tw), 1);
      // quick picks build a combo: double at 5 in a row, triple at 10…
      combo = comboT > 0 ? combo + 1 : 1; comboT = 1.3;
      const s = S(), mult = Math.min(5, 1 + Math.floor(combo / 5)), gain = (1 + s.axe) * mult;
      if (combo % 5 === 0) { fx.pop(`🌿 ${combo} COMBO! ×${mult}`, tw.x, tw.y - 50, "#7dff9a", 28); Fun.sfx.zap(); }
      s.embers += gain;
      flying.push({ x: tw.x, y: tw.y, icon: "🌿", xp: gain, t: 0, fromX: tw.x, fromY: tw.y });
      fx.pop("+" + gain + "✨", tw.x, tw.y - 20, "#ffe14d", 20);
      Fun.sfx.pop();
    }
    function buyFuel(f){
      const s = S();
      if (s.embers < f[3] || s.lv < f[5]) return;
      s.embers -= f[3];
      const side = Math.random() < 0.5 ? -1 : 1;
      flying.push({ icon: f[1], xp: f[4], t: 0, fromX: FX + side * 360, fromY: 500 });
      Fun.sfx.whoosh(); refreshShop();
    }
    function buyUpgrade(u){
      const s = S(), n = s[u[0]];
      if (n >= u[6] || s.embers < upCost(u, n)) return;
      s.embers -= upCost(u, n); s[u[0]]++;
      fx.pop(u[1] + " " + u[2] + " " + s[u[0]] + "!", FX, 160, "#7df9ff", 30); Fun.sfx.coin();
      Hub.saveStore(); refreshShop();
    }

    /* ----- storms ----- */
    function startStorm(){
      const s = S();
      if (storm || s.storm >= STORMS.length) return;
      storm = { t: 0, i: s.storm, flash: 0, bolt: null, tornado: -150 };
      rain = []; bits = [];
      stormBtn.hidden = true;
      fx.pop("⚠️ STORM INCOMING! ⚠️", W / 2, H / 2 - 40, "#ff5a5a", 46);
      Fun.sfx.crash(); Fun.sfx.honk(); shake = 0.5;
    }
    function endStorm(){
      const s = S(), st = STORMS[storm.i];
      if (s.lv >= st.need) {
        s.storm++;
        const prize = 25 * st.need;
        s.embers += prize;
        roar = 1.2; shake = 0.7; fx.burst(FX, FY - 80, "#ffd84d", 50, 420);
        fx.pop("SURVIVED! 🎉", W / 2, 150, "#ffe14d", 48); fx.pop("+" + prize + "✨", W / 2, 210, "#fff", 28);
        Fun.sfx.tada(); Hub.confettiBurst(stormBtn);
        if (s.storm >= STORMS.length) setTimeout(won, 1500);
      } else {
        const drop = Math.max(0, 5 - s.stones);
        s.lv = Math.max(1, s.lv - drop); s.xp = 0;
        for (let i = 0; i < 30; i++) smoke.push({ x: FX + (Math.random() - 0.5) * 80, y: FY - 30, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, r: 14 + Math.random() * 16, t: 0, max: 2 + Math.random() });
        fx.pop("FIZZLE... 💨", W / 2, 150, "#9ecbff", 44);
        fx.pop(drop ? `Your fire lost ${drop} levels` : "🪨 Your stones kept it safe!", W / 2, 210, "#fff", 24);
        Fun.sfx.wah(); Fun.shake(canvas);
      }
      storm = null; rain = [];
      Hub.saveStore(); Hub.checkBadges(); refreshShop();
    }
    function won(){
      if (!isOpen) return;
      running = false;
      panelTitle.textContent = "🏆 You beat all 10 storms!";
      panelText.textContent = `Your fire is level ${S().lv} and nothing can put it out. You're the Storm Master! Keep growing it, or start a new fire.`;
      playBtn.textContent = "▶ Keep playing"; newBtn.hidden = false; panel.hidden = false;
      Hub.confettiBurst(playBtn);
    }

    /* ----- the shop under the picture ----- */
    function refreshShop(){
      const s = S();
      const html = FUELS.map((f, i) => s.lv < f[5]
        ? `<button class="sf-item locked" type="button" disabled><b>🔒</b><span>Fire Lv ${f[5]}</span></button>`
        : `<button class="sf-item" type="button" data-fuel="${i}" ${s.embers < f[3] ? "disabled" : ""}><b>${f[1]} ${f[2]}</b><span>✨${f[3]} → 🔥+${f[4]}</span></button>`
      ).join("") + UPGRADES.map((u, i) => {
        const n = s[u[0]];
        return n >= u[6]
          ? `<button class="sf-item up" type="button" disabled><b>${u[1]} ${u[2]} MAX</b><span>${u[3]}</span></button>`
          : `<button class="sf-item up" type="button" data-up="${i}" ${s.embers < upCost(u, n) ? "disabled" : ""}><b>${u[1]} ${u[2]} ${n + 1}</b><span>✨${upCost(u, n)} · ${u[3]}</span></button>`;
      }).join("");
      if (html !== shopHtml) shop.innerHTML = shopHtml = html;   // only when something changed, so a click isn't lost
    }
    shop.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !running || storm) return;
      if (b.dataset.fuel) buyFuel(FUELS[+b.dataset.fuel]);
      if (b.dataset.up) buyUpgrade(UPGRADES[+b.dataset.up]);
    });

    /* ----- drawing ----- */
    function drawScene(dt){
      const dark = storm ? Math.min(1, storm.t / 1.2) * (storm.t > 6.2 ? Math.max(0, (7 - storm.t) / 0.8) : 1) : 0;
      const mega = storm && storm.i === STORMS.length - 1;
      // the camera: a shake for big moments, and a zoom on the fire when it evolves or roars
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 18 * shake);
      const zoom = (evolve ? Math.sin(Math.min(1, evolve.t / 1.6) * Math.PI) * 0.12 : 0) + roar * 0.06;
      if (zoom) { ctx.translate(FX, FY - 80); ctx.scale(1 + zoom, 1 + zoom); ctx.translate(-FX, -(FY - 80)); }
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mega && dark ? "#3a0610" : dark ? "#0b0d16" : "#0d1838"); sky.addColorStop(1, mega && dark ? "#5a1a2a" : dark ? "#2a2f3c" : "#2c3f6e");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (!dark) { ctx.fillStyle = "#fff"; for (let i = 0; i < 40; i++) { const tw = 0.5 + Math.sin(clock * 2 + i) * 0.5; ctx.globalAlpha = 0.3 + tw * 0.6; ctx.fillRect((i * 173) % W, (i * 97) % 220, 2, 2); } ctx.globalAlpha = 1;
        ctx.fillStyle = "#f4f1d0"; ctx.beginPath(); ctx.arc(820, 80, 30, 0, 7); ctx.fill(); }
      // pine trees all round, then the ground
      for (let i = 0; i < 14; i++) {
        const x = i * 72 + 10, h = 120 + (i * 37) % 70, sway = storm ? Math.sin(clock * 6 + i) * 10 * dark : 0;
        ctx.fillStyle = "#0e2a22"; ctx.beginPath(); ctx.moveTo(x - 34, 400); ctx.lineTo(x + sway, 400 - h); ctx.lineTo(x + 34, 400); ctx.fill();
      }
      ctx.fillStyle = "#24361f"; ctx.fillRect(0, 380, W, H - 380);
      // the light of the fire on the ground
      const glow = ctx.createRadialGradient(FX, FY, 10, FX, FY, 120 + flameSize() * 1.6);
      glow.addColorStop(0, `hsla(${flameHue(0)},100%,60%,0.45)`); glow.addColorStop(1, "hsla(30,100%,50%,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 200, W, H - 200);
      // the stone ring and the log pile
      const ring = 8 + S().stones * 3;
      for (let i = 0; i < ring; i++) {
        const a = Math.PI * (i / (ring - 1)), x = FX + Math.cos(a) * 80, y = FY + 18 - Math.sin(a) * 8;
        ctx.fillStyle = i % 2 ? "#7a7d86" : "#9599a3"; ctx.beginPath(); ctx.ellipse(x, y, 13, 9, 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#6b4426";
      [[-0.35, 1], [0.35, -1], [0, 0]].forEach(([r]) => { ctx.save(); ctx.translate(FX, FY + 4); ctx.rotate(r); ctx.fillRect(-58, -8, 116, 16); ctx.restore(); });
      drawFlames(dt, dark);
      drawSparks(dt, dark);
      // twigs to pick up, bobbing a little so they're easy to spot
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "34px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'";
      twigs.forEach(tw => { tw.t += dt; ctx.save(); ctx.translate(tw.x, tw.y + Math.sin(tw.t * 4) * 3); ctx.rotate(Math.sin(tw.rot) * 0.4); ctx.fillText("🌿", 0, 0); ctx.restore(); });
      // the beaver, trotting about collecting
      if (S().beaver) { const bx = FX + Math.sin(clock * 0.7) * 330; ctx.save(); ctx.translate(bx, 470); ctx.scale(Math.cos(clock * 0.7) > 0 ? -1 : 1, 1); ctx.font = "40px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'"; ctx.fillText("🦫", 0, Math.abs(Math.sin(clock * 8)) * -4); ctx.restore(); }
      // fuel flying into the fire
      ctx.font = "34px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'";
      flying = flying.filter(f => {
        f.t += dt * 1.8;
        const k = Math.min(1, f.t), x = f.fromX + (FX - f.fromX) * k, y = f.fromY + (FY - 30 - f.fromY) * k - Math.sin(k * Math.PI) * 120;
        if (k >= 1) { feed(f.xp); fx.burst(FX, FY - 30, `hsl(${flameHue(0)},100%,60%)`, 10); fx.pop("+" + f.xp + "🔥", FX + 70, FY - 70, "#ffb347", 22); return false; }
        ctx.fillText(f.icon, x, y); return true;
      });
      if (storm) drawStorm(dt, dark);
      // the evolve flash and its shockwave ring
      if (evolve) {
        evolve.t += dt;
        const k = evolve.t / 1.6;
        if (k < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - k * 4)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
        ctx.strokeStyle = `hsla(${flameHue(0)},100%,70%,${Math.max(0, 1 - k)})`; ctx.lineWidth = 10 * (1 - k) + 2;
        ctx.beginPath(); ctx.ellipse(FX, FY - 40, k * 700, k * 320, 0, 0, 7); ctx.stroke();
        if (k >= 1) evolve = null;
      }
      if (roar > 0) { ctx.strokeStyle = `rgba(255,200,80,${roar / 1.2})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(FX, FY - 60, (1.2 - roar) * 600, 0, 7); ctx.stroke(); }
      ctx.restore();
      // the fire's name, top left
      ctx.font = "800 18px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "left"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)";
      const label = `🔥 ${stageOf(S().lv)}` + (combo >= 3 && comboT > 0 ? `   🌿 combo ${combo}` : "");
      ctx.strokeText(label, 14, H - 16); ctx.fillStyle = `hsl(${flameHue(0)},100%,70%)`; ctx.fillText(label, 14, H - 16);
    }
    // sparks floating up out of the fire, and smoke drifting away
    function drawSparks(dt, dark){
      const lv = S().lv, size = flameSize();
      if (Math.random() < dt * (6 + lv * 0.4) * (Fun.quality() === "low" ? 0.5 : 1)) sparks.push({ x: FX + (Math.random() - 0.5) * size * 0.6, y: FY - size * 0.6, vx: (Math.random() - 0.5) * 50, vy: -80 - Math.random() * 120 - lv, t: 0, max: 1.2 + Math.random() * 1.5, k: Math.random() * 6 | 0 });
      if (Math.random() < dt * 2) smoke.push({ x: FX + (Math.random() - 0.5) * 30, y: FY - size * 1.1, vx: 10 + Math.random() * 20, vy: -30 - Math.random() * 20, r: 10 + Math.random() * 10, t: 0, max: 3 + Math.random() * 2 });
      const wind = storm ? -160 * dark : 0;
      ctx.fillStyle = "#aaa";
      smoke = smoke.filter(m => { m.t += dt; m.x += (m.vx + wind) * dt; m.y += m.vy * dt; ctx.globalAlpha = 0.18 * (1 - m.t / m.max); ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1 + m.t), 0, 7); ctx.fill(); return m.t < m.max; });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "lighter";
      sparks = sparks.filter(p => {
        p.t += dt; p.x += (p.vx + wind + Math.sin(p.t * 6 + p.k) * 30) * dt; p.y += p.vy * dt;
        ctx.fillStyle = `hsla(${flameHue(p.k)},100%,70%,${Math.max(0, 1 - p.t / p.max) * (0.6 + 0.4 * Math.sin(p.t * 20))})`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        return p.t < p.max;
      });
      ctx.globalCompositeOperation = "source-over";
    }
    function drawFlames(dt, dark){
      const size = flameSize() * (storm ? 1 - 0.25 * dark * (0.5 + 0.5 * Math.sin(clock * 9)) : 1);
      const wind = storm ? -2.5 * dark : 0;
      // flames per second, fewer on the Low graphics setting
      spawn += dt * (60 + size * 2.5) * (Fun.quality() === "low" ? 0.5 : 1);
      for (; spawn >= 1; spawn--) flames.push({ x: FX + (Math.random() - 0.5) * size * 0.9, y: FY - 6, vy: -(60 + Math.random() * 60) * (size / 70), life: 0, max: 0.6 + Math.random() * 0.5, r: size * (0.18 + Math.random() * 0.14), k: Math.random() * 6 | 0 });
      ctx.globalCompositeOperation = "lighter";
      flames = flames.filter(f => {
        f.life += dt; if (f.life > f.max) return false;
        const p = f.life / f.max;
        f.y += f.vy * dt; f.x += (FX - f.x) * dt * 1.5 + wind * 60 * dt * p;
        ctx.fillStyle = `hsla(${flameHue(f.k)},100%,${48 + 14 * (1 - p)}%,${0.22 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - p * 0.6), 0, 7); ctx.fill();
        return true;
      });
      // a Phoenix Fire grows wings of flame that flap
      if (S().lv >= 70) {
        const flap = Math.sin(clock * 3) * 0.35, wy = FY - size * 0.75;
        [-1, 1].forEach(side => {
          ctx.fillStyle = `hsla(${flameHue(side > 0 ? 2 : 4)},100%,60%,0.35)`;
          ctx.beginPath(); ctx.moveTo(FX, wy);
          ctx.quadraticCurveTo(FX + side * size * 1.2, wy - size * (0.9 + flap), FX + side * size * 2.1, wy - size * (0.3 + flap));
          ctx.quadraticCurveTo(FX + side * size * 1.1, wy - size * 0.1, FX, wy + size * 0.3);
          ctx.fill();
        });
      }
      ctx.globalCompositeOperation = "source-over";
      // a cheerful face in the fire
      Fun.face(ctx, FX, FY - size * 0.45, Math.max(14, size * 0.2), storm ? "wow" : "happy", clock, 0, -0.2);
    }
    function drawStorm(dt, dark){
      const st = STORMS[storm.i], s = S();
      // clouds rolling in over the top
      ctx.fillStyle = `rgba(40,44,58,${0.9 * dark})`;
      for (let i = 0; i < 9; i++) { const x = ((i * 130 + clock * 40) % (W + 200)) - 100; ctx.beginPath(); ctx.arc(x, 50, 70, 0, 7); ctx.arc(x + 60, 70, 55, 0, 7); ctx.fill(); }
      // rain (or snow for the blizzard), slanting in the wind
      const snow = st.name === "Big Blizzard";
      for (let i = 0; i < 8 + storm.i * 3; i++) rain.push({ x: Math.random() * (W + 200), y: -10, v: snow ? 120 : 600 + Math.random() * 200 });
      ctx.strokeStyle = "rgba(170,200,255,0.6)"; ctx.fillStyle = "#fff"; ctx.lineWidth = 2;
      rain = rain.filter(r => { r.y += r.v * dt; r.x -= r.v * dt * 0.35; if (snow) { ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + 6, r.y - 18); ctx.stroke(); } return r.y < H; });
      // each storm brings its own trouble
      const name = st.name, mega = storm.i === STORMS.length - 1;
      ctx.font = "26px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if ((name === "Windy Night" || name === "Hurricane" || mega) && Math.random() < dt * 8) bits.push({ icon: name === "Hurricane" || mega ? (Math.random() < 0.5 ? "🪵" : "🍂") : "🍂", x: W + 30, y: 80 + Math.random() * 380, vx: -300 - Math.random() * 300, vy: (Math.random() - 0.5) * 120, spin: 0, ground: false });
      if ((name === "Hailstorm" || mega) && Math.random() < dt * 14) bits.push({ hail: true, x: Math.random() * W, y: -10, vx: -60, vy: 400 + Math.random() * 200 });
      bits = bits.filter(b => {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.hail) {
          if (b.y > 420 + (b.x * 7) % 100 && b.vy > 0) { b.vy = -b.vy * 0.35; if (Math.abs(b.vy) < 40) return false; }
          b.vy += 900 * dt; ctx.fillStyle = "#e8f4ff"; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill();
        } else { b.spin += dt * 8; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin); ctx.fillText(b.icon, 0, 0); ctx.restore(); }
        return b.x > -40 && b.y < H + 20;
      });
      if (name === "Big Blizzard") { ctx.fillStyle = `rgba(230,240,255,${0.25 * dark})`; ctx.fillRect(0, 0, W, H); }
      // the tornado crosses the field and tugs at the fire
      if (name === "Tornado" || mega) {
        storm.tornado += dt * 170;
        const tx = storm.tornado;
        for (let k = 0; k < 14; k++) {
          const y = 40 + k * 28, w = 18 + k * k * 0.9, wob = Math.sin(clock * 9 + k * 0.7) * 12;
          ctx.strokeStyle = `rgba(150,160,175,${0.55 * dark})`; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.ellipse(tx + wob, 420 - y + 40, w, 7 + k * 0.4, 0, 0, 7); ctx.stroke();
        }
      }
      // lightning, with a jolt
      storm.flash = Math.max(0, storm.flash - dt * 3);
      if (storm.i >= 2 && Math.random() < dt * (0.6 + storm.i * 0.15 + (mega ? 1.5 : 0))) {
        storm.flash = 1; let x = 100 + Math.random() * 760, y = 0; storm.bolt = [[x, y]];
        while (y < 360) { x += (Math.random() - 0.5) * 70; y += 40; storm.bolt.push([x, y]); }
        Fun.sfx.thunk(); shake = Math.max(shake, 0.35);
      }
      if (storm.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${storm.flash * 0.35})`; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(255,255,200,${storm.flash})`; ctx.lineWidth = 4; ctx.beginPath();
        storm.bolt.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        ctx.strokeStyle = `rgba(160,190,255,${storm.flash * 0.5})`; ctx.lineWidth = 12; ctx.stroke();
      }
      // the battle bars: your fire against the storm
      const k = Math.min(1, storm.t / 6), win = s.lv >= st.need;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(W / 2 - 250, 20, 500, 74);
      ctx.font = "800 20px 'Bricolage Grotesque', sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.fillText(`⛈️ Storm ${storm.i + 1}: ${st.name}`, W / 2, 42);
      ctx.font = "700 15px system-ui";
      ctx.fillText(`🔥 Your fire: Lv ${s.lv}   vs   needs Lv ${st.need}`, W / 2, 64);
      const fill = win ? 1 : s.lv / st.need;
      ctx.fillStyle = "#333"; ctx.fillRect(W / 2 - 230, 74, 460, 12);
      ctx.fillStyle = win ? "#ffb347" : "#6fa8ff"; ctx.fillRect(W / 2 - 230, 74, 460 * (1 - k + k * fill), 12);
    }

    function hud(){
      const s = S();
      $("sfLevel").textContent = `🔥 Lv ${s.lv} (${Math.floor(s.xp / xpNeed(s.lv) * 100)}%)`;
      $("sfEmbers").textContent = "✨ " + Math.floor(s.embers);
      $("sfStorms").textContent = `⛈️ ${s.storm}/10`;
      if (running && !storm && s.storm < STORMS.length) {
        const st = STORMS[s.storm], ready = s.lv >= st.need;
        stormBtn.hidden = false; stormBtn.classList.toggle("ready", ready);
        stormBtn.textContent = `⛈️ Storm ${s.storm + 1}: ${st.name} · needs 🔥 Lv ${st.need}` + (ready ? " · GO!" : "");
      } else stormBtn.hidden = true;
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last, 0.05); last = now; clock += dt;
      const s = S();
      shake = Math.max(0, shake - dt * 1.5); roar = Math.max(0, roar - dt); comboT = Math.max(0, comboT - dt);
      if (running) {
        s.embers += embersPerSec() * dt;
        twigT -= dt; if (twigT <= 0) { spawnTwig(); twigT = 1.1; }
        if (s.beaver) { beaverT -= dt; if (beaverT <= 0 && twigs.length && !storm) { pickTwig(twigs[0]); beaverT = 2.4 / s.beaver; } }
        if (storm) { storm.t += dt; if (storm.t >= 7) endStorm(); }
        saveT += dt; if (saveT > 5) { saveT = 0; Hub.saveStore(); }
        shopT += dt; if (shopT > 0.4) { shopT = 0; refreshShop(); }
      }
      drawScene(dt);
      fx.draw(ctx, dt);
      hud();
      requestAnimationFrame(loop);
    }

    // clicks on the picture pick up twigs
    canvas.addEventListener("pointerdown", e => {
      if (!running || storm) return;
      const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      const tw = twigs.find(t => Math.hypot(t.x - x, t.y - y) < 40);
      if (tw) pickTwig(tw);
    });
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (e.code === "Space" && running && !storm) { e.preventDefault(); if (twigs.length) pickTwig(twigs[0]); }
    });

    function start(){ running = true; panel.hidden = true; refreshShop(); canvas.focus(); }
    function openGame(){
      isOpen = true; running = false; storm = null;
      Fun.screen(overlay, true);
      const s = S();
      panelTitle.textContent = "🔥 Storm Fire";
      panelText.textContent = s.storm >= STORMS.length
        ? `You beat all 10 storms! Your fire is level ${s.lv}.`
        : "10 storms are coming! Click the twigs 🌿 to feed your campfire. The fire makes ✨ embers: spend them on logs, coal and even dragon breath to make it bigger, and on upgrades. When your fire is big enough, face the storm. The 10th storm needs a level 100 fire!";
      playBtn.textContent = s.lv > 1 || s.storm ? "▶ Continue" : "▶ Play";
      newBtn.hidden = !(s.storm >= STORMS.length);
      panel.hidden = false; refreshShop();
      last = performance.now(); requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; storm = null; Hub.saveStore(); Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    newBtn.addEventListener("click", () => { store.stormFire = Object.assign(fresh(), { best: S().best }); Hub.saveStore(); twigs = []; start(); });
    stormBtn.addEventListener("click", startStorm);
    canvas.tabIndex = 0;
    $("sfCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("sfCloseBtn"));

    return { open: openGame, close: closeGame };
  }
})();
