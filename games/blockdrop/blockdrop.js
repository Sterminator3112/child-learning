/* Block Drop 3D: a Tetris-style falling blocks game, drawn as real 3D cubes in a well seen in perspective,
   over a moving neon grid. Seven shapes fall into a 10 × 20 well; slide and turn them to fill whole rows.
   Three modes: 🏔️ Marathon (endless, faster every 10 rows), ⏱️ Sprint (40 rows against the clock) and
   ⛏️ Dig (dig out 10 rows of junk against the clock).
   The pro stuff: turning uses the official "super rotation" wall kicks, so shapes can twist into tight spots;
   a T-Spin (turning the T into a slot) scores big; clears in a row build a combo; a Block Blast or T-Spin
   right after another is "back-to-back" (×1.5); and emptying the whole well is a Perfect Clear.
   There's a ghost showing where the shape will land, the next 5 shapes, and a Hold box. Shapes come in
   "bags" of all seven, so you never wait too long for a long one. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "blockdrop", section: "games", title: "Block Drop 3D", icon: "🧱",
    blurb: "Tetris-style in 3D! Marathon, Sprint and Dig, with T-Spins and combos.",
    stat: () => store.blockBest ? "Best: " + store.blockBest : "",
    badges: [
      { id: "bd-blast", icon: "💥", name: "Block Blast", desc: "Clear 4 rows at once in Block Drop", test: () => !!store.blockBlast },
      { id: "bd-100", icon: "🧱", name: "Row Wrecker", desc: "Clear 100 rows in Block Drop (all games together)", test: () => (store.blockRows || 0) >= 100 },
      { id: "bd-lv10", icon: "🚀", name: "Speed Stacker", desc: "Reach level 10 in Block Drop", test: () => (store.blockLevel || 0) >= 10 },
      { id: "bd-tspin", icon: "🌀", name: "T-Spin Master", desc: "Clear a row with a T-Spin in Block Drop", test: () => !!store.blockTSpin },
      { id: "bd-sprint", icon: "⏱️", name: "Sprinter", desc: "Finish a 40-row Sprint in Block Drop", test: () => !!store.blockSprint }
    ],
    mount
  });

  const COLS = 10, ROWS = 20;
  // each shape: its cells in a 3 × 3 (or 4 × 4) box, turned 0, and its colour
  const SHAPES = {
    I: { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], colour: "#36d6ff" },
    O: { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], colour: "#ffd93b" },
    T: { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], colour: "#b35cff" },
    S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], colour: "#3ddc6a" },
    Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], colour: "#ff4060" },
    J: { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], colour: "#4a6dff" },
    L: { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], colour: "#ff9a1f" }
  };
  const KINDS = Object.keys(SHAPES), JUNK = "#6e7487";
  // the official wall kicks, as [dx, dy] with y going down the screen, for each turn "from>to"
  const KICKS = {
    "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };
  const KICKS_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };
  const POINTS = [0, 100, 300, 500, 800], TSPIN = [400, 800, 1200, 1600];
  const WORDS = ["", "NICE!", "DOUBLE!", "TRIPLE!", "💥 BLOCK BLAST!"];
  const MODES = {
    marathon: { icon: "🏔️", name: "Marathon", text: "Endless! Every 10 rows the blocks fall faster." },
    sprint: { icon: "⏱️", name: "Sprint", text: "Clear 40 rows as fast as you can." },
    dig: { icon: "⛏️", name: "Dig", text: "Dig through 10 rows of grey junk as fast as you can." }
  };
  const rot4 = r => ((r % 4) + 4) % 4;
  // a shape turned r quarter-turns clockwise in its box
  function cellsOf(kind, r){
    const n = kind === "I" || kind === "O" ? 4 : 3;
    let cells = SHAPES[kind].cells;
    if (kind === "O") return cells;
    for (let k = 0; k < rot4(r); k++) cells = cells.map(([x, y]) => [n - 1 - y, x]);
    return cells;
  }
  function shade(hex, f){ const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="bdOverlay" hidden aria-label="Block Drop 3D">
      <div class="game-box bd-box">
        <div class="game-hud">
          <h2>🧱 Block Drop 3D</h2>
          <span class="mono game-stat" id="bdScore">⭐ 0</span>
          <span class="mono game-stat" id="bdRows">🧱 0</span>
          <span class="mono game-stat" id="bdLevel">Level 1</span>
          <button class="btn ghost small" id="bdCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="bdCanvas" width="720" height="660"></canvas>
          <div class="game-panel bd-panel" id="bdPanel">
            <div class="game-panel-title" id="bdPanelTitle">🧱 Block Drop 3D</div>
            <div class="game-panel-text" id="bdPanelText"></div>
            <button class="btn" id="bdPlayBtn" type="button">▶ Play</button>
            <div class="bd-modes" id="bdModes"></div>
          </div>
        </div>
        <div class="game-help">← → move · ↑ or X turn · Z turn back · ↓ drop faster · Space slam down · C or Shift hold · P pause</div>
        <div class="game-touch bd-touch">
          <button class="btn ghost" data-bd="left" type="button" aria-label="Left">◀</button>
          <button class="btn ghost" data-bd="right" type="button" aria-label="Right">▶</button>
          <button class="btn ghost" data-bd="back" type="button" aria-label="Turn back">⟲</button>
          <button class="btn ghost" data-bd="turn" type="button" aria-label="Turn">⟳</button>
          <button class="btn ghost" data-bd="down" type="button" aria-label="Drop faster">▼</button>
          <button class="btn ghost" data-bd="drop" type="button" aria-label="Slam down">⤓</button>
          <button class="btn ghost" data-bd="hold" type="button" aria-label="Hold">Hold</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("bdOverlay"), canvas = $("bdCanvas"), ctx = canvas.getContext("2d");
    const panel = $("bdPanel"), panelTitle = $("bdPanelTitle"), panelText = $("bdPanelText"), playBtn = $("bdPlayBtn"), modesEl = $("bdModes");
    const W = 720, H = 660;
    const fx = Fun.pops();

    let isOpen = false, running = false, paused = false, last = 0, clock = 0;
    let mode = "marathon", grid = [], piece = null, bag = [], next = [], hold = null, held = false;
    let score = 0, rows = 0, level = 1, fallT = 0, lockT = 0, lockMoves = 0, soft = false, clearing = null, over = 0;
    let combo = -1, b2b = false, lastTurn = false, timeT = 0, bump = 0, glow = 0, debris = [], banner = null;

    /* ----- the 3D camera: the well is 10 × 20 cubes, one cube deep, seen from slightly above the middle ----- */
    const F = 420, D = 14, CAMX = 5, CAMY = 13, CX = W / 2, CY = 236;
    // a point in the well (x across, y up from the floor, z into the screen) to the screen
    function P(x, y, z){ const s = F / (D + z); return [CX + (x - CAMX) * s, CY - (y - CAMY) * s + bump * 8]; }
    function quad(pts, fill){ ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
    // one cube at grid square (col, row), row 0 at the top; sides only where there's no neighbour
    function cube(col, row, colour, alpha, ghost){
      const x = col, y = ROWS - 1 - row;
      const f = [P(x, y + 1, 0), P(x + 1, y + 1, 0), P(x + 1, y, 0), P(x, y, 0)];
      const b = [P(x, y + 1, 1), P(x + 1, y + 1, 1), P(x + 1, y, 1), P(x, y, 1)];
      const has = (c, r) => !ghost && r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c];
      ctx.globalAlpha = alpha;
      if (ghost) {
        ctx.strokeStyle = colour; ctx.lineWidth = 2;
        ctx.beginPath(); f.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = alpha * 0.25; quad(f, colour); ctx.globalAlpha = 1; return;
      }
      // the top shows below the camera, the bottom above it; the side that faces the middle
      if (y + 1 < CAMY && !has(col, row - 1)) quad([b[0], b[1], f[1], f[0]], shade(colour, 1.35));
      if (y > CAMY && !has(col, row + 1)) quad([f[3], f[2], b[2], b[3]], shade(colour, 0.55));
      if (x + 1 < CAMX && !has(col + 1, row)) quad([f[1], b[1], b[2], f[2]], shade(colour, 0.7));
      if (x > CAMX && !has(col - 1, row)) quad([b[0], f[0], f[3], b[3]], shade(colour, 0.7));
      // the front, with a shine
      const g = ctx.createLinearGradient(f[0][0], f[0][1], f[2][0], f[2][1]);
      g.addColorStop(0, shade(colour, 1.25)); g.addColorStop(1, shade(colour, 0.85));
      quad(f, g);
      const s = (f[1][0] - f[0][0]);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(f[0][0] + s * 0.12, f[0][1] + s * 0.12, s * 0.5, s * 0.14);
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(f[0][0] + 0.5, f[0][1] + 0.5, s - 1, f[3][1] - f[0][1] - 1);
      ctx.globalAlpha = 1;
    }

    /* ----- shapes ----- */
    const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    function draw7(){ if (!bag.length) bag = KINDS.slice().sort(() => Math.random() - 0.5); return bag.pop(); }
    const fallTime = () => mode === "marathon" ? Math.max(0.03, 0.8 * Math.pow(0.84, level - 1)) : 0.8;
    function fits(kind, r, px, py){
      return cellsOf(kind, r).every(([x, y]) => {
        const gx = px + x, gy = py + y;
        return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !grid[gy][gx]);
      });
    }
    function spawn(kind){
      piece = { kind, r: 0, x: 3, y: kind === "I" ? -1 : 0 };
      fallT = 0; lockT = 0; lockMoves = 0; lastTurn = false;
      if (!fits(piece.kind, piece.r, piece.x, piece.y)) gameOver(false);
    }
    function nextPiece(){ next.push(draw7()); spawn(next.shift()); held = false; }
    // moving or turning on the floor gives a little more time before it locks (up to 15 times)
    function moved(){ if (piece && !fits(piece.kind, piece.r, piece.x, piece.y + 1) && lockMoves < 15) { lockT = 0; lockMoves++; } }

    function move(dx){
      if (!piece || clearing) return;
      if (fits(piece.kind, piece.r, piece.x + dx, piece.y)) { piece.x += dx; lastTurn = false; moved(); }
    }
    function turn(dir){
      if (!piece || clearing || piece.kind === "O") return;
      const from = rot4(piece.r), to = rot4(piece.r + dir), kicks = (piece.kind === "I" ? KICKS_I : KICKS)[from + ">" + to];
      for (const [kx, ky] of kicks) {
        if (fits(piece.kind, to, piece.x + kx, piece.y + ky)) { piece.r = to; piece.x += kx; piece.y += ky; lastTurn = true; moved(); Fun.sfx.pop(); return; }
      }
    }
    function ghostY(){ let y = piece.y; while (fits(piece.kind, piece.r, piece.x, y + 1)) y++; return y; }
    function hardDrop(){
      if (!piece || clearing) return;
      const y = ghostY();
      score += 2 * (y - piece.y);
      // a streak of light where it fell
      cellsOf(piece.kind, piece.r).forEach(([x]) => debris.push({ trail: true, col: piece.x + x, from: piece.y, to: y, t: 0, colour: SHAPES[piece.kind].colour }));
      piece.y = y; bump = 1;
      lock();
      Fun.sfx.thunk();
    }
    function holdPiece(){
      if (!piece || held || clearing) return;
      const k = piece.kind;
      if (hold) spawn(hold); else nextPiece();
      hold = k; held = true;
      Fun.sfx.whoosh();
    }

    /* ----- landing, T-Spins, combos and clearing ----- */
    function isTSpin(){
      if (piece.kind !== "T" || !lastTurn) return false;
      const solid = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && grid[y][x]);
      return [[0, 0], [2, 0], [0, 2], [2, 2]].filter(([x, y]) => solid(piece.x + x, piece.y + y)).length >= 3;
    }
    function lock(){
      const tspin = isTSpin(), colour = SHAPES[piece.kind].colour;
      cellsOf(piece.kind, piece.r).forEach(([x, y]) => { if (piece.y + y >= 0) grid[piece.y + y][piece.x + x] = colour; });
      const above = cellsOf(piece.kind, piece.r).every(([, y]) => piece.y + y < 0);
      piece = null;
      if (above) { gameOver(false); return; }
      const full = grid.map((row, i) => row.every(Boolean) ? i : -1).filter(i => i >= 0), n = full.length;
      if (tspin) { score += TSPIN[n] * level; say(n ? `🌀 T-SPIN ${["", "SINGLE", "DOUBLE", "TRIPLE"][n]}!` : "🌀 T-SPIN!", "#d68cff"); }
      if (!n) { combo = -1; nextPiece(); return; }
      // the score for the rows, with back-to-back and the combo on top
      const hard = n === 4 || tspin;
      let pts = tspin ? 0 : POINTS[n] * level;
      if (hard && b2b) { pts = Math.round(pts * 1.5) + (tspin ? Math.round(TSPIN[n] * level * 0.5) : 0); say("🔥 BACK-TO-BACK!", "#ff9a1f", 1); }
      b2b = hard;
      combo++;
      if (combo > 0) { pts += 50 * combo * level; say(`⚡ ${combo} COMBO!`, "#7df9ff", 2); }
      score += pts; rows += n;
      store.blockRows = (store.blockRows || 0) + n;
      if (tspin) store.blockTSpin = true;
      if (n === 4) { store.blockBlast = true; Fun.sfx.tada(); Hub.confettiBurst(canvas); glow = 1; } else Fun.sfx.ding();
      if (!tspin) say(WORDS[n], n === 4 ? "#ff4dd2" : "#ffe14d");
      // cubes from the cleared rows fly out of the well
      full.forEach(r => { for (let x = 0; x < COLS; x++) { const [sx, sy] = P(x + 0.5, ROWS - 1 - r + 0.5, 0); debris.push({ x: sx, y: sy, vx: (x - 4.5) * 40 + (Math.random() - 0.5) * 120, vy: -150 - Math.random() * 200, spin: Math.random() * 6, t: 0, colour: grid[r][x] }); } });
      clearing = { rows: full, t: 0 };
      if (mode === "marathon") {
        const lv = Math.floor(rows / 10) + 1;
        if (lv > level) { level = lv; store.blockLevel = Math.max(store.blockLevel || 0, level); say("LEVEL " + level + "!", "#7df9ff", 3); }
      }
      Hub.checkBadges();
    }
    function finishClear(){
      grid = grid.filter((row, i) => !clearing.rows.includes(i));
      while (grid.length < ROWS) grid.unshift(Array(COLS).fill(null));
      clearing = null;
      if (grid.every(row => row.every(c => !c))) { score += 2000 * level; say("🌟 PERFECT CLEAR!", "#fff", 3); Fun.sfx.tada(); Hub.confettiBurst(canvas); }
      if (mode === "sprint" && rows >= 40) { gameOver(true); return; }
      if (mode === "dig" && !grid.some(row => row.includes(JUNK))) { gameOver(true); return; }
      nextPiece();
    }
    // the big words in the middle of the well, one under the other
    function say(text, colour, line){ fx.pop(text, W / 2, 200 + (line || 0) * 46, colour, text.length > 12 ? 30 : 38); }

    function gameOver(won){
      running = false; piece = null; over = won ? 0 : 1;
      const secs = Math.round(timeT * 10) / 10;
      let text, newBest = false;
      if (mode === "marathon") {
        newBest = score > (store.blockBest || 0);
        if (newBest) store.blockBest = score;
        text = `You cleared ${rows} rows, reached level ${level} and scored ${score}.` + (newBest ? " That's a new best! 🎉" : ` Your best is ${store.blockBest || 0}.`);
      } else if (won) {
        const key = mode === "sprint" ? "blockSprint" : "blockDig";
        newBest = !store[key] || secs < store[key];
        if (newBest) store[key] = secs;
        text = `${MODES[mode].icon} Done in ${secs} seconds!` + (newBest ? " That's a new best time! 🎉" : ` Your best is ${store[key]} s.`);
      } else text = `${MODES[mode].icon} The blocks reached the top! You cleared ${rows} rows. Try again!`;
      Fun.sfx[won ? "tada" : "wah"]();
      Hub.saveStore(); Hub.checkBadges();
      setTimeout(() => {
        if (!isOpen) return;
        panelTitle.textContent = won ? "🏆 You did it!" : "🧱 Game over!";
        panelText.textContent = text;
        playBtn.textContent = "▶ Play again"; showModes(); panel.hidden = false;
        if (newBest) Hub.confettiBurst(playBtn);
        playBtn.focus();
      }, 900);
    }

    /* ----- drawing ----- */
    function background(){
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0b0320"); g.addColorStop(0.55, "#2a0b4a"); g.addColorStop(1, "#06021a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // a neon sun and a grid floor rolling towards you
      const hor = 470;
      const sun = ctx.createLinearGradient(0, hor - 170, 0, hor);
      sun.addColorStop(0, "#ffde59"); sun.addColorStop(1, "#ff3fa4");
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W / 2, hor, 150, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#2a0b4a"; for (let k = 0; k < 6; k++) ctx.fillRect(W / 2 - 160, hor - 18 - k * 22, 320, 3 + k);
      ctx.fillStyle = "#12052b"; ctx.fillRect(0, hor, W, H - hor);
      ctx.strokeStyle = `rgba(255,63,164,${0.45 + glow * 0.5})`; ctx.lineWidth = 1.5;
      for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 14, hor); ctx.lineTo(W / 2 + i * 150, H); ctx.stroke(); }
      const speed = 0.4 + level * 0.06;
      for (let k = 0; k < 8; k++) { const p = ((k + clock * speed) % 8) / 8, y = hor + (H - hor) * p * p; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    function well(){
      // the back wall with its grid, the floor, and a glowing rainbow rim
      quad([P(0, ROWS, 1), P(COLS, ROWS, 1), P(COLS, 0, 1), P(0, 0, 1)], "rgba(8,4,24,0.92)");
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { const [a, b] = [P(x, 0, 1), P(x, ROWS, 1)]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (let y = 1; y < ROWS; y++) { const [a, b] = [P(0, y, 1), P(COLS, y, 1)]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      quad([P(0, 0, 0), P(COLS, 0, 0), P(COLS, 0, 1), P(0, 0, 1)], "#3a2466");
      quad([P(0, ROWS, 0), P(0, ROWS, 1), P(0, 0, 1), P(0, 0, 0)], "rgba(80,50,140,0.55)");
      quad([P(COLS, ROWS, 1), P(COLS, ROWS, 0), P(COLS, 0, 0), P(COLS, 0, 1)], "rgba(80,50,140,0.55)");
    }
    function rim(){
      const a = P(0, ROWS, 0), b = P(COLS, 0, 0);
      const g = ctx.createLinearGradient(a[0], 0, b[0], 0);
      ["#ff4060", "#ff9a1f", "#ffd93b", "#3ddc6a", "#36d6ff", "#b35cff"].forEach((c, i) => g.addColorStop(i / 5, c));
      ctx.save(); ctx.shadowColor = "#ff3fa4"; ctx.shadowBlur = 14 + glow * 30;
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.strokeRect(a[0] - 2, a[1] - 2, b[0] - a[0] + 4, b[1] - a[1] + 4);
      ctx.restore();
    }
    // the cubes, drawn from the outside in so the nearer ones cover the sides of the further ones
    function cubes(){
      const list = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!grid[r][c]) continue;
        const flash = clearing && clearing.rows.includes(r);
        if (flash && clearing.t > 0.12) continue;
        list.push([c, r, flash ? "#ffffff" : grid[r][c], over ? 0.45 : 1]);
      }
      if (piece) {
        const gy = ghostY(), colour = SHAPES[piece.kind].colour;
        cellsOf(piece.kind, piece.r).forEach(([x, y]) => { if (gy + y >= 0 && gy !== piece.y) list.push([piece.x + x, gy + y, colour, 0.7, true]); });
        cellsOf(piece.kind, piece.r).forEach(([x, y]) => { if (piece.y + y >= 0) list.push([piece.x + x, piece.y + y, colour, 1]); });
      }
      const dist = ([c, r]) => Math.abs(c + 0.5 - CAMX) + Math.abs(ROWS - r - 0.5 - CAMY);
      // the ghost goes first, so real cubes cover it
      list.sort((a, b) => (b[4] ? 1 : 0) - (a[4] ? 1 : 0) || dist(b) - dist(a));
      list.forEach(([c, r, colour, alpha, ghost]) => cube(c, r, colour, alpha, ghost));
    }
    // a small cube for the Hold and Next boxes
    function miniCube(x, y, s, colour, alpha){
      const d = s * 0.3;
      ctx.globalAlpha = alpha;
      quad([[x, y], [x + d, y - d], [x + s + d, y - d], [x + s, y]], shade(colour, 1.35));
      quad([[x + s, y], [x + s + d, y - d], [x + s + d, y + s - d], [x + s, y + s]], shade(colour, 0.7));
      quad([[x, y], [x + s, y], [x + s, y + s], [x, y + s]], colour);
      ctx.globalAlpha = 1;
    }
    function mini(kind, cx, cy, s, alpha){
      if (!kind) return;
      const cells = cellsOf(kind, 0), xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), w = (Math.max(...xs) - x0 + 1) * s, h = (Math.max(...ys) - y0 + 1) * s;
      cells.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0]).forEach(([x, y]) => miniCube(cx - w / 2 + (x - x0) * s, cy - h / 2 + (y - y0) * s, s, SHAPES[kind].colour, alpha));
    }
    function box(x, y, w, h, title){
      ctx.fillStyle = "rgba(20,8,48,0.75)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255,63,164,0.6)"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#fff"; ctx.font = "800 15px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(title, x + w / 2, y + 14);
    }
    function side(){
      box(16, 20, 130, 96, "HOLD"); mini(hold, 81, 74, 18, held ? 0.4 : 1);
      box(W - 146, 20, 130, 330, "NEXT");
      next.forEach((k, i) => mini(k, W - 81, 72 + i * 60, i ? 14 : 18, 1));
      // the mode and its goal, the combo and back-to-back
      box(16, 136, 130, 150, MODES[mode].icon + " " + MODES[mode].name);
      ctx.font = "700 14px system-ui"; ctx.fillStyle = "#fff";
      const lines = mode === "marathon" ? [`Level ${level}`, `${10 - rows % 10} to next`] : mode === "sprint" ? [`${Math.max(0, 40 - rows)} rows left`, fmt(timeT)] : [`${grid.filter(r => r.includes(JUNK)).length} junk rows`, fmt(timeT)];
      if (combo > 0) lines.push(`⚡ Combo ${combo}`);
      if (b2b) lines.push("🔥 Back-to-back");
      lines.forEach((t, i) => ctx.fillText(t, 81, 172 + i * 26));
    }
    const fmt = t => `⏱️ ${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
    function flyers(dt){
      debris = debris.filter(d => {
        d.t += dt;
        if (d.trail) {
          const a = P(d.col, ROWS - d.from, 0.5), b = P(d.col + 1, ROWS - d.to - 1, 0.5);
          ctx.globalAlpha = Math.max(0, 0.5 - d.t * 2); ctx.fillStyle = d.colour; ctx.fillRect(a[0] + 4, a[1], b[0] - a[0] - 8, b[1] - a[1]); ctx.globalAlpha = 1;
          return d.t < 0.25;
        }
        d.vy += 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.spin += dt * 8;
        const s = 22 * Math.max(0.2, 1 - d.t * 0.6);
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.spin); miniCube(-s / 2, -s / 2, s, d.colour, 1); ctx.restore();
        return d.y < H + 40;
      });
    }
    function draw(dt){
      background(); well(); cubes(); rim(); flyers(dt); side();
      if (paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "900 40px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillText("PAUSED", W / 2, H / 2);
      }
      fx.draw(ctx, dt);
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last, 0.05); last = now; clock += dt;
      bump = Math.max(0, bump - dt * 7); glow = Math.max(0, glow - dt * 0.8);
      if (running && !paused) {
        timeT += dt;
        if (clearing) { clearing.t += dt; if (clearing.t > 0.3) finishClear(); }
        else if (piece) {
          fallT += dt;
          const every = soft ? Math.min(0.035, fallTime()) : fallTime();
          while (piece && fallT >= every) {
            fallT -= every;
            if (fits(piece.kind, piece.r, piece.x, piece.y + 1)) { piece.y++; lastTurn = false; if (soft) score += 1; }
            else break;
          }
          // a short moment to slide it after it touches down
          if (piece && !fits(piece.kind, piece.r, piece.x, piece.y + 1)) { lockT += dt; if (lockT > 0.5) lock(); }
        }
      }
      over = Math.max(0, over - dt * 0.5);
      draw(dt);
      $("bdScore").textContent = "⭐ " + score;
      $("bdRows").textContent = "🧱 " + rows;
      $("bdLevel").textContent = mode === "marathon" ? "Level " + level : fmt(timeT);
      requestAnimationFrame(loop);
    }

    /* ----- controls ----- */
    // holding ← or → slides the shape along after a short wait
    let slide = 0, slideT = 0;
    function act(a, on){
      if (!running || paused) { if (a === "down" && !on) soft = false; return; }
      if (a === "left" || a === "right") { if (on) { move(a === "left" ? -1 : 1); slide = a === "left" ? -1 : 1; slideT = -0.16; } else if (slide === (a === "left" ? -1 : 1)) slide = 0; }
      else if (a === "down") soft = on;
      else if (on && a === "turn") turn(1);
      else if (on && a === "back") turn(-1);
      else if (on && a === "drop") hardDrop();
      else if (on && a === "hold") holdPiece();
    }
    setInterval(() => {
      if (!slide || !running || paused) return;
      slideT += 0.04;
      if (slideT >= 0) move(slide);
    }, 40);
    const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowDown: "down", KeyS: "down",
      ArrowUp: "turn", KeyX: "turn", KeyW: "turn", KeyZ: "back", Space: "drop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold" };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (e.code === "KeyP" && running) { paused = !paused; return; }
      const a = KEYMAP[e.code]; if (!a) return;
      e.preventDefault();
      if (e.repeat && a !== "down") return;
      act(a, true);
    });
    window.addEventListener("keyup", e => { const a = KEYMAP[e.code]; if (a) act(a, false); });
    window.addEventListener("blur", () => { slide = 0; soft = false; });
    host.querySelectorAll("[data-bd]").forEach(b => {
      const a = b.dataset.bd;
      b.addEventListener("pointerdown", e => { e.preventDefault(); b.setPointerCapture(e.pointerId); act(a, true); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(n => b.addEventListener(n, () => act(a, false)));
    });
    // on the well: tap to turn, swipe sideways to move, swipe down to slam
    let touch = null;
    canvas.addEventListener("pointerdown", e => { touch = { x: e.clientX, y: e.clientY, moved: false }; });
    canvas.addEventListener("pointermove", e => {
      if (!touch || !running) return;
      const cw = canvas.getBoundingClientRect().width / W * 30, dx = e.clientX - touch.x;
      if (Math.abs(dx) > cw) { move(dx > 0 ? 1 : -1); touch.x = e.clientX; touch.moved = true; }
      if (e.clientY - touch.y > cw * 4 && !touch.moved) { hardDrop(); touch = null; }
    });
    canvas.addEventListener("pointerup", () => { if (touch && !touch.moved) act("turn", true); touch = null; });
    canvas.tabIndex = 0;

    function showModes(){
      modesEl.innerHTML = Object.entries(MODES).map(([id, m]) =>
        `<button class="bd-mode${id === mode ? " on" : ""}" type="button" data-mode="${id}" aria-pressed="${id === mode}"><b>${m.icon} ${m.name}</b><span>${m.text}</span></button>`).join("");
    }
    modesEl.addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) { mode = b.dataset.mode; showModes(); } });

    function start(){
      grid = empty(); bag = []; next = [draw7(), draw7(), draw7(), draw7(), draw7()]; hold = null; held = false;
      score = 0; rows = 0; level = 1; soft = false; slide = 0; clearing = null; paused = false; over = 0;
      combo = -1; b2b = false; timeT = 0; debris = [];
      if (mode === "dig") {
        // 10 rows of junk, each with one hole
        for (let r = ROWS - 10; r < ROWS; r++) { const hole = Math.floor(Math.random() * COLS); grid[r] = grid[r].map((_, c) => c === hole ? null : JUNK); }
      }
      fx.clear();
      running = true; panel.hidden = true;
      nextPiece();
      canvas.focus();
    }
    function openGame(){
      isOpen = true; running = false; paused = false;
      grid = empty(); piece = null; next = []; hold = null; debris = [];
      Fun.screen(overlay, true);
      panelTitle.textContent = "🧱 Block Drop 3D";
      panelText.textContent = "Slide and turn the 3D blocks to fill whole rows! 4 rows at once is a BLOCK BLAST. Pro moves: twist the T into a slot for a 🌀 T-Spin, clear rows one after another for a ⚡ combo. Pick a mode:"
        + (store.blockBest ? ` (Marathon best: ${store.blockBest})` : "");
      playBtn.textContent = "▶ Play"; showModes(); panel.hidden = false;
      last = performance.now(); requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; slide = 0; soft = false; Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    $("bdCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("bdCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
