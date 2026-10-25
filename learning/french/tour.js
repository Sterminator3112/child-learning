/* Tour de France: the scene above Français Fusée's questions. You race your bike through France, seen from
   the side, against Monsieur Jaune in the yellow jersey. Every right answer: you pedal hard and pull ahead,
   and a streak gives you a Sprint. A wrong answer: you wobble and he gets away. Every 10 km you ride into a
   new town, from Genève all the way to Paris and the Eiffel Tower, and then round again.
     TourDeFrance(el, store) -> { answer(correct, streak), topic(id), open(), close() }
   Drawn on a 2D canvas. Progress is kept in store (km, wins). */
(function(){
  "use strict";

  const TOWNS = ["Genève", "Annecy", "Lyon", "Avignon", "Marseille", "Nice", "Montpellier", "Toulouse", "Bordeaux",
    "Nantes", "Rennes", "le Mont-Saint-Michel", "Rouen", "Lille", "Reims", "Strasbourg", "Dijon", "Paris"];
  const STEP = 2;                                  // km for a right answer
  const PRAISE = ["Allez !", "Bravo !", "Super !", "Vite !", "Génial !", "Oui !", "Formidable !"];
  const TAUNT = ["Ha ha ! 😎", "Trop lent !", "Au revoir !", "Bye bye !", "Je suis le champion !"];
  const RAINBOW = ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd96b", "#4db8ff", "#9b6bff"];

  window.TourDeFrance = function(el, S){
    el.innerHTML = `<canvas width="960" height="270" aria-label="Tour de France"></canvas>`;
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const W = 960, H = 270, ROAD = 214;
    const fx = Fun.pops();
    S.km = S.km || 0; S.wins = S.wins || 0;

    let open = false, raf = 0, last = 0, clock = 0;
    let roll = 0, speed = 1, lead = 0, shownLead = 0, wobble = 0, sprint = 0, pedal = 0, rivalPedal = 0;
    let sign = null;                                // a town sign rolling in from the right
    const town = () => TOWNS[Math.floor(S.km / 10) % TOWNS.length];

    // something far away slides past slower than something close: x at a depth k (0 still, 1 like the road)
    const slide = (x0, k, span) => ((x0 - roll * k) % span + span) % span - 100;

    function drawWorld(){
      const sky = ctx.createLinearGradient(0, 0, 0, ROAD); sky.addColorStop(0, "#58a8f2"); sky.addColorStop(1, "#d8efff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // the sun and a cloud or two
      ctx.fillStyle = "#ffe46b"; ctx.beginPath(); ctx.arc(860, 46, 26, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      [[120, 40], [520, 28], [760, 60]].forEach(([cx, cy]) => { const x = slide(cx, 8, W + 200); ctx.beginPath(); ctx.arc(x, cy, 16, 0, 7); ctx.arc(x + 20, cy + 4, 13, 0, 7); ctx.arc(x - 18, cy + 5, 11, 0, 7); ctx.fill(); });
      // far hills, then purple lavender fields, then near green hills
      ctx.fillStyle = "#9cc7a0"; ctx.beginPath(); ctx.moveTo(0, ROAD);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 130 + Math.sin((x + roll * 12) / 90) * 18 + Math.sin((x + roll * 12) / 37) * 6);
      ctx.lineTo(W, ROAD); ctx.fill();
      ctx.fillStyle = "#a98bdc"; ctx.fillRect(0, 170, W, ROAD - 170);
      ctx.strokeStyle = "#7f5fc4"; ctx.lineWidth = 3;
      for (let x = -40; x < W + 40; x += 26) { const sx = ((x - roll * 40) % (W + 80) + W + 80) % (W + 80) - 40; ctx.beginPath(); ctx.moveTo(sx, 172); ctx.lineTo(sx - 30, ROAD); ctx.stroke(); }
      // trees and the Eiffel Tower once you reach Paris
      for (let k = 0; k < 6; k++) {
        const x = slide(k * 190 + 60, 60, W + 200);
        ctx.fillStyle = "#6b4a2b"; ctx.fillRect(x - 3, 178, 6, 22);
        ctx.fillStyle = k % 2 ? "#3f9a4a" : "#56b85a"; ctx.beginPath(); ctx.arc(x, 172, 16, 0, 7); ctx.fill();
      }
      if (town() === "Paris") drawEiffel(slide(700, 20, W + 300));
      // the road with its white line rushing past, and the cheering crowd behind the barrier
      ctx.fillStyle = "#555b66"; ctx.fillRect(0, ROAD - 14, W, H - ROAD + 14);
      ctx.fillStyle = "#fff";
      for (let x = 0; x < W + 80; x += 80) ctx.fillRect(((x - roll * 120) % (W + 80) + W + 80) % (W + 80) - 80, ROAD + 24, 44, 5);
      ctx.fillStyle = "#e8e8e8"; ctx.fillRect(0, ROAD - 18, W, 5);
      for (let x = 0; x < W + 40; x += 34) {
        const sx = ((x - roll * 120) % (W + 40) + W + 40) % (W + 40) - 20, hop = sprint > 0 ? Math.abs(Math.sin(clock * 9 + x)) * 5 : 0;
        ctx.fillStyle = RAINBOW[(x / 34) % RAINBOW.length]; ctx.fillRect(sx - 5, ROAD - 34 - hop, 10, 14);
        ctx.fillStyle = "#f2c49b"; ctx.beginPath(); ctx.arc(sx, ROAD - 39 - hop, 5, 0, 7); ctx.fill();
      }
    }
    function drawEiffel(x){
      ctx.strokeStyle = "#6e5a48"; ctx.fillStyle = "#6e5a48"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 42, 196); ctx.quadraticCurveTo(x - 10, 120, x - 3, 40); ctx.lineTo(x + 3, 40); ctx.quadraticCurveTo(x + 10, 120, x + 42, 196); ctx.stroke();
      [[150, 30], [110, 18], [75, 10]].forEach(([y, w]) => ctx.fillRect(x - w, y, w * 2, 4));
      ctx.fillRect(x - 1, 22, 2, 20);
    }

    // a rider on a bike; jersey is a colour or "rainbow"
    function drawRider(x, jersey, spin, tilt, name){
      ctx.save(); ctx.translate(x, ROAD + 2); ctx.rotate(tilt);
      const wheel = cx => {
        ctx.strokeStyle = "#222"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, -18, 18, 0, 7); ctx.stroke();
        ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { const a = spin + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 16, -18 - Math.sin(a) * 16); ctx.lineTo(cx + Math.cos(a) * 16, -18 + Math.sin(a) * 16); ctx.stroke(); }
      };
      wheel(-28); wheel(28);
      // the frame, then the legs going round with the pedals
      ctx.strokeStyle = jersey === "rainbow" ? "#ff4d8d" : "#2b2b2b"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-28, -18); ctx.lineTo(-4, -18); ctx.lineTo(20, -44); ctx.lineTo(-12, -44); ctx.lineTo(-28, -18); ctx.moveTo(-4, -18); ctx.lineTo(-12, -50); ctx.moveTo(20, -44); ctx.lineTo(28, -18); ctx.stroke();
      const px = Math.cos(spin) * 9, py = Math.sin(spin) * 9;
      ctx.strokeStyle = "#1d2b55"; ctx.lineWidth = 6; ctx.lineCap = "round";
      [[px, py], [-px, -py]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(-10, -56); ctx.lineTo(-2 + dx * 0.4, -38); ctx.lineTo(-4 + dx, -18 + dy); ctx.stroke(); });
      // the body leaning over the handlebars
      if (jersey === "rainbow") {
        RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, -54 - i * 2.6 + 6); ctx.lineTo(14, -66 - i * 2.6 + 6); ctx.stroke(); });
      } else { ctx.strokeStyle = jersey; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-10, -58); ctx.lineTo(12, -68); ctx.stroke(); }
      ctx.strokeStyle = "#f2c49b"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(10, -66); ctx.lineTo(20, -46); ctx.stroke();
      ctx.fillStyle = "#f2c49b"; ctx.beginPath(); ctx.arc(20, -78, 9, 0, 7); ctx.fill();
      ctx.fillStyle = jersey === "rainbow" ? "#ff4d8d" : "#e63946"; ctx.beginPath(); ctx.arc(19, -81, 10, Math.PI, 0); ctx.fill();
      ctx.lineCap = "butt"; ctx.restore();
      ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
      ctx.strokeText(name, x, ROAD - 100); ctx.fillText(name, x, ROAD - 100);
    }

    function drawSign(dt){
      if (!sign) return;
      sign.x -= speed * 120 * dt;
      if (sign.x < -120) { sign = null; return; }
      ctx.fillStyle = "#666"; ctx.fillRect(sign.x - 2, ROAD - 66, 4, 50);
      ctx.font = "bold 15px system-ui"; const w = ctx.measureText(sign.name).width + 22;
      ctx.fillStyle = "#fff"; ctx.fillRect(sign.x - w / 2, ROAD - 92, w, 28);
      ctx.strokeStyle = "#d62828"; ctx.lineWidth = 3; ctx.strokeRect(sign.x - w / 2 + 3, ROAD - 89, w - 6, 22);
      ctx.fillStyle = "#1a1a1a"; ctx.textAlign = "center"; ctx.fillText(sign.name, sign.x, ROAD - 73);
    }

    function hud(){
      ctx.font = "bold 15px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(10, 10, 300, 26);
      ctx.fillStyle = "#fff"; ctx.fillText(`🚴 ${S.km} km · 📍 ${town()} · 🏆 ${S.wins}`, 18, 28);
      if (sprint > 0) { ctx.textAlign = "right"; ctx.fillStyle = "#ffe14d"; ctx.font = "900 20px system-ui"; ctx.fillText("⚡ SPRINT !", W - 16, 30); }
    }

    function frame(now){
      raf = 0;
      if (!open) return;
      const dt = Fun.dt(now, last, 0.05); last = now; clock += dt;
      speed += ((sprint > 0 ? 2.6 : 1.2) - speed) * Math.min(1, dt * 2);
      roll += speed * dt;
      sprint = Math.max(0, sprint - dt); wobble = Math.max(0, wobble - dt * 1.5);
      shownLead += (lead - shownLead) * Math.min(1, dt * 3);
      pedal += dt * speed * 9; rivalPedal += dt * 10;
      drawWorld(); drawSign(dt);
      // your rider and Monsieur Jaune, the further ahead the further right
      const you = W / 2 - 40 + shownLead * 34, him = W / 2 + 40 - shownLead * 34;
      if (sprint > 0) { ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const y = ROAD - 20 - i * 14; ctx.beginPath(); ctx.moveTo(you - 60 - i * 8, y); ctx.lineTo(you - 110 - i * 8, y); ctx.stroke(); } }
      drawRider(him, "#ffd400", rivalPedal, Math.sin(clock * 5) * 0.015, "M. Jaune");
      drawRider(you, "rainbow", pedal, wobble > 0 ? Math.sin(clock * 30) * 0.12 * wobble : -0.04 * Math.min(1, sprint), Hub.store.name || "Toi");
      fx.draw(ctx, dt);
      hud();
      raf = requestAnimationFrame(frame);
    }

    return {
      answer(correct, streak){
        const you = W / 2 - 40 + lead * 34;
        if (correct) {
          const before = Math.floor(S.km / 10);
          S.km += STEP; lead = Math.min(5, lead + 1);
          if (streak && streak % 5 === 0) { sprint = 3; fx.pop("⚡ SPRINT !", you, 70, "#ffe14d", 34); Fun.sfx.whoosh(); }
          else { fx.pop(PRAISE[Math.floor(Math.random() * PRAISE.length)], you, 80, "#fff", 26); Fun.sfx.ding(); }
          fx.burst(you, ROAD - 60, RAINBOW[Math.floor(Math.random() * RAINBOW.length)], 12);
          if (lead === 5) { S.wins++; lead = 1; fx.pop("🏆 Maillot jaune !", W / 2, 110, "#ffd400", 32); Fun.sfx.tada(); }
          if (Math.floor(S.km / 10) > before) sign = { name: "🇫🇷 " + town(), x: W + 80 };
        } else {
          lead = Math.max(-5, lead - 1); wobble = 1;
          fx.pop(TAUNT[Math.floor(Math.random() * TAUNT.length)], W / 2 + 40 - lead * 34, 80, "#ffd400", 22); Fun.sfx.boing();
        }
        Hub.saveStore();
      },
      topic(){},
      open(){ open = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
      close(){ open = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    };
  };
})();
