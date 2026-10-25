/* The race WOW kit, shared by Race Off, Stunt Wheels and Turbo Track. Drawn on top of a game's own picture:
     const rfx = RaceFX();
     rfx.nitro(on)            warp speed while the nitro (or a boost) burns: streaks rushing out from the
                              middle and a blue glow round the edges
     rfx.flash(colour, k)     a flash of colour over the whole screen (k = how strong, 0 to 1)
     rfx.title(text, colour)  a huge 3D title that slams in and fades ("GO!", "DOUBLE FLIP!")
     rfx.fireworks(n)         n rockets that burst into colour
     rfx.finish(won)          the finish: a waving checkered flag, FINISH! (WINNER! if won) and fireworks (fewer if won is false)
     rfx.draw(ctx, W, H, dt)  every frame, last thing before the HUD, in the game's own W × H units */
(function(){
  "use strict";
  const COLOURS = ["#ff4d6d", "#ffd84d", "#4dd96b", "#4db8ff", "#b26bff", "#ff9f1c", "#ffffff"];

  window.RaceFX = function(){
    let nitroOn = false, nitroK = 0, flashes = [], titles = [], rockets = [], sparks = [], flagT = -1, streaks = [];
    const low = () => Fun.quality() === "low";

    function fireworks(n){
      for (let i = 0; i < n; i++) rockets.push({ x: 0.15 + Math.random() * 0.7, y: 1.05, vy: -(0.9 + Math.random() * 0.4), top: 0.15 + Math.random() * 0.3, delay: i * 0.25, colour: COLOURS[Math.floor(Math.random() * COLOURS.length)] });
    }

    function draw(ctx, W, H, dt){
      ctx.save();
      // warp speed: streaks from the middle outwards, and a blue glow round the edges
      nitroK += ((nitroOn ? 1 : 0) - nitroK) * Math.min(1, dt * 6);
      if (nitroK > 0.02) {
        if (nitroOn) for (let i = 0; i < (low() ? 2 : 5); i++) { const a = Math.random() * Math.PI * 2; streaks.push({ a, r: 40 + Math.random() * 80, v: 900 + Math.random() * 900 }); }
        ctx.lineCap = "round";
        streaks = streaks.filter(s => {
          s.r += s.v * dt;
          const len = 30 + s.r * 0.25, x0 = W / 2 + Math.cos(s.a) * s.r, y0 = H / 2 + Math.sin(s.a) * s.r * 0.6;
          ctx.strokeStyle = `rgba(200,240,255,${0.55 * nitroK})`; ctx.lineWidth = 2 + s.r / 300;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(s.a) * len, y0 + Math.sin(s.a) * len * 0.6); ctx.stroke();
          return s.r < Math.max(W, H);
        });
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, "rgba(60,140,255,0)"); g.addColorStop(1, `rgba(90,60,255,${0.45 * nitroK})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else streaks = [];
      // flashes
      flashes = flashes.filter(f => { f.t += dt; ctx.globalAlpha = Math.max(0, f.k * (1 - f.t / 0.35)); ctx.fillStyle = f.colour; ctx.fillRect(0, 0, W, H); return f.t < 0.35; });
      ctx.globalAlpha = 1;
      // the checkered flag waving across the top
      if (flagT >= 0) {
        flagT += dt;
        const slide = Math.min(1, flagT / 0.5), fade = flagT > 3.2 ? Math.max(0, 1 - (flagT - 3.2) / 0.6) : 1, sq = Math.max(16, W / 40);
        ctx.globalAlpha = fade;
        for (let col = 0; col < Math.ceil(W / sq) + 1; col++) for (let row = 0; row < 3; row++) {
          const x = -W + slide * W + col * sq, wave = Math.sin(flagT * 7 + col * 0.45) * sq * 0.5;
          ctx.fillStyle = (col + row) % 2 ? "#111" : "#fff";
          ctx.fillRect(x, H * 0.06 + row * sq + wave, sq + 1, sq + 1);
        }
        ctx.globalAlpha = 1;
        if (flagT > 3.8) flagT = -1;
      }
      // fireworks
      ctx.globalCompositeOperation = "lighter";
      rockets = rockets.filter(r => {
        if ((r.delay -= dt) > 0) return true;
        r.y += r.vy * dt;
        ctx.fillStyle = "#fff"; ctx.fillRect(r.x * W - 2, r.y * H - 2, 4, 8);
        if (r.y > r.top) return true;
        const n = low() ? 24 : 48;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, v = 0.18 + Math.random() * 0.12; sparks.push({ x: r.x * W, y: r.y * H, vx: Math.cos(a) * v * W, vy: Math.sin(a) * v * W, t: 0, colour: Math.random() < 0.2 ? "#ffffff" : r.colour }); }
        Fun.sfx.pop();
        return false;
      });
      sparks = sparks.filter(p => {
        p.t += dt; p.vx *= Math.pow(0.3, dt); p.vy = p.vy * Math.pow(0.3, dt) + H * 0.25 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4); ctx.fillStyle = p.colour; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        return p.t < 1.4;
      });
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      // big 3D titles: stacked copies give them thickness, and they slam in from big to normal
      titles = titles.filter(t => {
        t.t += dt;
        const k = Math.min(1, t.t / 0.25), s = 2.4 - 1.4 * (1 - Math.pow(1 - k, 3)), alpha = t.t > 1.2 ? Math.max(0, 1 - (t.t - 1.2) / 0.4) : 1;
        const size = Math.round(Math.min(W / Math.max(5, t.text.length) * 1.5, H * 0.16));
        ctx.save(); ctx.translate(W / 2, H * t.y); ctx.scale(s, s); ctx.rotate(-0.05);
        ctx.font = `900 ${size}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.globalAlpha = alpha;
        for (let d = 8; d > 0; d--) { ctx.fillStyle = d > 1 ? "#1a1030" : "#000"; ctx.fillText(t.text, d * 1.2, d * 1.5); }
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, "#fff"); g.addColorStop(0.5, t.colour); g.addColorStop(1, t.colour);
        ctx.fillStyle = g; ctx.fillText(t.text, 0, 0);
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.strokeText(t.text, 0, 0);
        ctx.restore();
        return t.t < 1.6;
      });
      ctx.restore();
    }

    return {
      nitro(on){ nitroOn = !!on; },
      flash(colour, k){ flashes.push({ colour, k: k === undefined ? 0.5 : k, t: 0 }); },
      title(text, colour, y){ titles = titles.filter(t => t.t < 0.8); titles.push({ text, colour: colour || "#ffd84d", t: 0, y: y || 0.42 }); },
      fireworks,
      finish(won){ flagT = 0; this.title(won ? "WINNER!" : "FINISH!", won ? "#ffd84d" : "#ffffff", 0.45); fireworks(won === false ? 3 : 8); },
      draw,
      reset(){ nitroOn = false; nitroK = 0; flashes = []; titles = []; rockets = []; sparks = []; flagT = -1; streaks = []; }
    };
  };
})();
