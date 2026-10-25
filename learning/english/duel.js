/* Wizard Duel: the 3D scene above Word Wizard's questions. You're a wizard on a floating stone arena under
   the stars; a word monster stands across from you (a different one for every topic). Every right answer
   casts a spell at it (a spark, then a fireball, lightning and a rainbow blast as your streak grows);
   a wrong answer and the monster gets a turn. Knock out its hearts and a tougher one comes along.
     WizardDuel(el, store) -> { answer(correct, streak), topic(id), open(), close() }
   Drawn with a little 3D camera on a 2D canvas. Progress is kept in store (defeated, level). */
(function(){
  "use strict";

  const MONSTERS = {
    words:     { name: "Word Goblin",    body: "#5fbf3a", dark: "#3a8a22", shape: "goblin" },
    opposites: { name: "Mirror Imp",     body: "#b46bff", dark: "#7d3fd0", shape: "imp" },
    spelling:  { name: "Spelling Slime", body: "#4da6ff", dark: "#2a6fd0", shape: "slime" },
    verbs:     { name: "Verb Dragon",    body: "#ff5a4d", dark: "#c0302a", shape: "dragon" },
    grammar:   { name: "Grammar Golem",  body: "#9aa3ad", dark: "#6d757e", shape: "golem" }
  };
  const SPELLS = [
    { at: 0,  name: "Spark",         col: "#ffe14d", size: 0.35, hit: 1, words: ["ZAP!", "POW!", "Bzzt!"] },
    { at: 3,  name: "Fireball",      col: "#ff8a1a", size: 0.55, hit: 1, words: ["FWOOSH!", "BOOM!", "Toasty!"] },
    { at: 5,  name: "Lightning",     col: "#7fe3ff", size: 0.5,  hit: 2, words: ["KRA-KOOM!", "ZZZAP!"] },
    { at: 10, name: "Rainbow Blast", col: "#ff6bd6", size: 0.75, hit: 3, words: ["RAINBOW BLAST!", "KAPOW!!"] }
  ];

  const RAINBOW = ["#ff4d4d", "#ff9f1a", "#ffe14d", "#6be03a", "#4da6ff", "#b46bff"];

  window.WizardDuel = function(el, S){
    el.innerHTML = `<canvas class="duel-canvas" width="960" height="270" aria-label="Wizard duel"></canvas>`;
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const W = 960, H = 270, FOC = 450;
    const fx = Fun.pops();
    S.defeated = S.defeated || 0; S.level = S.level || 1;

    let clock = 0;
    let kind = "words", hp = 0, maxHp = 0, shots = [], bits = [], hurt = 0, cast = 0, shield = 0, poof = 0, laugh = 0, enter = 1;
    const ME = { x: -3.2, z: 0 }, FOE = { x: 3.2, z: 0 };

    function newFoe(){ maxHp = 3 + Math.min(7, Math.floor(S.level / 2)); hp = maxHp; enter = 1; poof = 0; }
    newFoe();

    /* ----- the camera: a little above, looking across the arena, swaying gently ----- */
    let cam = { x: 0, y: 2.8, z: -11, yaw: 0 };
    function proj(x, y, z){
      const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      // tilt down a little
      const t = 0.22, ry = dy * Math.cos(t) + rz * Math.sin(t), rz2 = -dy * Math.sin(t) + rz * Math.cos(t);
      if (rz2 < 0.3) return null;
      return { x: W / 2 + rx * FOC / rz2, y: H * 0.7 - ry * FOC / rz2, s: FOC / rz2 };
    }
    function poly(pts, fill){
      const p = pts.map(q => proj(...q));
      if (p.some(q => !q)) return;
      ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    }
    // a shiny ball, lit from the top left
    function ball(x, y, z, r, col, glow){
      const p = proj(x, y, z); if (!p) return null;
      const R = r * p.s;
      if (glow) { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 2.6); g.addColorStop(0, glow); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(p.x - R * 3, p.y - R * 3, R * 6, R * 6); }
      const g = ctx.createRadialGradient(p.x - R * 0.35, p.y - R * 0.4, R * 0.1, p.x, p.y, R);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.18, col); g.addColorStop(1, shade(col, 0.45));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fill();
      return { x: p.x, y: p.y, r: R };
    }
    // a cone standing on (x, y, z), shaded round its side
    function cone(x, y, z, r, h, col, tipX){
      const b = proj(x, y, z), t = proj(x + (tipX || 0), y + h, z); if (!b || !t) return;
      const R = r * b.s, g = ctx.createLinearGradient(b.x - R, 0, b.x + R, 0);
      g.addColorStop(0, shade(col, 1.25)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, 0.5));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b.x - R, b.y); ctx.lineTo(t.x, t.y); ctx.lineTo(b.x + R, b.y);
      ctx.ellipse(b.x, b.y, R, R * 0.28, 0, 0, Math.PI); ctx.fill();
    }
    const shade = Fun.shade;

    /* ----- the arena ----- */
    function drawArena(){
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#120a33"); sky.addColorStop(0.6, "#3a1f6e"); sky.addColorStop(1, "#5a2f8a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 70; k++) { const x = (k * 137 + cam.yaw * 400) % W, y = (k * 53) % (H * 0.55); ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(clock * 1.5 + k))})`; ctx.fillRect((x + W) % W, y, 2, 2); }
      const m = { x: W * 0.82 + cam.yaw * 200, y: 46 }; ctx.fillStyle = "#fff6d8"; ctx.beginPath(); ctx.arc(m.x, m.y, 26, 0, 7); ctx.fill(); ctx.fillStyle = "#3a1f6e"; ctx.beginPath(); ctx.arc(m.x + 10, m.y - 6, 22, 0, 7); ctx.fill();
      // the floating stone floor: a checkerboard of tiles, and its rocky edge
      const N = 6, T = 1.6;
      for (let i = -N; i < N; i++) for (let j = -2; j < 3; j++) {
        const x0 = i * T, z0 = j * T;
        poly([[x0, 0, z0], [x0 + T, 0, z0], [x0 + T, 0, z0 + T], [x0, 0, z0 + T]], (i + j) & 1 ? "#6b6f86" : "#7f849c");
      }
      poly([[-N * T, 0, -2 * T], [N * T, 0, -2 * T], [N * T, -0.9, -2 * T], [-N * T, -0.9, -2 * T]], "#4a4c60");
      poly([[-N * T, -0.9, -2 * T], [N * T, -0.9, -2 * T], [0, -4, -1], [0, -4, -1]], "#2f3042");
      // glowing crystals floating round the edge
      [[-8, 2.2, 3.5], [8, 2.6, 3.8], [-5.5, 3.4, 5], [5, 3.2, 5.2]].forEach(([x, y, z], k) => {
        const yy = y + Math.sin(clock * 1.4 + k) * 0.25, p = proj(x, yy, z); if (!p) return;
        const r = 0.45 * p.s, a = clock * 1.2 + k;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3); g.addColorStop(0, "rgba(127,227,255,0.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(p.x - r * 3, p.y - r * 3, r * 6, r * 6);
        const w = r * Math.abs(Math.cos(a)) + r * 0.25;
        ctx.fillStyle = "#7fe3ff"; ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 1.6); ctx.lineTo(p.x + w, p.y); ctx.lineTo(p.x, p.y + r * 1.6); ctx.lineTo(p.x - w, p.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 1.6); ctx.lineTo(p.x + w * 0.4, p.y); ctx.lineTo(p.x, p.y + r * 1.6); ctx.closePath(); ctx.fill();
      });
    }

    /* ----- you: a wizard with a starry hat and a staff ----- */
    function staffTip(){ const bob = Math.sin(clock * 2) * 0.05, lift = cast > 0 ? Math.sin(cast / 0.45 * Math.PI) * 0.5 : 0; return [ME.x + 0.75, 2.75 + bob + lift, ME.z - 0.1]; }
    function drawWizard(){
      const bob = Math.sin(clock * 2) * 0.05, x = ME.x, z = ME.z;
      shadow(x, z, 0.9);
      cone(x, 0, z, 0.85, 2.1 + bob, "#3b4fd8");
      [[-0.25, 0.6], [0.2, 1.1], [-0.1, 1.5]].forEach(([dx, y]) => { const p = proj(x + dx, y + bob, z - 0.75); if (p) star(p.x, p.y, 0.09 * p.s, "#ffe14d"); });
      const head = ball(x, 2.25 + bob, z, 0.42, "#f5cd8a");
      if (head) {
        Fun.face(ctx, head.x + head.r * 0.12, head.y + head.r * 0.08, head.r * 0.9, hurt > 0 ? "dizzy" : shield > 0 ? "wow" : cast > 0 ? "grin" : "happy", clock, 1, 0);
        // a fluffy white beard
        ctx.fillStyle = "#f2f2f2"; ctx.beginPath(); ctx.moveTo(head.x - head.r * 0.6, head.y + head.r * 0.45); ctx.quadraticCurveTo(head.x, head.y + head.r * 2.1, head.x + head.r * 0.7, head.y + head.r * 0.45); ctx.fill();
      }
      cone(x, 2.55 + bob, z, 0.62, 1.35, "#3b4fd8", -0.35);
      const brim = proj(x, 2.55 + bob, z); if (brim) { ctx.fillStyle = "#2a3aa8"; ctx.beginPath(); ctx.ellipse(brim.x, brim.y, 0.75 * brim.s, 0.18 * brim.s, 0, 0, 7); ctx.fill(); }
      const hs = proj(x - 0.05, 3.2 + bob, z - 0.5); if (hs) star(hs.x, hs.y, 0.14 * hs.s, "#ffe14d");
      // the staff, with its orb glowing brighter when you cast
      const tip = staffTip(), bot = proj(ME.x + 0.75, 0.05, ME.z - 0.1), tp = proj(...tip);
      if (bot && tp) { ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 0.12 * tp.s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(tp.x, tp.y); ctx.stroke(); ctx.lineCap = "butt"; }
      ball(...tip, cast > 0 ? 0.3 : 0.2, spellNow().col, cast > 0 ? "rgba(255,240,150,0.9)" : "rgba(255,240,150,0.35)");
      if (shield > 0) {
        const c = proj(x, 1.5, z); if (c) { ctx.strokeStyle = `rgba(127,227,255,${shield})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, 1.9 * c.s, 0, 7); ctx.stroke(); ctx.fillStyle = `rgba(127,227,255,${shield * 0.18})`; ctx.fill(); }
      }
    }
    function star(x, y, r, col){
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
    function shadow(x, z, r){ const p = proj(x, 0.01, z); if (!p) return; ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * p.s, r * 0.3 * p.s, 0, 0, 7); ctx.fill(); }

    /* ----- the monster for this topic ----- */
    function drawFoe(){
      const M = MONSTERS[kind] || MONSTERS.words;
      const shake = hurt > 0 ? Math.sin(clock * 60) * 0.12 : 0;
      const sc = (poof > 0 ? poof : 1) * (1 - enter * 0.9), slide = enter * 4;
      if (sc <= 0.02) return;
      const x = FOE.x + shake + slide, z = FOE.z, bob = Math.sin(clock * (M.shape === "slime" ? 4 : 2.4)) * 0.08;
      shadow(x, z, 1.1 * sc);
      const col = hurt > 0 && Math.floor(clock * 20) % 2 ? "#ffffff" : M.body;
      let head;
      if (M.shape === "slime") {
        const sq = 1 + Math.sin(clock * 4) * 0.08;
        const p = proj(x, 0.9 * sc, z); if (p) {
          const R = 1.15 * p.s * sc, g = ctx.createRadialGradient(p.x - R * 0.3, p.y - R * 0.4, R * 0.1, p.x, p.y, R);
          g.addColorStop(0, "#ffffff"); g.addColorStop(0.2, col); g.addColorStop(1, M.dark);
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y + R * 0.15, R * sq, R * 0.85 / sq, 0, 0, 7); ctx.fill();
          head = { x: p.x, y: p.y, r: R * 0.8 };
        }
      } else if (M.shape === "golem") {
        [[-0.55, 0.7], [0.55, 0.7]].forEach(([dx, y]) => ball(x + dx * sc, (y + bob) * sc, z, 0.4 * sc, col));
        ball(x, (1.4 + bob) * sc, z, 0.85 * sc, col);
        head = ball(x, (2.5 + bob) * sc, z, 0.55 * sc, col);
        [[-1.1, 1.5], [1.1, 1.5]].forEach(([dx, y]) => ball(x + dx * sc, (y + bob) * sc, z - 0.1, 0.38 * sc, M.dark));
      } else {
        // goblin, imp and dragon: a round body, a head, and their own bits
        ball(x, (1.0 + bob) * sc, z, 0.8 * sc, col);
        if (M.shape === "dragon") {
          [-1, 1].forEach(sd => { const a = proj(x + sd * 0.5 * sc, (1.5 + bob) * sc, z + 0.2), b = proj(x + sd * 1.9 * sc, (2.5 + bob + Math.sin(clock * 6) * 0.3) * sc, z + 0.3), c = proj(x + sd * 1.3 * sc, (1.0 + bob) * sc, z + 0.3); if (a && b && c) { ctx.fillStyle = M.dark; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.fill(); } });
        }
        head = ball(x - 0.15 * sc, (2.05 + bob) * sc, z - 0.1, 0.62 * sc, col);
        if (head) {
          const ear = M.shape === "imp" ? "#ffe14d" : M.dark;
          [-1, 1].forEach(sd => { ctx.fillStyle = ear; ctx.beginPath(); ctx.moveTo(head.x + sd * head.r * 0.5, head.y - head.r * 0.6); ctx.lineTo(head.x + sd * head.r * (M.shape === "goblin" ? 1.6 : 0.8), head.y - head.r * (M.shape === "goblin" ? 0.7 : 1.6)); ctx.lineTo(head.x + sd * head.r * 0.9, head.y - head.r * 0.2); ctx.fill(); });
        }
      }
      if (head) Fun.face(ctx, head.x - head.r * 0.1, head.y + head.r * 0.05, head.r * 0.85, poof > 0 || hurt > 0 ? "dizzy" : laugh > 0 ? "grin" : "angry", clock, -1, 0);
      // its name and hearts, floating above it
      const top = proj(FOE.x, 3.6, z); if (top && poof <= 0) {
        ctx.font = "bold 15px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
        ctx.strokeText(M.name, top.x, top.y); ctx.fillText(M.name, top.x, top.y);
        ctx.font = "14px system-ui"; const hearts = "❤️".repeat(hp) + "🖤".repeat(maxHp - hp);
        ctx.fillText(hearts, top.x, top.y + 20);
      }
    }

    /* ----- spells flying across ----- */
    const spellNow = streak => { const s = streak === undefined ? curStreak : streak; let sp = SPELLS[0]; SPELLS.forEach(x => { if (s >= x.at) sp = x; }); return sp; };
    let curStreak = 0;
    function fire(fromFoe, sp){
      const a = fromFoe ? [FOE.x - 0.5, 2.1, FOE.z] : staffTip(), b = fromFoe ? [ME.x + 0.2, 1.6, ME.z] : [FOE.x, 1.6, FOE.z];
      shots.push({ a, b, t: 0, sp, foe: fromFoe });
    }
    function drawShots(dt){
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.t += dt * (s.foe ? 1.6 : 2.2);
        const k = Math.min(1, s.t), arc = Math.sin(k * Math.PI) * 1.6;
        const p = [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k + arc, s.a[2] + (s.b[2] - s.a[2]) * k];
        const col = s.foe ? "#7dff5a" : s.sp.col;
        // a sparkly trail behind it
        if (Math.random() < 0.9) bits.push({ p: p.slice(), v: [(Math.random() - 0.5), (Math.random() - 0.2), (Math.random() - 0.5)], life: 0.5, col: s.sp && s.sp.name === "Rainbow Blast" ? `hsl(${(clock * 400) % 360},90%,65%)` : col });
        if (s.sp && s.sp.name === "Lightning" && !s.foe) {
          const A = proj(...s.a), B = proj(...p);
          if (A && B) { ctx.strokeStyle = "#e8fbff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(A.x, A.y); for (let j = 1; j <= 6; j++) ctx.lineTo(A.x + (B.x - A.x) * j / 6 + (j < 6 ? (Math.random() - 0.5) * 30 : 0), A.y + (B.y - A.y) * j / 6 + (j < 6 ? (Math.random() - 0.5) * 30 : 0)); ctx.stroke(); }
        }
        ball(...p, s.foe ? 0.3 : s.sp.size, s.sp && s.sp.name === "Rainbow Blast" ? RAINBOW[Math.floor(clock * 12) % RAINBOW.length] : col, "rgba(255,255,255,0.6)");
        if (k >= 1) { shots.splice(i, 1); land(s); }
      }
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i]; b.life -= dt; b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
        const q = proj(...b.p); if (q) { ctx.globalAlpha = Math.max(0, b.life * 2); ctx.fillStyle = b.col; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); ctx.globalAlpha = 1; }
        if (b.life <= 0) bits.splice(i, 1);
      }
    }
    function land(s){
      const at = proj(...s.b) || { x: W / 2, y: H / 2 };
      if (s.foe) {
        shield = 1; Fun.sfx.bonk();
        fx.pop(["Ha ha!", "Missed me!", "Nyah nyah!", "Try again!"][Math.floor(Math.random() * 4)], at.x + 40, at.y - 70, "#7dff5a", 24);
        return;
      }
      hp = Math.max(0, hp - s.sp.hit); hurt = 0.5;
      fx.pop(s.sp.words[Math.floor(Math.random() * s.sp.words.length)], at.x, at.y - 60, s.sp.col, s.sp.hit > 1 ? 40 : 30);
      fx.burst(at.x, at.y, s.sp.col, 18 + s.sp.hit * 8, 200);
      if (s.sp.hit > 1) Fun.sfx.crash(); else Fun.sfx.zap();
      if (hp <= 0) {
        poof = 1; S.defeated++; S.level = 1 + Math.floor(S.defeated / 2); Hub.saveStore();
        const M = MONSTERS[kind] || MONSTERS.words;
        setTimeout(() => { fx.pop(`${M.name} is defeated! ⭐`, W / 2, H * 0.3, "#ffe14d", 32); fx.burst(W / 2, H * 0.3, "#ffe14d", 40, 260); Fun.sfx.tada(); }, 250);
      }
    }

    /* ----- each frame ----- */
    const anim = Fun.animate(dt => {
      clock += dt;
      cam.yaw = Math.sin(clock * 0.25) * 0.08; cam.x = Math.sin(clock * 0.25) * 0.8;
      hurt = Math.max(0, hurt - dt); cast = Math.max(0, cast - dt); shield = Math.max(0, shield - dt * 1.5); laugh = Math.max(0, laugh - dt);
      enter = Math.max(0, enter - dt * 1.6);
      if (poof > 0) { poof -= dt * 1.5; if (poof <= 0) newFoe(); }
      drawArena();
      drawWizard();
      drawFoe();
      drawShots(dt);
      // your level and how many monsters you've beaten
      ctx.fillStyle = "rgba(10,10,30,0.55)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(10, 10, 250, 30, 8) : ctx.rect(10, 10, 250, 30); ctx.fill();
      ctx.font = "bold 14px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
      ctx.fillText(`🧙 Level ${S.level} · 👾 ${S.defeated} defeated`, 20, 25);
      const sp = spellNow();
      ctx.textAlign = "right"; ctx.fillStyle = sp.col; ctx.fillText(`✨ Next spell: ${sp.name}${curStreak ? `  (streak ${curStreak})` : ""}`, W - 16, 25);
      ctx.textBaseline = "alphabetic";
      fx.draw(ctx, dt);
    });

    return {
      answer(correct, streak){
        if (correct) { curStreak = streak; cast = 0.45; fire(false, spellNow(Math.max(0, streak - 1))); Fun.sfx.whoosh(); }
        else { curStreak = 0; laugh = 1.2; fire(true, null); }
      },
      topic(id){ if (MONSTERS[id] && id !== kind) { kind = id; newFoe(); } },
      open: anim.open,
      close: anim.close
    };
  };
})();
