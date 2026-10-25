/* Rocket Run: the 3D scene above Fast Math's questions. A rocket flies through space, with the stars streaming
   past in 3D. Every right answer fires the boosters (a streak makes them roar and the stars stretch into
   streaks); every 5 right answers in total you fly past a planet that grows from a dot into a big shaded
   ball: the Moon, Mars, Jupiter, Saturn with its rings and on out to Neptune and beyond. A wrong answer
   sends a space rock bonking into the rocket and it wobbles and slows down.
     MathRocket(el, store) -> { answer(correct, streak), topic(id), open(), close() }
   Drawn with a little 3D camera on a 2D canvas. Progress is kept in store (km flown, planets passed). */
(function(){
  "use strict";

  const PLANETS = [
    { name: "the Moon",   col: "#d9d6c8", dark: "#8f8c80", r: 0.9 },
    { name: "Mars",       col: "#e0603a", dark: "#8f2f18", r: 1.1 },
    { name: "Jupiter",    col: "#e8c08a", dark: "#a8733a", r: 2.2, bands: true },
    { name: "Saturn",     col: "#f0d9a0", dark: "#b8985a", r: 1.9, rings: true },
    { name: "Uranus",     col: "#8fe3e8", dark: "#3a9aa8", r: 1.4 },
    { name: "Neptune",    col: "#4d7cf0", dark: "#1f3fa8", r: 1.4 },
    { name: "Pluto",      col: "#d8b8a0", dark: "#8a6a58", r: 0.7 },
    { name: "a Black Hole", col: "#1a1030", dark: "#000000", r: 1.6, hole: true }
  ];
  const KM_PER_RIGHT = 12500;

  window.MathRocket = function(el, S){
    el.innerHTML = `<canvas class="rocket-canvas" width="960" height="270" aria-label="Rocket run"></canvas>`;
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const W = 960, H = 270, FOC = 330, CX = W / 2, CY = H * 0.52;
    const fx = Fun.pops();
    S.km = S.km || 0; S.planets = S.planets || 0; S.rights = S.rights || 0;

    let clock = 0;
    let speed = 1, boost = 0, wobble = 0, rock = null, planet = null, hue = 0;
    // 160 stars at random spots in a big box, flying towards you
    const stars = Array.from({ length: 160 }, () => newStar(true));
    function newStar(any){ return { x: (Math.random() - 0.5) * 24, y: (Math.random() - 0.5) * 12, z: any ? Math.random() * 30 + 0.5 : 30, c: Math.random() }; }
    function proj(x, y, z){ return { x: CX + x * FOC / z, y: CY + y * FOC / z, s: FOC / z }; }
    const shade = Fun.shade;

    function drawPlanet(P, z, sx, sy){
      const p = proj(sx, sy, z), R = P.r * p.s;
      if (R < 1.5 || p.x < -R * 3 || p.x > W + R * 3) return;
      if (P.hole) {
        const g = ctx.createRadialGradient(p.x, p.y, R * 0.3, p.x, p.y, R * 2.6);
        g.addColorStop(0, "#000"); g.addColorStop(0.35, "#6b2bd1"); g.addColorStop(0.6, "rgba(255,140,40,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R * 2.6, 0, 7); ctx.fill();
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.8, 0, 7); ctx.fill();
        return;
      }
      if (P.rings) { ctx.strokeStyle = "rgba(240,217,160,0.55)"; ctx.lineWidth = R * 0.16; ctx.beginPath(); ctx.ellipse(p.x, p.y, R * 2.2, R * 0.55, -0.35, Math.PI, 0); ctx.stroke(); }
      const g = ctx.createRadialGradient(p.x - R * 0.4, p.y - R * 0.4, R * 0.1, p.x, p.y, R * 1.05);
      g.addColorStop(0, shade(P.col, 1.25)); g.addColorStop(0.55, P.col); g.addColorStop(1, P.dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fill();
      if (P.bands) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.clip(); ctx.strokeStyle = "rgba(150,90,40,0.5)"; ctx.lineWidth = R * 0.12; [-0.5, -0.1, 0.35].forEach(o => { ctx.beginPath(); ctx.moveTo(p.x - R, p.y + o * R); ctx.lineTo(p.x + R, p.y + o * R + R * 0.06); ctx.stroke(); }); ctx.restore(); }
      if (P.name === "the Moon" || P.name === "Mars") { ctx.fillStyle = "rgba(0,0,0,0.18)"; [[-0.3, -0.2, 0.2], [0.35, 0.25, 0.15], [0.05, 0.45, 0.1]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(p.x + dx * R, p.y + dy * R, r * R, 0, 7); ctx.fill(); }); }
      if (P.rings) { ctx.strokeStyle = "rgba(240,217,160,0.8)"; ctx.lineWidth = R * 0.16; ctx.beginPath(); ctx.ellipse(p.x, p.y, R * 2.2, R * 0.55, -0.35, 0, Math.PI); ctx.stroke(); }
      // the shadow side
      const sh = ctx.createRadialGradient(p.x + R * 0.6, p.y + R * 0.4, R * 0.2, p.x + R * 0.6, p.y + R * 0.4, R * 1.6);
      sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,10,0.5)");
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.clip(); ctx.fillStyle = sh; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2); ctx.restore();
    }

    // the rocket seen from behind and above: a nose cone, a body with a window, fins, and the flame
    function drawRocket(){
      const sway = Math.sin(clock * 3) * 5 + (wobble > 0 ? Math.sin(wobble * 40) * wobble * 16 : 0);
      const x = CX + sway, y = CY + 58 + Math.sin(clock * 2) * 3, tilt = (wobble > 0 ? Math.sin(wobble * 30) * wobble * 0.25 : 0) + sway * 0.004;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      // the flame, bigger with a boost
      const fl = 26 + boost * 70 + Math.random() * 14;
      const g = ctx.createLinearGradient(0, 24, 0, 24 + fl);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.25, "#ffe14d"); g.addColorStop(0.6, boost > 0.3 ? "#ff4d1a" : "#ff9f1a"); g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-16, 24); ctx.quadraticCurveTo(0, 24 + fl * 1.2, 16, 24); ctx.fill();
      // the fins
      ctx.fillStyle = "#c0302a"; [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(s * 18, -2); ctx.lineTo(s * 44, 30); ctx.lineTo(s * 18, 26); ctx.fill(); });
      // the body, shaded like a cylinder
      const body = ctx.createLinearGradient(-24, 0, 24, 0); body.addColorStop(0, "#ffffff"); body.addColorStop(0.5, "#e8ecf4"); body.addColorStop(1, "#8e9ab3");
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-22, 26); ctx.lineTo(-22, -22); ctx.quadraticCurveTo(0, -78, 22, -22); ctx.lineTo(22, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e8402c"; ctx.beginPath(); ctx.moveTo(-17, -36); ctx.quadraticCurveTo(0, -78, 17, -36); ctx.quadraticCurveTo(0, -46, -17, -36); ctx.fill();
      ctx.fillStyle = "#1b3a7a"; ctx.beginPath(); ctx.arc(0, -10, 11, 0, 7); ctx.fill();
      const win = ctx.createRadialGradient(-3, -13, 1, 0, -10, 10); win.addColorStop(0, "#bfe8ff"); win.addColorStop(1, "#3a7ad0");
      ctx.fillStyle = win; ctx.beginPath(); ctx.arc(0, -10, 8.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#c0302a"; ctx.fillRect(-22, 14, 44, 6);
      ctx.restore();
      // a little happy face in the window, which turns dizzy when you get bonked
      Fun.face(ctx, x, y - 10, 8, wobble > 0 ? "dizzy" : boost > 0.4 ? "grin" : "happy", clock, 0, -0.3);
    }

    const anim = Fun.animate(dt => {
      clock += dt;
      boost = Math.max(0, boost - dt * 0.5); wobble = Math.max(0, wobble - dt * 1.2);
      speed += ((1 + boost * 5) - speed) * Math.min(1, dt * 3);
      const bg = ctx.createRadialGradient(CX, CY, 10, CX, CY, W * 0.6);
      bg.addColorStop(0, "#1b1650"); bg.addColorStop(1, "#05051a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // a faint nebula that drifts
      hue = (hue + dt * 4) % 360;
      const neb = ctx.createRadialGradient(W * 0.25, H * 0.3, 0, W * 0.25, H * 0.3, 220);
      neb.addColorStop(0, `hsla(${hue},80%,50%,0.18)`); neb.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
      // the stars fly towards you; faster means longer streaks
      stars.forEach((s, i) => {
        s.z -= speed * dt * 7;
        if (s.z < 0.4) { stars[i] = newStar(false); return; }
        const a = proj(s.x, s.y, s.z), b = proj(s.x, s.y, Math.min(40, s.z + speed * 0.35 + 0.1));
        ctx.strokeStyle = `rgba(${200 + s.c * 55},${210 + s.c * 40},255,${Math.min(1, 1.2 - s.z / 30)})`;
        ctx.lineWidth = Math.max(0.8, a.s * 0.012 + 0.6);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
      });
      // the planet we're flying past
      if (planet) {
        planet.z -= dt * (2.2 + speed * 1.2);
        const P = PLANETS[planet.i % PLANETS.length];
        drawPlanet(P, Math.max(0.7, planet.z), planet.sx, planet.sy);
        if (planet.z < 0.7) planet = null;
      }
      // a space rock tumbling in
      if (rock) {
        rock.z -= dt * 12; rock.rot += dt * 5;
        const p = proj(rock.x, rock.y, Math.max(0.5, rock.z));
        const R = 1.1 * p.s;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rock.rot);
        const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); g.addColorStop(0, "#c9b8a0"); g.addColorStop(1, "#5a4a3a");
        ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = R * (0.75 + 0.25 * Math.sin(i * 7)); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        ctx.restore();
        if (rock.z < 1.1) { fx.pop("BONK!", CX, CY + 20, "#ffd2a0", 40); fx.burst(CX, CY + 30, "#ffd2a0", 24, 200); Fun.sfx.bonk(); wobble = 1; rock = null; }
      }
      drawRocket();
      // km flown, and the next planet
      ctx.fillStyle = "rgba(10,10,40,0.6)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(10, 10, 300, 30, 8) : ctx.rect(10, 10, 300, 30); ctx.fill();
      ctx.font = "bold 14px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      const next = PLANETS[S.planets % PLANETS.length].name;
      ctx.fillText(`🚀 ${S.km.toLocaleString("en")} km · next: ${next} (${5 - (S.rights % 5)})`, 20, 25);
      ctx.textBaseline = "alphabetic";
      fx.draw(ctx, dt);
    });

    return {
      answer(correct, streak){
        if (correct) {
          S.rights++; S.km += KM_PER_RIGHT * (streak >= 5 ? 2 : 1); boost = Math.min(1, 0.6 + streak * 0.05);
          fx.pop(streak >= 5 ? `TURBO ×${streak}! 🔥` : ["WHOOSH!", "ZOOM!", "Yes!", "Boom!"][Math.floor(Math.random() * 4)], CX + 150, 70, streak >= 5 ? "#ff9f1a" : "#7fe3ff", streak >= 5 ? 34 : 28);
          Fun.sfx.whoosh();
          if (S.rights % 5 === 0) {
            planet = { i: S.planets, z: 26, sx: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3), sy: (Math.random() - 0.5) * 3 };
            const P = PLANETS[S.planets % PLANETS.length]; S.planets++;
            setTimeout(() => { fx.pop(`🪐 Flying past ${P.name}!`, W / 2, 50, "#ffe14d", 30); Fun.sfx.tada(); }, 700);
          }
        } else {
          rock = { x: (Math.random() - 0.5) * 3, y: -0.2 + Math.random() * 0.8, z: 14, rot: 0 };
          boost = 0; fx.pop(["Uh-oh!", "Watch out!", "Rock ahead!"][Math.floor(Math.random() * 3)], W * 0.3, 80, "#ffd2a0", 26);
        }
        Hub.saveStore();
      },
      topic(){},
      open: anim.open,
      close: anim.close
    };
  };
})();
