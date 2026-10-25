/* Memory Match: flip two cards at a time and find all the pairs. Three sizes (6, 8 or 12 pairs) and four
   picture sets. Fewer moves earn more stars, and each size keeps its best (fewest moves and fastest time).
   Find a pair and you go again; two players can take turns too, and whoever finds more pairs wins. */
(function(){
  "use strict";
  const store = Hub.store;

  const SIZES = [{ id: "easy", label: "Easy", pairs: 6, cols: 4 }, { id: "medium", label: "Medium", pairs: 8, cols: 4 }, { id: "hard", label: "Hard", pairs: 12, cols: 6 }];
  const SETS = {
    animals: ["🐶", "🐱", "🦊", "🐼", "🐸", "🦁", "🐵", "🐧", "🦄", "🐙", "🦖", "🐢"],
    food: ["🍕", "🍔", "🍦", "🍩", "🍓", "🍉", "🥨", "🧀", "🍫", "🌮", "🥐", "🍿"],
    space: ["🚀", "🌍", "🌙", "⭐", "☄️", "🪐", "👽", "🛸", "🌞", "🔭", "👨‍🚀", "🌈"],
    sport: ["⚽", "🏀", "🎾", "🏎️", "🚲", "⛷️", "🏓", "🎳", "⛳", "🥊", "🛹", "🏆"]
  };
  const SET_ICONS = { animals: "🐶", food: "🍕", space: "🚀", sport: "⚽" };
  const best = id => (store.memory && store.memory[id]) || null;

  Hub.register({
    id: "memory", section: "games", title: "Memory Match", icon: "🃏",
    blurb: "Flip the cards and find all the pairs, alone or against a friend!",
    stat: () => { const b = best("hard") || best("medium") || best("easy"); return b ? `Best: ${b.moves} moves` : ""; },
    badges: [
      { id: "mem-1", icon: "🃏", name: "Good Memory", desc: "Finish a game of Memory Match", test: () => SIZES.some(s => best(s.id)) },
      { id: "mem-hard", icon: "🧠", name: "Super Brain", desc: "Finish Memory Match on Hard in 22 moves or fewer", test: () => !!best("hard") && best("hard").moves <= 22 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="mmOverlay" hidden aria-label="Memory Match">
      <div class="game-box mm-box">
        <div class="game-hud">
          <h2>🃏 Memory Match</h2>
          <span class="mono game-stat" id="mmMoves">👆 0</span>
          <span class="mono game-stat" id="mmTime">⏱️ 0:00</span>
          <span class="mono game-stat" id="mmTurn" hidden></span>
          <button class="btn ghost small" id="mmCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage mm-stage">
          <div class="mm-grid" id="mmGrid"></div>
          <div class="game-panel mm-panel" id="mmPanel">
            <div class="game-panel-title" id="mmPanelTitle">🃏 Memory Match</div>
            <div class="game-panel-text" id="mmPanelText"></div>
            <div class="mm-choose">
              <div class="mm-row" id="mmSizes"></div>
              <div class="mm-row" id="mmSets"></div>
              <div class="mm-row" id="mmPlayers"></div>
            </div>
            <button class="btn" id="mmPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">Click a card to flip it · find two the same and they stay up · find all the pairs!</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("mmOverlay"), grid = $("mmGrid"), panel = $("mmPanel"), panelTitle = $("mmPanelTitle"), panelText = $("mmPanelText"), playBtn = $("mmPlayBtn");
    let isOpen = false, running = false, timerId = 0;
    let size = SIZES[0], set = "animals", players = 1;
    let cards = [], open = [], moves = 0, found = 0, startT = 0, turn = 0, points = [0, 0], busy = false;

    // the choices on the start panel
    function choices(){
      const seg = (el, items, on, pick) => {
        el.innerHTML = items.map(([v, label]) => `<button class="mm-opt${v === on ? " on" : ""}" type="button" data-v="${v}" aria-pressed="${v === on}">${label}</button>`).join("");
        el.onclick = e => { const b = e.target.closest("[data-v]"); if (b) { pick(b.dataset.v); choices(); } };
      };
      seg($("mmSizes"), SIZES.map(s => [s.id, `${s.label} (${s.pairs})`]), size.id, v => { size = SIZES.find(s => s.id === v); });
      seg($("mmSets"), Object.keys(SETS).map(k => [k, SET_ICONS[k]]), set, v => { set = v; });
      seg($("mmPlayers"), [["1", "🙂 1 player"], ["2", "👫 2 players"]], String(players), v => { players = +v; });
    }

    function deal(){
      const pics = SETS[set].slice().sort(() => Math.random() - 0.5).slice(0, size.pairs);
      cards = pics.concat(pics).sort(() => Math.random() - 0.5).map(pic => ({ pic, up: false, done: false }));
      grid.style.setProperty("--cols", size.cols);
      grid.innerHTML = cards.map((c, i) => `<button class="mm-card" type="button" data-i="${i}" aria-label="Card ${i + 1}"><span class="mm-front">${c.pic}</span><span class="mm-back">?</span></button>`).join("");
    }
    function show(i){ const el = grid.children[i], c = cards[i]; el.classList.toggle("up", c.up || c.done); el.classList.toggle("done", c.done); el.setAttribute("aria-label", c.up || c.done ? c.pic : `Card ${i + 1}`); }
    function hud(){
      $("mmMoves").textContent = "👆 " + moves;
      const s = running ? Math.floor((performance.now() - startT) / 1000) : 0;
      $("mmTime").textContent = "⏱️ " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      const t = $("mmTurn");
      t.hidden = players < 2;
      t.textContent = `${turn ? "🟣" : "🟠"} Player ${turn + 1} · ${points[0]}–${points[1]}`;
    }

    function flip(i){
      const c = cards[i];
      if (!running || busy || c.up || c.done) return;
      c.up = true; show(i); open.push(i); Fun.sfx.pop();
      if (open.length < 2) return;
      moves++;
      const [a, b] = open; open = [];
      if (cards[a].pic === cards[b].pic) {
        cards[a].done = cards[b].done = true; show(a); show(b); found++; points[turn]++;
        Fun.sfx.ding();
        if (found === size.pairs) setTimeout(finish, 500);
      } else {
        busy = true;
        setTimeout(() => { cards[a].up = cards[b].up = false; show(a); show(b); busy = false; if (players === 2) turn = 1 - turn; hud(); }, 850);
      }
      hud();
    }
    function finish(){
      running = false; clearInterval(timerId);
      const secs = Math.round((performance.now() - startT) / 1000), perfect = size.pairs;
      const stars = moves <= perfect * 1.5 ? 3 : moves <= perfect * 2.2 ? 2 : 1;
      let text;
      if (players === 2) {
        text = points[0] === points[1] ? `A draw, ${points[0]} pairs each! 🤝` : `Player ${points[0] > points[1] ? 1 : 2} wins, ${Math.max(...points)} pairs to ${Math.min(...points)}! 🏆`;
      } else {
        store.memory = store.memory || {};
        const was = best(size.id), better = !was || moves < was.moves || (moves === was.moves && secs < was.secs);
        if (better) store.memory[size.id] = { moves, secs };
        Hub.saveStore(); Hub.checkBadges();
        text = `${"⭐".repeat(stars)} All ${size.pairs} pairs in ${moves} moves and ${secs} seconds.` + (better ? " New best! 🎉" : ` Your best: ${was.moves} moves.`);
      }
      Fun.sfx.tada();
      panelTitle.textContent = players === 2 ? "🃏 Game over!" : "🃏 You found them all!";
      panelText.textContent = text;
      playBtn.textContent = "▶ Play again"; panel.hidden = false;
      Hub.confettiBurst(playBtn); choices(); playBtn.focus();
    }

    grid.addEventListener("click", e => { const b = e.target.closest(".mm-card"); if (b) flip(+b.dataset.i); });
    window.addEventListener("keydown", e => { if (isOpen && e.key === "Escape") Hub.leave(); });

    function start(){
      deal(); open = []; moves = 0; found = 0; turn = 0; points = [0, 0]; busy = false;
      running = true; panel.hidden = true; startT = performance.now();
      clearInterval(timerId); timerId = setInterval(hud, 500); hud();
      grid.querySelector(".mm-card").focus();
    }
    function openGame(){
      isOpen = true; running = false;
      Fun.screen(overlay, true);
      deal(); hud();
      panelTitle.textContent = "🃏 Memory Match";
      panelText.textContent = "Flip two cards. Same picture? They stay up! Different? They turn back over, so remember where they were. Find all the pairs in as few moves as you can.";
      playBtn.textContent = "▶ Play"; panel.hidden = false; choices();
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; clearInterval(timerId); Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    $("mmCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("mmCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
