/*
 * Bike and rider art. Each bike was traced from a side-on product photo:
 * points are in that photo's pixel coordinates and get converted once, at
 * load, into metres in the bike's local frame (y up, origin at the rear
 * tyre's contact patch, rear axle at (0, R)). `ref` holds the calibration:
 * the pixel centres of both axles, the real wheelbase and the tyre radius.
 *
 * Reference photos:
 *   Stark Varg MX     - elmox.de product image (red), facing right
 *   Sur-Ron LBX       - radmotousa.com product image (green), mirrored and
 *                       vectorised into colour layers (js/traced/surron-lbx.js)
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const FORK_RAKE = 25 * Math.PI / 180;

  /* ------------------------------------------------------------------ */
  /* Traced art                                                          */
  /* ------------------------------------------------------------------ */

  const ART = {
    'stark-varg-mx': {
      ref: { rear: [140, 447], front: [556, 445], wheelbase: 1.48, tyre: 98 },
      pal: {
        body: '#d4111c', body2: '#8f0a12', seat: '#26272b', frame: '#1c1d20', metal: '#c9ccd1',
        dark: '#202125', battery: '#2b2d31', rim: '#1d1e21', spoke: '#c4c7cc', accent: '#ffffff',
        forkUp: '#b8935a', forkLow: '#18191b', spring: '#e8e9eb', shockBody: '#2a2b2f', chain: '#8c8f94', sprocket: '#3a3c40',
      },
      traced: 'stark-varg-mx', paint: 'r',
      sprocket: 34, drive: [287, 404], driveR: 9,
      style: {
        rim: '#1a1b1e', spoke: '#c4c7cc', hub: '#c9ccd1', sprocket: '#7d8187', chain: '#8c8f94',
        tyre: { tread: 'mx' }, disc: { style: 'wave' }, caliper: { c: '#2b2d31', pistons: 2 },
        fork: { upper: '#b8935a', stanchion: '#4a3f2c', guard: '#18191b', clamp: '#2a2b2f' },
        shock: { spring: '#26272b', body: '#b9bdc3', collar: '#3b3d42' },
        motor: { cover: '#c9ccd1', hub: '#9ea2a8' },
        battery: {},
        light: { type: 'none' },
        bars: { c: '#1c1d20' },
      },
      parts: [
        { k: 'chain' },
        { k: 'shock', a: [272, 402], b: [258, 340], w: 13 },
        { k: 'traced' },
        { k: 'battery', clip: [[340, 316], [414, 321], [418, 348], [410, 420], [392, 440], [340, 440]], badge: [384, 334] },
        { k: 'motor', at: [316, 386], r: 36, shape: 'oval' },
        { k: 'fork', top: [432, 196], axle: [556, 445], split: 0.58, guard: 0.4, lower: 0.24, wUp: 18, wLow: 15 },
        { k: 'plate', p: [[440, 203], [462, 200], [494, 244], [472, 252], [452, 242]] },
        { k: 'lamp', at: [474, 224], angle: -0.15, mount: [446, 214] },
        { k: 'bars', clamp: [434, 194], grip: [388, 190], c: 'frame' },
      ],
      rider: { hip: [290, 246], peg: [284, 426], grip: [392, 189] },
      light: [486, 222], // the MX bike has no lamp; a light kit fits on the plate
      kit: { jersey: '#d4111c', jersey2: '#ffffff', pants: '#1f2024', pants2: '#d4111c', helmet: '#f4f4f4', helmet2: '#d4111c', visor: '#1b1c20', lens: '#ff8a3d', boots: '#f2f2f2', gloves: '#1f2024' },
    },

    'surron-lbx': {
      // Body and frame come from the vectorised photo in js/traced/surron-lbx.js;
      // these parts fill in what the wheels hide (swingarm end, fork legs, chain).
      ref: { rear: [284, 870], front: [1334, 868], wheelbase: 1.26, tyre: 259 },
      traced: 'surron-lbx', paint: 'g',
      pal: {
        rim: '#1a1b1e', spoke: '#c4c7cc', chain: '#b08d52', sprocket: '#c2a46a',
        forkUp: '#c69f6c', forkLow: '#1c1d20', spring: '#c69f6c', shockBody: '#2a2b2f',
        dark: '#1b1c1f', metal: '#b9bdc3', body: '#7a8032', accent: '#e5db48',
      },
      sprocket: 92, drive: [766, 810], driveR: 22,
      style: {
        rim: '#1a1b1e', spoke: '#c4c7cc', hub: '#9ca0a6', sprocket: '#c2a46a', chain: '#b08d52',
        tyre: { tread: 'mx' }, disc: { style: 'wave' }, caliper: { c: '#2b2d31', pistons: 4 },
        fork: { upper: '#c69f6c', stanchion: '#d7dade', guard: '#1c1d20', clamp: '#2a2b2f', decal: '#e5db48' },
        shock: { spring: '#d9d9d4', body: '#2a2b2f', reservoir: '#b87333', collar: '#b87333' },
        motor: { cover: '#141517', ring: '#e5db48', dash: true },
        battery: {},
        light: { type: 'stock' },
        bars: { c: '#1b1c1f' },
      },
      parts: [
        { k: 'chain' },
        { k: 'poly', c: '#6c7230', paint: 0.35, p: [[250, 860], [300, 838], [420, 778], [540, 712], [600, 690], [660, 700], [690, 760], [660, 800], [560, 830], [420, 862], [300, 900], [258, 898]], smooth: 0.5 },
        { k: 'shock', a: [646, 694], b: [714, 530], w: 40 },
        { k: 'traced' },
        { k: 'controller', at: [560, 470], w: 90, h: 40, angle: -0.35 },
        { k: 'battery', badge: [842, 400] },
        { k: 'motor', at: [768, 806], r: 64 },
        { k: 'fork', top: [1050, 300], axle: [1334, 868], split: 0.61, guard: 0.34, lower: 0.18, wUp: 46, wLow: 40 },
        { k: 'lamp', at: [1132, 292], s: 1.25, mount: [1066, 300] },
        { k: 'bars', clamp: [1072, 262], grip: [1004, 228], c: 'dark' },
      ],
      rider: { hip: [590, 392], peg: [655, 855], grip: [1000, 228] },
      light: [1182, 292],
      kit: { jersey: '#f2f2ee', jersey2: '#8a9a2e', pants: '#4a4f57', pants2: '#c9d36a', helmet: '#f2f2ee', helmet2: '#8a9a2e', visor: '#1d1e21', lens: '#ffd34d', boots: '#f2f2ee', gloves: '#1d1e21' },
    },

  };

  /* ------------------------------------------------------------------ */
  /* Calibration: photo pixels -> local metres                          */
  /* ------------------------------------------------------------------ */

  function compile(art) {
    const { rear, front, wheelbase, tyre } = art.ref;
    const ppm = (front[0] - rear[0]) / wheelbase;
    const shear = (rear[1] - front[1]) / (front[0] - rear[0]);
    const R = tyre / ppm;
    const M = (pt) => [(pt[0] - rear[0]) / ppm, (rear[1] - (pt[1] + (pt[0] - rear[0]) * shear)) / ppm + R];
    const L = (px) => px / ppm;
    const out = { R, WB: wheelbase, pal: art.pal, kit: art.kit, style: art.style || {}, parts: [] };
    out.sprocketR = L(art.sprocket || 30);
    out.drive = M(art.drive);
    out.driveR = L(art.driveR || 10);
    for (const part of art.parts) {
      const q = Object.assign({}, part);
      if (q.p) q.p = q.p.map(M);
      if (q.clip) q.clip = q.clip.map(M);
      for (const key of ['at', 'a', 'b', 'top', 'axle', 'clamp', 'grip', 'badge', 'mount']) if (q[key]) q[key] = M(q[key]);
      if (q.k === 'fork') q.axle = [wheelbase, R];
      for (const key of ['r', 'w', 'h', 'wUp', 'wLow', 'gap']) if (typeof q[key] === 'number') q[key] = L(q[key]);
      out.parts.push(q);
    }
    out.rider = { hip: M(art.rider.hip), peg: M(art.rider.peg), grip: M(art.rider.grip) };
    out.light = M(art.light || art.rider.grip);
    if (art.traced) {
      const T = tracedData(art.traced);
      out.layers = T.layers.map((L) => {
        const rings = L.rings.map((r) => {
          const pts = [];
          for (let i = 0; i < r.length; i += 2) pts.push(M([r[i], r[i + 1]]));
          return pts;
        });
        let path = null;
        if (typeof Path2D !== 'undefined') {
          path = new Path2D();
          for (const ring of rings) {
            path.moveTo(ring[0][0], ring[0][1]);
            for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
            path.closePath();
          }
        }
        return { id: L.id, c: L.c, rings, path };
      });
      // Paint: the bodywork's shade bands, ranked dark to light, so a new
      // colour keeps the photo's lighting.
      if (art.paint) {
        const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); };
        const ps = out.layers.filter((L) => L.id.startsWith(art.paint));
        const ls = ps.map((L) => lum(L.c)), lo = Math.min(...ls), hi = Math.max(...ls);
        ps.forEach((L, i) => { L.paint = hi > lo ? (ls[i] - lo) / (hi - lo) : 0.5; });
      }
    }
    return out;
  }

  function tracedData(id) {
    if (root.TRACED && root.TRACED[id]) return root.TRACED[id];
    if (typeof require === 'function') return require(`./traced/${id}.js`);
    throw new Error(`missing traced art for ${id}`);
  }

  const COMPILED = {};
  for (const id in ART) COMPILED[id] = compile(ART[id]);

  /* ------------------------------------------------------------------ */
  /* Drawing helpers (all in metres, y up)                               */
  /* ------------------------------------------------------------------ */

  function col(pal, c) { return pal[c] || c; }

  // A colour along a dark-mid-light ramp, t in 0..1.
  function ramp(stops, t) {
    const seg = t < 0.5 ? 0 : 1, k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const a = parseInt(stops[seg].slice(1), 16), b = parseInt(stops[seg + 1].slice(1), 16);
    const mix = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k);
    return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
  }

  function shade(hex, amt) {
    // amt > 0 lightens towards white, < 0 darkens towards black
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  function tracePath(ctx, pts, smooth) {
    ctx.beginPath();
    if (!smooth) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      return;
    }
    // Rounded corners: run quadratic curves through edge midpoints, blended
    // with the raw polygon by `smooth`.
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const k = Math.min(1, smooth);
    let start = mid(pts[n - 1], pts[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], next = pts[(i + 1) % n], prev = pts[(i - 1 + n) % n];
      const a = lerp(p, mid(prev, p), k), b = lerp(p, mid(p, next), k);
      ctx.lineTo(a[0], a[1]);
      ctx.quadraticCurveTo(p[0], p[1], b[0], b[1]);
    }
    ctx.closePath();
  }

  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1 };
  }

  function fillShape(ctx, pts, color, opts = {}) {
    tracePath(ctx, pts, opts.smooth);
    ctx.save();
    if (opts.alpha) ctx.globalAlpha = opts.alpha;
    ctx.fillStyle = color;
    ctx.fill();
    if (opts.gloss) {
      // Light from above: a soft top highlight and a darker underside.
      const b = bbox(pts);
      const g = ctx.createLinearGradient(0, b.y1, 0, b.y0);
      g.addColorStop(0, `rgba(255,255,255,${0.32 * opts.gloss})`);
      g.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.28 * opts.gloss})`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = 'rgba(8,9,11,0.55)';
    ctx.stroke();
    ctx.restore();
  }

  function stroke(ctx, pts, w, color, cap = 'round') {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.lineCap = cap;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function circle(ctx, c, r, color) {
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* ------------------------------------------------------------------ */
  /* Wheels                                                              */
  /* ------------------------------------------------------------------ */

  // Tread patterns: knob count, width and height (m) of the big crown knobs.
  const TREADS = {
    mx: { n: 50, w: 0.02, h: 0.017, shoulder: true },      // intermediate motocross knobby
    soft: { n: 38, w: 0.022, h: 0.024, shoulder: true },   // soft / sand: taller, wider spaced
    mud: { n: 26, w: 0.026, h: 0.03, shoulder: false },    // mud: big paddles, lots of gap
    hard: { n: 64, w: 0.016, h: 0.012, shoulder: true },   // hard pack: low, dense blocks
    trials: { n: 80, w: 0.012, h: 0.009, shoulder: false },// trials: fine tread, soft rubber
  };

  function drawWheel(ctx, c, R, st, spin, blur, discR, sprocketR) {
    const [cx, cy] = c;
    const rimR = R * 0.76;
    const tyre = st.tyre || {};
    const T = TREADS[tyre.tread] || TREADS.mx;
    // tyre carcass: a ring, so the wheel stays see-through between the spokes
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.02, 0, TAU);
    ctx.arc(cx, cy, rimR + 0.008, 0, TAU, true);
    ctx.fillStyle = '#151618';
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    for (let i = 0; i < T.n; i++) {
      // slightly irregular blocks, like a worn knobby
      const j = Math.sin(i * 12.9898) * 43758.5453, n = j - Math.floor(j);
      const w = T.w * (1 + n * 0.5), h = T.h * (1 + (1 - n) * 0.45);
      ctx.save();
      ctx.rotate((i * TAU) / T.n);
      ctx.beginPath();
      ctx.moveTo(R - 0.018 - h * 0.1, -w / 2); ctx.lineTo(R - 0.02 + h, -w * 0.38); ctx.lineTo(R - 0.02 + h, w * 0.38); ctx.lineTo(R - 0.018 - h * 0.1, w / 2);
      ctx.closePath();
      ctx.fillStyle = n > 0.5 ? '#232428' : '#1f2023';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(R - 0.024 + h, -w * 0.38, 0.004, w * 0.76);
      if (T.shoulder) {
        ctx.rotate(TAU / T.n / 2);
        ctx.fillStyle = '#1c1d20';
        ctx.fillRect(R - 0.032, -0.008, 0.014, 0.016);
      }
      ctx.restore();
    }
    ctx.restore();
    // sidewall with a soft sheen on the upper half
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.85, 0, TAU);
    ctx.lineWidth = R * 0.15;
    ctx.strokeStyle = '#1f2023';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.87, Math.PI * 0.2, Math.PI * 0.8);
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();
    // sidewall lettering, as two coloured flashes that turn with the wheel
    if (tyre.wall) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.strokeStyle = tyre.wall;
      ctx.lineWidth = R * 0.045;
      for (const a0 of [0.3, Math.PI + 0.3]) {
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.86, a0, a0 + 0.55);
        ctx.stroke();
      }
      ctx.restore();
    }
    // rim
    ctx.beginPath();
    ctx.arc(cx, cy, rimR, 0, TAU);
    ctx.lineWidth = 0.022;
    ctx.strokeStyle = st.rim;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rimR - 0.006, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 0.004;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();
    // spokes (motion-blurred into a disc at speed)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.globalAlpha = 1 - 0.75 * blur;
    ctx.strokeStyle = st.spoke;
    ctx.lineWidth = 0.0032;
    ctx.beginPath();
    const spokes = 36;
    for (let i = 0; i < spokes; i++) {
      const a = (i * TAU) / spokes;
      const off = (i % 2 ? 1 : -1) * 0.5;
      ctx.moveTo(Math.cos(a) * 0.045, Math.sin(a) * 0.045);
      ctx.lineTo(Math.cos(a + off) * (rimR - 0.01), Math.sin(a + off) * (rimR - 0.01));
    }
    ctx.stroke();
    ctx.restore();
    if (blur > 0.05) {
      ctx.beginPath();
      ctx.arc(cx, cy, rimR - 0.012, 0, TAU);
      ctx.fillStyle = `rgba(190,194,200,${0.16 * blur})`;
      ctx.fill();
    }
    // sprocket sits behind the brake disc
    if (sprocketR) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.beginPath();
      const teeth = 44;
      for (let i = 0; i <= teeth * 2; i++) {
        const a = (i * TAU) / (teeth * 2);
        const r = i % 2 ? sprocketR : sprocketR - 0.007;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.moveTo(sprocketR * 0.55, 0);
      ctx.arc(0, 0, sprocketR * 0.55, 0, TAU, true);
      ctx.fillStyle = st.sprocket;
      ctx.fill();
      ctx.restore();
    }
    if (discR) drawDisc(ctx, discR, st.disc || {}, spin, cx, cy);
    // hub
    circle(ctx, c, 0.045, st.hub || '#9ca0a6');
    circle(ctx, c, 0.02, '#5d6167');
  }

  // Brake disc: wave (petal) or round, drilled, on a carrier to the hub.
  function drawDisc(ctx, r, d, spin, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    r *= d.scale || 1;
    ctx.beginPath();
    const waves = d.style === 'round' ? 0 : 12;
    if (waves) {
      for (let i = 0; i <= waves * 4; i++) {
        const a = (i * TAU) / (waves * 4);
        ctx.lineTo(Math.cos(a) * r * (i % 4 === 0 ? 0.94 : 1), Math.sin(a) * r * (i % 4 === 0 ? 0.94 : 1));
      }
      ctx.closePath();
    } else ctx.arc(0, 0, r, 0, TAU);
    ctx.moveTo(r * 0.7, 0);
    ctx.arc(0, 0, r * 0.7, 0, TAU, true);
    ctx.fillStyle = d.c || '#b9bdc3';
    ctx.fill();
    ctx.fillStyle = '#5f6369';
    for (let i = 0; i < 18; i++) {
      const a = (i * TAU) / 18;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84, 0.0045, 0, TAU);
      ctx.fill();
    }
    // carrier: a coloured spider on floating discs, plain spokes otherwise
    ctx.strokeStyle = d.carrier || '#8d9197';
    ctx.lineWidth = d.carrier ? 0.014 : 0.01;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      ctx.moveTo(Math.cos(a) * 0.04, Math.sin(a) * 0.04);
      ctx.lineTo(Math.cos(a + 0.3) * r * 0.72, Math.sin(a + 0.3) * r * 0.72);
    }
    ctx.stroke();
    if (d.carrier) {
      ctx.fillStyle = d.carrier;
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5 + 0.3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 0.006, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Brake caliper, fixed to the fork leg or swingarm, over the disc edge.
  function drawCaliper(ctx, at, ang, R, st) {
    const cal = st.caliper || {};
    const pistons = cal.pistons || 2;
    const len = 0.05 + pistons * 0.008;
    ctx.save();
    ctx.translate(at[0], at[1]);
    ctx.rotate(ang);
    ctx.translate(R, 0);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-0.018, -len / 2, 0.036, len, 0.01) : ctx.rect(-0.018, -len / 2, 0.036, len);
    ctx.fillStyle = cal.c || '#2b2d31';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-0.014, -len / 2 + 0.006, 0.006, len - 0.012);
    if (cal.label) {
      ctx.fillStyle = cal.label;
      ctx.fillRect(0.002, -len * 0.3, 0.008, len * 0.6);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Components (all restyled by the parts you fit)                      */
  /* ------------------------------------------------------------------ */

  // Upside-down fork: big outer tubes clamped at the top, the stanchions
  // sliding out of them, and a guard and axle foot at the bottom that move
  // with the wheel. A darker far leg sits just behind.
  function drawFork(ctx, q, st, axle, R) {
    const f = st.fork || {};
    const { top, wUp, wLow } = q;
    const axle0 = q.axle;
    const L0 = Math.hypot(axle0[0] - top[0], axle0[1] - top[1]);
    const ux = (axle0[0] - top[0]) / L0, uy = (axle0[1] - top[1]) / L0;
    const along = (p, d) => [p[0] + ux * d, p[1] + uy * d];
    const tubeEnd = along(top, L0 * q.split);
    const guardLen = L0 * (q.guard || 0.36);
    const guardTop = along(axle, -guardLen);
    const leg = (dx, dy, dim) => {
      const o = (p) => [p[0] + dx, p[1] + dy];
      const sh = (c) => (dim ? shade(c, -0.45) : c);
      // stanchion, visible between the outer tube and the guard
      stroke(ctx, [o(along(tubeEnd, -0.02)), o(guardTop)], wLow * 0.74, sh(f.stanchion || '#d7dade'), 'butt');
      // outer tube
      stroke(ctx, [o(top), o(tubeEnd)], wUp, sh(f.upper || '#c69f6c'), 'butt');
      if (!dim) {
        stroke(ctx, [o([top[0] - uy * wUp * 0.25, top[1] + ux * wUp * 0.25]), o([tubeEnd[0] - uy * wUp * 0.25, tubeEnd[1] + ux * wUp * 0.25])], wUp * 0.16, 'rgba(255,255,255,0.3)', 'butt');
        stroke(ctx, [o(along(tubeEnd, -0.012)), o(tubeEnd)], wUp * 1.04, shade(f.upper || '#c69f6c', -0.35), 'butt');
        if (f.ring) stroke(ctx, [o(along(top, L0 * 0.36)), o(along(top, L0 * 0.36 + 0.012))], wUp * 1.02, f.ring, 'butt');
      }
      // guard and axle foot
      stroke(ctx, [o(guardTop), o(along(axle, -0.01))], wLow, sh(f.guard || '#1c1d20'), 'butt');
      circle(ctx, o(axle), wLow * 0.62, sh(f.guard || '#1c1d20'));
      if (!dim && f.decal) stroke(ctx, [o(along(guardTop, guardLen * 0.35)), o(along(guardTop, guardLen * 0.55))], wLow * 0.42, f.decal, 'butt');
    };
    leg(-0.022, 0.012, true);
    leg(0, 0, false);
    // brake caliper behind the leg, at the disc's edge
    drawCaliper(ctx, axle, Math.atan2(uy, ux) + Math.PI * 0.62, R * 0.36, st);
    // triple clamps
    const clamp = (p, w) => {
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-w * 0.75, -0.016, w * 1.5, 0.032, 0.01) : ctx.rect(-w * 0.75, -0.016, w * 1.5, 0.032);
      ctx.fillStyle = f.clamp || '#2a2b2f';
      ctx.fill();
      ctx.restore();
    };
    clamp(along(top, 0.012), wUp);
    clamp(along(top, q.lower || 0.15), wUp);
  }

  // Rear shock between its frame mount (b) and its linkage (a). A coil over
  // a damper body, with a piggyback reservoir on some.
  function drawShock(ctx, q, st) {
    const sk = st.shock || {};
    const { a, b, w } = q;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    ctx.save();
    ctx.translate(a[0], a[1]);
    ctx.rotate(Math.atan2(dy, dx));
    if (sk.reservoir) {
      ctx.fillStyle = sk.reservoir;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(len * 0.55, w * 0.32, len * 0.4, w * 0.42, w * 0.2) : ctx.rect(len * 0.55, w * 0.32, len * 0.4, w * 0.42);
      ctx.fill();
    }
    // damper body and shaft
    ctx.fillStyle = sk.body || '#2a2b2f';
    ctx.fillRect(len * 0.42, -w * 0.3, len * 0.5, w * 0.6);
    ctx.fillStyle = '#c9ccd1';
    ctx.fillRect(len * 0.06, -w * 0.11, len * 0.4, w * 0.22);
    // coil (or an air can)
    if (sk.air) {
      ctx.fillStyle = sk.spring;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(len * 0.2, -w * 0.38, len * 0.5, w * 0.76, w * 0.3) : ctx.rect(len * 0.2, -w * 0.38, len * 0.5, w * 0.76);
      ctx.fill();
    } else {
      ctx.strokeStyle = sk.spring || '#c69f6c';
      ctx.lineWidth = w * 0.2;
      ctx.lineCap = 'round';
      const coils = 7, s0 = len * 0.16, s1 = len * 0.84;
      ctx.beginPath();
      for (let i = 0; i <= coils; i++) {
        const x = s0 + ((s1 - s0) * i) / coils;
        ctx.moveTo(x - w * 0.1, -w * 0.5);
        ctx.lineTo(x + w * 0.1, w * 0.5);
      }
      ctx.stroke();
      // spring seats
      ctx.fillStyle = sk.collar || '#3b3d42';
      ctx.fillRect(s0 - w * 0.12, -w * 0.58, w * 0.18, w * 1.16);
      ctx.fillRect(s1 - w * 0.06, -w * 0.58, w * 0.18, w * 1.16);
    }
    // eyes
    ctx.fillStyle = '#3b3d42';
    ctx.beginPath(); ctx.arc(0, 0, w * 0.42, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(len, 0, w * 0.42, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Motor cover: the round end of a mid-drive motor, or the Varg's cast cover.
  function drawMotor(ctx, q, st) {
    const m = st.motor || {};
    const [x, y] = q.at;
    const r = q.r * (m.scale || 1);
    ctx.save();
    if (q.shape === 'oval') {
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.72, r, 0, 0, TAU);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = m.cover || '#16171a';
    ctx.fill();
    const g = ctx.createLinearGradient(0, y + r, 0, y - r);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
    // accent ring (dashed on the Sur-Ron), cooling fins on big motors
    if (m.ring) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.68, 0, TAU);
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = m.ring;
      if (m.dash) ctx.setLineDash([r * 0.35, r * 0.18]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (m.fins) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = r * 0.06;
      for (let i = -3; i <= 3; i++) {
        const yy = y + i * r * 0.22;
        const half = Math.sqrt(Math.max(0, r * r * 0.7 - (yy - y) ** 2));
        ctx.beginPath(); ctx.moveTo(x - half, yy); ctx.lineTo(x + half, yy); ctx.stroke();
      }
    }
    circle(ctx, [x, y], r * 0.3, m.hub || '#2b2d31');
    circle(ctx, [x - r * 0.08, y + r * 0.08], r * 0.12, 'rgba(255,255,255,0.18)');
    if (m.label) {
      ctx.fillStyle = m.label;
      ctx.fillRect(x - r * 0.35, y - r * 0.62, r * 0.7, r * 0.12);
    }
    ctx.restore();
  }

  // Battery side: fins over the pack, and a badge for upgraded packs.
  function drawBattery(ctx, q, st) {
    const b = st.battery || {};
    if (q.clip) {
      tracePath(ctx, q.clip, false);
      ctx.save();
      ctx.clip();
      const bb = bbox(q.clip);
      ctx.fillStyle = b.c || 'rgba(0,0,0,0)';
      ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      ctx.strokeStyle = b.fins || 'rgba(10,11,13,0.55)';
      ctx.lineWidth = 0.008;
      ctx.beginPath();
      for (let y = bb.y0; y <= bb.y1; y += 0.018) { ctx.moveTo(bb.x0, y); ctx.lineTo(bb.x1, y + 0.01); }
      ctx.stroke();
      ctx.restore();
    }
    if (b.badge && q.badge) {
      const [x, y] = q.badge;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = b.badge;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-0.045, -0.018, 0.09, 0.036, 0.008) : ctx.rect(-0.045, -0.018, 0.09, 0.036);
      ctx.fill();
      ctx.fillStyle = b.badgeInk || '#111';
      ctx.fillRect(-0.032, -0.006, 0.064, 0.012);
      ctx.restore();
    }
  }

  // Aftermarket controller, where it shows: a finned box with a coloured lid.
  function drawController(ctx, q, st) {
    const c = st.controller;
    if (!c || !c.c) return;
    const [x, y] = q.at, w = q.w, h = q.h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(q.angle || 0);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.2) : ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = c.c;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = h * 0.12;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) { const xx = -w / 2 + (w * i) / 6; ctx.moveTo(xx, -h * 0.35); ctx.lineTo(xx, h * 0.35); }
    ctx.stroke();
    if (c.accent) { ctx.fillStyle = c.accent; ctx.fillRect(-w / 2, h * 0.28, w, h * 0.22); }
    ctx.restore();
  }

  // Front lamp: the bike's own lamp, a bar-mounted LED pod, or an LED bar.
  function drawLamp(ctx, q, st, lit) {
    const L = st.light || {};
    if (L.type === 'none') return;
    const [x, y] = q.at;
    // bracket back to the fork's top clamp
    if (q.mount) stroke(ctx, [q.mount, q.at], 0.014, '#202125');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(q.angle || 0);
    if (q.s) ctx.scale(q.s, q.s);
    const glow = lit ? 1 : 0;
    if (L.type === 'square' || L.type === 'pod') {
      // a square LED pod (big for the Squadron, small for the S1)
      const k = L.type === 'square' ? 1 : 0.72;
      ctx.scale(k, k);
      ctx.fillStyle = '#16171a';
      ctx.fillRect(-0.03, -0.012, 0.03, 0.024);
      ctx.fillStyle = L.housing || '#1d1e21';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-0.005, -0.045, 0.06, 0.09, 0.01) : ctx.rect(-0.005, -0.045, 0.06, 0.09);
      ctx.fill();
      ctx.fillStyle = L.type === 'pod' ? '#e8a23a' : glow ? '#fffbe8' : '#c9d3dc';
      ctx.fillRect(0.044, -0.038, 0.012, 0.076);
      if (L.back) { ctx.fillStyle = L.back; ctx.fillRect(-0.005, -0.045, 0.006, 0.09); }
    } else {
      // stock round lamp in a shell
      ctx.fillStyle = L.housing || '#18191c';
      ctx.beginPath();
      ctx.moveTo(-0.02, -0.035); ctx.lineTo(0.035, -0.04); ctx.lineTo(0.045, 0.04); ctx.lineTo(-0.02, 0.035);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = glow ? '#fff6dc' : '#aeb7c0';
      ctx.beginPath(); ctx.ellipse(0.042, 0, 0.008, 0.034, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Number plate on the front of the Varg (clear on this one).
  function drawPlate(ctx, q, st) {
    fillShape(ctx, q.p, (st.plate || 'rgba(235,238,242,0.88)'), { smooth: 0.6, gloss: 0.5 });
  }

  function drawChain(ctx, art, spin, st) {
    // Belt of links between the drive sprocket and the rear sprocket.
    const rear = art._dyn.rear, d = art.drive;
    const r1 = art.sprocketR * (st.sprocketScale || 1), r2 = art.driveR;
    const ang = Math.atan2(d[1] - rear[1], d[0] - rear[0]);
    const n = [-Math.sin(ang), Math.cos(ang)];
    const top = [[rear[0] + n[0] * r1, rear[1] + n[1] * r1], [d[0] + n[0] * r2, d[1] + n[1] * r2]];
    const bot = [[rear[0] - n[0] * r1, rear[1] - n[1] * r1], [d[0] - n[0] * r2, d[1] - n[1] * r2]];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]); ctx.lineTo(top[1][0], top[1][1]);
    ctx.moveTo(bot[0][0], bot[0][1]); ctx.lineTo(bot[1][0], bot[1][1]);
    ctx.lineWidth = 0.014;
    ctx.strokeStyle = '#2a2b2e';
    ctx.stroke();
    ctx.lineWidth = 0.008;
    ctx.strokeStyle = st.chain;
    ctx.setLineDash([0.008, 0.005]);
    ctx.lineDashOffset = -spin * art.R;
    ctx.stroke();
    ctx.restore();
    circle(ctx, d, r2, st.driveSprocket || st.sprocket);
  }

  function drawPattern(ctx, q, pal) {
    tracePath(ctx, q.clip, false);
    ctx.save();
    ctx.clip();
    const b = bbox(q.clip);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeStyle = col(pal, q.c);
    if (q.k === 'stripes') {
      ctx.translate(cx, cy);
      ctx.rotate((q.angle * Math.PI) / 180);
      ctx.lineWidth = q.w;
      ctx.beginPath();
      for (let x = -size; x <= size; x += q.gap) { ctx.moveTo(x, -size); ctx.lineTo(x, size); }
      ctx.stroke();
    } else if (q.k === 'fins') {
      ctx.lineWidth = q.gap * 0.45;
      ctx.beginPath();
      if (q.dir === 'v') for (let x = b.x0; x <= b.x1; x += q.gap) { ctx.moveTo(x, b.y0); ctx.lineTo(x, b.y1); }
      else for (let y = b.y0; y <= b.y1; y += q.gap) { ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); }
      ctx.stroke();
    } else if (q.k === 'blocks') {
      ctx.translate(cx, cy);
      ctx.rotate((q.angle * Math.PI) / 180);
      ctx.fillStyle = col(pal, q.c);
      const g = q.gap;
      for (let i = -8; i <= 8; i++) {
        for (let j = -8; j <= 8; j++) {
          if ((i * 7 + j * 3 + (i * j) % 5 + 40) % 4 === 0) continue; // irregular gaps, like the decal
          if ((i + j) % 2 === 0) ctx.fillRect(i * g, j * g, g * 0.92, g * 0.92);
        }
      }
    } else if (q.k === 'grid') {
      ctx.lineWidth = q.gap * 0.25;
      ctx.beginPath();
      for (let x = b.x0; x <= b.x1; x += q.gap) { ctx.moveTo(x, b.y0); ctx.lineTo(x + size * 0.3, b.y1); }
      for (let x = b.x0 - size * 0.3; x <= b.x1; x += q.gap) { ctx.moveTo(x, b.y1); ctx.lineTo(x + size * 0.3, b.y0); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPart(ctx, q, art, spin) {
    const pal = art.pal, st = art._st;
    switch (q.k) {
      case 'poly': fillShape(ctx, q.p, q.paint !== undefined && st.paint ? ramp(st.paint.ramp, q.paint) : col(pal, q.c), { smooth: q.smooth, gloss: q.gloss, alpha: q.alpha }); break;
      case 'fender':
        fillShape(ctx, q.p, col(pal, q.c), { smooth: 1, gloss: 0.8 });
        if (q.edge) stroke(ctx, q.p.slice(0, 4), 0.008, col(pal, q.edge));
        break;
      case 'line': {
        let pts = q.p;
        if (q.end === 'front') pts = [...pts.slice(0, -1), art._dyn.front];
        else if (q.move === 'front') pts = pts.map(([x, y]) => [x + art._dyn.shift[0], y + art._dyn.shift[1]]);
        stroke(ctx, pts, q.w, col(pal, q.c));
        break;
      }
      case 'circle': {
        const at = q.move === 'front' ? [q.at[0] + art._dyn.shift[0], q.at[1] + art._dyn.shift[1]] : q.at;
        circle(ctx, at, q.r, col(pal, q.c));
        break;
      }
      case 'ring':
        ctx.beginPath(); ctx.arc(q.at[0], q.at[1], q.r, 0, TAU);
        ctx.lineWidth = q.w; ctx.strokeStyle = col(pal, q.c); ctx.stroke();
        break;
      case 'rect':
        ctx.fillStyle = col(pal, q.c);
        ctx.fillRect(q.at[0], q.at[1] - q.h, q.w, q.h);
        break;
      case 'shock': drawShock(ctx, q, st); break;
      case 'chain': drawChain(ctx, art, spin, st); break;
      case 'fork': drawFork(ctx, q, st, art._dyn.front, art.R); break;
      case 'motor': drawMotor(ctx, q, st); break;
      case 'battery': drawBattery(ctx, q, st); break;
      case 'controller': drawController(ctx, q, st); break;
      case 'lamp': drawLamp(ctx, q, st, art._lit); break;
      case 'plate': drawPlate(ctx, q, st); break;
      case 'stripes': case 'fins': case 'grid': case 'blocks': drawPattern(ctx, q, pal); break;
      case 'traced':
        for (const L of art.layers) {
          ctx.fillStyle = st.paint && L.paint !== undefined ? ramp(st.paint.ramp, L.paint) : L.c;
          if (L.path) ctx.fill(L.path, 'evenodd');
        }
        break;
      case 'bars':
        stroke(ctx, [q.clamp, [q.clamp[0] - 0.02, q.clamp[1] + 0.03], q.grip], 0.024, (st.bars && st.bars.c) || col(pal, q.c));
        stroke(ctx, [[q.grip[0] + 0.035, q.grip[1] + 0.008], [q.grip[0] - 0.03, q.grip[1] - 0.006]], 0.034, '#101113');
        stroke(ctx, [[q.grip[0] + 0.03, q.grip[1] + 0.02], [q.grip[0] + 0.07, q.grip[1] + 0.005]], 0.008, '#2a2b2f');
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rider                                                               */
  /* ------------------------------------------------------------------ */

  const BODY = { thigh: 0.45, shin: 0.46, upper: 0.3, fore: 0.3, torso: 0.5 };

  function ik(a, b, l1, l2, sign) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4);
    const base = Math.atan2(dy, dx);
    const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    return [a[0] + Math.cos(base + sign * ang) * l1, a[1] + Math.sin(base + sign * ang) * l1];
  }

  function pose(art, lean) {
    const r = art.rider;
    // Leaning back slides the hips back on the seat and straightens the torso.
    const hip = [r.hip[0] - 0.1 * lean, r.hip[1] + 0.05 + 0.05 * Math.max(0, -lean)];
    const torsoAng = ((14 - 18 * lean) * Math.PI) / 180; // forward tilt from vertical
    const tdir = [Math.sin(torsoAng), Math.cos(torsoAng)];
    const fwd = [Math.cos(torsoAng), -Math.sin(torsoAng)];
    const shoulder = [hip[0] + tdir[0] * BODY.torso, hip[1] + tdir[1] * BODY.torso];
    const foot = [r.peg[0] + 0.02, r.peg[1] + 0.035];
    const knee = ik(hip, foot, BODY.thigh, BODY.shin, 1);
    const hand = r.grip;
    // Elbows up: the elbow sits out in front of the shoulder, as MX riders hold it.
    const elbow = ik(shoulder, hand, BODY.upper, BODY.fore, 1);
    const head = [shoulder[0] + tdir[0] * 0.25 + fwd[0] * 0.04, shoulder[1] + tdir[1] * 0.25 + fwd[1] * 0.04];
    return { hip, shoulder, head, foot, knee, hand, elbow, tdir, fwd, torsoAng };
  }

  const EDGE = 'rgba(10,11,13,0.45)';

  function limb(ctx, a, b, w0, w1, color, edge = true) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const an = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
    ctx.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
    ctx.arc(b[0], b[1], w1 / 2, an, an - Math.PI, true);
    ctx.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
    ctx.arc(a[0], a[1], w0 / 2, an + Math.PI, an, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (edge) { ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke(); }
  }

  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function drawLeg(ctx, p, kit, dim) {
    const k = (c) => (dim ? shade(c, -0.4) : c);
    // thigh, with the coloured side panel of the pants
    limb(ctx, p.hip, p.knee, 0.17, 0.125, k(kit.pants));
    if (!dim) limb(ctx, at(p.hip, p.knee, 0.15), at(p.hip, p.knee, 0.85), 0.05, 0.035, kit.pants2, false);
    limb(ctx, p.knee, p.foot, 0.115, 0.095, k(kit.pants));
    // knee brace
    ctx.beginPath();
    ctx.ellipse(p.knee[0], p.knee[1], 0.062, 0.054, 0, 0, TAU);
    ctx.fillStyle = dim ? '#1d1e21' : '#2f3136';
    ctx.fill();
    // MX boot: tall shaft, flat sole along the peg
    const top = at(p.knee, p.foot, 0.4);
    limb(ctx, top, p.foot, 0.125, 0.11, k(kit.boots));
    ctx.beginPath();
    ctx.moveTo(p.foot[0] - 0.08, p.foot[1] + 0.035);
    ctx.lineTo(p.foot[0] + 0.1, p.foot[1] + 0.02);
    ctx.quadraticCurveTo(p.foot[0] + 0.17, p.foot[1] - 0.005, p.foot[0] + 0.15, p.foot[1] - 0.05);
    ctx.lineTo(p.foot[0] - 0.09, p.foot[1] - 0.05);
    ctx.closePath();
    ctx.fillStyle = k(kit.boots);
    ctx.fill();
    ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke();
    stroke(ctx, [[p.foot[0] - 0.09, p.foot[1] - 0.05], [p.foot[0] + 0.15, p.foot[1] - 0.05]], 0.024, '#111214', 'butt');
    if (!dim) {
      for (let i = 0; i < 3; i++) {
        const c = at(top, p.foot, 0.2 + i * 0.27);
        const d = [p.foot[0] - top[0], p.foot[1] - top[1]], L = Math.hypot(d[0], d[1]);
        const n = [-d[1] / L, d[0] / L];
        stroke(ctx, [[c[0] + n[0] * 0.06, c[1] + n[1] * 0.06], [c[0] - n[0] * 0.06, c[1] - n[1] * 0.06]], 0.016, 'rgba(0,0,0,0.4)', 'butt');
      }
    }
  }

  function drawArm(ctx, p, kit, dim) {
    const k = (c) => (dim ? shade(c, -0.4) : c);
    limb(ctx, p.shoulder, p.elbow, 0.12, 0.095, k(kit.jersey));
    limb(ctx, p.elbow, p.hand, 0.095, 0.075, k(kit.jersey));
    if (!dim) limb(ctx, at(p.shoulder, p.elbow, 0.15), at(p.shoulder, p.elbow, 0.85), 0.035, 0.03, kit.jersey2, false);
    // glove
    ctx.beginPath();
    ctx.ellipse(p.hand[0] + 0.01, p.hand[1] + 0.005, 0.055, 0.045, 0, 0, TAU);
    ctx.fillStyle = k(kit.gloves);
    ctx.fill();
    ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke();
  }

  function drawTorso(ctx, p, kit) {
    const T = (u, v) => [p.hip[0] + p.tdir[0] * u + p.fwd[0] * v, p.hip[1] + p.tdir[1] * u + p.fwd[1] * v];
    // seat of the pants
    ctx.beginPath();
    ctx.ellipse(p.hip[0] - 0.02, p.hip[1] - 0.01, 0.15, 0.1, 0, 0, TAU);
    ctx.fillStyle = kit.pants;
    ctx.fill();
    ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke();
    // jersey over a chest protector: broad back, bulked chest
    const body = [T(-0.02, -0.15), T(0.22, -0.16), T(0.46, -0.13), T(0.56, -0.03), T(0.54, 0.09), T(0.42, 0.15), T(0.22, 0.14), T(0.04, 0.12)];
    fillShape(ctx, body, kit.jersey, { smooth: 0.9, gloss: 0.6 });
    // side panel and number board on the back
    fillShape(ctx, [T(0.1, -0.03), T(0.44, -0.05), T(0.46, -0.01), T(0.12, 0.01)], kit.jersey2, { smooth: 0.6 });
    fillShape(ctx, [T(0.38, 0.1), T(0.5, 0.06), T(0.54, 0.09), T(0.42, 0.15)], kit.jersey2, { smooth: 0.4 });
    // kidney belt
    limb(ctx, T(0.06, -0.15), T(0.06, 0.12), 0.06, 0.06, kit.pants, true);
    // neck brace bridging the shoulders and helmet
    limb(ctx, T(0.5, -0.02), T(0.62, 0.02), 0.15, 0.12, '#1f2024');
  }

  function drawHelmet(ctx, p, kit, pitch) {
    ctx.save();
    ctx.translate(p.head[0], p.head[1]);
    // keep the head roughly level as the bike pitches up
    ctx.rotate(-pitch * 0.55 - 0.12);
    ctx.lineWidth = 0.007;
    ctx.strokeStyle = EDGE;
    // shell
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.155, 0.145, 0, 0, TAU);
    ctx.fillStyle = kit.helmet;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = kit.helmet2;
    ctx.beginPath();
    ctx.moveTo(-0.22, 0.0); ctx.lineTo(0.02, 0.17); ctx.lineTo(0.11, 0.17); ctx.lineTo(-0.16, -0.05); ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0.15, 0, -0.15);
    g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(-0.2, -0.2, 0.4, 0.4);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.155, 0.145, 0, 0, TAU);
    ctx.stroke();
    // chin bar, jutting forward
    ctx.beginPath();
    ctx.moveTo(0.04, -0.05); ctx.lineTo(0.2, -0.04); ctx.quadraticCurveTo(0.235, -0.12, 0.14, -0.16); ctx.lineTo(0.0, -0.14); ctx.closePath();
    ctx.fillStyle = kit.helmet2;
    ctx.fill(); ctx.stroke();
    // mouthpiece vent
    stroke(ctx, [[0.17, -0.07], [0.2, -0.09]], 0.012, 'rgba(0,0,0,0.45)');
    // peak
    ctx.beginPath();
    ctx.moveTo(0.0, 0.11); ctx.lineTo(0.27, 0.09); ctx.lineTo(0.26, 0.055); ctx.lineTo(0.05, 0.055); ctx.closePath();
    ctx.fillStyle = kit.helmet;
    ctx.fill(); ctx.stroke();
    // goggles: strap, frame, tinted lens
    stroke(ctx, [[-0.15, 0.03], [0.08, 0.02]], 0.04, kit.visor, 'butt');
    ctx.beginPath();
    ctx.moveTo(0.07, 0.05); ctx.lineTo(0.18, 0.045); ctx.lineTo(0.18, -0.03); ctx.lineTo(0.07, -0.025); ctx.closePath();
    ctx.fillStyle = kit.visor;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.095, 0.036); ctx.lineTo(0.172, 0.033); ctx.lineTo(0.172, -0.018); ctx.lineTo(0.095, -0.014); ctx.closePath();
    const lg = ctx.createLinearGradient(0.095, 0.036, 0.172, -0.018);
    lg.addColorStop(0, kit.lens); lg.addColorStop(1, shade(kit.lens, -0.5));
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  // opts: { lean, spin, blur, rider (bool), pitch, frontOff, rearOff, style, lit }
  function drawBike(ctx, id, opts = {}) {
    const art = COMPILED[id];
    const spin = -(opts.spin || 0);
    const blur = opts.blur || 0;
    const lean = opts.lean || 0;
    const rider = opts.rider !== false;
    const p = rider ? pose(art, lean) : null;
    ctx.lineJoin = 'round';

    if (rider) {
      // far-side leg and arm, shaded, behind the bike
      const far = Object.assign({}, p, {
        knee: [p.knee[0] - 0.04, p.knee[1] + 0.02], foot: [p.foot[0] - 0.04, p.foot[1]],
        elbow: [p.elbow[0] - 0.05, p.elbow[1] + 0.03], hand: [p.hand[0] - 0.03, p.hand[1] + 0.015],
      });
      drawLeg(ctx, far, art.kit, true);
      drawArm(ctx, far, art.kit, true);
    }

    // Suspension: the rear wheel moves up and down against the chassis, the
    // front wheel slides along the fork. Offsets are from static sag,
    // positive towards the chassis.
    const fo = opts.frontOff || 0, ro = opts.rearOff || 0;
    const fu = [-Math.sin(FORK_RAKE), Math.cos(FORK_RAKE)];
    art._dyn = { front: [art.WB + fo * fu[0], art.R + fo * fu[1]], rear: [0, art.R + ro], shift: [fo * fu[0], fo * fu[1]] };
    const st = art._st = styleFor(art, opts.style);
    art._lit = !!opts.lit;
    const rearSt = Object.assign({}, st, { tyre: st.rearTyre || st.tyre, disc: st.rearDisc || st.disc });
    drawWheel(ctx, art._dyn.rear, art.R, rearSt, spin, blur, art.R * 0.32, art.sprocketR * (st.sprocketScale || 1));
    drawCaliper(ctx, art._dyn.rear, Math.PI * 0.9, art.R * 0.3, rearSt);
    drawWheel(ctx, art._dyn.front, art.R, st, opts.frontSpin !== undefined ? -opts.frontSpin : spin, blur, art.R * 0.38, 0);
    for (const q of art.parts) drawPart(ctx, q, art, spin);

    if (rider) {
      drawTorso(ctx, p, art.kit);
      drawLeg(ctx, p, art.kit, false);
      drawArm(ctx, p, art.kit, false);
      drawHelmet(ctx, p, art.kit, opts.pitch || 0);
    }
  }

  // The bike's stock look, with any fitted parts' looks laid over it (one
  // level deep: { fork: { upper } } replaces just the fork's upper colour).
  function styleFor(art, extra) {
    const out = {};
    for (const k in art.style) out[k] = typeof art.style[k] === 'object' && art.style[k] ? Object.assign({}, art.style[k]) : art.style[k];
    if (extra) {
      for (const k in extra) {
        const v = extra[k];
        out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? Object.assign(out[k], v) : v;
      }
    }
    return out;
  }

  // A rider on their own, for the crash tumble. Drawn around the hip.
  function drawLooseRider(ctx, id) {
    const art = COMPILED[id];
    const p = pose(art, 0.6);
    ctx.translate(-p.hip[0], -p.hip[1]);
    drawLeg(ctx, Object.assign({}, p, { knee: [p.knee[0] - 0.05, p.knee[1]] }), art.kit, true);
    drawTorso(ctx, p, art.kit);
    drawLeg(ctx, p, art.kit, false);
    drawArm(ctx, p, art.kit, false);
    drawHelmet(ctx, p, art.kit, 0);
  }

  function info(id) {
    const art = COMPILED[id];
    const p = pose(art, 0);
    return { R: art.R, WB: art.WB, hip: p.hip, light: art.light };
  }

  const api = { drawBike, drawLooseRider, info, ART, COMPILED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BikeArt = api;
})(typeof self !== 'undefined' ? self : this);
