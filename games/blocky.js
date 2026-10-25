/* Blocky: the Roblox-style 3D look that Tag Rush, Blox Soccer and Blox Hoops share, drawn on a plain 2D canvas.
   A camera floats up behind you; the world is flat ground with boxes on it, and people are blocky
   avatars with the classic smiley.
     const B = Blocky(ctx, W, H)     makes one for a canvas (W × H is the size the game draws at)
     B.cam                           where the camera is: { x, y, z, a } (a = the way it looks, 0 is +z)
     B.follow(body, yaw, dt)         moves the camera up behind a body, looking the way yaw points
     B.at(x, y, z)                   where a spot in the world is on screen, or null when it's behind you
     B.polyPath(pts) / B.line3(a, b) flat shapes and lines in the world (cut off where they go behind you)
     B.part(list, body, lx, ly, lz, w, h, d, colour, swing, isHead)
                                     adds one box to a list: lx, ly, lz is the middle of its bottom in the
                                     body's own space (turned with body.face); swing turns it round its top
     B.avatar(list, body, look)      adds a whole avatar: look = { shirt, pants, head }
     B.paint(list)                   draws a list of boxes, farthest first
     B.label(x, y, z, text, colour)  a name tag floating in the world
     B.shadow(x, z, r, a)            a round shadow on the ground
     B.sky(clock)                    the blue sky with blocky clouds, and the ground colour under the horizon
   Bodies are { x, y, z, face, vx, vz, walk }. */
