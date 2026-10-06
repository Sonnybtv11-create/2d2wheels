/*
 * Canvas drawing for the world and the bikes. Bikes are drawn in metres in a
 * y-up local frame, with the rear tyre's contact patch at the origin.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;

  function line(ctx, pts, width, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function wheel(ctx, cx, cy, r, spin) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = '#16181b';
    ctx.fill();
    // knobbly tread
    ctx.strokeStyle = '#2a2d31';
    ctx.lineWidth = r * 0.09;
    ctx.setLineDash([r * 0.12, r * 0.1]);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.95, spin, spin + TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // rim
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, TAU);
    ctx.strokeStyle = '#8b939c';
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    // spokes
    ctx.strokeStyle = 'rgba(200,205,210,0.55)';
    ctx.lineWidth = r * 0.025;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = spin + (i * TAU) / 12;
      ctx.moveTo(cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1);
      ctx.lineTo(cx + Math.cos(a + 0.25) * r * 0.7, cy + Math.sin(a + 0.25) * r * 0.7);
    }
    ctx.stroke();
    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.13, 0, TAU);
    ctx.fillStyle = '#b8bec5';
    ctx.fill();
  }

  // Key points of the bike in local metres (y up), shared by the bike, the
  // rider and the crash animation.
  function geometry(look) {
    const R = look.wheelRadius, WB = look.wheelbase;
    return {
      R, WB,
      rear: [0, R],
      front: [WB, R],
      pivot: [0.5 * WB - 0.05, R + 0.32],
      steer: [WB - 0.3, R + 0.78],
      bars: [WB - 0.38, R + 0.93],
      seatFront: [0.62 * WB, R + 0.74],
      seatRear: [0.05 * WB, R + 0.72],
      peg: [0.42 * WB, R + 0.1],
    };
  }

  function drawBike(ctx, look, opts) {
    const g = geometry(look);
    const { R, WB } = g;
    const spin = opts.wheelSpin || 0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // swingarm
    line(ctx, [g.rear, g.pivot], 0.075, look.frame);
    // rear shock
    line(ctx, [[0.3 * WB, R + 0.28], [0.42 * WB, R + 0.62]], 0.04, look.accent);

    wheel(ctx, g.rear[0], g.rear[1], R, -spin);
    wheel(ctx, g.front[0], g.front[1], R, -spin);

    // fork legs
    line(ctx, [g.front, g.steer], 0.07, '#c3c8ce');
    line(ctx, [[g.front[0] - 0.01, g.front[1] + 0.06], [WB - 0.12, R + 0.32]], 0.085, '#e9ecef');

    // frame spine
    line(ctx, [g.steer, [0.48 * WB, R + 0.62], g.pivot], 0.07, look.frame);
    line(ctx, [g.steer, g.pivot], 0.05, look.frame);

    // battery box / tank
    poly(ctx, [
      [0.4 * WB, R + 0.34], [0.72 * WB, R + 0.36], [WB - 0.3, R + 0.74], [0.5 * WB, R + 0.74],
    ], look.plastic);
    poly(ctx, [
      [0.45 * WB, R + 0.5], [0.66 * WB, R + 0.52], [0.7 * WB, R + 0.6], [0.47 * WB, R + 0.6],
    ], look.accent);

    // motor
    ctx.beginPath();
    ctx.arc(0.47 * WB, R + 0.3, 0.1, 0, TAU);
    ctx.fillStyle = '#4a5058';
    ctx.fill();

    // rear fender and side panel
    poly(ctx, [
      [-0.32, R + 0.6], [0.05 * WB, R + 0.66], [0.38 * WB, R + 0.72], [0.36 * WB, R + 0.58], [0.05 * WB, R + 0.52],
    ], look.plastic);
    // seat
    poly(ctx, [
      g.seatRear, [0.08 * WB, R + 0.8], [0.6 * WB, R + 0.83], g.seatFront, [0.36 * WB, R + 0.7],
    ], look.seat);

    // front fender and number plate
    poly(ctx, [
      [WB - 0.18, R + 0.42], [WB + 0.32, R + 0.44], [WB + 0.36, R + 0.4], [WB - 0.1, R + 0.34],
    ], look.plastic);
    poly(ctx, [
      [WB - 0.28, R + 0.7], [WB - 0.16, R + 0.98], [WB - 0.1, R + 0.92], [WB - 0.2, R + 0.66],
    ], look.plastic);

    // bars
    line(ctx, [g.steer, g.bars], 0.04, '#2b2e33');
    line(ctx, [[g.bars[0] - 0.04, g.bars[1] + 0.02], [g.bars[0] + 0.04, g.bars[1] - 0.02]], 0.05, '#111');

    if (opts.rider !== false) drawRider(ctx, look, g, opts.lean || 0);
  }

  function riderPose(g, lean) {
    // lean: +1 = full lean back, -1 = full lean forward
    const hip = [g.seatFront[0] - 0.24 - 0.12 * lean, g.seatFront[1] + 0.14];
    const torso = (28 - 26 * lean) * Math.PI / 180; // tilt forward from vertical
    const shoulder = [hip[0] + Math.sin(torso) * 0.55, hip[1] + Math.cos(torso) * 0.55];
    const head = [shoulder[0] + Math.sin(torso) * 0.2, shoulder[1] + Math.cos(torso) * 0.2];
    const hand = g.bars;
    const elbow = [(shoulder[0] + hand[0]) / 2 - 0.02, (shoulder[1] + hand[1]) / 2 - 0.1];
    const foot = g.peg;
    const knee = [(hip[0] + foot[0]) / 2 + 0.2, (hip[1] + foot[1]) / 2 + 0.06];
    return { hip, shoulder, head, hand, elbow, foot, knee, torso };
  }

  function drawRider(ctx, look, g, lean) {
    const p = riderPose(g, lean);
    drawRiderPose(ctx, look, p);
  }

  function drawRiderPose(ctx, look, p) {
    const pants = '#2e3440', jersey = look.accent === '#111214' ? '#e9ecef' : look.accent;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    line(ctx, [p.hip, p.knee, p.foot], 0.13, pants);
    line(ctx, [[p.foot[0] - 0.04, p.foot[1] - 0.02], [p.foot[0] + 0.1, p.foot[1] - 0.02]], 0.09, '#111');
    line(ctx, [p.hip, p.shoulder], 0.2, jersey);
    line(ctx, [p.shoulder, p.elbow, p.hand], 0.085, jersey);
    ctx.beginPath();
    ctx.arc(p.hand[0], p.hand[1], 0.045, 0, TAU);
    ctx.fillStyle = '#111';
    ctx.fill();
    // helmet with peak and visor
    ctx.save();
    ctx.translate(p.head[0], p.head[1]);
    ctx.rotate(-p.torso * 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.15, 0.14, 0, 0, TAU);
    ctx.fillStyle = look.helmet;
    ctx.fill();
    poly(ctx, [[0.02, 0.06], [0.24, 0.04], [0.22, 0.0], [0.04, 0.02]], look.helmet);
    poly(ctx, [[0.05, -0.02], [0.16, -0.01], [0.15, -0.08], [0.06, -0.09]], '#1c1f24');
    ctx.restore();
  }

  /* ---------------- world ---------------- */

  function hash(n) {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawSky(ctx, w, h, camX) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#5aa7e6');
    sky.addColorStop(0.6, '#a9d4f2');
    sky.addColorStop(1, '#f2e6c9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // sun
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.18, Math.min(w, h) * 0.06, 0, TAU);
    ctx.fillStyle = 'rgba(255,248,220,0.9)';
    ctx.fill();

    // clouds
    const cloudShift = camX * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = -1; i < 6; i++) {
      const slot = Math.floor(cloudShift / 400) + i;
      const x = slot * 400 - cloudShift + hash(slot) * 160;
      const y = h * (0.08 + hash(slot + 9.1) * 0.22);
      const s = 0.6 + hash(slot + 3.3) * 0.7;
      ctx.beginPath();
      ctx.ellipse(x, y, 60 * s, 18 * s, 0, 0, TAU);
      ctx.ellipse(x + 34 * s, y - 10 * s, 36 * s, 20 * s, 0, 0, TAU);
      ctx.ellipse(x - 30 * s, y - 4 * s, 30 * s, 14 * s, 0, 0, TAU);
      ctx.fill();
    }

    hills(ctx, w, h, camX * 6, h * 0.58, h * 0.12, '#8fb3c9', 0.0037);
    hills(ctx, w, h, camX * 14, h * 0.66, h * 0.1, '#7aa36b', 0.006);
  }

  function hills(ctx, w, h, shift, baseY, amp, color, freq) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) {
      const u = x + shift;
      const y = baseY - amp * (0.55 * Math.sin(u * freq) + 0.3 * Math.sin(u * freq * 2.3 + 1.3) + 0.15 * Math.sin(u * freq * 5.1 + 2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawGround(ctx, view, terrain) {
    const { w, h, scale, camX, toScreenY } = view;
    const x0 = camX - 1, x1 = camX + w / scale + 1;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = x0; x <= x1; x += 0.25) ctx.lineTo((x - camX) * scale, toScreenY(terrain.height(x)));
    ctx.lineTo(w, h);
    ctx.closePath();
    const dirt = ctx.createLinearGradient(0, toScreenY(0) - scale, 0, h);
    dirt.addColorStop(0, '#9b6b43');
    dirt.addColorStop(1, '#5c3c22');
    ctx.fillStyle = dirt;
    ctx.fill();

    // packed track surface
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 0.25) {
      const sx = (x - camX) * scale, sy = toScreenY(terrain.height(x));
      if (x === x0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = '#c99a62';
    ctx.lineWidth = Math.max(3, scale * 0.08);
    ctx.stroke();

    // stones
    ctx.fillStyle = 'rgba(60,38,20,0.5)';
    for (let i = Math.floor(x0); i <= x1; i++) {
      if (hash(i) > 0.55) continue;
      const sx = (i + hash(i + 0.5) - camX) * scale;
      const sy = toScreenY(terrain.height(i)) + scale * (0.25 + hash(i + 1.7) * 1.4);
      ctx.beginPath();
      ctx.ellipse(sx, sy, scale * 0.06, scale * 0.035, 0, 0, TAU);
      ctx.fill();
    }

    // distance posts every 25 m
    ctx.font = `700 ${Math.max(11, Math.round(scale * 0.22))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let m = Math.ceil(x0 / 25) * 25; m <= x1; m += 25) {
      if (m <= 0) continue;
      const sx = (m - camX) * scale, sy = toScreenY(terrain.height(m));
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(sx - scale * 0.03, sy - scale * 0.7, scale * 0.06, scale * 0.7);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(`${m} m`, sx, sy - scale * 0.78);
    }
  }

  function drawFlag(ctx, view, terrain, x, label, color) {
    const { scale, camX, toScreenY } = view;
    const sx = (x - camX) * scale;
    if (sx < -100 || sx > view.w + 100) return;
    const sy = toScreenY(terrain.height(x));
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - 1.5, sy - scale * 1.6, 3, scale * 1.6);
    ctx.beginPath();
    ctx.moveTo(sx + 1.5, sy - scale * 1.6);
    ctx.lineTo(sx + scale * 0.6, sy - scale * 1.42);
    ctx.lineTo(sx + 1.5, sy - scale * 1.24);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = `700 ${Math.max(11, Math.round(scale * 0.2))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, sx + 6, sy - scale * 1.7);
    ctx.fillText(label, sx + 6, sy - scale * 1.7);
  }

  // Pitch gauge: a quarter-circle dial from 0° to 90°.
  function drawGauge(ctx, cx, cy, r, theta, balance, crash) {
    const a = (deg) => Math.PI + deg; // canvas angle: 0° points left, 90° points up
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineWidth = r * 0.22;
    const arc = (from, to, color) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, a(from), a(to), false);
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    const deg = Math.PI / 180;
    arc(0, balance - 22 * deg, 'rgba(255,255,255,0.25)');
    arc(balance - 22 * deg, balance - 3 * deg, 'rgba(61,220,132,0.9)');
    arc(balance - 3 * deg, balance + 3 * deg, 'rgba(255,201,61,0.95)');
    arc(balance + 3 * deg, crash, 'rgba(255,90,79,0.9)');
    arc(crash, 90 * deg, 'rgba(120,20,20,0.9)');
    // needle
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a(theta)) * r * 1.12, cy + Math.sin(a(theta)) * r * 1.12);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(theta / deg)}°`, cx + r * 0.35, cy + 18);
    ctx.restore();
  }

  root.Render = { drawBike, drawRiderPose, riderPose, geometry, drawSky, drawGround, drawFlag, drawGauge };
})(typeof self !== 'undefined' ? self : this);
