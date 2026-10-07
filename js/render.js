/*
 * World drawing: a desert motocross track at golden hour. Screen space is
 * pixels (y down); the world is metres (y up). `view` converts between them.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const FONT = '"Saira Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';

  const DIRT = { top: '#c88a55', surface: '#a8693f', mid: '#8a5233', deep: '#5b341f', rut: 'rgba(70,40,22,0.35)' };
  const shadeHex = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ---------------- sky & backdrop ---------------- */

  // a: palette and conditions from Atmo.compute. t: seconds (for twinkle and drift).
  function drawSky(ctx, w, h, camX, horizon, a, t) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, a.sky[0]);
    sky.addColorStop(0.45, a.sky[1]);
    sky.addColorStop(0.8, a.sky[2]);
    sky.addColorStop(1, a.sky[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // stars, twinkling, drifting slowly
    if (a.stars > 0.02) {
      for (let i = 0; i < 140; i++) {
        const x = ((hash(i) * w * 1.5 - camX * 0.6) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * 0.25;
        const y = hash(i + 0.37) * horizon * 0.85;
        const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + hash(i + 2) * 3) + i);
        ctx.fillStyle = `rgba(235,240,255,${(a.stars * tw * (0.35 + hash(i + 5) * 0.65)).toFixed(3)})`;
        const r = hash(i + 9) > 0.92 ? 1.6 : 0.9;
        ctx.fillRect(x, y, r, r);
      }
    }
    // moon
    if (a.moon) {
      const mx = w * 0.22, my = horizon * 0.28, mr = Math.max(14, Math.min(w, h) * 0.03);
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
      mg.addColorStop(0, `rgba(210,220,255,${(0.25 * a.stars).toFixed(3)})`);
      mg.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.fillStyle = `rgba(240,240,230,${(0.35 + 0.65 * a.stars).toFixed(3)})`;
      ctx.fill();
      ctx.fillStyle = 'rgba(160,160,170,0.25)';
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.4, 0.12]]) {
        ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill();
      }
    }
    // sun: sits on the horizon at sunset, higher in the day
    if (a.sunVisible) {
      const sx = w * 0.74, sy = horizon - Math.max(-0.05, a.sunAlt) * horizon * 1.1 - horizon * 0.06;
      const sr = Math.max(26, Math.min(w, h) * 0.05);
      const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 9);
      glow.addColorStop(0, Atmo.rgba(a.sun, 0.7));
      glow.addColorStop(0.25, Atmo.rgba(a.sun, 0.22));
      glow.addColorStop(1, Atmo.rgba(a.sun, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fillStyle = a.sun;
      ctx.fill();
    }

    // clouds: thin streaks in fair weather, a heavy deck when it rains;
    // they drift slowly
    const drift = camX * 2 + t * 4;
    const heavy = a.overcast;
    const lit = Atmo.mix(a.sky[3], '#ffffff', 0.25);
    const n = heavy > 0.3 ? 9 : 7;
    for (let i = -1; i < n; i++) {
      const slot = Math.floor(drift / 360) + i;
      const x = slot * 360 - drift + hash(slot) * 200;
      const y = horizon * (0.08 + hash(slot + 9.1) * (heavy > 0.3 ? 0.35 : 0.45));
      const len = (120 + hash(slot + 3.3) * 220) * (1 + heavy);
      const thick = (5 + hash(slot + 1.1) * 6) * (1 + heavy * 5);
      const g = ctx.createLinearGradient(0, y - thick, 0, y + thick);
      g.addColorStop(0, Atmo.rgba(heavy > 0.3 ? Atmo.mix(a.sky[0], '#000000', 0.2) : lit, 0));
      g.addColorStop(0.6, Atmo.rgba(heavy > 0.3 ? Atmo.mix(a.sky[1], '#000000', 0.25) : lit, 0.5 + heavy * 0.4));
      g.addColorStop(1, Atmo.rgba(heavy > 0.3 ? Atmo.mix(a.sky[2], '#000000', 0.3) : Atmo.mix(lit, a.sky[2], 0.5), 0.35 + heavy * 0.5));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, len, thick, 0, 0, TAU);
      ctx.ellipse(x + len * 0.35, y - thick * 0.8, len * 0.45, thick * 0.8, 0, 0, TAU);
      ctx.fill();
    }

    mesas(ctx, w, h, camX * 4, horizon - h * 0.02, h * 0.16, a.mesaFar, 1);
    haze(ctx, w, horizon, h * 0.12, Atmo.rgba(a.haze, 0.35 + a.rain * 0.25));
    mesas(ctx, w, h, camX * 12, horizon + h * 0.01, h * 0.11, a.mesaNear, 2);
    haze(ctx, w, horizon + h * 0.02, h * 0.1, Atmo.rgba(a.haze, 0.28 + a.rain * 0.25));
    hills(ctx, w, h, camX * 30, horizon + h * 0.06, h * 0.05, a.hills);
    scrub(ctx, w, camX * 30, horizon + h * 0.06, h * 0.05, h, a.scrub);
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
  function scrub(ctx, w, shift, baseY, amp, h, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const step = 46;
    for (let k = Math.floor(shift / step) - 1; k * step - shift < w + step; k++) {
      const r = hash(k * 3.1);
      if (r > 0.55) continue;
      const x = k * step - shift + hash(k) * step;
      const y = baseY - amp * (0.6 * Math.sin((x + shift) * 0.004) + 0.3 * Math.sin((x + shift) * 0.011 + 1.3) + 0.4) + 2;
      const s = h * 0.012 * (0.6 + hash(k + 0.3));
      ctx.save();
      ctx.translate(x, y);
      if (r < 0.06) {
        // joshua tree: tapered trunk, upturned arms, spiky leaf clusters
        const arms = [[-0.9, -3.6, -1.6, -4.9], [0, -4.2, 0.2, -5.8], [0.8, -3.2, 1.7, -4.4]];
        ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.42;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -s * 3.4);
        ctx.stroke();
        ctx.lineWidth = s * 0.26;
        for (const [ax, ay, bx, by] of arms) {
          ctx.beginPath();
          ctx.moveTo(0, -s * 2.9);
          ctx.quadraticCurveTo(ax * s, ay * s, bx * s, by * s);
          ctx.stroke();
          ctx.beginPath();
          for (let q = 0; q < 9; q++) {
            const a2 = (q / 9) * TAU, rr = q % 2 ? s * 0.25 : s * 0.62;
            ctx.lineTo(bx * s + Math.cos(a2) * rr, by * s + Math.sin(a2) * rr);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.6, s, 0, Math.PI, TAU);
        ctx.ellipse(s, 0, s * 1.1, s * 0.8, 0, Math.PI, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ---------------- track ---------------- */

  // Course tape on stakes, set back from the racing line, sagging a little
  // between them.
  function drawTrackside(ctx, view, terrain) {
    const { scale, camX, toScreenY, w } = view;
    const x0 = camX - 2, x1 = camX + w / scale + 2;
    const gap = 6;
    const lift = scale * 0.06;
    const posts = [];
    for (let m = Math.floor(x0 / gap) * gap; m <= x1; m += gap) {
      posts.push([(m - camX) * scale, toScreenY(terrain.surface(m)) - lift, m]);
    }
    ctx.lineCap = 'round';
    const smear = Math.min(scale * 0.4, (view.speed || 0) * scale * 0.008);
    for (const [sx, sy] of posts) {
      if (smear > 2) {
        ctx.fillStyle = 'rgba(91,70,54,0.35)';
        ctx.fillRect(sx - scale * 0.018, sy - scale * 0.85, scale * 0.036 + smear, scale * 0.85);
      }
      ctx.fillStyle = '#5b4636';
      ctx.fillRect(sx - scale * 0.018, sy - scale * 0.85, scale * 0.036, scale * 0.85);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const [ax, ay] = posts[i], [bx, by] = posts[i + 1];
      ctx.beginPath();
      ctx.moveTo(ax, ay - scale * 0.72);
      ctx.bezierCurveTo(ax + (bx - ax) * 0.33, (ay + by) / 2 - scale * 0.62,
        ax + (bx - ax) * 0.66, (ay + by) / 2 - scale * 0.62, bx, by - scale * 0.72);
      ctx.lineWidth = Math.max(1.5, scale * 0.035);
      ctx.strokeStyle = '#e8e2d6';
      ctx.stroke();
      ctx.setLineDash([scale * 0.18, scale * 0.18]);
      ctx.strokeStyle = '#d64528';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawGround(ctx, view, terrain, a) {
    const { w, h, scale, camX, toScreenY } = view;
    const x0 = camX - 1, x1 = camX + w / scale + 1;
    const step = Math.max(0.12, 3 / scale);
    const pts = [];
    for (let x = x0; x <= x1 + step; x += step) pts.push([(x - camX) * scale, toScreenY(terrain.surface(x)), x]);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const [sx, sy] of pts) ctx.lineTo(sx, sy);
    ctx.lineTo(w, h);
    ctx.closePath();
    const top = toScreenY(terrain.surface(camX + w / scale / 3));
    const dirt = ctx.createLinearGradient(0, top - scale * 0.3, 0, h);
    const wetK = 1 - a.wet * 0.32; // wet dirt is darker
    dirt.addColorStop(0, shadeHex(DIRT.surface, wetK));
    dirt.addColorStop(0.18, shadeHex(DIRT.mid, wetK));
    dirt.addColorStop(1, shadeHex(DIRT.deep, wetK));
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
    for (let i = Math.floor(x0 * 3); i <= x1 * 3; i++) {
      if (hash(i) > 0.55) continue;
      const x = i / 3 + hash(i + 0.5) * 0.33;
      const sx = (x - camX) * scale;
      const sy = toScreenY(terrain.surface(x)) + scale * (0.12 + hash(i + 1.7) * 1.6);
      // smeared into streaks at speed
      const smear = Math.min(scale * 0.5, (view.speed || 0) * scale * 0.006);
      ctx.beginPath();
      ctx.ellipse(sx + smear / 2, sy, scale * (0.025 + hash(i + 2.2) * 0.035) + smear, scale * 0.02, 0, 0, TAU);
      ctx.fillStyle = hash(i + 4.4) > 0.5 ? 'rgba(222,180,130,0.5)' : 'rgba(50,26,14,0.5)';
      ctx.fill();
    }
    ctx.restore();

    // lit lip of the track and a rut line just below it
    ctx.beginPath();
    pts.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
    ctx.lineWidth = Math.max(2, scale * 0.06);
    ctx.strokeStyle = shadeHex(DIRT.top, wetK);
    ctx.stroke();
    if (a.wet > 0) {
      // a wet sheen picking up the sky
      ctx.lineWidth = Math.max(1, scale * 0.018);
      ctx.strokeStyle = Atmo.rgba(a.sky[2], 0.35 * a.wet);
      ctx.stroke();
    }
    ctx.beginPath();
    pts.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy + scale * 0.1) : ctx.moveTo(sx, sy + scale * 0.1)));
    ctx.lineWidth = Math.max(1.5, scale * 0.03);
    ctx.strokeStyle = 'rgba(60,32,16,0.55)';
    ctx.setLineDash([scale * 0.9, scale * 0.25, scale * 0.3, scale * 0.4]);
    ctx.lineDashOffset = camX * scale;
    ctx.stroke();
    ctx.setLineDash([]);

    // loose gravel along the racing line: small, high-contrast flecks the
    // eye can track as they stream past
    for (let i = Math.floor(x0 * 5); i <= x1 * 5; i++) {
      if (hash(i + 3.3) > 0.5) continue;
      const x = i / 5 + hash(i + 0.9) * 0.2;
      const sx = (x - camX) * scale;
      const sy = toScreenY(terrain.surface(x)) + scale * (0.03 + hash(i + 5.1) * 0.22);
      const smear = Math.min(scale * 0.3, (view.speed || 0) * scale * 0.004);
      ctx.fillStyle = hash(i + 6.6) > 0.45 ? 'rgba(236,200,150,0.75)' : 'rgba(45,24,12,0.65)';
      ctx.fillRect(sx, sy, Math.max(2, scale * 0.025) + smear, Math.max(1.5, scale * 0.018));
    }

    // dry grass tufts on the lip
    ctx.strokeStyle = 'rgba(120,96,52,0.9)';
    ctx.lineWidth = Math.max(1, scale * 0.012);
    for (let i = Math.floor(x0 * 1.5); i <= x1 * 1.5; i++) {
      if (hash(i + 7.7) > 0.2) continue;
      const x = i / 1.5;
      const sx = (x - camX) * scale, sy = toScreenY(terrain.surface(x));
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
      drawBoard(ctx, (m - camX) * scale, toScreenY(terrain.surface(m)), scale, `${m}`);
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

  // Darker edges; tighter and darker at speed, like tunnel vision.
  function drawVignette(ctx, w, h, fast = 0) {
    const g = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * (0.35 - 0.08 * fast), w / 2, h * 0.55, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(20,10,20,0)');
    g.addColorStop(1, `rgba(20,10,20,${(0.35 + 0.2 * fast).toFixed(3)})`);
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


  /* ---------------- features, obstacles, police, popups ---------------- */

  // Mud and puddles on the surface, and warning boards ahead of features.
  function drawFeatures(ctx, view, terrain, a, t) {
    const { scale, camX, toScreenY, w } = view;
    const x0 = camX - 15, x1 = camX + w / scale + 15;
    for (const f of terrain.features) {
      if (f.x1 < x0) continue;
      if (f.x0 - 12 > x1) break;
      if (f.type === 'puddle' && !a.wet) continue;
      if (f.type === 'mud' || f.type === 'puddle') {
        const depth = f.type === 'mud' ? 0.22 : 0.12;
        ctx.beginPath();
        for (let x = f.x0; x <= f.x1; x += 0.25) {
          const sx = (x - camX) * scale, sy = toScreenY(terrain.surface(x)) - scale * 0.01;
          if (x === f.x0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        for (let x = f.x1; x >= f.x0; x -= 0.25) {
          const edge = Math.min(1, (x - f.x0) / 1.2, (f.x1 - x) / 1.2);
          ctx.lineTo((x - camX) * scale, toScreenY(terrain.surface(x)) + scale * (0.05 + depth * edge));
        }
        ctx.closePath();
        if (f.type === 'mud') {
          ctx.fillStyle = '#4a2e1c';
        } else {
          // standing water reflects the sky
          const sy = toScreenY(terrain.surface((f.x0 + f.x1) / 2));
          const g = ctx.createLinearGradient(0, sy, 0, sy + scale * 0.15);
          g.addColorStop(0, Atmo.mix(a.sky[2], '#20283a', 0.35));
          g.addColorStop(1, Atmo.mix(a.sky[1], '#0c1220', 0.55));
          ctx.fillStyle = g;
        }
        ctx.fill();
        ctx.beginPath();
        for (let x = f.x0 + 0.8; x <= f.x1 - 0.8; x += 0.25) {
          const sx = (x - camX) * scale, sy = toScreenY(terrain.surface(x)) + scale * 0.02;
          if (x <= f.x0 + 0.8) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.lineWidth = Math.max(1, scale * 0.02);
        ctx.strokeStyle = f.type === 'mud' ? 'rgba(255,220,180,0.3)' : Atmo.rgba(a.sky[3], 0.55);
        ctx.stroke();
        // raindrops ringing the water
        if (f.type === 'puddle' && a.rain > 0) {
          ctx.strokeStyle = 'rgba(220,230,245,0.5)';
          ctx.lineWidth = 1;
          for (let k = 0; k < 6; k++) {
            const ph = (t * 1.3 + hash(k + f.x0)) % 1;
            const x = f.x0 + 0.8 + hash(k * 3.3 + Math.floor(t * 1.3 + hash(k + f.x0))) * (f.x1 - f.x0 - 1.6);
            const sx = (x - camX) * scale, sy = toScreenY(terrain.surface(x)) + scale * 0.03;
            ctx.globalAlpha = (1 - ph) * a.rain;
            ctx.beginPath();
            ctx.ellipse(sx, sy, scale * 0.25 * ph, scale * 0.05 * ph, 0, 0, TAU);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      if (f.type !== 'puddle') drawSign(ctx, ((f.x0 - 10) - camX) * scale, toScreenY(terrain.surface(f.x0 - 10)), scale, f.type === 'mud' ? 'MUD' : 'WHOOPS');
    }
  }

  // Obstacles: logs (end-on), rocks, stacked tyres and cones. `gone` holds
  // the ones knocked away (cones, tyres shunted by the police car).
  function drawObstacles(ctx, view, terrain, gone, a) {
    const { scale, camX, toScreenY, w } = view;
    const x0 = camX - 2, x1 = camX + w / scale + 2;
    for (const o of terrain.obstaclesNear(x0, x1)) {
      if (gone && gone.has(o)) continue;
      const sx = (o.x - camX) * scale, sy = toScreenY(terrain.surface(o.x));
      const H = o.h * scale, Wd = o.w * scale;
      ctx.save();
      ctx.translate(sx, sy);
      if (o.type === 'log') {
        const r = H / 2;
        ctx.beginPath(); ctx.arc(0, -r, r, 0, TAU);
        ctx.fillStyle = '#6b4a2b'; ctx.fill();
        ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = '#3d2814'; ctx.stroke();
        ctx.strokeStyle = 'rgba(60,36,16,0.55)'; ctx.lineWidth = Math.max(1, r * 0.06);
        for (const k of [0.72, 0.48, 0.25]) { ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.95, r * k, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#c99a62';
        ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.95, r * 0.08, 0, TAU); ctx.fill();
      } else if (o.type === 'rock') {
        ctx.beginPath();
        const n = 9;
        for (let k = 0; k <= n; k++) {
          const u = k / n - 0.5;
          const hgt = Sim.obstacleProfile(o, o.x + u * o.w) * scale;
          if (k === 0) ctx.moveTo(u * Wd, 0); else ctx.lineTo(u * Wd, -hgt * (0.92 + 0.12 * hash(o.x + k)));
        }
        ctx.lineTo(Wd / 2, 0);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -H, 0, 0);
        g.addColorStop(0, '#9b8f84'); g.addColorStop(1, '#5a514a');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(30,25,20,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
      } else if (o.type === 'tyres') {
        const rows = 3, th = H / rows;
        for (let k = 0; k < rows; k++) {
          const y = -th * (k + 1);
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(-Wd / 2, y, Wd, th * 0.96, th * 0.45) : ctx.rect(-Wd / 2, y, Wd, th * 0.96);
          ctx.fillStyle = k === 1 ? '#e8e2d6' : '#1d1e21';
          ctx.fill();
          ctx.strokeStyle = k === 1 ? '#c13a26' : '#34363b';
          ctx.lineWidth = Math.max(1, th * 0.1);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1;
          for (let q = 1; q < 6; q++) { ctx.beginPath(); ctx.moveTo(-Wd / 2 + q * Wd / 6, y + th * 0.2); ctx.lineTo(-Wd / 2 + q * Wd / 6, y + th * 0.75); ctx.stroke(); }
        }
      } else if (o.type === 'cones') {
        drawCone(ctx, scale, o.h);
      }
      ctx.restore();
    }
  }

  function drawCone(ctx, scale, hgt) {
    const H = hgt * scale, B = scale * 0.13;
    ctx.fillStyle = '#ff6a1a';
    ctx.beginPath();
    ctx.moveTo(-B, 0); ctx.lineTo(-B * 0.18, -H); ctx.lineTo(B * 0.18, -H); ctx.lineTo(B, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f4f0';
    ctx.beginPath();
    ctx.moveTo(-B * 0.62, -H * 0.4); ctx.lineTo(-B * 0.42, -H * 0.62); ctx.lineTo(B * 0.42, -H * 0.62); ctx.lineTo(B * 0.62, -H * 0.4); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2b2e';
    ctx.fillRect(-B * 1.25, -scale * 0.02, B * 2.5, scale * 0.02);
  }

  // The police cruiser: black-and-white sedan with a flashing light bar.
  // Drawn in metres from the rear bumper at (x, ground), y up.
  // o.interceptor: the five-star unmarked car. o.parked: { s, lift, alpha }
  // draws a smaller car parked back on the far side of the tape.
  function drawPolice(ctx, view, terrain, p, t, o = {}) {
    const { scale, camX, toScreenY, w } = view;
    const L = 4.8;
    const sx0 = (p.x - camX) * scale;
    if (sx0 > w + 50 || sx0 + L * scale < -50) return;
    const pk = o.parked;
    const rw = p.x + 0.9, fw = p.x + 3.9, R = 0.34;
    const yr = pk ? terrain.surface(rw) : terrain.wheelY(rw, R), yf = pk ? terrain.surface(fw) : terrain.wheelY(fw, R);
    const ang = pk ? 0 : Math.atan2(yf - yr, fw - rw);
    const bob = pk ? 0 : Math.sin(t * 9) * 0.01;
    const k = pk ? pk.s : 1;
    ctx.save();
    if (pk) ctx.globalAlpha = pk.alpha;
    ctx.translate((rw - camX) * scale, toScreenY(yr + R * k + bob) - (pk ? pk.lift * scale : 0));
    ctx.scale(scale * k, -scale * k);
    ctx.rotate(ang);
    ctx.translate(-0.9, -R);
    const body = [[0.0, 0.42], [0.05, 0.78], [0.25, 0.92], [0.95, 0.96], [1.35, 1.38], [2.95, 1.4], [3.55, 0.98], [4.55, 0.9], [4.8, 0.72], [4.82, 0.38], [4.6, 0.26], [0.2, 0.26]];
    const path = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    path(body);
    ctx.fillStyle = o.interceptor ? '#1d2026' : '#111316';
    ctx.fill();
    if (o.interceptor) {
      // unmarked: a sheen along the flank instead of white doors
      path([[0.3, 0.62], [4.6, 0.66], [4.6, 0.72], [0.3, 0.7]]);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
    } else {
      // white doors
      path([[1.25, 0.34], [3.35, 0.34], [3.42, 0.95], [1.18, 0.95]]);
      ctx.fillStyle = '#eef0f2';
      ctx.fill();
    }
    // windows
    path([[1.45, 1.0], [2.15, 1.0], [2.15, 1.32], [1.48, 1.3]]);
    ctx.fillStyle = '#2a3442'; ctx.fill();
    path([[2.25, 1.0], [3.35, 1.0], [2.9, 1.33], [2.25, 1.33]]);
    ctx.fill();
    // POLICE lettering on the doors
    if (!o.interceptor) {
      ctx.save();
      ctx.scale(1, -1);
      ctx.fillStyle = '#111316';
      ctx.font = `800 0.2px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 2.3, -0.55);
      ctx.restore();
    }
    // push bar, lights
    ctx.fillStyle = '#0a0b0d';
    ctx.fillRect(4.78, 0.3, 0.12, 0.42);
    ctx.fillStyle = '#ffe9b8'; ctx.fillRect(4.7, 0.62, 0.12, 0.08);
    ctx.fillStyle = '#d4191f'; ctx.fillRect(-0.02, 0.62, 0.08, 0.12);
    // light bar: alternating red and blue (in the grille and the screen on the interceptor)
    const phase = Math.floor(t * 8) % 4;
    const on = p.active !== false;
    const red = phase < 2, blue = !red;
    if (o.interceptor) {
      ctx.fillStyle = on && red ? '#ff2b2b' : '#3a1010'; ctx.fillRect(4.62, 0.48, 0.18, 0.06);
      ctx.fillStyle = on && blue ? '#2b6bff' : '#0e1a3a'; ctx.fillRect(4.62, 0.4, 0.18, 0.06);
      ctx.fillStyle = on && blue ? '#2b6bff' : '#0e1a3a'; ctx.fillRect(2.9, 1.24, 0.25, 0.05);
      ctx.fillStyle = on && red ? '#ff2b2b' : '#3a1010'; ctx.fillRect(1.6, 1.22, 0.25, 0.05);
    } else {
      ctx.fillStyle = '#1b1c1f'; ctx.fillRect(1.85, 1.4, 0.9, 0.08);
      ctx.fillStyle = on && red ? '#ff2b2b' : '#5a1212'; ctx.fillRect(1.88, 1.42, 0.4, 0.1);
      ctx.fillStyle = on && blue ? '#2b6bff' : '#10204a'; ctx.fillRect(2.32, 1.42, 0.4, 0.1);
    }
    // wheels
    for (const wx of [0.9, 3.9]) {
      ctx.beginPath(); ctx.arc(wx, R, R, 0, TAU); ctx.fillStyle = '#0d0e10'; ctx.fill();
      ctx.beginPath(); ctx.arc(wx, R, R * 0.6, 0, TAU); ctx.fillStyle = '#8d939a'; ctx.fill();
      ctx.save(); ctx.translate(wx, R); ctx.rotate(-p.x / R);
      ctx.strokeStyle = '#4b4f55'; ctx.lineWidth = 0.04;
      for (let k = 0; k < 5; k++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.55, 0); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
    // screen positions of the lamps, for lighting
    const toScreen = (lx, ly) => {
      const c = Math.cos(ang), s2 = Math.sin(ang);
      const dx = lx - 0.9, dy = ly - R;
      return [(rw + dx * c - dy * s2 - camX) * scale, toScreenY(yr + R + bob + dx * s2 + dy * c)];
    };
    return { head: toScreen(4.82, 0.66), bar: o.interceptor ? toScreen(4.7, 0.48) : toScreen(2.3, 1.48), red, angle: -ang };
  }

  // A stinger: a folding spike strip lying across the track, its cord
  // running off to the roadside.
  function drawStinger(ctx, view, terrain, st, t) {
    const { scale, camX, toScreenY, w } = view;
    const sx = (st.x - camX) * scale;
    if (sx < -60 || sx > w + 60) return;
    const sy = toScreenY(terrain.surface(st.x));
    const half = (st.w / 2) * scale, hgt = Math.max(3, 0.05 * scale);
    // thrown on: it slides into place over a quarter of a second
    const k = Math.min(1, Math.max(0, (t - st.t) / 0.25));
    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#ffb21a';
    ctx.lineWidth = Math.max(1, scale * 0.012);
    ctx.beginPath();
    ctx.moveTo(half, -hgt * 0.4);
    ctx.quadraticCurveTo(half + scale * 0.4, -hgt * 0.2, half + scale * 0.9, -scale * 0.12);
    ctx.stroke();
    ctx.fillStyle = '#2a2b2f';
    ctx.fillRect(-half, -hgt * 0.55, half * 2, hgt * 0.55);
    // accordion links, orange and black
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x0 = -half + (i * 2 * half) / n, x1 = -half + ((i + 1) * 2 * half) / n;
      ctx.fillStyle = i % 2 ? '#1c1d20' : '#ff8a1a';
      ctx.beginPath();
      ctx.moveTo(x0, -hgt * 0.5); ctx.lineTo((x0 + x1) / 2, -hgt); ctx.lineTo(x1, -hgt * 0.5); ctx.closePath();
      ctx.fill();
    }
    // spikes
    ctx.strokeStyle = '#d7dade';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const x = -half + (i * 2 * half) / 10;
      ctx.moveTo(x, -hgt * 0.6); ctx.lineTo(x + 1, -hgt * 1.35);
    }
    ctx.stroke();
    ctx.restore();
  }

  // The police helicopter, hovering ahead with its searchlight on you.
  // (x, y) is the searchlight in world metres. Returns the lamp's screen
  // position for lighting.
  function drawHeli(ctx, view, x, y, tilt, t) {
    const { scale, camX, toScreenY } = view;
    const sx = (x - camX) * scale, sy = toScreenY(y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.rotate(tilt);
    // tail boom and fin
    ctx.fillStyle = '#15171b';
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.55); ctx.lineTo(-4.2, -0.75); ctx.lineTo(-4.2, -0.6); ctx.lineTo(-0.6, -0.25);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3.9, -0.7); ctx.lineTo(-4.5, -1.5); ctx.lineTo(-4.25, -1.5); ctx.lineTo(-3.7, -0.7);
    ctx.closePath(); ctx.fill();
    // tail rotor blur
    ctx.strokeStyle = 'rgba(40,44,52,0.5)';
    ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(-4.3, -1.05, 0.45, 0, Math.PI * 2); ctx.stroke();
    // cabin
    ctx.fillStyle = '#1b1e24';
    ctx.beginPath();
    ctx.ellipse(0.2, -0.45, 1.25, 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,150,180,0.45)';
    ctx.beginPath();
    ctx.ellipse(0.85, -0.55, 0.5, 0.36, -0.2, -Math.PI * 0.7, Math.PI * 0.5);
    ctx.fill();
    // POLICE band
    ctx.fillStyle = '#e8eaee';
    ctx.fillRect(-0.9, -0.42, 1.6, 0.14);
    // skids
    ctx.strokeStyle = '#0d0e10';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(-0.8, 0.32); ctx.lineTo(1.1, 0.32); ctx.quadraticCurveTo(1.35, 0.32, 1.4, 0.2);
    ctx.moveTo(-0.4, 0.32); ctx.lineTo(-0.3, 0.05); ctx.moveTo(0.7, 0.32); ctx.lineTo(0.6, 0.05);
    ctx.stroke();
    // main rotor, a blurred disc seen edge-on, with a flicker of blade
    ctx.fillStyle = '#0d0e10';
    ctx.fillRect(0.05, -1.22, 0.15, 0.2);
    ctx.fillStyle = 'rgba(30,34,40,0.35)';
    ctx.beginPath(); ctx.ellipse(0.12, -1.24, 4.2, 0.08, 0, 0, Math.PI * 2); ctx.fill();
    const b = Math.sin(t * 40);
    ctx.fillStyle = 'rgba(15,17,20,0.85)';
    ctx.fillRect(0.12 - 4.2 * Math.abs(b), -1.27, 8.4 * Math.abs(b), 0.05);
    // navigation lights
    const blink = Math.floor(t * 1.5) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3030' : '#4a1010';
    ctx.beginPath(); ctx.arc(-4.4, -1.5, 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9cff9c';
    ctx.beginPath(); ctx.arc(1.3, -0.4, 0.05, 0, Math.PI * 2); ctx.fill();
    // searchlight pod
    ctx.fillStyle = '#2a2d33';
    ctx.beginPath(); ctx.arc(0.9, 0.05, 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return [sx + Math.cos(tilt) * 0.9 * scale, sy + Math.sin(tilt) * 0.9 * scale + 0.05 * scale];
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

  const Sim = root.WheelieSim;
  root.Render = { FONT, drawSky, drawTrackside, drawGround, drawFlag, drawShadow, drawParticles, drawVignette, drawGauge, drawFeatures, drawObstacles, drawCone, drawPolice, drawStinger, drawHeli, drawPopups };
})(typeof self !== 'undefined' ? self : this);
