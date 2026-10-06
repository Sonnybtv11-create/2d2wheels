/*
 * World drawing: a desert motocross track at golden hour. Screen space is
 * pixels (y down); the world is metres (y up). `view` converts between them.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const FONT = '"Saira Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';

  const SKY = [
    [0, '#1d3557'],
    [0.42, '#5d6e93'],
    [0.7, '#d9a17b'],
    [0.86, '#f3c48b'],
    [1, '#f8dcaa'],
  ];
  const LAYERS = {
    mesaFar: '#a2849a',
    mesaNear: '#86687e',
    hills: '#6b5160',
    scrub: '#4a3944',
  };
  const DIRT = { top: '#c88a55', surface: '#a8693f', mid: '#8a5233', deep: '#5b341f', rut: 'rgba(70,40,22,0.35)' };

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ---------------- sky & backdrop ---------------- */

  function drawSky(ctx, w, h, camX, horizon) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    for (const [t, c] of SKY) sky.addColorStop(t, c);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // low sun with a wide glow
    const sx = w * 0.74, sy = horizon * 0.8, sr = Math.max(28, Math.min(w, h) * 0.05);
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 9);
    glow.addColorStop(0, 'rgba(255,226,170,0.75)');
    glow.addColorStop(0.25, 'rgba(255,190,130,0.25)');
    glow.addColorStop(1, 'rgba(255,170,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fillStyle = '#fff1d2';
    ctx.fill();

    // long, thin evening clouds lit from below
    const shift = camX * 2;
    for (let i = -1; i < 7; i++) {
      const slot = Math.floor(shift / 360) + i;
      const x = slot * 360 - shift + hash(slot) * 200;
      const y = horizon * (0.12 + hash(slot + 9.1) * 0.45);
      const len = 120 + hash(slot + 3.3) * 220;
      const g = ctx.createLinearGradient(0, y - 8, 0, y + 8);
      g.addColorStop(0, 'rgba(255,214,190,0.0)');
      g.addColorStop(0.6, 'rgba(255,200,170,0.55)');
      g.addColorStop(1, 'rgba(240,150,130,0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, len, 5 + hash(slot + 1.1) * 6, 0, 0, TAU);
      ctx.ellipse(x + len * 0.35, y - 6, len * 0.45, 4, 0, 0, TAU);
      ctx.fill();
    }

    mesas(ctx, w, h, camX * 4, horizon - h * 0.02, h * 0.16, LAYERS.mesaFar, 1);
    haze(ctx, w, horizon, h * 0.12, 'rgba(243,196,139,0.35)');
    mesas(ctx, w, h, camX * 9, horizon + h * 0.01, h * 0.11, LAYERS.mesaNear, 2);
    haze(ctx, w, horizon + h * 0.02, h * 0.1, 'rgba(240,180,130,0.28)');
    hills(ctx, w, h, camX * 18, horizon + h * 0.06, h * 0.05, LAYERS.hills);
    scrub(ctx, w, camX * 18, horizon + h * 0.06, h * 0.05, h);
  }

  function haze(ctx, w, y, size, color) {
    const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.4);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, y - size, w, size * 1.4);
  }

  // Flat-topped mesas: stepped plateaus with sloped cliffs between them.
  function mesaY(u, seed, amp) {
    const seg = 220;
    const i = Math.floor(u / seg), f = u / seg - i;
    const lvl = (k) => {
      const r = hash(k * 1.7 + seed);
      return r < 0.3 ? 0 : r < 0.65 ? 0.55 : r < 0.9 ? 0.8 : 1;
    };
    const a = lvl(i), b = lvl(i + 1);
    const t = Math.max(0, Math.min(1, (f - 0.78) / 0.22));
    const s = t * t * (3 - 2 * t);
    return amp * (a + (b - a) * s) + Math.sin(u * 0.05 + seed) * amp * 0.02;
  }

  function mesas(ctx, w, h, shift, baseY, amp, color, seed) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 6; x += 6) ctx.lineTo(x, baseY - mesaY(x + shift, seed, amp));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function hills(ctx, w, h, shift, baseY, amp, color) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) {
      const u = x + shift;
      ctx.lineTo(x, baseY - amp * (0.6 * Math.sin(u * 0.004) + 0.3 * Math.sin(u * 0.011 + 1.3) + 0.4));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Creosote bushes and the odd joshua tree on the near ridge.
  function scrub(ctx, w, shift, baseY, amp, h) {
    ctx.fillStyle = LAYERS.scrub;
    const step = 46;
    for (let k = Math.floor(shift / step) - 1; k * step - shift < w + step; k++) {
      const r = hash(k * 3.1);
      if (r > 0.55) continue;
      const x = k * step - shift + hash(k) * step;
      const y = baseY - amp * (0.6 * Math.sin((x + shift) * 0.004) + 0.3 * Math.sin((x + shift) * 0.011 + 1.3) + 0.4) + 2;
      const s = h * 0.012 * (0.6 + hash(k + 0.3));
      if (r < 0.06) {
        // joshua tree: tapered trunk, upturned arms, spiky leaf clusters
        const arms = [[-0.9, -3.6, -1.6, -4.9], [0, -4.2, 0.2, -5.8], [0.8, -3.2, 1.7, -4.4]];
        ctx.strokeStyle = LAYERS.scrub;
        ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.42;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x, y - s * 3.4);
        ctx.stroke();
        ctx.lineWidth = s * 0.26;
        for (const [ax, ay, bx, by] of arms) {
          ctx.beginPath();
          ctx.moveTo(x, y - s * 2.9);
          ctx.quadraticCurveTo(x + ax * s, y + ay * s, x + bx * s, y + by * s);
          ctx.stroke();
          ctx.beginPath();
          for (let k = 0; k < 9; k++) {
            const t = (k / 9) * TAU, rr = k % 2 ? s * 0.25 : s * 0.62;
            ctx.lineTo(x + bx * s + Math.cos(t) * rr, y + by * s + Math.sin(t) * rr);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.ellipse(x, y, s * 1.6, s, 0, Math.PI, TAU);
        ctx.ellipse(x + s, y, s * 1.1, s * 0.8, 0, Math.PI, TAU);
        ctx.fill();
      }
    }
  }

  /* ---------------- track ---------------- */

  function drawTrackside(ctx, view, terrain) {
    // Course tape on stakes, set back from the racing line.
    const { scale, camX, toScreenY, w } = view;
    const x0 = camX - 2, x1 = camX + w / scale + 2;
    const gap = 6;
    const lift = scale * 0.06;
    const posts = [];
    for (let m = Math.floor(x0 / gap) * gap; m <= x1; m += gap) {
      posts.push([(m - camX) * scale, toScreenY(terrain.height(m)) - lift]);
    }
    ctx.lineCap = 'round';
    for (const [sx, sy] of posts) {
      ctx.fillStyle = '#5b4636';
      ctx.fillRect(sx - scale * 0.018, sy - scale * 0.85, scale * 0.036, scale * 0.85);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const [ax, ay] = posts[i], [bx, by] = posts[i + 1];
      ctx.beginPath();
      ctx.moveTo(ax, ay - scale * 0.72);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - scale * 0.6, bx, by - scale * 0.72);
      ctx.lineWidth = Math.max(1.5, scale * 0.035);
      ctx.strokeStyle = '#e8e2d6';
      ctx.stroke();
      ctx.setLineDash([scale * 0.18, scale * 0.18]);
      ctx.strokeStyle = '#d64528';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawGround(ctx, view, terrain) {
    const { w, h, scale, camX, toScreenY } = view;
    const x0 = camX - 1, x1 = camX + w / scale + 1;
    const step = Math.max(0.12, 3 / scale);
    const pts = [];
    for (let x = x0; x <= x1 + step; x += step) pts.push([(x - camX) * scale, toScreenY(terrain.height(x)), x]);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const [sx, sy] of pts) ctx.lineTo(sx, sy);
    ctx.lineTo(w, h);
    ctx.closePath();
    const top = toScreenY(terrain.height(camX + w / scale / 3));
    const dirt = ctx.createLinearGradient(0, top - scale * 0.3, 0, h);
    dirt.addColorStop(0, DIRT.surface);
    dirt.addColorStop(0.18, DIRT.mid);
    dirt.addColorStop(1, DIRT.deep);
    ctx.fillStyle = dirt;
    ctx.fill();

    // strata bands following the surface
    ctx.save();
    ctx.clip();
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [sx, sy, x] = pts[i];
        const y = sy + scale * (0.55 * k + 0.12 * Math.sin(x * 0.7 + k * 2.1));
        if (i === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
      }
      ctx.lineWidth = scale * 0.05;
      ctx.strokeStyle = `rgba(60,32,18,${0.12 + k * 0.03})`;
      ctx.stroke();
    }
    // pebbles
    for (let i = Math.floor(x0 * 2); i <= x1 * 2; i++) {
      if (hash(i) > 0.4) continue;
      const x = i / 2 + hash(i + 0.5) * 0.5;
      const sx = (x - camX) * scale;
      const sy = toScreenY(terrain.height(x)) + scale * (0.12 + hash(i + 1.7) * 1.6);
      ctx.beginPath();
      ctx.ellipse(sx, sy, scale * (0.025 + hash(i + 2.2) * 0.035), scale * 0.02, 0, 0, TAU);
      ctx.fillStyle = hash(i + 4.4) > 0.5 ? 'rgba(212,170,120,0.35)' : 'rgba(55,30,16,0.35)';
      ctx.fill();
    }
    ctx.restore();

    // lit lip of the track and a rut line just below it
    ctx.beginPath();
    pts.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
    ctx.lineWidth = Math.max(2, scale * 0.06);
    ctx.strokeStyle = DIRT.top;
    ctx.stroke();
    ctx.beginPath();
    pts.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy + scale * 0.1) : ctx.moveTo(sx, sy + scale * 0.1)));
    ctx.lineWidth = Math.max(1, scale * 0.025);
    ctx.strokeStyle = DIRT.rut;
    ctx.setLineDash([scale * 0.9, scale * 0.25, scale * 0.3, scale * 0.4]);
    ctx.lineDashOffset = camX * scale;
    ctx.stroke();
    ctx.setLineDash([]);

    // dry grass tufts on the lip
    ctx.strokeStyle = 'rgba(120,96,52,0.9)';
    ctx.lineWidth = Math.max(1, scale * 0.012);
    for (let i = Math.floor(x0 * 1.5); i <= x1 * 1.5; i++) {
      if (hash(i + 7.7) > 0.2) continue;
      const x = i / 1.5;
      const sx = (x - camX) * scale, sy = toScreenY(terrain.height(x));
      ctx.beginPath();
      for (let j = -2; j <= 2; j++) {
        ctx.moveTo(sx + j * scale * 0.02, sy);
        ctx.lineTo(sx + j * scale * 0.05, sy - scale * (0.1 + hash(i + j) * 0.08));
      }
      ctx.stroke();
    }

    // distance boards every 25 m
    for (let m = Math.ceil(x0 / 25) * 25; m <= x1; m += 25) {
      if (m <= 0) continue;
      drawBoard(ctx, (m - camX) * scale, toScreenY(terrain.height(m)), scale, `${m}`);
    }
  }

  function drawBoard(ctx, sx, sy, scale, label) {
    const pw = scale * 0.05, ph = scale * 1.2;
    ctx.fillStyle = '#3c2f26';
    ctx.fillRect(sx - pw / 2, sy - ph, pw, ph);
    const bw = scale * 0.62, bh = scale * 0.36;
    const bx = sx - bw / 2, by = sy - ph - bh * 0.6;
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by + bh - scale * 0.05, bw, scale * 0.05);
    ctx.font = `800 ${Math.round(bh * 0.72)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1a1c';
    ctx.fillText(label, sx, by + bh * 0.46);
    ctx.textBaseline = 'alphabetic';
  }

  function drawFlag(ctx, view, terrain, x, label, color) {
    const { scale, camX, toScreenY } = view;
    const sx = (x - camX) * scale;
    if (sx < -120 || sx > view.w + 120) return;
    const sy = toScreenY(terrain.height(x));
    const ph = scale * 1.9;
    ctx.fillStyle = '#222';
    ctx.fillRect(sx - 1.5, sy - ph, 3, ph);
    // chequered-edge pennant
    const fw = scale * 0.7, fh = scale * 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx + 1.5, sy - ph);
    ctx.lineTo(sx + fw, sy - ph + fh * 0.15);
    ctx.lineTo(sx + fw * 0.92, sy - ph + fh * 0.55);
    ctx.lineTo(sx + 1.5, sy - ph + fh);
    ctx.closePath();
    ctx.fill();
    ctx.font = `700 ${Math.max(12, Math.round(scale * 0.24))}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,14,10,0.6)';
    ctx.fillStyle = '#fff';
    ctx.strokeText(label, sx + 6, sy - ph - 6);
    ctx.fillText(label, sx + 6, sy - ph - 6);
  }

  function drawShadow(ctx, view, terrain, x, wb, theta) {
    const { scale, camX, toScreenY } = view;
    const len = wb * Math.cos(theta) + 0.3;
    const sx = (x - camX + len / 2 - 0.15) * scale;
    const sy = toScreenY(terrain.height(x + len / 2)) + scale * 0.02;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, len * scale * 0.6);
    g.addColorStop(0, 'rgba(40,20,10,0.45)');
    g.addColorStop(1, 'rgba(40,20,10,0)');
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.12);
    ctx.translate(-sx, -sy);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, len * scale * 0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(ctx, view, parts) {
    const { scale, camX, toScreenY } = view;
    for (const p of parts) {
      const a = Math.max(0, 1 - p.age / p.life) * p.a;
      if (p.spark) {
        ctx.beginPath();
        ctx.arc((p.x - camX) * scale, toScreenY(p.y), Math.max(1.2, p.r * scale), 0, TAU);
        ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`;
        ctx.fill();
        continue;
      }
      const x = (p.x - camX) * scale, y = toScreenY(p.y), r = p.r * scale * (1.4 + p.age * 2.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${p.c},${a.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(${p.c},${(a * 0.45).toFixed(3)})`);
      g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(20,10,20,0)');
    g.addColorStop(1, 'rgba(20,10,20,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Pitch dial: a quarter circle from 0° (flat) to 90° (vertical), with a
  // digital readout beside it. (cx, cy) is the dial's pivot.
  function drawGauge(ctx, cx, cy, r, theta, balance, crash, sweet) {
    const deg = Math.PI / 180;
    const a = (d) => Math.PI + d; // canvas angle: 0° points left, 90° points up
    ctx.save();
    // backing plate: rounded box around dial and readout
    const bx = cx - r * 1.3, by = cy - r * 1.3, bw = r * 2.45, bh = r * 1.48;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 10) : ctx.rect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(22,15,19,0.6)';
    ctx.fill();
    const arc = (from, to, color, width) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, a(from), a(to));
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    ctx.lineCap = 'butt';
    const bw2 = r * 0.14;
    arc(0, balance - 22 * deg, 'rgba(255,255,255,0.16)', bw2);
    arc(balance - 22 * deg, balance - 7 * deg, '#6fd38a', bw2);
    if (sweet) {
      ctx.save();
      ctx.shadowColor = '#ffc531';
      ctx.shadowBlur = r * 0.4;
      arc(balance - 7 * deg, balance + 2 * deg, '#ffd75e', bw2 * 1.9);
      ctx.restore();
    } else {
      arc(balance - 7 * deg, balance + 2 * deg, '#ffc531', bw2 * 1.4);
    }
    arc(balance + 2 * deg, crash, '#ff6a3d', bw2);
    arc(crash, 90 * deg, '#a3162a', bw2);
    // ticks inside the band
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    for (let d = 0; d <= 90; d += 10) {
      const t = a(d * deg), long = d % 30 === 0;
      ctx.lineWidth = long ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(t) * r * 0.84, cy + Math.sin(t) * r * 0.84);
      ctx.lineTo(cx + Math.cos(t) * r * (long ? 0.7 : 0.76), cy + Math.sin(t) * r * (long ? 0.7 : 0.76));
      ctx.stroke();
    }
    // needle
    const t = a(theta);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(t) * r * 1.06, cy + Math.sin(t) * r * 1.06);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // readout to the right of the pivot
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${Math.round(r * 0.17)}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(sweet ? 'SWEET ×2' : 'PITCH', cx + r * 0.16, cy - r * 0.62);
    ctx.font = `italic 800 ${Math.round(r * 0.46)}px ${FONT}`;
    ctx.fillStyle = theta > balance + 2 * deg ? '#ff6a3d' : sweet ? '#ffd75e' : '#fff';
    ctx.fillText(`${Math.round(theta / deg)}°`, cx + r * 0.14, cy - r * 0.16);
    ctx.restore();
  }


  /* ---------------- pickups, features, popups ---------------- */

  // Charge cells: a glowing orb with a lightning bolt. `heightOf(p)` gives
  // the cell's height above the ground for the current bike.
  function drawPickups(ctx, view, terrain, pickups, heightOf, t) {
    const { scale, camX, toScreenY, w } = view;
    const x0 = camX - 1, x1 = camX + w / scale + 1;
    const r = scale * 0.13;
    for (const p of pickups) {
      if (p.x < x0) continue;
      if (p.x > x1) break;
      if (p.got) continue;
      const sx = (p.x - camX) * scale;
      const sy = toScreenY(terrain.height(p.x) + heightOf(p));
      const dim = p.missed;
      const pulse = 1 + 0.12 * Math.sin(t * 6 + p.x);
      if (!dim) {
        const g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 2.6 * pulse);
        g.addColorStop(0, 'rgba(120,240,255,0.55)');
        g.addColorStop(1, 'rgba(120,240,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - r * 3, sy - r * 3, r * 6, r * 6);
      }
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.fillStyle = dim ? 'rgba(90,90,100,0.45)' : '#16313a';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.strokeStyle = dim ? 'rgba(160,160,170,0.5)' : '#7ff0ff';
      ctx.stroke();
      // bolt
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.15, sy - r * 0.7);
      ctx.lineTo(sx - r * 0.35, sy + r * 0.08);
      ctx.lineTo(sx + r * 0.02, sy + r * 0.08);
      ctx.lineTo(sx - r * 0.15, sy + r * 0.7);
      ctx.lineTo(sx + r * 0.38, sy - r * 0.12);
      ctx.lineTo(sx + r * 0.02, sy - r * 0.12);
      ctx.closePath();
      ctx.fillStyle = dim ? 'rgba(200,200,210,0.5)' : '#ffe55c';
      ctx.fill();
    }
  }

  // Mud patches on the surface and warning boards ahead of each feature.
  function drawFeatures(ctx, view, terrain) {
    const { scale, camX, toScreenY, w } = view;
    const x0 = camX - 15, x1 = camX + w / scale + 15;
    for (const f of terrain.features) {
      if (f.x1 < x0) continue;
      if (f.x0 - 12 > x1) break;
      if (f.type === 'mud') {
        ctx.beginPath();
        for (let x = f.x0; x <= f.x1; x += 0.25) {
          const sx = (x - camX) * scale, sy = toScreenY(terrain.height(x)) - scale * 0.01;
          if (x === f.x0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        for (let x = f.x1; x >= f.x0; x -= 0.25) {
          const edge = Math.min(1, (x - f.x0) / 1.2, (f.x1 - x) / 1.2);
          ctx.lineTo((x - camX) * scale, toScreenY(terrain.height(x)) + scale * (0.06 + 0.22 * edge));
        }
        ctx.closePath();
        ctx.fillStyle = '#4a2e1c';
        ctx.fill();
        // wet sheen
        ctx.beginPath();
        for (let x = f.x0 + 0.8; x <= f.x1 - 0.8; x += 0.25) {
          const sx = (x - camX) * scale, sy = toScreenY(terrain.height(x)) + scale * 0.02;
          if (x <= f.x0 + 0.8) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.lineWidth = Math.max(1, scale * 0.02);
        ctx.strokeStyle = 'rgba(255,220,180,0.35)';
        ctx.stroke();
      }
      drawSign(ctx, ((f.x0 - 10) - camX) * scale, toScreenY(terrain.height(f.x0 - 10)), scale, f.type === 'mud' ? 'MUD' : 'WHOOPS');
    }
  }

  function drawSign(ctx, sx, sy, scale, label) {
    const ph = scale * 1.1;
    ctx.fillStyle = '#3c2f26';
    ctx.fillRect(sx - scale * 0.025, sy - ph, scale * 0.05, ph);
    const d = scale * 0.32;
    const cy = sy - ph - d * 0.6;
    ctx.save();
    ctx.translate(sx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffc531';
    ctx.fillRect(-d / Math.SQRT2, -d / Math.SQRT2, d * Math.SQRT2, d * Math.SQRT2);
    ctx.lineWidth = Math.max(1.5, scale * 0.025);
    ctx.strokeStyle = '#1a1a1c';
    ctx.strokeRect(-d / Math.SQRT2 * 0.85, -d / Math.SQRT2 * 0.85, d * Math.SQRT2 * 0.85, d * Math.SQRT2 * 0.85);
    ctx.restore();
    ctx.font = `800 ${Math.max(9, Math.round(scale * 0.11))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1a1c';
    ctx.fillText(label, sx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // Floating score text anchored in the world.
  function drawPopups(ctx, view, popups) {
    const { scale, camX, toScreenY } = view;
    ctx.textAlign = 'center';
    for (const p of popups) {
      const a = Math.max(0, 1 - p.age / p.life);
      const sx = (p.x - camX) * scale, sy = toScreenY(p.y) - p.age * scale * 0.9;
      ctx.font = `italic 800 ${Math.round(scale * (p.big ? 0.34 : 0.26))}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(20,12,16,${0.55 * a})`;
      ctx.strokeText(p.text, sx, sy);
      ctx.fillStyle = p.color.replace('A', a.toFixed(3));
      ctx.fillText(p.text, sx, sy);
    }
  }

  root.Render = { FONT, drawSky, drawTrackside, drawGround, drawFlag, drawShadow, drawParticles, drawVignette, drawGauge, drawPickups, drawFeatures, drawPopups };
})(typeof self !== 'undefined' ? self : this);
