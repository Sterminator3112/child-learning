/* Blox Chess: chess against BloxBot (Easy, Normal or Hard) or two players on one device.
   Tap a piece to see where it can go, then tap where to move it. Pick a board and the colours of each
   side's pieces under "Board and pieces"; they're remembered. The rules live in engine.js. */
(function(){
  "use strict";
  const store = Hub.store, E = window.ChessEngine;
  const C = () => (store.chess = store.chess || { theme: "wood", white: "#f7f5ee", black: "#2b2b33", mode: "normal", side: "w", flip: true, wins: 0, losses: 0, draws: 0 });

  Hub.register({
    id: "chess", section: "games", title: "Blox Chess", icon: "♟️",
    blurb: "Chess against BloxBot or a friend. Pick your board and piece colours!",
    stat: () => store.chessWins ? "Wins: " + store.chessWins : "",
    badges: [
      { id: "chesswin",   icon: "♟️", name: "Checkmate!",    desc: "Beat BloxBot at chess",              test: () => (store.chessWins || 0) >= 1 },
      { id: "chesshard",  icon: "👑", name: "Grandmaster",   desc: "Beat BloxBot on Hard",               test: () => !!(store.chess && store.chess.hardWin) },
      { id: "chesspromo", icon: "✨", name: "Pawn Power",    desc: "Turn a pawn into a queen",           test: () => !!(store.chess && store.chess.promoted) }
    ],
    mount
  });

  const THEMES = [
    { id: "wood", name: "Classic wood", light: "#f0d9b5", dark: "#b58863", frame: "#6b4423" },
    { id: "forest", name: "Forest", light: "#eeeed2", dark: "#769656", frame: "#3e5a2a" },
    { id: "ocean", name: "Ocean", light: "#d6ecff", dark: "#4a7fc1", frame: "#1f3f6e" },
    { id: "candy", name: "Candy", light: "#ffe3f1", dark: "#ff7eb6", frame: "#b33a78" },
    { id: "ice", name: "Ice", light: "#ffffff", dark: "#a8d8ff", frame: "#5d93c2" },
    { id: "lava", name: "Lava", light: "#ffd2a8", dark: "#c0392b", frame: "#5e1a12" },
    { id: "neon", name: "Neon", light: "#3a3a5c", dark: "#1a1a2e", frame: "#ff4df0" },
    { id: "galaxy", name: "Galaxy", light: "#6c5fc7", dark: "#241c5c", frame: "#0e0a2a" }
  ];
  const COLOURS = [
    ["Snow", "#f7f5ee"], ["Ink", "#2b2b33"], ["Gold", "#ffcc33"], ["Silver", "#c0c6d4"], ["Ruby", "#e8333b"], ["Royal blue", "#2f6bff"],
    ["Emerald", "#19b25a"], ["Grape", "#8b3dff"], ["Bubblegum", "#ff7ac8"], ["Orange", "#ff8a1e"], ["Aqua", "#25d3e8"], ["Chocolate", "#7a4a2a"]
  ];
  // a dark outline on light pieces and a light one on dark pieces, so they always stand out
  const lineFor = hex => { const n = parseInt(hex.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.45 ? "#1a1030" : "#f2f0ff"; };

  // blocky pieces, drawn in a 100 x 100 box
  const BASE = `<rect x="22" y="80" width="56" height="12" rx="3"/><rect x="30" y="72" width="40" height="9" rx="2"/>`;
  const SHAPES = {
    P: `<rect x="38" y="46" width="24" height="27" rx="3"/><circle cx="50" cy="36" r="13"/>`,
    R: `<rect x="32" y="36" width="36" height="37" rx="2"/><path d="M27 40 V18 H37 V26 H45 V18 H55 V26 H63 V18 H73 V40 Z"/>`,
    N: `<path d="M30 73 L34 54 L24 48 L27 37 L42 22 L46 11 L54 20 C67 25 73 40 70 56 L72 73 Z"/><circle class="eye" cx="44" cy="33" r="3.2"/>`,
    B: `<path d="M37 73 L42 46 H58 L63 73 Z"/><ellipse cx="50" cy="34" rx="13" ry="16"/><circle cx="50" cy="14" r="5"/><path class="cut" d="M46 25 L56 35"/>`,
    Q: `<path d="M34 73 L39 46 H61 L66 73 Z"/><path d="M30 46 L25 20 L38 33 L44 12 L50 30 L56 12 L62 33 L75 20 L70 46 Z"/><circle cx="25" cy="18" r="4"/><circle cx="44" cy="10" r="4"/><circle cx="56" cy="10" r="4"/><circle cx="75" cy="18" r="4"/>`,
    K: `<path d="M34 73 L39 48 H61 L66 73 Z"/><rect x="32" y="31" width="36" height="18" rx="4"/><rect x="45" y="5" width="10" height="27" rx="2"/><rect x="37" y="11" width="26" height="9" rx="2"/>`
  };
  const pieceSVG = t => `<svg viewBox="0 0 100 100" aria-hidden="true">${SHAPES[t]}${BASE}</svg>`;
  const NAMES = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };

  function mount(host){
    host.innerHTML = `
    <div class="wrap chess">
      <header class="hub-head">
        <a class="back-link" href="#/games">← Games</a>
        <h1>♟️ Blox Chess</h1>
      </header>
      <div class="ch-layout">
        <div class="ch-boardbox">
          <div class="ch-tray" id="chTrayTop"></div>
          <div class="ch-board" id="chBoard" role="group" aria-label="Chess board">
            <div class="ch-squares" id="chSquares"></div>
            <div class="ch-pieces" id="chPieces"></div>
            <div class="ch-promo" id="chPromo" hidden><p>Turn your pawn into:</p><div id="chPromoBtns"></div></div>
          </div>
          <div class="ch-tray" id="chTrayBottom"></div>
        </div>
        <aside class="ch-side">
          <div class="ch-status" id="chStatus" aria-live="polite"></div>
          <div class="ch-buttons">
            <button class="btn" type="button" id="chNew">↻ New game</button>
            <button class="btn ghost" type="button" id="chUndo">↶ Undo</button>
            <button class="btn ghost" type="button" id="chHint">💡 Hint</button>
            <button class="btn ghost" type="button" id="chFlip">⇅ Flip</button>
          </div>
          <div class="ch-setup">
            <span class="ch-label">Play against</span>
            <div class="segmented" id="chMode" role="group" aria-label="Play against">
              <button type="button" data-mode="easy">🤖 Easy</button><button type="button" data-mode="normal">🤖 Normal</button><button type="button" data-mode="hard">🤖 Hard</button><button type="button" data-mode="two">👥 2 players</button>
            </div>
            <span class="ch-label" id="chSideLabel">You play</span>
            <div class="segmented" id="chSide" role="group" aria-label="Your side">
              <button type="button" data-side="w">White</button><button type="button" data-side="b">Black</button><button type="button" data-side="r">Random</button>
            </div>
            <label class="ch-check" id="chAutoFlipRow"><input type="checkbox" id="chAutoFlip"> Turn the board for each player</label>
            <p class="ch-note">Changes start a new game.</p>
          </div>
          <details class="ch-colours">
            <summary>🎨 Board and pieces</summary>
            <span class="ch-label">Board</span>
            <div class="ch-swatches" id="chThemes"></div>
            <span class="ch-label">White's pieces</span>
            <div class="ch-swatches" id="chWhite"></div>
            <span class="ch-label">Black's pieces</span>
            <div class="ch-swatches" id="chBlack"></div>
          </details>
          <div class="ch-movesbox"><span class="ch-label">Moves</span><ol class="ch-moves" id="chMoves"></ol></div>
        </aside>
      </div>
    </div>`;

    const $ = id => host.querySelector("#" + id);
    const board = $("chBoard"), squaresEl = $("chSquares"), piecesEl = $("chPieces"), statusEl = $("chStatus"), movesEl = $("chMoves");
    const promoEl = $("chPromo"), promoBtns = $("chPromoBtns");

    let pos, history, keys, sel = -1, targets = [], hint = null, over = null, pendingPromo = null, viewFlip = false, botTimer = 0, human = "w";
    const pieceEls = new Map();

    /* ---------------- the look ---------------- */
    function applyLook(){
      const S = C(), th = THEMES.find(t => t.id === S.theme) || THEMES[0];
      board.style.setProperty("--light", th.light); board.style.setProperty("--dark", th.dark); board.style.setProperty("--frame", th.frame);
      board.style.setProperty("--pw", S.white); board.style.setProperty("--pw-line", lineFor(S.white));
      board.style.setProperty("--pb", S.black); board.style.setProperty("--pb-line", lineFor(S.black));
      host.querySelectorAll(".ch-tray").forEach(t => { t.style.setProperty("--pw", S.white); t.style.setProperty("--pw-line", lineFor(S.white)); t.style.setProperty("--pb", S.black); t.style.setProperty("--pb-line", lineFor(S.black)); });
      $("chThemes").innerHTML = THEMES.map(t => `<button type="button" class="ch-theme${t.id === S.theme ? " on" : ""}" data-theme="${t.id}" title="${t.name}" aria-label="${t.name}" aria-pressed="${t.id === S.theme}" style="--a:${t.light};--b:${t.dark};--f:${t.frame}"><i></i></button>`).join("");
      const swatches = (side, other) => COLOURS.map(([n, c]) => `<button type="button" class="ch-swatch${S[side] === c ? " on" : ""}" data-side="${side}" data-colour="${c}" title="${n}" aria-label="${n}" aria-pressed="${S[side] === c}" style="--c:${c}" ${S[other] === c ? "disabled" : ""}></button>`).join("");
      $("chWhite").innerHTML = swatches("white", "black");
      $("chBlack").innerHTML = swatches("black", "white");
    }

    /* ---------------- drawing the board ---------------- */
    // which square is at screen row vr, column vf
    const flipped = () => viewFlip;
    const sqAt = (vr, vf) => flipped() ? (7 - vr) * 8 + (7 - vf) : vr * 8 + vf;
    const spot = sq => { const r = sq >> 3, f = sq & 7; return flipped() ? [7 - r, 7 - f] : [r, f]; };
    function buildSquares(){
      squaresEl.innerHTML = "";
      for (let vr = 0; vr < 8; vr++) for (let vf = 0; vf < 8; vf++) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ch-sq"; b.dataset.v = vr * 8 + vf;
        squaresEl.appendChild(b);
      }
    }
    function render(){
      const lastMove = history.length ? history[history.length - 1].move : null;
      const checkSq = E.inCheck(pos, pos.turn) ? pos.b.findIndex(p => p && p.t === "K" && p.c === pos.turn) : -1;
      squaresEl.querySelectorAll(".ch-sq").forEach(el => {
        const v = +el.dataset.v, vr = v >> 3, vf = v & 7, sq = sqAt(vr, vf), p = pos.b[sq], t = targets.find(m => m.to === sq);
        el.className = "ch-sq " + ((vr + vf) % 2 ? "dark" : "light")
          + (sq === sel ? " sel" : "") + (t ? (t.cap ? " cap" : " dot") : "")
          + (lastMove && (sq === lastMove.from || sq === lastMove.to) ? " last" : "")
          + (sq === checkSq ? " check" : "") + (hint && (sq === hint.from || sq === hint.to) ? " hint" : "");
        el.setAttribute("aria-label", E.sqName(sq) + (p ? `, ${p.c === "w" ? "white" : "black"} ${NAMES[p.t]}` : ""));
        // the letters and numbers round the edge
        const lab = (vf === 0 ? `<span class="ch-rk">${8 - (sq >> 3)}</span>` : "") + (vr === 7 ? `<span class="ch-fl">${"abcdefgh"[sq & 7]}</span>` : "");
        if (el.innerHTML !== lab) el.innerHTML = lab;
      });
      // the pieces slide from square to square
      const seen = new Set();
      pos.b.forEach((p, sq) => {
        if (!p) return;
        seen.add(p.id);
        let el = pieceEls.get(p.id);
        if (!el) { el = document.createElement("div"); el.className = "ch-piece"; piecesEl.appendChild(el); pieceEls.set(p.id, el); }
        const look = p.c + p.t;
        if (el.dataset.look !== look) { el.dataset.look = look; el.className = "ch-piece " + (p.c === "w" ? "pw" : "pb"); el.innerHTML = pieceSVG(p.t); }
        const [vr, vf] = spot(sq);
        el.style.left = vf * 12.5 + "%"; el.style.top = vr * 12.5 + "%";
      });
      pieceEls.forEach((el, id) => { if (!seen.has(id)) { el.remove(); pieceEls.delete(id); } });
      renderTrays(); renderMoves(); renderStatus();
      $("chUndo").disabled = !history.length || botThinking();
      $("chHint").disabled = !!over || !isHumanTurn();
    }
    // the pieces each side has taken, and who is ahead
    function renderTrays(){
      const count = c => { const n = { P: 8, N: 2, B: 2, R: 2, Q: 1 }; pos.b.forEach(p => { if (p && p.c === c && n[p.t] !== undefined) n[p.t]--; }); return n; };
      const lost = { w: count("w"), b: count("b") };
      const value = c => Object.keys(lost[c]).reduce((s, t) => s + Math.max(0, lost[c][t]) * E.VALUE[t], 0);
      const row = (taker, victim) => {
        let h = "";
        ["Q", "R", "B", "N", "P"].forEach(t => { for (let i = 0; i < lost[victim][t]; i++) h += `<span class="ch-mini ${victim === "w" ? "pw" : "pb"}">${pieceSVG(t)}</span>`; });
        const lead = Math.round((value(victim) - value(taker)) / 100);
        return h + (lead > 0 ? `<b>+${lead}</b>` : "");
      };
      const top = flipped() ? "w" : "b", bottom = flipped() ? "b" : "w";
      const name = c => C().mode === "two" ? (c === "w" ? "White" : "Black") : c === human ? (store.name || "You") : "🤖 BloxBot";
      $("chTrayTop").innerHTML = `<span class="ch-who">${name(top)}</span>${row(top, bottom)}`;
      $("chTrayBottom").innerHTML = `<span class="ch-who">${name(bottom)}</span>${row(bottom, top)}`;
    }
    function renderMoves(){
      let h = "";
      for (let i = 0; i < history.length; i += 2) h += `<li><span>${history[i].san}</span><span>${history[i + 1] ? history[i + 1].san : ""}</span></li>`;
      movesEl.innerHTML = h;
      movesEl.scrollTop = movesEl.scrollHeight;
    }
    function renderStatus(){
      if (over) { statusEl.innerHTML = over.text; statusEl.className = "ch-status over"; return; }
      const who = pos.turn === "w" ? "White" : "Black", check = E.inCheck(pos, pos.turn) ? " Check! 😱" : "";
      statusEl.className = "ch-status";
      if (C().mode === "two") statusEl.textContent = `${who} to move.${check}`;
      else statusEl.textContent = pos.turn === human ? `Your move (${who}).${check}` : "🤖 BloxBot is thinking…";
    }

    /* ---------------- playing ---------------- */
    const isHumanTurn = () => !over && (C().mode === "two" || pos.turn === human);
    const botThinking = () => !over && C().mode !== "two" && pos.turn !== human;
    function newGame(){
      clearTimeout(botTimer);
      const S = C();
      human = S.side === "r" ? (Math.random() < 0.5 ? "w" : "b") : S.side;
      pos = E.start(); history = []; keys = [E.key(pos)]; sel = -1; targets = []; hint = null; over = null; pendingPromo = null; promoEl.hidden = true;
      pieceEls.forEach(el => el.remove()); pieceEls.clear();
      viewFlip = S.mode === "two" ? false : human === "b";
      render();
      maybeBot();
    }
    function play(m){
      const san = E.san(pos, m);
      history.push({ pos, move: m, san });
      if (m.promo && m.promo === "Q" && (C().mode === "two" || m.p.c === human)) { C().promoted = true; }
      pos = E.make(pos, m); keys.push(E.key(pos));
      sel = -1; targets = []; hint = null;
      if (m.cap) Fun.sfx.pop(); else Fun.sfx.thunk();
      checkEnd();
      if (!over && E.inCheck(pos, pos.turn)) Fun.sfx.ding();
      if (!over && C().mode === "two" && C().flip) viewFlip = pos.turn === "b";
      Hub.saveStore(); Hub.checkBadges();
      render();
      maybeBot();
    }
    function checkEnd(){
      const moves = E.legal(pos), rep = keys.filter(k => k === keys[keys.length - 1]).length;
      let result = null, text = "";
      if (!moves.length && E.inCheck(pos, pos.turn)) { result = pos.turn === "w" ? "b" : "w"; text = `Checkmate! ${result === "w" ? "White" : "Black"} wins.`; }
      else if (!moves.length) { result = "draw"; text = "Stalemate: no legal moves, so it's a draw."; }
      else if (pos.half >= 100) { result = "draw"; text = "Draw: 50 moves with no capture or pawn move."; }
      else if (rep >= 3) { result = "draw"; text = "Draw: the same position came up three times."; }
      else if (E.notEnough(pos)) { result = "draw"; text = "Draw: nobody has enough pieces left to checkmate."; }
      if (!result) return;
      const S = C(), vsBot = S.mode !== "two";
      over = { result, text };
      if (vsBot) {
        if (result === human) {
          store.chessWins = (store.chessWins || 0) + 1; S.wins = (S.wins || 0) + 1; if (S.mode === "hard") S.hardWin = true;
          over.text = `🏆 Checkmate! You beat BloxBot on ${S.mode[0].toUpperCase() + S.mode.slice(1)}!`;
          Fun.sfx.tada(); Hub.confettiBurst(board);
        } else if (result === "draw") { S.draws = (S.draws || 0) + 1; over.text = "🤝 " + text; Fun.sfx.ding(); }
        else { S.losses = (S.losses || 0) + 1; over.text = "🤖 Checkmate! BloxBot wins this time. Try again?"; Fun.sfx.wah(); }
      } else { over.text = (result === "draw" ? "🤝 " : "🏆 ") + text; Fun.sfx.tada(); if (result !== "draw") Hub.confettiBurst(board); }
      Hub.saveStore(); Hub.checkBadges();
    }
    function maybeBot(){
      if (!botThinking()) return;
      const mine = pos;
      botTimer = setTimeout(() => {
        if (pos !== mine || over) return;
        const m = E.best(pos, C().mode);
        if (m) play(m);
      }, 450);
    }
    function undo(){
      if (!history.length || botThinking()) return;
      clearTimeout(botTimer);
      let n = C().mode === "two" ? 1 : (history.length && history[history.length - 1].move.p.c !== human ? 2 : 1);
      n = Math.min(n, history.length);
      for (let i = 0; i < n; i++) { pos = history.pop().pos; keys.pop(); }
      over = null; sel = -1; targets = []; hint = null; pendingPromo = null; promoEl.hidden = true;
      if (C().mode === "two" && C().flip) viewFlip = pos.turn === "b";
      render(); maybeBot();
    }

    // tapping squares: pick a piece, then where it goes
    squaresEl.addEventListener("click", e => {
      const el = e.target.closest(".ch-sq");
      if (!el || !isHumanTurn() || pendingPromo) return;
      const v = +el.dataset.v, sq = sqAt(v >> 3, v & 7), p = pos.b[sq];
      const moves = targets.filter(m => m.to === sq);
      if (moves.length) {
        if (moves.length > 1) { askPromo(moves); return; }   // a pawn reaching the end: choose what it becomes
        play(moves[0]); return;
      }
      if (p && p.c === pos.turn && sq !== sel) { sel = sq; targets = E.legal(pos).filter(m => m.from === sq); Fun.sfx.pop(); }
      else { sel = -1; targets = []; }
      hint = null;
      render();
    });
    function askPromo(moves){
      pendingPromo = moves;
      const c = moves[0].p.c;
      promoBtns.innerHTML = ["Q", "R", "B", "N"].map(t => `<button type="button" class="ch-promo-btn ${c === "w" ? "pw" : "pb"}" data-t="${t}" aria-label="${NAMES[t]}">${pieceSVG(t)}</button>`).join("");
      promoEl.hidden = false;
    }
    promoBtns.addEventListener("click", e => {
      const b = e.target.closest("[data-t]"); if (!b || !pendingPromo) return;
      const m = pendingPromo.find(x => x.promo === b.dataset.t);
      pendingPromo = null; promoEl.hidden = true;
      play(m);
    });

    $("chNew").addEventListener("click", newGame);
    $("chUndo").addEventListener("click", undo);
    $("chFlip").addEventListener("click", () => { viewFlip = !viewFlip; render(); });
    $("chHint").addEventListener("click", () => {
      if (!isHumanTurn()) return;
      hint = E.best(pos, "normal"); sel = -1; targets = [];
      render();
    });
    function syncSetup(){
      const S = C();
      $("chMode").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
      $("chSide").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.side === S.side)));
      $("chSide").hidden = $("chSideLabel").hidden = S.mode === "two";
      $("chAutoFlipRow").hidden = S.mode !== "two";
      $("chAutoFlip").checked = !!S.flip;
    }
    $("chMode").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (!b) return; C().mode = b.dataset.mode; Hub.saveStore(); syncSetup(); newGame(); });
    $("chSide").addEventListener("click", e => { const b = e.target.closest("[data-side]"); if (!b) return; C().side = b.dataset.side; Hub.saveStore(); syncSetup(); newGame(); });
    $("chAutoFlip").addEventListener("change", e => { C().flip = e.target.checked; Hub.saveStore(); viewFlip = C().flip && pos.turn === "b"; render(); });
    host.querySelector(".ch-colours").addEventListener("click", e => {
      const t = e.target.closest("[data-theme]"), s = e.target.closest("[data-colour]");
      if (t) C().theme = t.dataset.theme;
      else if (s && !s.disabled) C()[s.dataset.side] = s.dataset.colour;
      else return;
      Hub.saveStore(); applyLook(); Fun.sfx.pop();
    });

    buildSquares(); applyLook(); syncSetup(); newGame();
    window.__chess = { get pos(){ return pos; }, play: m => play(m), legal: () => E.legal(pos), get over(){ return over; }, newGame };
    return {
      open(){ applyLook(); syncSetup(); render(); maybeBot(); },
      close(){ clearTimeout(botTimer); }
    };
  }
})();
