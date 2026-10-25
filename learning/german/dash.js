/* Fehlerteufel-Jagd: the 3D scene above Deutsch Dash's questions. You run along a path through the Swiss
   countryside, and the Fehlerteufel (the mistake devil) chases you. Every right answer: a jump, a Schoggi
   and a few steps further ahead; a streak gives you a Turbo. A wrong answer: you stumble and the devil
   catches up. Every 100 m you pass a new town, from Baar to the Matterhorn and beyond.
     DeutschDash(el, store) -> { answer(correct, streak), topic(id), open(), close() }
   Drawn with a little 3D camera on a 2D canvas. Progress is kept in store (meters, schoggi). */
(function(){
  "use strict";

  const TOWNS = ["Baar", "Zug", "Cham", "Luzern", "Rigi", "Schwyz", "Altdorf", "Andermatt", "Gotthard", "Bellinzona", "Lugano",
    "Locarno", "Zermatt", "Matterhorn", "Bern", "Thun", "Interlaken", "Jungfraujoch", "Basel", "Zürich"];
  const STEP = 20;                                // metres for a right answer
  const PRAISE = ["Super!", "Toll!", "Bravo!", "Spitze!", "Klasse!", "Genau!", "Juhui!"];
  const TAUNT = ["Hehe! 😈", "Hab dich gleich!", "Fehler! Fehler!", "Muahaha!", "Nicht so schnell!"];

  window.DeutschDash = function(el, S){
    el.innerHTML = `<canvas class="dash-canvas" width="960" height="270" aria-label="Fehlerteufel-Jagd"></canvas>`;
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const W = 960, H = 270, HOR = 92;
    const fx = Fun.pops();
    S.meters = S.meters || 0; S.schoggi = S.schoggi || 0;

    let clock = 0;
    let roll = 0, speed = 1, gap = 5, shownGap = 5, jump = 0, trip = 0, turbo = 0, caught = 0;
    let goodies = [];        // Schoggi floating ahead on the path, at a distance z
    let sign = null;         // a town sign coming up

    // a spot on the path: lane -1..1 across, z = 1 just in front of the camera, bigger = further away
    const at = (lane, z) => { const k = 1 / z; return { x: W / 2 + lane * W * 0.38 * k, y: HOR + (H - HOR) * k, s: k }; };
    function round(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    const shade = Fun.shade;
    // a box with a lit top and a darker side, so it looks solid
    function block(x, y, w, h, d, col){
      ctx.fillStyle = shade(col, 0.7); ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d * 0.6); ctx.lineTo(x + w + d, y - h - d * 0.6); ctx.lineTo(x + w, y - h); ctx.fill();
      ctx.fillStyle = shade(col, 1.15); ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + d, y - h - d * 0.6); ctx.lineTo(x + w + d, y - h - d * 0.6); ctx.lineTo(x + w, y - h); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(x, y - h, w, h);
    }

    /* ----- the countryside ----- */
    function drawWorld(){
      const sky = ctx.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, "#5aa7f0"); sky.addColorStop(1, "#d6ecff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HOR);
      // the Alps, drifting slowly
      [[80, 26], [210, 10], [330, 34], [470, 6], [610, 30], [740, 14], [880, 28]].forEach(([px, py]) => {
        const x = ((px - roll * 3) % (W + 220) + W + 220) % (W + 220) - 110;
        ctx.fillStyle = "#8291ab"; ctx.beginPath(); ctx.moveTo(x - 110, HOR); ctx.lineTo(x, py); ctx.lineTo(x + 110, HOR); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x - 30, py + 22); ctx.lineTo(x, py); ctx.lineTo(x + 30, py + 22); ctx.lineTo(x + 10, py + 16); ctx.lineTo(x - 8, py + 24); ctx.fill();
      });
      // a fluffy cloud or two
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      [[150, 30], [600, 22]].forEach(([cx, cy], k) => { const x = ((cx - roll * 6 - k * 300) % (W + 200) + W + 200) % (W + 200) - 100; ctx.beginPath(); ctx.arc(x, cy, 16, 0, 7); ctx.arc(x + 20, cy + 4, 13, 0, 7); ctx.arc(x - 18, cy + 5, 11, 0, 7); ctx.fill(); });
      // green meadows and the path
      ctx.fillStyle = "#7cc85a"; ctx.fillRect(0, HOR, W, H - HOR);
      const a = at(-1.05, 1), b = at(-1.05, 40), c = at(1.05, 40), d = at(1.05, 1);
      ctx.fillStyle = "#d9b27c"; ctx.beginPath(); ctx.moveTo(a.x, H); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, H); ctx.fill();
      for (let k = 0; k < 40; k++) {
        const z0 = 1 + k * 0.8 - (roll % 1.6), z1 = z0 + 0.4;
        if (z0 < 0.95) continue;
        // stripes of grass alongside, rushing past
        [-1.15, 1.15].forEach(l => { const p = at(l, z0), q = at(l, z1); ctx.strokeStyle = k % 2 ? "#68b648" : "#8fd46b"; ctx.lineWidth = 14 * p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); });
      }
      // chalets, fir trees and cows beside the path
      const things = [];
      for (let k = 0; k < 16; k++) {
        const z = 1.1 + k * 2.2 - (roll * 1.1 % 2.2);
        const kind = (k + Math.floor(roll * 1.1 / 2.2)) % 5;
        [-1, 1].forEach(side => things.push({ z, side, kind: (kind + (side > 0 ? 2 : 0)) % 5 }));
      }
      things.sort((p, q) => q.z - p.z).forEach(t => {
        const p = at(t.side * (t.kind === 0 ? 2.3 : 1.8), t.z); if (p.y < HOR + 1) return;
        const s = p.s;
        if (t.kind === 0) { // a chalet with a red roof
          block(p.x - 40 * s, p.y, 80 * s, 46 * s, 14 * s, "#c58a4a");
          ctx.fillStyle = "#c8553d"; ctx.beginPath(); ctx.moveTo(p.x - 52 * s, p.y - 44 * s); ctx.lineTo(p.x + 7 * s, p.y - 84 * s); ctx.lineTo(p.x + 66 * s, p.y - 44 * s); ctx.fill();
          ctx.fillStyle = "#fff6d8"; ctx.fillRect(p.x - 26 * s, p.y - 34 * s, 14 * s, 12 * s); ctx.fillRect(p.x + 10 * s, p.y - 34 * s, 14 * s, 12 * s);
          ctx.fillStyle = "#e33"; ctx.fillRect(p.x - 6 * s, p.y - 104 * s, 3 * s, 22 * s); ctx.fillRect(p.x - 3 * s, p.y - 104 * s, 14 * s, 10 * s);
        } else if (t.kind === 1 || t.kind === 3) { // a fir tree
          ctx.fillStyle = "#6b4423"; ctx.fillRect(p.x - 4 * s, p.y - 14 * s, 8 * s, 14 * s);
          ctx.fillStyle = t.kind === 1 ? "#2f7d32" : "#3a8f3a";
          for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(p.x - (30 - j * 7) * s, p.y - (12 + j * 22) * s); ctx.lineTo(p.x, p.y - (52 + j * 22) * s); ctx.lineTo(p.x + (30 - j * 7) * s, p.y - (12 + j * 22) * s); ctx.fill(); }
        } else if (t.kind === 2) { // a Swiss cow
          ctx.fillStyle = "#fff"; round(p.x - 26 * s, p.y - 34 * s, 52 * s, 22 * s, 8 * s); ctx.fill();
          ctx.fillStyle = "#6b4423"; ctx.beginPath(); ctx.arc(p.x - 8 * s, p.y - 26 * s, 6 * s, 0, 7); ctx.arc(p.x + 10 * s, p.y - 22 * s, 5 * s, 0, 7); ctx.fill();
          ctx.fillStyle = "#fff"; round(p.x + 18 * s * t.side, p.y - 40 * s, 16 * s, 14 * s, 4 * s); ctx.fill();
          ctx.fillStyle = "#333"; [-18, -6, 6, 18].forEach(dx => ctx.fillRect(p.x + dx * s, p.y - 12 * s, 4 * s, 12 * s));
          ctx.fillStyle = "#ffcc33"; ctx.beginPath(); ctx.arc(p.x + 24 * s * t.side, p.y - 22 * s, 4 * s, 0, 7); ctx.fill();
        }
      });
    }

    /* ----- you, and the devil ----- */
    function kid(x, y, s){
      const run = Math.sin(clock * (10 + speed * 4)), up = jump > 0 ? Math.sin((1 - jump) * Math.PI) * 60 * s : Math.abs(run) * 4 * s;
      const fall = trip > 0 ? Math.sin(trip * Math.PI) * 0.6 : 0;
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 7 * s, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y - up); ctx.rotate(fall);
      if (turbo > 0) { for (let i = 0; i < 3; i++) { ctx.fillStyle = ["#ffe14d", "#ff9f1a", "#ff4d1a"][i]; ctx.beginPath(); ctx.moveTo(-10 * s + i * 10 * s, -30 * s); ctx.lineTo(-5 * s + i * 10 * s, (-4 + Math.random() * 26) * s); ctx.lineTo(i * 10 * s, -30 * s); ctx.fill(); } }
      // legs, body, backpack, arms, head with a red cap
      ctx.fillStyle = "#2a4d8f"; ctx.fillRect(-12 * s, -24 * s + run * 6 * s, 9 * s, 24 * s - run * 6 * s); ctx.fillRect(3 * s, -24 * s - run * 6 * s, 9 * s, 24 * s + run * 6 * s);
      block(-15 * s, -22 * s, 30 * s, 30 * s, 8 * s, "#e8402c");
      ctx.fillStyle = "#fff"; ctx.fillRect(-3 * s, -44 * s, 6 * s, 14 * s); ctx.fillRect(-7 * s, -40 * s, 14 * s, 6 * s);   // a Swiss cross on the shirt
      ctx.fillStyle = "#f5cd8a"; ctx.fillRect(-23 * s, -50 * s - run * 6 * s, 8 * s, 22 * s); ctx.fillRect(15 * s, -50 * s + run * 6 * s, 8 * s, 22 * s);
      const hx = 0, hy = -66 * s;
      ctx.fillStyle = "#f5cd8a"; round(hx - 14 * s, hy - 14 * s, 28 * s, 28 * s, 6 * s); ctx.fill();
      ctx.fillStyle = "#e8402c"; round(hx - 16 * s, hy - 20 * s, 32 * s, 10 * s, 4 * s); ctx.fill();
      ctx.restore();
    }
    function devil(x, y, s){
      const hop = Math.abs(Math.sin(clock * 9)) * 8 * s;
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x, y, 34 * s, 9 * s, 0, 0, 7); ctx.fill();
      y -= hop;
      // tail, body, horns, a trident and a cheeky face
      ctx.strokeStyle = "#b8121b"; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(x + 20 * s, y - 20 * s); ctx.quadraticCurveTo(x + 60 * s, y - 20 * s + Math.sin(clock * 6) * 10 * s, x + 50 * s, y - 50 * s); ctx.stroke();
      ctx.fillStyle = "#b8121b"; ctx.beginPath(); ctx.moveTo(x + 44 * s, y - 50 * s); ctx.lineTo(x + 58 * s, y - 60 * s); ctx.lineTo(x + 56 * s, y - 44 * s); ctx.fill();
      const g = ctx.createRadialGradient(x - 12 * s, y - 60 * s, 4 * s, x, y - 44 * s, 44 * s); g.addColorStop(0, "#ff7a6b"); g.addColorStop(1, "#c0182a");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 42 * s, 32 * s, 40 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a0a10"; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(x + sd * 14 * s, y - 74 * s); ctx.lineTo(x + sd * 30 * s, y - 104 * s); ctx.lineTo(x + sd * 26 * s, y - 70 * s); ctx.fill(); });
      ctx.strokeStyle = "#ffcc33"; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(x - 40 * s, y); ctx.lineTo(x - 40 * s, y - 96 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 52 * s, y - 96 * s); ctx.lineTo(x - 52 * s, y - 108 * s); ctx.moveTo(x - 40 * s, y - 96 * s); ctx.lineTo(x - 40 * s, y - 112 * s); ctx.moveTo(x - 28 * s, y - 96 * s); ctx.lineTo(x - 28 * s, y - 108 * s); ctx.moveTo(x - 52 * s, y - 96 * s); ctx.lineTo(x - 28 * s, y - 96 * s); ctx.stroke();
      Fun.face(ctx, x, y - 48 * s, 26 * s, caught > 0 ? "grin" : "angry", clock, 0, -0.3);
      ctx.font = `bold ${Math.max(11, 14 * s)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
      ctx.strokeText("Fehlerteufel", x, y - 118 * s); ctx.fillText("Fehlerteufel", x, y - 118 * s);
    }

    /* ----- each frame ----- */
    const anim = Fun.animate(dt => {
      clock += dt;
      speed += ((turbo > 0 ? 2.6 : 1.1) - speed) * Math.min(1, dt * 2);
      roll += speed * dt * 1.2;
      jump = Math.max(0, jump - dt * 1.8); trip = Math.max(0, trip - dt * 1.6); turbo = Math.max(0, turbo - dt); caught = Math.max(0, caught - dt);
      shownGap += (gap - shownGap) * Math.min(1, dt * 3);
      drawWorld();
      // Schoggi on the path, coming towards you
      goodies.forEach(g => { g.z -= dt * speed * 3; });
      goodies = goodies.filter(g => g.z > 1.6);
      goodies.forEach(g => {
        const p = at(0.18, g.z), s = p.s * 1.6;
        ctx.fillStyle = "#6b3a1a"; round(p.x - 14 * s, p.y - 40 * s, 28 * s, 16 * s, 3 * s); ctx.fill();
        ctx.fillStyle = "#c8553d"; ctx.fillRect(p.x - 14 * s, p.y - 40 * s, 10 * s, 16 * s);
      });
      // the town sign
      if (sign) {
        sign.z -= dt * speed * 2.4;
        const p = at(-1.35, sign.z);
        if (sign.z < 1.1) sign = null;
        else if (p.y > HOR) {
          const s = p.s * 1.4;
          ctx.fillStyle = "#555"; ctx.fillRect(p.x - 3 * s, p.y - 60 * s, 6 * s, 60 * s);
          ctx.fillStyle = "#fff"; round(p.x - 70 * s, p.y - 92 * s, 140 * s, 36 * s, 4 * s); ctx.fill();
          ctx.strokeStyle = "#111"; ctx.lineWidth = 3 * s; ctx.stroke();
          ctx.fillStyle = "#111"; ctx.font = `bold ${Math.max(8, 20 * s)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sign.name, p.x, p.y - 74 * s); ctx.textBaseline = "alphabetic";
        }
      }
      // you run in the middle; the devil is behind you, bigger the closer it gets
      const me = at(0.18, 2.1);
      const dz = Math.max(1.05, 2.1 - (8 - Math.min(8, shownGap)) * 0.13);
      const dv = at(-0.32, dz);
      if (shownGap < 8) { kid(me.x, me.y, me.s * 1.7); devil(dv.x, dv.y + 6, dv.s * 1.2); }
      else { kid(me.x, me.y, me.s * 1.7); }
      // the score
      ctx.fillStyle = "rgba(10,20,45,0.6)"; round(10, 10, 300, 30, 8); ctx.fill();
      ctx.font = "bold 14px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      const town = TOWNS[Math.floor(S.meters / 100) % TOWNS.length];
      ctx.fillText(`🏃 ${S.meters} m · 📍 ${town} · 🍫 ${S.schoggi}`, 20, 25);
      // how close the devil is
      ctx.fillStyle = "rgba(10,20,45,0.6)"; round(W - 230, 10, 220, 30, 8); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.fillText("😈", W - 196, 25);
      ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(W - 186, 20, 130, 10);
      ctx.fillStyle = shownGap < 3 ? "#ff4d4d" : shownGap < 6 ? "#ffb347" : "#6bd66b"; ctx.fillRect(W - 186, 20, 130 * Math.min(1, shownGap / 10), 10);
      ctx.fillStyle = "#fff"; ctx.fillText("🏃", W - 20, 25);
      ctx.textBaseline = "alphabetic";
      fx.draw(ctx, dt);
    });

    return {
      answer(correct, st){
        if (correct) {
          const before = Math.floor(S.meters / 100);
          S.meters += STEP * (turbo > 0 || st >= 5 ? 2 : 1); S.schoggi++;
          gap = Math.min(10, gap + 1.6); jump = 1;
          goodies.push({ z: 9 });
          if (st && st % 5 === 0) { turbo = 3; fx.pop(`TURBO! 🔥 ${st} richtig`, W / 2, 70, "#ff9f1a", 34); Fun.sfx.whoosh(); }
          else fx.pop(PRAISE[Math.floor(Math.random() * PRAISE.length)] + " 🍫", W * 0.6, 90, "#ffe14d", 28);
          Fun.sfx.coin();
          const after = Math.floor(S.meters / 100);
          if (after > before) {
            const name = TOWNS[after % TOWNS.length];
            sign = { name, z: 14 };
            setTimeout(() => { fx.pop(`Willkommen in ${name}! 🇨🇭`, W / 2, 60, "#ffffff", 30); Fun.sfx.ding(); }, 700);
          }
        } else {
          gap = Math.max(0, gap - 2.6); trip = 1; turbo = 0;
          fx.pop(TAUNT[Math.floor(Math.random() * TAUNT.length)], W * 0.3, 80, "#ff8a8a", 26);
          Fun.sfx.oof();
          if (gap <= 0) {
            caught = 1.5; gap = 5;
            setTimeout(() => { fx.pop("ERWISCHT! 😱 Weiter geht's!", W / 2, 70, "#ff4d4d", 34); Fun.sfx.wah(); }, 200);
          }
        }
        Hub.saveStore();
      },
      topic(){},
      open: anim.open,
      close: anim.close
    };
  };
})();
