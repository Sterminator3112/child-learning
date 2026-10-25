/* Bühne: the 3D scene above Musik Maestro's questions. You're the Dirigent (conductor) on a concert stage
   with a red curtain, wooden floor and coloured spotlights, and a crowd in front of you. Every right answer
   makes the band play a real note (the notes climb a scale as your streak grows), notes fly into the air, the
   lights flash and the crowd jumps. The band grows as you play: after 10 right answers the Schlagzeuger (drums)
   joins, after 25 the Gitarrist, after 50 the Pianistin and after 100 the Sängerin. A wrong answer snaps a
   string: a sour note, the lights flicker and the crowd goes "Oooh".
     MusikBuehne(el, store) -> { answer(correct, streak), topic(id), open(), close() }
   Drawn with a little 3D camera on a 2D canvas. Progress is kept in store (notes played). */
(function(){
  "use strict";

  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];   // C major pentatonic, two octaves
  const BAND = [
    { at: 10,  name: "Schlagzeuger", x: 2.6,  skin: "#f5cd8a", shirt: "#d62b2b", tool: "drums" },
    { at: 25,  name: "Gitarrist",    x: -2.6, skin: "#c68863", shirt: "#3fae4a", tool: "guitar" },
    { at: 50,  name: "Pianistin",    x: -5.2, skin: "#f2c49b", shirt: "#b46bff", tool: "keys" },
    { at: 100, name: "Sängerin",     x: 5.2,  skin: "#f5cd8a", shirt: "#ff6bd6", tool: "mic" }
  ];
  const CHEER = ["Bravo!", "Zugabe!", "Wow!", "Super!", "Encore!", "Juhui!"];

  window.MusikBuehne = function(el, S){
    el.innerHTML = `<canvas class="buehne-canvas" width="960" height="270" aria-label="Konzertbühne"></canvas>`;
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const W = 960, H = 270, FOC = 380;
    const fx = Fun.pops();
    S.notes = S.notes || 0;

    let clock = 0;
    let flash = 0, flicker = 0, jump = 0, sour = 0, streak = 0;
    let notes = [];   // floating music notes
    let audio = null;

    // a tiny sound for each note: a soft triangle wave, quieter as it fades
    function tone(freq, len, type, vol){
      if (Hub.store.sound === false) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
        o.type = type || "triangle"; o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len);
      } catch (e) {}
    }

    /* ----- the camera: in front of the stage, looking at it, swaying a little ----- */
    function proj(x, y, z){
      const cx = Math.sin(clock * 0.3) * 0.6;
      const dx = x - cx, dy = y - 3.2, dz = z + 12;
      const t = 0.14, ry = dy * Math.cos(t) + dz * Math.sin(t), rz = -dy * Math.sin(t) + dz * Math.cos(t);
      if (rz < 0.5) return null;
      return { x: W / 2 + dx * FOC / rz, y: H * 0.62 - ry * FOC / rz, s: FOC / rz };
    }
    const shade = Fun.shade;
    function quad(pts, fill){
      const p = pts.map(q => proj(...q)); if (p.some(q => !q)) return;
      ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    // a solid box standing on the floor
    function box(x, y, z, w, h, d, col){
      const X = [x - w / 2, x + w / 2], Z = [z - d / 2, z + d / 2];
      quad([[X[0], y + h, Z[0]], [X[1], y + h, Z[0]], [X[1], y + h, Z[1]], [X[0], y + h, Z[1]]], shade(col, 1.2));
      quad([[X[0], y, Z[0]], [X[1], y, Z[0]], [X[1], y + h, Z[0]], [X[0], y + h, Z[0]]], shade(col, 0.8));
      quad([[X[0], y, Z[0]], [X[0], y, Z[1]], [X[0], y + h, Z[1]], [X[0], y + h, Z[0]]], shade(col, 0.65));
      quad([[X[1], y, Z[0]], [X[1], y, Z[1]], [X[1], y + h, Z[1]], [X[1], y + h, Z[0]]], shade(col, 0.7));
    }

    function drawStage(){
      ctx.fillStyle = "#120a1c"; ctx.fillRect(0, 0, W, H);
      // the back wall, with a red curtain either side and a banner
      quad([[-9, 0, 3], [9, 0, 3], [9, 7, 3], [-9, 7, 3]], "#2a1840");
      [[-9, -5.6], [5.6, 9]].forEach(([a, b]) => {
        for (let i = 0; i < 6; i++) { const x0 = a + (b - a) * i / 6, x1 = a + (b - a) * (i + 1) / 6; quad([[x0, 0, 2.6], [x1, 0, 2.6], [x1, 7.4, 2.6], [x0, 7.4, 2.6]], i % 2 ? "#a81f2a" : "#c8303c"); }
      });
      quad([[-9, 6.4, 2.6], [9, 6.4, 2.6], [9, 7.4, 2.6], [-9, 7.4, 2.6]], "#8a1620");
      // the floor: planks of wood, with a shine in the middle
      for (let i = -9; i < 9; i++) for (let j = 0; j < 5; j++) {
        const x0 = i, z0 = -3 + j * 1.2;
        quad([[x0, 0, z0], [x0 + 1, 0, z0], [x0 + 1, 0, z0 + 1.2], [x0, 0, z0 + 1.2]], (i + j) & 1 ? "#a8743c" : "#b8844c");
      }
      // the front edge of the stage
      quad([[-9, 0, -3], [9, 0, -3], [9, -1, -3], [-9, -1, -3]], "#4a2e18");
      // a banner on the wall
      const bn = proj(0, 5.3, 2.6);
      if (bn) { ctx.font = `bold ${Math.max(12, 0.95 * bn.s)}px "Bricolage Grotesque", system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffe14d"; ctx.fillText("MUSIK MAESTRO", bn.x, bn.y); ctx.textBaseline = "alphabetic"; }
    }

    // spotlight cones from the ceiling, in changing colours; they sweep faster with a streak
    function drawLights(){
      const cols = ["#ff4d6d", "#4da6ff", "#ffe14d", "#6be03a", "#b46bff"];
      for (let i = 0; i < 5; i++) {
        const sweep = Math.sin(clock * (0.6 + Math.min(streak, 12) * 0.12) + i * 1.7) * 2.2;
        const top = proj(-6 + i * 3, 8, 1), bot = proj(-6 + i * 3 + sweep, 0, 0.5);
        if (!top || !bot) continue;
        const a = (0.1 + flash * 0.25) * (flicker > 0 && Math.sin(clock * 60) > 0 ? 0 : 1);
        ctx.fillStyle = cols[i]; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(top.x - 4, top.y); ctx.lineTo(top.x + 4, top.y); ctx.lineTo(bot.x + 40 * bot.s * 0.08 + 22, bot.y); ctx.lineTo(bot.x - 40 * bot.s * 0.08 - 22, bot.y); ctx.fill();
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(bot.x, bot.y, 0, bot.x, bot.y, 60 + flash * 40); g.addColorStop(0, cols[i] + "88"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(bot.x - 100, bot.y - 100, 200, 200);
      }
    }

    // a blocky musician: legs, body, arms, a head with a face, and something to play
    function person(x, z, look, tool, playing){
      const bob = playing ? Math.abs(Math.sin(clock * 8 + x)) * 0.12 : Math.sin(clock * 2 + x) * 0.03;
      const y = bob;
      box(x - 0.22, 0, z, 0.36, 1.0, 0.4, "#2a3a5a"); box(x + 0.22, 0, z, 0.36, 1.0, 0.4, "#2a3a5a");
      box(x, 1.0 + y, z, 1.0, 1.1, 0.5, look.shirt);
      const arm = playing ? Math.sin(clock * 10 + x) * 0.3 : 0;
      box(x - 0.7, 1.05 + y + arm * 0.5, z - 0.15, 0.3, 0.95, 0.35, look.skin); box(x + 0.7, 1.05 + y - arm * 0.5, z - 0.15, 0.3, 0.95, 0.35, look.skin);
      box(x, 2.1 + y, z, 0.7, 0.7, 0.7, look.skin);
      const h = proj(x, 2.45 + y, z - 0.38);
      if (h) Fun.face(ctx, h.x, h.y, 0.3 * h.s, sour > 0 ? "dizzy" : playing ? "grin" : "happy", clock, 0, 0.2);
      if (tool === "drums") { box(x, 0, z + 1.0, 1.8, 0.8, 0.9, "#d62b2b"); const c = proj(x - 1.1, 1.8, z + 1.0); if (c) { ctx.fillStyle = "#ffe14d"; ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.5 * c.s, 0.12 * c.s, 0, 0, 7); ctx.fill(); } }
      if (tool === "guitar") { box(x + 0.35, 0.9 + y, z - 0.45, 0.35, 1.4, 0.2, "#c8553d"); box(x + 0.35, 2.0 + y, z - 0.45, 0.14, 0.9, 0.14, "#6b4423"); }
      if (tool === "keys") { box(x, 0.8, z - 0.7, 2.2, 0.35, 0.8, "#1a1a22"); box(x, 1.15, z - 0.7, 2.0, 0.08, 0.7, "#f5f5f5"); }
      if (tool === "mic") { box(x + 0.9, 0, z - 0.4, 0.1, 1.9, 0.1, "#9aa3ad"); box(x + 0.9, 1.9, z - 0.4, 0.24, 0.24, 0.24, "#222"); }
    }

    function drawCrowd(){
      // rows of heads at the bottom, bobbing, with hands up when the crowd is happy
      for (let row = 0; row < 2; row++) for (let i = -10; i <= 10; i++) {
        const x = i * 1.1 + (row ? 0.55 : 0), z = -5.5 - row * 1.6;
        const up = Math.max(0, Math.sin(clock * 6 + i * 1.3 + row)) * (0.1 + jump * 0.6);
        const p = proj(x, 0.6 + up, z); if (!p) continue;
        const R = 0.42 * p.s;
        ctx.fillStyle = shade(["#f5cd8a", "#c68863", "#f2c49b", "#8a5a3a"][(i + 20 + row) % 4], 0.45); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fill();
        ctx.fillRect(p.x - R * 0.9, p.y + R * 0.8, R * 1.8, R * 2);
        if (jump > 0.2 && (i + row) % 2 === 0) { ctx.fillRect(p.x - R * 1.5, p.y - R * (1.2 + up * 2), R * 0.4, R * 1.8); ctx.fillRect(p.x + R * 1.1, p.y - R * (1.2 + up * 2), R * 0.4, R * 1.8); }
      }
    }

    const anim = Fun.animate(dt => {
      clock += dt;
      flash = Math.max(0, flash - dt * 1.5); flicker = Math.max(0, flicker - dt); jump = Math.max(0, jump - dt * 0.8); sour = Math.max(0, sour - dt);
      drawStage();
      drawLights();
      // you, the Dirigent, in front of the band with a baton
      const members = BAND.filter(m => S.notes >= m.at);
      members.forEach(m => person(m.x, 0.8, m, m.tool, flash > 0.1));
      person(0, -0.4, { skin: "#f5cd8a", shirt: "#1b1d24" }, null, flash > 0.1);
      const tip = proj(0.95, 2.4 + Math.sin(clock * 9) * (flash > 0.1 ? 0.5 : 0.08), -0.7), hand = proj(0.7, 1.4, -0.55);
      if (tip && hand) { ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1.5, 0.05 * tip.s); ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); }
      // the top hat
      box(0, 2.78, -0.4, 0.8, 0.12, 0.8, "#111"); box(0, 2.9, -0.4, 0.55, 0.45, 0.55, "#111");
      drawCrowd();
      // music notes floating up and out
      ctx.font = `bold 26px system-ui, "Apple Color Emoji", sans-serif`; ctx.textAlign = "center";
      notes.forEach(n => { n.t += dt; n.y -= dt * 60; n.x += Math.sin(n.t * 4 + n.ph) * 0.6; ctx.globalAlpha = Math.max(0, 1 - n.t / 1.8); ctx.fillStyle = n.col; ctx.fillText(n.ch, n.x, n.y); });
      ctx.globalAlpha = 1; notes = notes.filter(n => n.t < 1.8);
      // the counter, and who plays next
      ctx.fillStyle = "rgba(10,10,30,0.6)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(10, 10, 340, 30, 8) : ctx.rect(10, 10, 340, 30); ctx.fill();
      ctx.font = "bold 14px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      const nxt = BAND.find(m => S.notes < m.at);
      ctx.fillText(`🎵 ${S.notes} Töne${nxt ? ` · ${nxt.at - S.notes} bis ${nxt.name}` : " · volle Band!"}`, 20, 25);
      ctx.textBaseline = "alphabetic";
      fx.draw(ctx, dt);
    });

    return {
      answer(correct, st){
        streak = st;
        if (correct) {
          S.notes++; flash = 1; jump = 1;
          const i = Math.min(SCALE.length - 1, Math.max(0, st - 1));
          tone(SCALE[i], 0.5); tone(SCALE[i] / 2, 0.6, "sine", 0.07);
          for (let k = 0; k < 3; k++) notes.push({ x: W / 2 + (Math.random() - 0.5) * 300, y: H * 0.55, t: -k * 0.12, ph: Math.random() * 6, ch: ["♪", "♫", "♬"][k], col: ["#ffe14d", "#7fe3ff", "#ff6bd6"][Math.floor(Math.random() * 3)] });
          const nw = BAND.find(m => m.at === S.notes);
          if (nw) { fx.pop(`🎉 ${nw.name} spielt mit!`, W / 2, 60, "#ffe14d", 32); Fun.sfx.tada(); }
          else if (st && st % 5 === 0) { fx.pop(`${CHEER[Math.floor(Math.random() * CHEER.length)]} ×${st}`, W / 2, 60, "#ffe14d", 34); Fun.sfx.ding(); }
          else fx.pop(CHEER[Math.floor(Math.random() * CHEER.length)], W * 0.7, 70, "#ffe14d", 26);
        } else {
          flicker = 0.9; sour = 1.2; jump = 0;
          tone(220, 0.3, "sawtooth", 0.07); setTimeout(() => tone(233, 0.4, "sawtooth", 0.07), 80);
          fx.pop(["Oooh!", "Falscher Ton!", "Ups!", "Klirr!"][Math.floor(Math.random() * 4)], W * 0.3, 70, "#ff8a8a", 28);
        }
        Hub.saveStore();
      },
      topic(){},
      open: anim.open,
      close: anim.close
    };
  };
})();
