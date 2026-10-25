/* Ballonfahrt: the 3D scene above NMG Entdecker's questions. You float in a red-and-white hot-air balloon
   over a 3D landscape of hills, mountains with snow and blue lakes. Every right answer fires the burner,
   lifts the balloon and brings up a find for the topic (a coat of arms, a castle, a fox, a heart, a rocket...)
   into your Entdecker-Sammlung. A wrong answer brings a grumpy storm cloud that rains on you and pushes
   you down. A streak floats you higher, up past the clouds.
     NmgExplorer(el, store) -> { answer(correct, streak), topic(id), open(), close() }
   Drawn with a little 3D camera on a 2D canvas. Progress is kept in store (finds). */
(function(){
  "use strict";

  const FINDS = {
    kantone:    ["🛡️", "🏛️", "🐻", "🦁", "🗝️", "🚩"],
    geografie:  ["⛰️", "🏔️", "🌊", "🗻", "🧭", "🌲"],
    geschichte: ["🏰", "⚔️", "🏹", "🍎", "📜", "👑"],
    koerper:    ["🫀", "🧠", "🦴", "🫁", "👁️", "💪"],
    natur:      ["🦊", "🦌", "🐿️", "🍄", "🐝", "🌻"],
    technik:    ["🧲", "💡", "🔋", "🚀", "🔭", "⚙️"]
  };
  const PRAISE = ["Entdeckt!", "Super!", "Gefunden!", "Bravo!", "Toll!", "Spitze!"];

  // the landscape: rolling hills, a mountain range and lakes, made of a few waves
  function height(x, z){
    let h = Math.sin(x * 0.18) * 1.2 + Math.sin(z * 0.23 + 1) * 1.1 + Math.sin((x + z) * 0.11) * 1.6;
    h += Math.max(0, Math.sin(x * 0.07 - 0.6) * 4.5 + Math.sin(z * 0.05) * 2) * 1.1;   // the Alps
    return h;
  }
  const WATER = -0.6;

  window.NmgExplorer = function(el, S){
    el.innerHTML = `<canvas class="explore-canvas" width="960" height="270" aria-label="Ballonfahrt"></canvas>`;
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const W = 960, H = 270, FOC = 330;
    const fx = Fun.pops();
    S.finds = S.finds || 0;

    let clock = 0;
    let travel = 0, speed = 1.2, alt = 5, wantAlt = 5, burner = 0, storm = 0, kind = "kantone";
    let rising = [];      // finds floating up from the ground into the basket
    let bag = [];         // the last few finds, shown in the corner

    /* ----- the camera, a little behind and above the balloon ----- */
    const cam = { x: 0, y: 0, z: 0 };
    function proj(x, y, z){
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      const t = 0.32, ry = dy * Math.cos(t) + dz * Math.sin(t), rz = -dy * Math.sin(t) + dz * Math.cos(t);
      if (rz < 0.4) return null;
      return { x: W / 2 + dx * FOC / rz, y: H * 0.36 - ry * FOC / rz, s: FOC / rz };
    }
    function shade(col, f){ return `rgb(${Math.round(col[0] * f)},${Math.round(col[1] * f)},${Math.round(col[2] * f)})`; }
    function groundColour(h){
      if (h <= WATER) return [70, 150, 220];
      if (h < 0.3) return [140, 200, 90];
      if (h < 2.5) return [96, 176, 72];
      if (h < 4.6) return [120, 128, 140];
      return [240, 244, 250];
    }

    /* ----- the 3D landscape, drawn from the back to the front ----- */
    function drawLand(){
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      sky.addColorStop(0, alt > 9 ? "#2f6fd0" : "#5aa7f0"); sky.addColorStop(1, "#d6ecff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      const sun = { x: W * 0.84, y: 40 }; ctx.fillStyle = "#fff2a8"; ctx.beginPath(); ctx.arc(sun.x, sun.y, 22, 0, 7); ctx.fill();
      const G = 1.6, COLS = 30, ROWS = 26, ox = Math.round(cam.x / G), oz = Math.floor(cam.z / G);
      const L = [-0.5, 0.85, -0.3], ln = Math.hypot(...L);
      for (let r = ROWS; r >= 1; r--) {
        for (let c = -COLS / 2; c < COLS / 2; c++) {
          const x0 = (ox + c) * G, z0 = (oz + r) * G, x1 = x0 + G, z1 = z0 + G;
          const h = [height(x0, z0), height(x1, z0), height(x1, z1), height(x0, z1)].map(v => Math.max(WATER, v));
          const p = [proj(x0, h[0], z0), proj(x1, h[1], z0), proj(x1, h[2], z1), proj(x0, h[3], z1)];
          if (p.some(q => !q)) continue;
          // light from the side the sun's on
          const nx = (h[0] - h[1] + h[3] - h[2]) / (2 * G), nz = (h[0] - h[3] + h[1] - h[2]) / (2 * G);
          const nl = Math.hypot(nx, 1, nz), lit = Math.max(0.45, (nx * L[0] + L[1] + nz * L[2]) / (nl * ln));
          const avg = (h[0] + h[1] + h[2] + h[3]) / 4;
          const fog = Math.min(0.75, r / ROWS * 0.8);
          const col = groundColour(avg).map((v, i) => v * (1 - fog) + [214, 236, 255][i] * fog);
          ctx.fillStyle = shade(col, avg <= WATER ? 1 : lit);
          ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y); ctx.lineTo(p[3].x, p[3].y); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke();
          // now and then a fir tree or a chalet on the grass
          const seed = Math.sin((ox + c) * 12.9898 + (oz + r) * 78.233) * 43758.5453, rnd = seed - Math.floor(seed);
          if (avg > 0.3 && avg < 2.6 && rnd < 0.12 && r < 18) {
            const b = proj(x0 + G / 2, avg, z0 + G / 2); if (!b) continue;
            const s = b.s * 0.05;
            if (rnd < 0.03) { // a chalet with a red roof
              ctx.fillStyle = "#c58a4a"; ctx.fillRect(b.x - 9 * s, b.y - 9 * s, 18 * s, 9 * s);
              ctx.fillStyle = "#c8553d"; ctx.beginPath(); ctx.moveTo(b.x - 12 * s, b.y - 8 * s); ctx.lineTo(b.x, b.y - 17 * s); ctx.lineTo(b.x + 12 * s, b.y - 8 * s); ctx.fill();
            } else {
              ctx.fillStyle = "#2f7d32"; ctx.beginPath(); ctx.moveTo(b.x - 6 * s, b.y); ctx.lineTo(b.x, b.y - 20 * s); ctx.lineTo(b.x + 6 * s, b.y); ctx.fill();
            }
          }
        }
      }
    }

    /* ----- the balloon ----- */
    function drawBalloon(){
      const bx = cam.x, bz = cam.z + 12, by = alt + Math.sin(clock * 1.3) * 0.25 - (storm > 0 ? Math.sin(storm * 3) * 0.3 : 0);
      const env = proj(bx, by + 2.4, bz), bas = proj(bx, by, bz);
      if (!env || !bas) return;
      const R = 1.8 * env.s;
      // its shadow far below
      const sh = proj(bx, Math.max(WATER, height(bx, bz)), bz);
      if (sh) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, R * 0.5, R * 0.15, 0, 0, 7); ctx.fill(); }
      // the ropes
      ctx.strokeStyle = "#5a3a1e"; ctx.lineWidth = 1.5;
      [-0.55, 0.55].forEach(k => { ctx.beginPath(); ctx.moveTo(env.x + k * R, env.y + R * 0.7); ctx.lineTo(bas.x + k * R * 0.35, bas.y - R * 0.25); ctx.stroke(); });
      // the basket
      const bw = R * 0.8, bh = R * 0.45;
      ctx.fillStyle = "#a8743c"; ctx.fillRect(bas.x - bw / 2, bas.y - bh, bw, bh);
      ctx.strokeStyle = "#7a5230"; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(bas.x - bw / 2, bas.y - bh + i * bh / 4); ctx.lineTo(bas.x + bw / 2, bas.y - bh + i * bh / 4); ctx.stroke(); }
      // you, waving from the basket
      ctx.fillStyle = "#f5cd8a"; ctx.beginPath(); ctx.arc(bas.x - bw * 0.15, bas.y - bh - R * 0.16, R * 0.15, 0, 7); ctx.fill();
      ctx.fillStyle = "#3fae4a"; ctx.fillRect(bas.x - bw * 0.15 - R * 0.17, bas.y - bh - R * 0.36, R * 0.34, R * 0.1);
      const wave = Math.sin(clock * 6) * 0.4;
      ctx.strokeStyle = "#f5cd8a"; ctx.lineWidth = R * 0.08; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bas.x + bw * 0.05, bas.y - bh - R * 0.05); ctx.lineTo(bas.x + bw * 0.05 + Math.cos(-1.2 + wave) * R * 0.3, bas.y - bh - R * 0.05 + Math.sin(-1.2 + wave) * R * 0.3); ctx.stroke(); ctx.lineCap = "butt";
      // the burner flame
      if (burner > 0) {
        const fl = R * (0.3 + burner * 0.5) * (0.8 + Math.random() * 0.4);
        const g = ctx.createRadialGradient(bas.x, bas.y - bh - R * 0.3, 0, bas.x, bas.y - bh - R * 0.3, fl);
        g.addColorStop(0, "rgba(255,255,200,1)"); g.addColorStop(0.4, "rgba(255,170,40,0.9)"); g.addColorStop(1, "rgba(255,80,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bas.x, bas.y - bh - R * 0.3, fl, 0, 7); ctx.fill();
      }
      // the envelope: red and white stripes, lit from the left, with a Swiss cross
      ctx.save();
      ctx.beginPath(); ctx.moveTo(env.x - R * 0.35, env.y + R * 0.95);
      ctx.bezierCurveTo(env.x - R * 1.25, env.y + R * 0.2, env.x - R * 1.1, env.y - R * 1.15, env.x, env.y - R * 1.15);
      ctx.bezierCurveTo(env.x + R * 1.1, env.y - R * 1.15, env.x + R * 1.25, env.y + R * 0.2, env.x + R * 0.35, env.y + R * 0.95);
      ctx.closePath(); ctx.clip();
      const stripes = 8, turn = clock * 0.4;
      for (let i = 0; i < stripes; i++) {
        const a0 = (i / stripes + turn) % 1, a1 = a0 + 1 / stripes;
        const x0 = env.x + Math.sin((a0 - 0.5) * Math.PI) * R * 1.2, x1 = env.x + Math.sin((Math.min(1, a1) - 0.5) * Math.PI) * R * 1.2;
        ctx.fillStyle = i % 2 ? "#ffffff" : "#e8302c"; ctx.fillRect(Math.min(x0, x1), env.y - R * 1.3, Math.abs(x1 - x0) + 1, R * 2.4);
      }
      const g = ctx.createRadialGradient(env.x - R * 0.45, env.y - R * 0.55, R * 0.1, env.x, env.y, R * 1.3);
      g.addColorStop(0, "rgba(255,255,255,0.45)"); g.addColorStop(0.6, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = g; ctx.fillRect(env.x - R * 1.3, env.y - R * 1.3, R * 2.6, R * 2.6);
      ctx.restore();
      ctx.fillStyle = "#e8302c"; ctx.fillRect(env.x - R * 0.28, env.y - R * 0.28, R * 0.56, R * 0.56);
      ctx.fillStyle = "#fff"; ctx.fillRect(env.x - R * 0.06, env.y - R * 0.2, R * 0.12, R * 0.4); ctx.fillRect(env.x - R * 0.2, env.y - R * 0.06, R * 0.4, R * 0.12);
      return { x: bas.x, y: bas.y - bh };
    }

    /* ----- a grumpy storm cloud ----- */
    function drawStorm(target){
      if (storm <= 0 || !target) return;
      const x = target.x + 10, y = Math.max(40, target.y - 150) + (1 - storm) * 10, a = Math.min(1, storm * 2);
      ctx.globalAlpha = a;
      if (Math.random() < 0.7) { ctx.strokeStyle = "rgba(160,200,255,0.8)"; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const rx = x - 50 + Math.random() * 100, ry = y + 20 + Math.random() * 110; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 10); ctx.stroke(); } }
      ctx.fillStyle = "#5b6475";
      [[-30, 6, 26], [0, -6, 32], [32, 6, 24], [12, 14, 22], [-14, 16, 22]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fill(); });
      Fun.face(ctx, x, y + 4, 20, "angry", clock, 0, 0.4);
      if (storm > 0.75 && Math.random() < 0.3) { ctx.strokeStyle = "#fff6a0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x - 10, y + 50); ctx.lineTo(x + 6, y + 56); ctx.lineTo(x - 6, y + 95); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    /* ----- each frame ----- */
    const EMOJI_FONT = `system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    const anim = Fun.animate(dt => {
      clock += dt;
      travel += speed * dt * 2.2;
      alt += (wantAlt - alt) * Math.min(1, dt * 1.5);
      burner = Math.max(0, burner - dt * 1.2); storm = Math.max(0, storm - dt * 0.5);
      // the balloon drifts on, with the camera behind it; stay above the ground
      cam.x = Math.sin(travel * 0.05) * 6; cam.z = travel;
      const ground = Math.max(WATER, height(cam.x, cam.z + 12)) + 1.6;
      if (alt < ground) alt = ground;
      cam.y = alt + 7;
      drawLand();
      const basket = drawBalloon();
      // finds floating up into the basket
      rising.forEach(f => { f.t += dt * 0.9; });
      rising = rising.filter(f => f.t < 1);
      rising.forEach(f => {
        if (!basket) return;
        const k = f.t, x = f.sx + (basket.x - f.sx) * k, y = f.sy + (basket.y - f.sy) * k - Math.sin(k * Math.PI) * 40;
        ctx.font = `${30 + Math.sin(k * Math.PI) * 18}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1; ctx.fillText(f.em, x, y); ctx.globalAlpha = 1;
      });
      drawStorm(basket);
      // the collection and the height
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(10,20,45,0.6)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(10, 10, 300, 30, 8) : ctx.rect(10, 10, 300, 30); ctx.fill();
      ctx.font = `bold 14px ${EMOJI_FONT}`; ctx.textAlign = "left"; ctx.fillStyle = "#fff";
      ctx.fillText(`🎈 ${Math.round(alt * 120)} m · 🔎 ${S.finds} Funde  ${bag.join("")}`, 20, 25);
      ctx.textBaseline = "alphabetic";
      fx.draw(ctx, dt);
    });

    return {
      answer(correct, streak){
        if (correct) {
          S.finds++; burner = 1; speed = 1.6;
          wantAlt = Math.min(13, 5 + Math.min(streak, 12) * 0.6);
          const list = FINDS[kind] || FINDS.kantone, em = list[Math.floor(Math.random() * list.length)];
          rising.push({ em, t: 0, sx: W * (0.25 + Math.random() * 0.5), sy: H - 20 });
          bag = bag.concat(em).slice(-6);
          fx.pop(`${PRAISE[Math.floor(Math.random() * PRAISE.length)]} ${em}`, W * 0.66, 80, "#ffe14d", 28);
          if (streak && streak % 5 === 0) { fx.pop(`🎈 Höhenrekord! ${streak} richtig`, W / 2, 60, "#ffffff", 32); Fun.sfx.tada(); }
          else Fun.sfx.whoosh();
          setTimeout(() => Fun.sfx.ding(), 600);
        } else {
          storm = 1; wantAlt = Math.max(3, wantAlt - 2.5); speed = 0.9;
          fx.pop(["Uff! ⛈️", "Gewitter!", "Huch!", "Achtung, Wolke!"][Math.floor(Math.random() * 4)], W * 0.3, 80, "#c9d7ff", 26);
          Fun.sfx.crash();
        }
        Hub.saveStore();
      },
      topic(id){ if (FINDS[id]) kind = id; },
      open: anim.open,
      close: anim.close
    };
  };
})();
