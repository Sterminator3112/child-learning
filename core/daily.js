/* Daily challenges, the streak and coins.
   Every day brings three small challenges, one for learning and two for games, picked from the date so they
   stay the same all day. Each one done earns 30 coins, all three earn 50 more, and every new trophy earns 20.
   Doing at least one challenge a day keeps the 🔥 streak going. Coins are spent in the shop (core/shop.js).
   Progress is read from what the apps already save (today's practice log, win counters, games opened today),
   so the apps don't need to know about challenges. Hub calls Daily.check() whenever trophies are checked. */
(function(){
  "use strict";
  const store = Hub.store;
  const COIN_EACH = 30, COIN_ALL = 50;

  const dayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => dayKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const subjects = () => (window.Notebook && Notebook.subjects) || [];
  const logOf = s => (s.data.log && s.data.log[today()]) || { a: 0, c: 0 };
  const allLog = () => subjects().reduce((t, s) => { const e = logOf(s); return { a: t.a + e.a, c: t.c + e.c }; }, { a: 0, c: 0 });
  const played = () => (store.playedDay && store.playedDay.day === today() ? store.playedDay.ids : []);
  const games = () => Hub.appList().filter(a => a.section === "games");

  // the challenges a day can pick from; "counter" ones count up from where the counter was this morning
  function catalogue(){
    const learn = [
      { id: "q10", icon: "📚", text: "Answer 10 questions in any subject", goal: 10, href: "#/learning", now: () => allLog().a },
      { id: "r8", icon: "✅", text: "Get 8 answers right in any subject", goal: 8, href: "#/learning", now: () => allLog().c },
      { id: "type1", icon: "⌨️", text: "Finish a lesson in Tipp-Meister", goal: 1, href: "#/learning/typing", now: () => ((store.typing && store.typing.log && store.typing.log[today()]) || { a: 0 }).a }
    ];
    subjects().forEach(s => learn.push({ id: "s:" + s.id, icon: s.icon, text: `Answer 5 questions in ${s.title}`, goal: 5, href: `#/learning/${s.id}`, now: () => logOf(s).a }));
    const play = [
      { id: "poolwin", icon: "🎱", text: "Win a game of Blox Pool", goal: 1, href: "#/games/pool", counter: "poolWins" },
      { id: "strike", icon: "🎳", text: "Bowl a strike", goal: 1, href: "#/games/bowling", counter: "bowlStrikes" },
      { id: "soccer", icon: "⚽", text: "Win a Blox Soccer match", goal: 1, href: "#/games/soccer", counter: "soccerWins" },
      { id: "dunk", icon: "🏀", text: "Slam dunk in Blox Hoops", goal: 1, href: "#/games/hoops", counter: "hoopsDunks" },
      { id: "build", icon: "🧱", text: "Place 30 blocks in Block World", goal: 30, href: "#/games/blocks", counter: "blocksPlaced" },
      { id: "parkour", icon: "🧗", text: "Reach the trophy in Parkour Run", goal: 1, href: "#/games/parkour", counter: "parkourWins" },
      { id: "pong", icon: "🏓", text: "Play a game of Ping Pong 3D", goal: 1, href: "#/games/ping-pong", counter: "pongPlayed" },
      { id: "raceoff", icon: "🚙", text: "Finish a Race Off level", goal: 1, href: "#/games/raceoff", counter: "raceoffWins" },
      { id: "rostunt", icon: "💥", text: "Do 5 stunts in Race Off", goal: 5, href: "#/games/raceoff", counter: "raceoffStunts" },
      { id: "rodaily", icon: "📅", text: "Reach 300 m on the Race Off daily track", goal: 1, href: "#/games/raceoff", counter: "raceoffDaily" },
      { id: "wheels", icon: "🏎️", text: "Finish a Stunt Wheels track", goal: 1, href: "#/games/wheels", counter: "wheelsFinishes" },
      { id: "chess", icon: "♟️", text: "Beat BloxBot at chess", goal: 1, href: "#/games/chess", counter: "chessWins" },
      { id: "three", icon: "🎮", text: "Play 3 different games", goal: 3, href: "#/games", now: () => played().filter(id => games().some(g => g.id === id)).length }
    ];
    games().forEach(g => play.push({ id: "play:" + g.id, icon: g.icon, text: `Play ${g.title}`, goal: 1, href: `#/games/${g.id}`, now: () => played().includes(g.id) ? 1 : 0 }));
    return { learn, play };
  }

  // the same three all day: pick with a random number seeded by the date
  function seeded(seed){ let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function plan(){
    const d = store.daily;
    if (d && d.day === today()) return d;
    const { learn, play } = catalogue(), rnd = seeded(today());
    // never two challenges for the same game on one day
    const pick = (list, n) => { const out = [], pool = list.slice(); while (out.length < n && pool.length) { const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; if (!out.some(o => o.href === c.href)) out.push(c); } return out; };
    const chosen = [...pick(learn, 1), ...pick(play, 2)];
    store.daily = { day: today(), ids: chosen.map(c => c.id), base: {}, done: {}, bonus: false };
    chosen.forEach(c => { if (c.counter) store.daily.base[c.counter] = store[c.counter] || 0; });
    Hub.saveStore();
    return store.daily;
  }
  function list(){
    const d = plan(), { learn, play } = catalogue(), all = [...learn, ...play];
    return d.ids.map(id => all.find(c => c.id === id)).filter(Boolean).map(c => {
      const value = c.counter ? (store[c.counter] || 0) - (d.base[c.counter] || 0) : c.now();
      return Object.assign({}, c, { value: Math.min(c.goal, Math.max(0, value)), done: !!d.done[c.id] || value >= c.goal });
    });
  }
  const streak = () => { const s = store.streak; return s && (s.last === today() || s.last === yesterday()) ? s.count : 0; };

  // called whenever trophies are checked: pays out newly finished challenges
  function check(){
    if (store.coins === undefined) store.coins = 50 + 20 * Object.keys(store.badges || {}).length;   // a welcome gift, and coins for trophies won before coins existed
    const d = plan();
    let paid = false;
    list().forEach(c => {
      if (!c.done || d.done[c.id]) return;
      d.done[c.id] = true; store.coins += COIN_EACH; paid = true;
      const s = store.streak || { count: 0, last: "" };
      if (s.last !== today()) { s.count = s.last === yesterday() ? s.count + 1 : 1; s.last = today(); store.streak = s; }
      Hub.toast(c.icon, "Challenge done! +" + COIN_EACH + " 🪙", c.text);
    });
    if (!d.bonus && d.ids.length && d.ids.every(id => d.done[id])) {
      d.bonus = true; store.coins += COIN_ALL; paid = true;
      setTimeout(() => Hub.toast("🌟", "All three done! +" + COIN_ALL + " 🪙", `Streak: ${streak()} day${streak() === 1 ? "" : "s"} 🔥`), 900);
    }
    if (paid) Hub.saveStore();
  }

  // the card on the home screen
  function renderHome(el){
    check();
    const items = list(), done = items.filter(c => c.done).length, s = streak();
    el.innerHTML = `
      <div class="daily-head">
        <h2>📅 Today's challenges <small>${done} of ${items.length}</small></h2>
        <span class="daily-streak" title="Days in a row with a challenge done">🔥 ${s ? `${s}-day streak` : "Start a streak today!"}</span>
        ${window.Study ? `<a class="daily-stars" href="#/shop" title="Study stars: 1 for every ${Study.PER_STAR} right answers in Learning">⭐ ${Study.balance()}${Study.boost() ? " · 📚 boost on" : ""}</a>` : ""}
        <a class="daily-coins" href="#/shop">🪙 ${store.coins} · Shop</a>
      </div>
      <ul class="daily-list">${items.map(c => `
        <li class="${c.done ? "done" : ""}"><a href="${c.href}">
          <span class="d-icon">${c.done ? "✅" : c.icon}</span>
          <span class="d-text"></span>
          <span class="d-bar" aria-hidden="true"><i style="width:${Math.round(c.value / c.goal * 100)}%"></i></span>
          <span class="d-num mono">${c.value}/${c.goal}</span>
          <span class="d-reward">${c.done ? "Done!" : "+" + COIN_EACH + " 🪙"}</span>
        </a></li>`).join("")}
      </ul>
      <p class="daily-note">${done === items.length ? "All done for today! New challenges tomorrow." : `Finish all three for +${COIN_ALL} bonus coins. New trophies earn 20 coins each.`}</p>`;
    el.querySelectorAll(".d-text").forEach((t, i) => { t.textContent = items[i].text; });
  }

  window.Daily = { check, renderHome, streak, list };
})();
