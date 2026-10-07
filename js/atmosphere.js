/*
 * Time of day and weather: sky colours, light level, stars and moon, rain
 * and lightning. `compute` gives the palette for a moment; `Fx` holds the
 * per-run moving parts (raindrops, splashes, lightning).
 * Screen space is pixels (y down). No game logic here.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  // Palettes by sun altitude (sin of the sun's elevation; 0 at the horizon).
  const STOPS = [
    { alt: -0.35, sky: ['#03050c', '#0a1029', '#141a38', '#1e2547'], mesaFar: '#191a2c', mesaNear: '#141523', hills: '#101019', scrub: '#0b0b12', haze: '#1b2140', sun: null },
    { alt: -0.08, sky: ['#121a3a', '#3a3a66', '#91536a', '#d27552'], mesaFar: '#4c3d58', mesaNear: '#3c2f47', hills: '#2f2436', scrub: '#221a28', haze: '#a9606a', sun: '#ff9a62' },
    { alt: 0.12,  sky: ['#1d3557', '#5d6e93', '#d9a17b', '#f8dcaa'], mesaFar: '#a2849a', mesaNear: '#86687e', hills: '#6b5160', scrub: '#4a3944', haze: '#f3c48b', sun: '#fff1d2' },
    { alt: 0.55,  sky: ['#2f6fc4', '#6aa5e0', '#a9cdec', '#e3eef2'], mesaFar: '#c39f86', mesaNear: '#a98068', hills: '#8c6650', scrub: '#5f4634', haze: '#dfe7ea', sun: '#fffbe8' },
  ];
  const OVERCAST = { day: ['#59616d', '#77808c', '#8d959f', '#a3a9b0'], night: ['#07090e', '#0e1118', '#151922', '#1c212b'] };

  function lerpStop(alt) {
    let i = 0;
    while (i < STOPS.length - 2 && alt > STOPS[i + 1].alt) i++;
    const A = STOPS[i], B = STOPS[i + 1];
    const t = clamp((alt - A.alt) / (B.alt - A.alt), 0, 1);
    const out = { sky: A.sky.map((c, k) => mix(c, B.sky[k], t)) };
    for (const k of ['mesaFar', 'mesaNear', 'hills', 'scrub', 'haze']) out[k] = mix(A[k], B[k], t);
    out.sun = B.sun && A.sun ? mix(A.sun, B.sun, t) : B.sun || A.sun;
    return out;
  }

  // tod: hours (0..24). weather: from WheelieSim.createWeather. t: seconds into the run.
  function compute(tod, weather, t) {
    const sunAlt = Math.sin(((tod - 6) / 12) * Math.PI);
    const p = lerpStop(sunAlt);
    const overcast = weather.kind === 'storm' ? 0.9 : weather.kind === 'rain' ? 0.7 : 0;
    const dayness = smooth(-0.15, 0.25, sunAlt);
    if (overcast) {
      const oc = OVERCAST.day.map((c, k) => mix(OVERCAST.night[k], c, dayness));
      p.sky = p.sky.map((c, k) => mix(c, oc[k], overcast));
      for (const k of ['mesaFar', 'mesaNear', 'hills', 'scrub']) p[k] = mix(p[k], mix('#1a1d24', '#5a5f66', dayness), overcast * 0.45);
      p.haze = mix(p.haze, mix('#20252e', '#9aa1a8', dayness), overcast);
    }
    // ambient light: day 1, deep night ~0.12 (moonlight); cloud dims it
    const light = (0.12 + 0.88 * smooth(-0.25, 0.2, sunAlt)) * (1 - 0.3 * overcast);
    return {
      tod, sunAlt, overcast, light,
      sky: p.sky, mesaFar: p.mesaFar, mesaNear: p.mesaNear, hills: p.hills, scrub: p.scrub, haze: p.haze,
      sun: p.sun, sunVisible: sunAlt > -0.12 && overcast < 0.6,
      stars: (1 - smooth(-0.25, -0.02, sunAlt)) * (1 - overcast * 0.95),
      moon: sunAlt < 0.05 && overcast < 0.85,
      rain: weather.rain(t), wet: weather.wet,
      headlights: light < 0.62,
      dirtShade: 1 - (1 - light) * 0.15,
    };
  }

  /* ---------------- moving parts ---------------- */

  function createFx(seed) {
    let r = seed >>> 0;
    const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    return {
      rnd,
      drops: [],      // rain streaks, screen space
      splashes: [],
      flash: 0,       // lightning flash 0..1
      bolt: null,
      nextBolt: 6 + rnd() * 8,
      thunder: [],    // pending thunder (seconds until it rolls in)
    };
  }

  // speedPx: how fast the world scrolls past (px/s, positive = world moving left)
  function updateFx(fx, a, dt, w, h, scale, speed, weatherKind, groundY) {
    // rain: streaks falling at an angle set by the bike's speed
    const want = Math.round(a.rain * 260 * (w * h) / 900000);
    while (fx.drops.length < want) fx.drops.push({ x: fx.rnd() * w * 1.3, y: fx.rnd() * h - h, len: 10 + fx.rnd() * 16, v: 900 + fx.rnd() * 500 });
    if (fx.drops.length > want) fx.drops.length = want;
    const drift = -speed * scale * 0.35;
    for (const d of fx.drops) {
      d.y += d.v * dt;
      d.x += drift * dt;
      if (d.y > groundY(d.x) || d.x < -40 || d.x > w * 1.3 + 40) {
        if (d.y > 0 && d.x > 0 && d.x < w && fx.splashes.length < 80 && fx.rnd() < 0.35) fx.splashes.push({ x: d.x, y: groundY(d.x), t: 0 });
        d.y = -fx.rnd() * h * 0.3;
        d.x = drift < 0 ? fx.rnd() * w * 1.3 : -fx.rnd() * w * 0.3 + fx.rnd() * w;
      }
    }
    for (const s of fx.splashes) s.t += dt;
    fx.splashes = fx.splashes.filter((s) => s.t < 0.3);

    // lightning in storms
    fx.flash = Math.max(0, fx.flash - dt * 3.2);
    if (fx.bolt) { fx.bolt.t -= dt; if (fx.bolt.t <= 0) fx.bolt = null; }
    if (weatherKind === 'storm') {
      fx.nextBolt -= dt;
      if (fx.nextBolt <= 0) {
        fx.nextBolt = 5 + fx.rnd() * 10;
        fx.flash = 1;
        const x0 = w * (0.15 + fx.rnd() * 0.7);
        const pts = [[x0, 0]];
        let x = x0, y = 0;
        while (y < h * 0.45) { y += 12 + fx.rnd() * 30; x += (fx.rnd() - 0.5) * 50; pts.push([x, y]); }
        fx.bolt = { pts, t: 0.18 };
        fx.thunder.push(0.4 + fx.rnd() * 1.6);
      }
    }
    for (let i = 0; i < fx.thunder.length; i++) fx.thunder[i] -= dt;
  }

  function drawRain(ctx, fx, a, w, h, scale, speed) {
    if (!fx.drops.length) return;
    const tilt = clamp(-speed * 0.012, -0.9, 0.9);
    ctx.save();
    ctx.strokeStyle = a.light > 0.5 ? 'rgba(210,220,235,0.45)' : 'rgba(170,185,210,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of fx.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - tilt * d.len, d.y - d.len);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,220,235,0.5)';
    ctx.lineWidth = 1;
    for (const s of fx.splashes) {
      const r = 2 + s.t * 30;
      ctx.globalAlpha = 1 - s.t / 0.3;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r, r * 0.3, 0, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLightning(ctx, fx, w, h) {
    if (fx.bolt) {
      ctx.save();
      ctx.strokeStyle = 'rgba(235,240,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#bcd0ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      fx.bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(220,228,255,${(fx.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /* ---------------- lighting ---------------- */

  let lightCanvas = null, lctx = null;

  // lights: [{ kind: 'cone', x, y, angle, spread, len, power } | { kind: 'point', x, y, r, power, color }]
  function drawLighting(ctx, a, lights, w, h, dpr, horizon, flash) {
    const dark = clamp(1 - a.light - flash * 0.6, 0, 1);
    if (dark < 0.02) return;
    if (!lightCanvas) { lightCanvas = document.createElement('canvas'); lctx = lightCanvas.getContext('2d'); }
    if (lightCanvas.width !== Math.round(w * dpr) || lightCanvas.height !== Math.round(h * dpr)) {
      lightCanvas.width = Math.round(w * dpr);
      lightCanvas.height = Math.round(h * dpr);
    }
    const L = lctx;
    L.setTransform(dpr, 0, 0, dpr, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, w, h);
    // darker towards the ground; the sky keeps its own colour (and stars)
    const g = L.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(4,7,20,${(dark * 0.15).toFixed(3)})`);
    g.addColorStop(clamp(horizon / h, 0.05, 0.95), `rgba(4,7,20,${(dark * 0.62).toFixed(3)})`);
    g.addColorStop(1, `rgba(4,7,20,${(dark * 0.8).toFixed(3)})`);
    L.fillStyle = g;
    L.fillRect(0, 0, w, h);
    // cut the lights out of the darkness
    L.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      if (l.kind === 'cone') {
        const rg = L.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.len);
        rg.addColorStop(0, `rgba(0,0,0,${l.power})`);
        rg.addColorStop(0.6, `rgba(0,0,0,${l.power * 0.6})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = rg;
        L.beginPath();
        L.moveTo(l.x, l.y);
        L.arc(l.x, l.y, l.len, l.angle - l.spread, l.angle + l.spread);
        L.closePath();
        L.fill();
      }
      const pr = l.kind === 'cone' ? l.len * 0.18 : l.r;
      const rg = L.createRadialGradient(l.x, l.y, 0, l.x, l.y, pr);
      rg.addColorStop(0, `rgba(0,0,0,${l.power})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = rg;
      L.fillRect(l.x - pr, l.y - pr, pr * 2, pr * 2);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lightCanvas, 0, 0);
    ctx.restore();

    // additive glow: beams, lamps and the police light bar
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const col = l.color || '255,236,200';
      if (l.kind === 'cone') {
        const rg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.len);
        rg.addColorStop(0, `rgba(${col},${(0.22 * dark * l.power).toFixed(3)})`);
        rg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.arc(l.x, l.y, l.len, l.angle - l.spread * 0.8, l.angle + l.spread * 0.8);
        ctx.closePath();
        ctx.fill();
        const lamp = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 16);
        lamp.addColorStop(0, `rgba(255,250,235,${(0.9 * l.power).toFixed(3)})`);
        lamp.addColorStop(1, 'rgba(255,250,235,0)');
        ctx.fillStyle = lamp;
        ctx.fillRect(l.x - 16, l.y - 16, 32, 32);
      } else {
        const rg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        rg.addColorStop(0, `rgba(${col},${(l.glow ?? 0.5) * l.power})`);
        rg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
    }
    ctx.restore();
  }

  root.Atmo = { compute, createFx, updateFx, drawRain, drawLightning, drawLighting, mix, rgba, clamp };
})(typeof self !== 'undefined' ? self : this);
