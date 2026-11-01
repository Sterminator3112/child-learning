/* Critter Quest: a monster-catching adventure. Pick a starter, walk through the tall grass to meet wild critters,
   weaken them in a turn-based battle and throw a Critter Ball to catch one. Critters level up and evolve, the
   🏥 Critter Center heals the team, and the 🏟️ Gym Captain guards the Spark Badge. Fire beats leaf, leaf beats
   water and spark, water beats fire, spark beats water. All the critters are made up for this game.
   Critters learn a support move at level 6 and a big move once fully evolved. Every throw asks a quick maths
   or word question, and a right answer aims it better. The 🎒 Team screen sorts the team and the box, and
   swaps ⭐ study stars from Learning for Super Balls. */
(function(){
  "use strict";
  const store = Hub.store;

  const TYPES = { fire: "🔥 Fire", water: "💧 Water", leaf: "🌿 Leaf", spark: "⚡ Spark", normal: "⭐ Normal" };
  const BEATS = { fire: ["leaf"], water: ["fire"], leaf: ["water", "spark"], spark: ["water"], normal: [] };
  const MOVE = { fire: "Ember Burst", water: "Splash Blast", leaf: "Leaf Whirl", spark: "Zap Bolt", normal: "Mega Bonk" };
  // learned at level 6: raises attack or defence for the battle, heals a third, or a quick hit that always goes first
  const SUPPORT = {
    fire: { name: "Fire Up", fx: "atk" }, water: { name: "Bubble Shield", fx: "def" }, leaf: { name: "Leaf Snack", fx: "heal" },
    spark: { name: "Quick Zap", power: 40, first: true }, normal: { name: "Snack Time", fx: "heal" }
  };
  // learned by a fully evolved critter: strong, but it can miss
  const BIG = { fire: "Inferno", water: "Tidal Wave", leaf: "Sun Blaster", spark: "Thunder Crash", normal: "Giga Bonk" };
  // the catch quiz: German words with their English and French
  const WORDS = [
    ["Hund", "dog", "chien"], ["Katze", "cat", "chat"], ["Haus", "house", "maison"], ["Wasser", "water", "eau"], ["Feuer", "fire", "feu"],
    ["Baum", "tree", "arbre"], ["Blume", "flower", "fleur"], ["Vogel", "bird", "oiseau"], ["Fisch", "fish", "poisson"], ["Sonne", "sun", "soleil"],
    ["Mond", "moon", "lune"], ["Apfel", "apple", "pomme"], ["Buch", "book", "livre"], ["Schule", "school", "école"], ["rot", "red", "rouge"],
    ["grün", "green", "vert"], ["blau", "blue", "bleu"], ["gross", "big", "grand"], ["klein", "small", "petit"], ["Freund", "friend", "ami"]
  ];
  const eff = (a, d) => BEATS[a].includes(d) ? 2 : BEATS[d].includes(a) ? 0.5 : 1;

  // base stats are [hp, attack, defence, speed]; evo is [level, becomes]
  const SP = {
    embit:       { name: "Embit",       icon: "🦊", type: "fire",   b: [40, 12, 9, 11],  evo: [8, "blazion"] },
    blazion:     { name: "Blazion",     icon: "🦁", type: "fire",   b: [62, 18, 13, 15] },
    splashy:     { name: "Splashy",     icon: "🐟", type: "water",  b: [44, 10, 12, 10], evo: [8, "torrenta"] },
    torrenta:    { name: "Torrenta",    icon: "🐬", type: "water",  b: [66, 15, 17, 14] },
    sprig:       { name: "Sprig",       icon: "🐛", type: "leaf",   b: [42, 11, 11, 9],  evo: [8, "bloomoth"] },
    bloomoth:    { name: "Bloomoth",    icon: "🦋", type: "leaf",   b: [64, 16, 15, 16] },
    zapkit:      { name: "Zapkit",      icon: "🐭", type: "spark",  b: [34, 12, 8, 16],  evo: [9, "thundrat"] },
    thundrat:    { name: "Thundrat",    icon: "🐀", type: "spark",  b: [54, 18, 12, 20] },
    fluffo:      { name: "Fluffo",      icon: "🐰", type: "normal", b: [46, 10, 10, 10], evo: [7, "bunnova"] },
    bunnova:     { name: "Bunnova",     icon: "🐇", type: "normal", b: [66, 15, 14, 16] },
    pipsy:       { name: "Pipsy",       icon: "🐦", type: "normal", b: [36, 10, 8, 14],  evo: [9, "skyhawk"] },
    skyhawk:     { name: "Skyhawk",     icon: "🦅", type: "normal", b: [58, 17, 12, 19] },
    mossy:       { name: "Mossy",       icon: "🐸", type: "leaf",   b: [48, 11, 12, 8],  evo: [10, "toadwood"] },
    toadwood:    { name: "Toadwood",    icon: "🐊", type: "leaf",   b: [72, 17, 17, 10] },
    pupflame:    { name: "Cinderpup",   icon: "🐕", type: "fire",   b: [42, 12, 10, 12], evo: [10, "infernhound"] },
    infernhound: { name: "Infernhound", icon: "🐺", type: "fire",   b: [64, 18, 14, 15] },
    dracolit:    { name: "Dracolit",    icon: "🐲", type: "fire",   b: [84, 21, 18, 18] }
  };
  const IDS = Object.keys(SP), STARTERS = ["embit", "splashy", "sprig"];
  const WILD = ["fluffo", "fluffo", "pipsy", "pipsy", "zapkit", "mossy", "sprig", "splashy", "embit", "pupflame"];

  // the map: # tree, ~ water, . path, g tall grass, H Critter Center, G Gym
  const MAP = [
    "############",
    "#..gggg..H.#",
    "#..gggg....#",
    "#.~~..gg.#.#",
    "#.~~..gg.#.#",
    "#gg....g...#",
    "#ggg.#.....#",
    "#gg..#..G..#",
    "############"
  ];
  const COLS = MAP[0].length, ROWS = MAP.length;
  const TILE = { "#": ["🌳", "tree"], "~": ["🌊", "water"], ".": ["", "path"], g: ["🌿", "grass"], H: ["🏥", "center"], G: ["🏟️", "gym"] };

  const sp = m => SP[m.sp];
  const stat = (m, i) => Math.floor(sp(m).b[i] * m.lv / 10) + 5;
  const maxHp = m => Math.floor(sp(m).b[0] * m.lv / 8) + m.lv + 10;
  const needXp = lv => lv * lv * 2 + 10;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function mk(id, lv){ const m = { sp: id, lv, xp: 0, hp: 0 }; m.hp = maxHp(m); return m; }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function movesOf(m){
    const s = sp(m), t = s.type;
    const list = [{ name: "Tackle", power: 40, type: "normal" }, { name: MOVE[t], power: s.evo ? 55 : 68, type: t }];
    if (m.lv >= 6) list.push(Object.assign({ type: t }, SUPPORT[t]));
    if (!s.evo) list.push({ name: BIG[t], power: 90, type: t, acc: 0.8 });
    return list;
  }
  // atkUp and defUp are the battle's boosts (x1.25 a step)
  function damage(att, def, mv, atkUp, defUp){
    const e = eff(mv.type, sp(def).type);
    const base = Math.floor(((2 * att.lv / 5 + 2) * mv.power * stat(att, 1) * atkUp / (stat(def, 2) * defUp)) / 26) + 2;
    return { n: Math.max(1, Math.floor(base * e * (0.85 + Math.random() * 0.15))), e };
  }
  // a quick question for aiming a Critter Ball: times tables, adding, dividing, or a word in English or French
  function quiz(){
    if (Math.random() < 0.6) {
      const k = rnd(0, 2);
      let q, a;
      if (k === 0) { const x = rnd(2, 10), y = rnd(2, 10); q = `${x} × ${y}`; a = x * y; }
      else if (k === 1) { const x = rnd(12, 88), y = rnd(11, 99 - x); q = `${x} + ${y}`; a = x + y; }
      else { const y = rnd(2, 10); a = rnd(2, 10); q = `${a * y} ÷ ${y}`; }
      const opts = new Set([a]);
      while (opts.size < 3) { const o = a + rnd(-10, 10); if (o > 0) opts.add(o); }
      return { q: q + " = ?", a: String(a), opts: shuffle([...opts].map(String)) };
    }
    const lang = Math.random() < 0.6 ? 1 : 2, w = pick(WORDS), others = shuffle(WORDS.filter(x => x !== w)).slice(0, 2);
    return { q: `${lang === 1 ? "In English" : "En français"}: „${w[0]}“?`, a: w[lang], opts: shuffle([w, ...others].map(x => x[lang])) };
  }
  const C = () => store.critters;
  const fresh = () => ({ team: [], box: [], balls: 8, dex: {}, caught: 0, evolved: 0, badge: 0, gymWins: 0, x: 1, y: 1, super: 0 });
  const dexCount = () => C() ? Object.keys(C().dex).length : 0;

  Hub.register({
    id: "critters", section: "games", title: "Critter Quest", icon: "🐾",
    blurb: "Catch, train and evolve critters, then beat the Gym Captain for the Spark Badge!",
    stat: () => C() && C().team.length ? `Critterdex: ${dexCount()}/${IDS.length}` : "",
    badges: [
      { id: "cr-1", icon: "🐾", name: "Critter Buddy", desc: "Pick your first critter in Critter Quest", test: () => !!C() && C().team.length + C().box.length > 0 },
      { id: "cr-catch5", icon: "⚪", name: "Critter Catcher", desc: "Catch 5 wild critters", test: () => !!C() && C().caught >= 5 },
      { id: "cr-evolve", icon: "✨", name: "Evolution!", desc: "Make a critter evolve", test: () => !!C() && C().evolved > 0 },
      { id: "cr-gym", icon: "⚡", name: "Spark Badge", desc: "Beat the Gym Captain", test: () => !!C() && C().badge > 0 },
      { id: "cr-dex8", icon: "📖", name: "Critterdex Explorer", desc: "Meet 8 different critters", test: () => dexCount() >= 8 },
      { id: "cr-dracolit", icon: "🐲", name: "Dragon Tamer", desc: "Catch the rare Dracolit", test: () => !!C() && !!C().dex.dracolit && C().team.concat(C().box).some(m => m.sp === "dracolit") }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="crOverlay" hidden aria-label="Critter Quest">
      <div class="game-box cr-box">
        <div class="game-hud">
          <h2>🐾 Critter Quest</h2>
          <span class="mono game-stat" id="crBalls">⚪ 8</span>
          <span class="mono game-stat" id="crDex">📖 0/${IDS.length}</span>
          <button class="btn ghost small" id="crCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage cr-stage">
          <div class="cr-world" id="crWorld">
            <div class="cr-map" id="crMap" style="--cols:${COLS}" role="img" aria-label="The map"></div>
            <div class="cr-note" id="crNote" aria-live="polite"></div>
            <div class="cr-pad" id="crPad">
              <button class="btn ghost" type="button" data-d="0,-1" aria-label="Up">⬆️</button>
              <button class="btn ghost" type="button" data-d="-1,0" aria-label="Left">⬅️</button>
              <button class="btn ghost" type="button" data-d="0,1" aria-label="Down">⬇️</button>
              <button class="btn ghost" type="button" data-d="1,0" aria-label="Right">➡️</button>
            </div>
            <button class="cr-team" id="crTeam" type="button" aria-label="Open the team"></button>
          </div>
          <div class="cr-teamview" id="crTeamView" hidden>
            <div class="cr-tv-head"><h3>🎒 Your critters</h3><button class="btn small" id="crTeamDone" type="button">✓ Done</button></div>
            <div id="crTeamBody"></div>
          </div>
          <div class="cr-battle" id="crBattle" hidden>
            <div class="cr-foe cr-card" id="crFoe"></div>
            <div class="cr-me cr-card" id="crMe"></div>
            <div class="cr-say" id="crSay" aria-live="polite"></div>
            <div class="cr-acts" id="crActs"></div>
          </div>
          <div class="game-panel cr-panel" id="crPanel">
            <div class="game-panel-title" id="crPanelTitle">🐾 Critter Quest</div>
            <div class="game-panel-text" id="crPanelText"></div>
            <div class="cr-starters" id="crStarters"></div>
            <button class="btn" id="crPlayBtn" type="button">▶ Play</button>
            <button class="btn ghost small" id="crResetBtn" type="button" hidden>🔄 Start a new adventure</button>
          </div>
        </div>
        <div class="game-help">Arrow keys or WASD to walk · T for your team · tall grass 🌿 hides wild critters · 🏥 heals your team · 🏟️ is the Gym</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("crOverlay"), mapEl = $("crMap"), noteEl = $("crNote"), teamEl = $("crTeam"), world = $("crWorld"),
      battleEl = $("crBattle"), foeEl = $("crFoe"), meEl = $("crMe"), sayEl = $("crSay"), actsEl = $("crActs"),
      panel = $("crPanel"), panelTitle = $("crPanelTitle"), panelText = $("crPanelText"), startersEl = $("crStarters"),
      playBtn = $("crPlayBtn"), resetBtn = $("crResetBtn"), teamView = $("crTeamView"), teamBody = $("crTeamBody");
    const ABORT = {};
    let isOpen = false, busy = false, epoch = 0, resolveAct = null, boosts = new Map();

    // waits, and gives up quietly if the game was closed meanwhile
    const sleep = ms => { const e = epoch; return new Promise(r => setTimeout(r, ms)).then(() => { if (e !== epoch) throw ABORT; }); };
    const note = t => { noteEl.textContent = t; };

    /* ---------------- the map ---------------- */
    function drawMap(){
      const c = C();
      let h = "";
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const t = MAP[y][x];
        let ch = TILE[t][0];
        if (t === "G" && c.badge) ch = "🏆";
        if (x === c.x && y === c.y) ch = "🧒";
        h += `<div class="cr-t t-${TILE[t][1]}${x === c.x && y === c.y ? " me" : ""}">${ch}</div>`;
      }
      mapEl.innerHTML = h;
    }
    function bar(m){
      const pct = Math.max(0, Math.round(m.hp / maxHp(m) * 100));
      return `<div class="cr-bar ${pct < 25 ? "low" : pct < 55 ? "mid" : ""}"><i style="width:${pct}%"></i></div>`;
    }
    function drawTeam(){
      const c = C();
      teamEl.innerHTML = c.team.map(m => `<div class="cr-mini${m.hp ? "" : " out"}" title="${sp(m).name}"><span>${sp(m).icon}</span><b>Lv ${m.lv}</b>${bar(m)}</div>`).join("")
        + `<div class="cr-mini box" title="Critters waiting in the box"><span>📦</span><b>${c.box.length}</b></div><div class="cr-mini open"><span>🎒</span><b>Team</b></div>`;
    }

    /* ---------------- the team screen: lead, box, and Super Balls for study stars ---------------- */
    function teamRow(m, i, inBox){
      const c = C(), s = sp(m);
      const btns = inBox
        ? `<button class="btn small" type="button" data-act="take" data-i="${i}"${c.team.length >= 6 ? " disabled" : ""}>➕ To team</button>`
        : (i ? `<button class="btn small ghost" type="button" data-act="lead" data-i="${i}">⭐ Make lead</button>` : `<span class="cr-lead">⭐ Lead</span>`)
          + `<button class="btn small ghost" type="button" data-act="box" data-i="${i}"${c.team.length < 2 ? " disabled" : ""}>📦 To box</button>`;
      return `<div class="cr-row${m.hp ? "" : " out"}">
        <span class="cr-ri">${s.icon}</span>
        <div class="cr-rd"><b>${s.name}</b> <small>Lv ${m.lv} · ${TYPES[s.type]}</small>${bar(m)}
          <small>${m.hp}/${maxHp(m)} HP · XP ${m.xp}/${needXp(m.lv)}${s.evo ? ` · evolves at Lv ${s.evo[0]}` : ""}</small>
          <small class="cr-mv">${movesOf(m).map(x => x.name).join(" · ")}</small></div>
        <div class="cr-rb">${btns}</div></div>`;
    }
    function drawTeamView(){
      const c = C(), stars = window.Study ? Study.balance() : 0;
      teamBody.innerHTML = `<div class="cr-shop">🟣 <b>Super Balls</b> catch much better. You have ${c.super}.
          <button class="btn small" type="button" data-act="buy"${window.Study && stars >= 1 ? "" : " disabled"}>Get 3 for ⭐ 1</button>
          <small>You have ⭐ ${stars} study star${stars === 1 ? "" : "s"}: earn one for every 10 right answers in Learning.</small></div>
        <h4>Team (${c.team.length}/6)</h4>${c.team.map((m, i) => teamRow(m, i, false)).join("")}
        <h4>📦 Box (${c.box.length})</h4>${c.box.length ? c.box.map((m, i) => teamRow(m, i, true)).join("") : `<p class="cr-empty">Catch more than 6 critters and the extras wait here.</p>`}`;
    }
    function openTeam(){
      if (busy || !panel.hidden) return;
      drawTeamView(); teamView.hidden = false; world.hidden = true; Fun.sfx.pop();
      $("crTeamDone").focus();
    }
    function closeTeam(){ teamView.hidden = true; world.hidden = false; drawMap(); save(); }
    teamBody.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const c = C(), i = +b.dataset.i, act = b.dataset.act;
      if (act === "lead") c.team.unshift(c.team.splice(i, 1)[0]);
      else if (act === "box" && c.team.length > 1) c.box.push(c.team.splice(i, 1)[0]);
      else if (act === "take" && c.team.length < 6) c.team.push(c.box.splice(i, 1)[0]);
      else if (act === "buy") { if (!window.Study || !Study.spend(1)) return; c.super += 3; Fun.sfx.coin(); Hub.confettiBurst(b); }
      Fun.sfx.pop(); Hub.saveStore(); drawTeamView(); hud();
    });
    teamEl.addEventListener("click", openTeam);
    $("crTeamDone").addEventListener("click", closeTeam);
    function hud(){
      const c = C();
      $("crBalls").textContent = "⚪ " + c.balls + (c.super ? " · 🟣 " + c.super : "");
      $("crDex").textContent = `📖 ${dexCount()}/${IDS.length}`;
      $("crBalls").classList.toggle("low", c.balls < 3);
    }
    function save(){ Hub.saveStore(); Hub.checkBadges(); hud(); drawTeam(); }
    function healAll(){ C().team.forEach(m => { m.hp = maxHp(m); }); }

    async function walk(dx, dy){
      if (busy || !isOpen) return;
      const c = C(), nx = c.x + dx, ny = c.y + dy, t = MAP[ny] && MAP[ny][nx];
      if (!t || t === "#" || t === "~") { Fun.sfx.bonk(); return; }
      c.x = nx; c.y = ny; drawMap(); Fun.sfx.pop();
      try {
        if (t === "H") {
          healAll(); c.balls = Math.max(c.balls, 5); Fun.sfx.ding(); note("🏥 The Critter Center heals your whole team and tops up your Critter Balls!"); save();
        } else if ((t === "G" || t === "g") && !c.team.some(m => m.hp > 0)) {
          note("😴 Your team is too tired to battle. Rest at the 🏥 Critter Center, or swap in a critter from the 🎒 box.");
        } else if (t === "G") {
          busy = true; await gym();
        } else if (t === "g") {
          note("");
          if (Math.random() < 0.22) { busy = true; await wild(); }
        } else note("");
      } catch (e) { if (e !== ABORT) throw e; }
      busy = false; save();
    }

    /* ---------------- battles ---------------- */
    const avgLv = () => { const t = C().team; return t.reduce((s, m) => s + m.lv, 0) / t.length; };
    async function wild(){
      const c = C();
      let foe;
      if (c.badge && Math.random() < 0.05) { foe = mk("dracolit", 12); foe.rare = true; }
      else foe = mk(pick(WILD), Math.max(2, Math.min(12, Math.round(avgLv()) - 2 + rnd(0, 3))));
      await battle([foe], null);
    }
    async function gym(){
      const c = C(), lv = Math.min(20, 7 + 4 * c.gymWins);
      note(c.badge ? "🏟️ The Gym Captain wants a rematch!" : "🏟️ The Gym Captain steps up!");
      await sleep(500);
      const foes = [mk("blazion", lv), mk("thundrat", lv), mk("infernhound", lv + 2)];
      await battle(foes, "Gym Captain Sparks");
    }

    // shows a message and waits a moment
    async function say(t, ms){ sayEl.textContent = t; await sleep(ms || 900); }
    function cards(me, foe){
      foeEl.innerHTML = `<div class="cr-emo">${sp(foe).icon}</div><div class="cr-info"><b>${sp(foe).name}</b> <span>Lv ${foe.lv}</span><small>${TYPES[sp(foe).type]}</small>${bar(foe)}</div>`;
      meEl.innerHTML = `<div class="cr-emo">${sp(me).icon}</div><div class="cr-info"><b>${sp(me).name}</b> <span>Lv ${me.lv}</span><small>${TYPES[sp(me).type]}</small>${bar(me)}<em>${me.hp}/${maxHp(me)}</em></div>`;
    }
    // shows buttons and waits for the player to press one: resolves with its value
    function choose(items){
      actsEl.innerHTML = items.map((it, i) => `<button class="btn${it.ghost ? " ghost" : ""}" type="button" data-i="${i}"${it.off ? " disabled" : ""}>${it.label}</button>`).join("");
      const e = epoch;
      return new Promise(res => {
        resolveAct = i => { resolveAct = null; actsEl.innerHTML = ""; if (e !== epoch) throw ABORT; res(items[i].v); };
        const first = actsEl.querySelector("button:not(:disabled)"); if (first) first.focus();
      });
    }
    const teamChoices = (skip, ghostBack) => C().team.map((m, i) => ({ label: `${sp(m).icon} ${sp(m).name} Lv ${m.lv} · ${m.hp}/${maxHp(m)}`, v: i, off: !m.hp || i === skip }))
      .concat(ghostBack ? [{ label: "↩ Back", v: -1, ghost: true }] : []);

    // the battle's attack and defence boosts for a critter, in steps of x1.25 (up to 3 steps)
    const boost = m => { if (!boosts.has(m)) boosts.set(m, { atk: 0, def: 0 }); return boosts.get(m); };
    // the other side picks a move: heals when low, sometimes boosts, and mostly uses its strongest moves
    function foeMove(foe){
      const ms = movesOf(foe), sup = ms.find(m => m.fx), hits = ms.filter(m => m.power);
      if (sup && sup.fx === "heal" && foe.hp < maxHp(foe) * 0.35 && Math.random() < 0.5) return sup;
      if (sup && sup.fx !== "heal" && !boost(foe)[sup.fx] && Math.random() < 0.2) return sup;
      return Math.random() < 0.25 ? hits[0] : pick(hits.slice(1));
    }
    async function useMove(att, def, mv, mine){
      const who = (mine ? "" : "The other ") + sp(att).name, show = () => mine ? cards(att, def) : cards(def, att);
      await say(`${who} uses ${mv.name}!`, 700);
      if (mv.fx === "heal") {
        const n = Math.min(maxHp(att) - att.hp, Math.ceil(maxHp(att) / 3));
        att.hp += n; Fun.sfx.ding(); show();
        await say(n ? `${who} feels better! +${n} HP 💚` : `${who} is already full of energy!`, 800);
        return;
      }
      if (mv.fx) {
        const b = boost(att);
        if (b[mv.fx] >= 3) { await say("It can't go any higher!", 700); return; }
        b[mv.fx]++; Fun.sfx.zap();
        await say(`${who}'s ${mv.fx === "atk" ? "attack" : "defence"} went up! ⬆️`, 800);
        return;
      }
      if (mv.acc && Math.random() > mv.acc) { Fun.sfx.whoosh(); await say(`${who} missed!`, 800); return; }
      const d = damage(att, def, mv, 1 + 0.25 * boost(att).atk, 1 + 0.25 * boost(def).def);
      def.hp = Math.max(0, def.hp - d.n);
      (mine ? foeEl : meEl).classList.add("hit"); Fun.sfx[d.e > 1 ? "crash" : "bonk"]();
      show();
      await sleep(350);
      foeEl.classList.remove("hit"); meEl.classList.remove("hit");
      if (d.e > 1) await say("It's super effective! 💥", 800); else if (d.e < 1) await say("It's not very effective…", 800);
    }

    // levels up while there's enough XP, evolving and learning new moves on the way
    async function levelUps(m){
      while (m.lv < 20 && m.xp >= needXp(m.lv)) {
        const knew = movesOf(m).map(x => x.name);
        m.xp -= needXp(m.lv); const before = maxHp(m); m.lv++; m.hp += maxHp(m) - before;
        Fun.sfx.ding(); await say(`⬆️ ${sp(m).name} grew to level ${m.lv}!`, 1000);
        const ev = sp(m).evo;
        if (ev && m.lv >= ev[0]) {
          const old = sp(m).name, hpBefore = maxHp(m);
          m.sp = ev[1]; m.hp += maxHp(m) - hpBefore; C().dex[m.sp] = 1; C().evolved++;
          Fun.sfx.tada(); Hub.confettiBurst(sayEl);
          await say(`✨ ${old} evolved into ${sp(m).name}! ${sp(m).icon}`, 1500);
        }
        for (const mv of movesOf(m)) if (!knew.includes(mv.name)) await say(`📘 ${sp(m).name} learned ${mv.name}!`, 1100);
      }
    }
    async function gainXp(me, foe, trainer, others){
      me.xp += foe.lv * (trainer ? 10 : 7);
      await say(`${sp(me).name} gets ${foe.lv * (trainer ? 10 : 7)} XP!`, 800);
      await levelUps(me);
      // the others who fought get half
      for (const m of others) { m.xp += Math.floor(foe.lv * (trainer ? 5 : 3)); await levelUps(m); }
    }

    async function battle(foes, trainer){
      const c = C();
      battleEl.hidden = false; world.hidden = true;
      let fi = 0, foe = foes[0], mi = c.team.findIndex(m => m.hp > 0), me = c.team[mi];
      const fought = new Set([mi]);
      boosts = new Map();
      c.dex[foe.sp] = 1; hud();
      cards(me, foe);
      try {
        await say(trainer ? `🏟️ ${trainer} wants to battle!` : foe.rare ? `🐲 A rare Dracolit appeared!` : `A wild ${sp(foe).name} appeared! ${sp(foe).icon}`, 1100);
        let over = null;
        while (!over) {
          cards(me, foe);
          sayEl.textContent = `What will ${sp(me).name} do?`;
          const mv = movesOf(me);
          const act = await choose(mv.map(m => ({
            label: `${m.type === "normal" && m.name === "Tackle" ? "💥" : m.fx === "heal" ? "💚" : m.fx ? "⬆️" : TYPES[m.type].split(" ")[0]} ${m.name}`, v: { k: "move", mv: m }
          })).concat([
            { label: `⚪ Ball (${c.balls})`, v: { k: "ball", super: false }, off: !!trainer || c.balls < 1, ghost: true },
            ...(c.super ? [{ label: `🟣 Super (${c.super})`, v: { k: "ball", super: true }, off: !!trainer, ghost: true }] : []),
            { label: "🔁 Swap", v: { k: "swap" }, off: c.team.filter(m => m.hp > 0).length < 2, ghost: true },
            { label: "🏃 Run", v: { k: "run" }, ghost: true, off: !!trainer }
          ]));
          let foeActs = true;
          if (act.k === "swap") {
            const i = await choose(teamChoices(mi, true));
            if (i < 0) continue;
            mi = i; me = c.team[i]; fought.add(i); cards(me, foe); await say(`Go, ${sp(me).name}! ${sp(me).icon}`, 800);
          } else if (act.k === "run") {
            if (Math.random() < 0.75) { await say("Got away safely! 💨", 900); over = "run"; break; }
            await say("Couldn't get away!", 800);
          } else if (act.k === "ball") {
            if (act.super) c.super--; else c.balls--;
            hud();
            // aim the throw: a right answer makes it 1.5 times as likely to catch
            const qz = quiz();
            sayEl.textContent = `🎯 Aim your throw! ${qz.q}`;
            const good = await choose(qz.opts.map(o => ({ label: o, v: o }))) === qz.a;
            if (good) { Fun.sfx.ding(); await say("✅ Right! A perfect throw!", 800); }
            else { Fun.sfx.nope(); await say(`❌ It was ${qz.a}. The throw wobbles…`, 1300); }
            Fun.sfx.whoosh();
            await say(act.super ? "You throw a Super Ball… 🟣" : "You throw a Critter Ball… ⚪", 1000);
            const p = Math.min(0.95, (0.2 + (1 - foe.hp / maxHp(foe)) * 0.6) * (foe.rare ? 0.5 : 1) * (good ? 1.5 : 1) * (act.super ? 1.5 : 1));
            if (Math.random() < p) {
              Fun.sfx.tada(); c.caught++; c.dex[foe.sp] = 1; foe.hp = Math.max(1, foe.hp);
              (c.team.length < 6 ? c.team : c.box).push(foe);
              Hub.confettiBurst(sayEl);
              await say(`🎉 Gotcha! ${sp(foe).name} was caught!` + (c.team.includes(foe) ? "" : " It goes to the box 📦"), 1500);
              over = "caught"; break;
            }
            Fun.sfx.nope(); await say("Oh no, it broke free!", 900);
          } else {
            const fmv = foeMove(foe);
            // Quick Zap goes first; otherwise the faster critter does
            const meFirst = !!act.mv.first !== !!fmv.first ? !!act.mv.first : stat(me, 3) >= stat(foe, 3);
            const turn = [{ att: me, def: foe, mv: act.mv, mine: true }, { att: foe, def: me, mv: fmv, mine: false }];
            if (!meFirst) turn.reverse();
            for (const t of turn) {
              if (t.att.hp <= 0 || t.def.hp <= 0) continue;
              await useMove(t.att, t.def, t.mv, t.mine);
            }
            foeActs = false;
          }
          // a swap, a failed run or a missed ball gives the other side a free hit
          if (foeActs && foe.hp > 0 && me.hp > 0) await useMove(foe, me, foeMove(foe), false);
          if (foe.hp <= 0) {
            await say(`${sp(foe).name} fainted!`, 900);
            await gainXp(me, foe, trainer, [...fought].filter(i => i !== mi && c.team[i].hp > 0).map(i => c.team[i]));
            if (++fi >= foes.length) { over = "won"; break; }
            foe = foes[fi]; c.dex[foe.sp] = 1; hud(); cards(me, foe);
            await say(`${trainer} sends out ${sp(foe).name}! ${sp(foe).icon}`, 1000);
          }
          if (me.hp <= 0) {
            await say(`${sp(me).name} fainted!`, 900);
            if (!c.team.some(m => m.hp > 0)) { over = "lost"; break; }
            const i = await choose(teamChoices(mi, false));
            mi = i; me = c.team[i]; fought.add(i); cards(me, foe); await say(`Go, ${sp(me).name}! ${sp(me).icon}`, 800);
          }
        }
        // after the battle
        if (over === "won") {
          Fun.sfx.tada();
          if (trainer) {
            const first = !c.badge; c.badge = 1; c.gymWins++; c.balls += 3;
            Hub.confettiBurst(sayEl);
            await say(first ? "🏆 You beat the Gym Captain and win the ⚡ Spark Badge! Wilder critters live in the grass now…" : "🏆 You beat the Gym Captain again! +3 balls, and the next rematch will be harder.", 2200);
          } else {
            const drop = Math.random() < 0.35;
            if (drop) c.balls++;
            await say(drop ? "You found a Critter Ball on the ground! ⚪" : "You won the battle! 🎉", 1000);
          }
        } else if (over === "lost") {
          Fun.sfx.wah(); await say("Your team is out of energy… you hurry back to the 🏥 Critter Center.", 1800);
          healAll(); c.x = 9; c.y = 1;
        }
      } finally {
        battleEl.hidden = true; world.hidden = false; actsEl.innerHTML = ""; resolveAct = null;
        if (isOpen) { drawMap(); save(); }
      }
    }

    /* ---------------- start panel ---------------- */
    function showPanel(){
      const c = C();
      resetBtn.hidden = !c || !c.team.length;
      if (!c || !c.team.length) {
        panelTitle.textContent = "🐾 Critter Quest";
        panelText.textContent = "Welcome, trainer! Pick your first critter. Walk through the 🌿 tall grass to find wild ones, weaken them and catch them with Critter Balls. Fire beats leaf, leaf beats water and spark, water beats fire, spark beats water.";
        startersEl.innerHTML = STARTERS.map(id => `<button class="btn cr-starter" type="button" data-id="${id}"><span>${SP[id].icon}</span>${SP[id].name}<small>${TYPES[SP[id].type]}</small></button>`).join("");
        playBtn.hidden = true;
      } else {
        panelTitle.textContent = "🐾 Welcome back!";
        panelText.textContent = `Your team has ${c.team.length} critter${c.team.length === 1 ? "" : "s"}, your Critterdex has ${dexCount()} of ${IDS.length}, and you ${c.badge ? "have the ⚡ Spark Badge" : "are heading for the 🏟️ Gym"}.`;
        startersEl.innerHTML = ""; playBtn.hidden = false; playBtn.textContent = "▶ Continue";
      }
      panel.hidden = false;
      const b = panel.querySelector(".btn:not([hidden])"); if (b) b.focus();
    }
    function begin(){
      C().super = C().super || 0;
      panel.hidden = true; battleEl.hidden = true; teamView.hidden = true; world.hidden = false;
      drawMap(); drawTeam(); hud(); note("Walk into the 🌿 tall grass to find wild critters!");
    }
    startersEl.addEventListener("click", e => {
      const b = e.target.closest("[data-id]"); if (!b) return;
      store.critters = fresh(); const c = C();
      c.team.push(mk(b.dataset.id, 5)); c.dex[b.dataset.id] = 1;
      Fun.sfx.tada(); Hub.confettiBurst(b); save(); begin();
    });
    playBtn.addEventListener("click", begin);
    resetBtn.addEventListener("click", () => {
      if (!confirm("Start a new adventure? Your critters will be released.")) return;
      store.critters = undefined; Hub.saveStore(); showPanel();
    });

    /* ---------------- controls ---------------- */
    actsEl.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b && resolveAct) { try { resolveAct(+b.dataset.i); } catch (x) { if (x !== ABORT) throw x; } } });
    $("crPad").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (b) { const [dx, dy] = b.dataset.d.split(",").map(Number); walk(dx, dy); } });
    const KEYS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
      if (e.key.toLowerCase() === "t" && panel.hidden && !busy) { if (teamView.hidden) { if (!world.hidden) openTeam(); } else closeTeam(); return; }
      if (k && panel.hidden && !world.hidden) { e.preventDefault(); walk(k[0], k[1]); }
    });

    function openGame(){
      isOpen = true; busy = false; resolveAct = null;
      Fun.screen(overlay, true);
      battleEl.hidden = true; teamView.hidden = true; world.hidden = false;
      if (C() && C().team.length) { drawMap(); drawTeam(); hud(); } else { mapEl.innerHTML = ""; teamEl.innerHTML = ""; }
      note(""); showPanel();
    }
    function closeGame(){
      isOpen = false; busy = false; epoch++;
      Fun.screen(overlay, false);
    }
    $("crCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("crCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