(function(){
  "use strict";
  window.Blocky = function(ctx, W, H, opts){
    const o = Object.assign({ focal: 600, near: 0.3, pitch: 0.3, back: 10, up: 6.5 }, opts);
    const FOCAL = o.focal, NEAR = o.near, SIN_P = Math.sin(o.pitch), COS_P = Math.cos(o.pitch);
    const HORIZON = H / 2 - FOCAL * Math.tan(o.pitch);
    const LIGHT = (() => { const l = [0.4, 0.85, -0.35], n = Math.hypot(...l); return l.map(v => v / n); })();
    const cam = { x: 0, y: o.up, z: -o.back, a: 0, s: 0, c: 1 };

    function follow(b, yaw, dt){
      const d = ((yaw - cam.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      cam.a = dt ? cam.a + d * Math.min(1, dt * 3) : yaw;
      cam.s = Math.sin(cam.a); cam.c = Math.cos(cam.a);
      const tx = b.x - cam.s * o.back, tz = b.z - cam.c * o.back, k = dt ? Math.min(1, dt * 8) : 1;
      cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
      cam.y += ((b.y || 0) * 0.5 + o.up - cam.y) * k;
    }
    function camSpace(x, y, z){
      const dx = x - cam.x, dz = z - cam.z, h = y - cam.y;
      const rx = dx * cam.c - dz * cam.s, fd = dx * cam.s + dz * cam.c;
      return [rx, h * COS_P + fd * SIN_P, fd * COS_P - h * SIN_P];
    }
    const toScreen = q => [W / 2 + q[0] * FOCAL / q[2], H / 2 - q[1] * FOCAL / q[2]];
    function at(x, y, z){ const q = camSpace(x, y, z); return q[2] > NEAR ? toScreen(q) : null; }
    const depth = (x, y, z) => camSpace(x, y, z)[2];

    function polyPath(pts){
      const q = pts.map(p => camSpace(p[0], p[1], p[2])), out = [];
      for (let i = 0; i < q.length; i++) {
        const a = q[i], b = q[(i + 1) % q.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (out.length < 3) return false;
      ctx.beginPath();
      out.forEach((p, i) => { const [sx, sy] = toScreen(p); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.closePath();
      return true;
    }
    function line3(a, b){
      let p = camSpace(...a), q = camSpace(...b);
      if (p[2] < NEAR && q[2] < NEAR) return;
      if (p[2] < NEAR || q[2] < NEAR) {
        const t = (NEAR - p[2]) / (q[2] - p[2]), m = p.map((v, i) => v + (q[i] - v) * t);
        if (p[2] < NEAR) p = m; else q = m;
      }
      const s = toScreen(p), e = toScreen(q);
      ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]);
    }
    const shadeCache = new Map();
    function shade(hex, f){
      const key = hex + f.toFixed(2);
      if (!shadeCache.has(key)) {
        const n = parseInt(hex.slice(1), 16), ch = v => Math.round(Math.min(255, v * f));
        shadeCache.set(key, `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`);
      }
      return shadeCache.get(key);
    }

    const FACES = [
      { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
      { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] }, { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
      { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], front: true }, { n: [0, 0, -1], q: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
    ];
    function part(list, b, lx, ly, lz, w, h, d, colour, swing, isHead){
      const c = Math.cos(b.face || 0), s = Math.sin(b.face || 0), cp = Math.cos(swing || 0), sp = Math.sin(swing || 0), by = b.y || 0;
      const local = (x, y, z) => {
        const yy = y - (ly + h), y2 = yy * cp - z * sp, z2 = yy * sp + z * cp;
        return [x + lx, y2 + ly + h, z2 + lz];
      };
      const world = ([x, y, z]) => [b.x + x * c + z * s, by + y, b.z - x * s + z * c];
      const X = [-w / 2, w / 2], Y = [ly, ly + h], Z = [-d / 2, d / 2];
      const corner = (i, j, k) => world(local(X[i], Y[j], Z[k]));
      const ctr = world(local(0, ly + h / 2, 0)), dep = depth(...ctr);
      FACES.forEach(f => {
        // the face's direction in the world: swung like the box, then turned with the body
        const nx = f.n[0], ny = f.n[1] * cp - f.n[2] * sp, nz = f.n[1] * sp + f.n[2] * cp;
        const wn = [nx * c + nz * s, ny, -nx * s + nz * c];
        const pts = f.q.map(([i, j, k]) => corner(i, j, k));
        const mid = pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
        if (wn[0] * (cam.x - mid[0]) + wn[1] * (cam.y - mid[1]) + wn[2] * (cam.z - mid[2]) <= 0) return;
        const light = 0.6 + 0.4 * Math.max(0, wn[0] * LIGHT[0] + wn[1] * LIGHT[1] + wn[2] * LIGHT[2]);
        list.push({ pts, colour, light, face: isHead && f.front ? b : null, depth: dep });
      });
    }
    function avatar(list, b, look){
      const sp = Math.hypot(b.vx || 0, b.vz || 0), air = (b.y || 0) > 0;
      const run = air ? 0.6 : Math.sin(b.walk || 0) * Math.min(1, sp / 5) * 0.8;
      part(list, b, -0.25, 0, 0, 0.48, 1, 0.48, look.pants, run);
      part(list, b, 0.25, 0, 0, 0.48, 1, 0.48, look.pants, -run);
      part(list, b, 0, 1, 0, 1, 1, 0.5, look.shirt, 0);
      // arms swing against the legs, go up when jumping, and reach forward when carrying
      part(list, b, -0.75, 1, 0, 0.48, 1, 0.48, look.head, air ? -2.6 : b.carry ? -1.3 : -run);
      part(list, b, 0.75, 1, 0, 0.48, 1, 0.48, look.head, air ? -2.6 : b.carry ? -1.3 : run);
      part(list, b, 0, 2, 0, 0.62, 0.6, 0.62, look.head, 0, true);
    }
    function paint(list){
      list.sort((p, q) => q.depth - p.depth);
      list.forEach(p => {
        if (!polyPath(p.pts)) return;
        ctx.fillStyle = shade(p.colour, p.light); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.stroke();
        if (p.face) drawFace(p.pts, p.face);
      });
    }
    // the classic smiley, painted on the front of the head (a flat mouth when body.sad)
    function drawFace(pts, b){
      const pos = (u, v) => {
        const bot = pts[0].map((x, i) => x + (pts[1][i] - x) * u), top = pts[3].map((x, i) => x + (pts[2][i] - x) * u);
        const p = bot.map((x, i) => x + (top[i] - x) * v);
        return at(...p);
      };
      const e1 = pos(0.33, 0.62), e2 = pos(0.67, 0.62), m = [0.25, 0.35, 0.5, 0.65, 0.75].map((u, i) => pos(u, 0.38 - Math.sin(i / 4 * Math.PI) * 0.12));
      if (!e1 || !e2 || m.some(p => !p)) return;
      const size = Math.max(1.2, Math.hypot(e2[0] - e1[0], e2[1] - e1[1]) * 0.18);
      ctx.fillStyle = "#1b1f2a";
      [e1, e2].forEach(e => { ctx.beginPath(); ctx.ellipse(e[0], e[1], size * 0.6, size, 0, 0, 7); ctx.fill(); });
      ctx.strokeStyle = "#1b1f2a"; ctx.lineWidth = Math.max(1, size * 0.6); ctx.lineCap = "round";
      ctx.beginPath(); m.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      if (b.sad) { ctx.beginPath(); ctx.moveTo(m[0][0], m[2][1]); ctx.lineTo(m[4][0], m[2][1]); }
      ctx.stroke(); ctx.lineCap = "butt";
    }
    function label(x, y, z, text, colour, maxSize){
      const sp = at(x, y, z);
      if (!sp) return;
      const size = Math.round(Math.max(10, Math.min(maxSize || 20, 220 / depth(x, y, z))));
      ctx.font = `800 ${size}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = "center";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.strokeText(text, sp[0], sp[1]);
      ctx.fillStyle = colour || "#fff"; ctx.fillText(text, sp[0], sp[1]);
    }
    function shadow(x, z, r, a){
      const pts = [];
      for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; pts.push([x + Math.cos(t) * r, 0.02, z + Math.sin(t) * r]); }
      if (polyPath(pts)) { ctx.fillStyle = `rgba(0,0,0,${a === undefined ? 0.3 : a})`; ctx.fill(); }
    }
    function sky(clock){
      const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
      g.addColorStop(0, "#3d8de0"); g.addColorStop(1, "#b9e1ff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let k = 0; k < 7; k++) {
        const x = ((k * 190 + clock * 6 - cam.a * 300) % (W + 300) + W + 300) % (W + 300) - 150, y = 20 + (k * 41) % 90;
        ctx.fillRect(x, y, 90 + (k % 3) * 30, 22); ctx.fillRect(x + 20, y - 14, 50, 16);
      }
      ctx.fillStyle = "#9fd0f5"; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    }

    return { cam, follow, camSpace, at, depth, polyPath, line3, shade, part, avatar, paint, label, shadow, sky, NEAR };
  };
})();
