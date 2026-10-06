/*
 * Wheelie physics. It's a simplified arcade model: the bike pivots about the
 * rear contact patch, and pitch comes from two moments about that point.
 *   - The rider+bike centre of mass is pushed back by the bike's own
 *     acceleration (nose up when accelerating, nose down when braking).
 *   - Gravity pulls the nose down until the centre of mass passes over the
 *     rear axle (the balance point). Past that, gravity pulls the bike over.
 * There's no DOM in this file, so the Node tests can run it directly.
 */
(function (root) {
  'use strict';

  const G = 9.81;
  const DEG = Math.PI / 180;
  const RIDER_KG = 80;
  const COM_ANGLE = 35 * DEG;     // centre of mass elevation seen from the rear contact patch
  const PITCH_GAIN = 2.4;         // arcade boost on the acceleration moment so every bike can lift
  const PITCH_ARM = 3.0;          // effective lever (m); longer = slower to rotate
  const PITCH_DAMP = 5;
  const CRASH_ANGLE = 80 * DEG;   // rear fender meets the ground
  const WHEELIE_START = 3 * DEG;
  const MIN_WHEELIE_TIME = 0.75;  // seconds; a shorter lift is a failed pop and the run goes on
  const BRAKE_DECEL = 7;
  const ROLL_DRAG = 0.25;
  const AIR_DRAG = 0.0015;
  const THROTTLE_UP = 6, THROTTLE_DOWN = 10, LEAN_RATE = 4;
  const FIXED_DT = 1 / 240;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function deriveHandling(bike) {
    const mass = bike.weightKg + RIDER_KG;
    const powerToMass = (bike.peakPowerKw * 1000) / mass;
    return {
      mass,
      // Launch acceleration grows with power-to-weight, compressed so the
      // Varg is a handful rather than impossible.
      launch: 6 + 2.5 * Math.log(powerToMass / 30),
      vmax: bike.topSpeedKmh / 3.6,
      // A light bike moves further when the rider shifts their weight.
      leanAngle: 10 * DEG * Math.min(1.2, 140 / mass),
      pitchArm: PITCH_ARM * Math.pow(mass / 140, 0.25),
      wheelbase: (bike.look && bike.look.wheelbase) || 1.3,
    };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BUMP_HALF_WIDTH = 0.35;

  function createTerrain(seed) {
    const rnd = mulberry32(seed);
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
    // The first stretch is flat so the player can get going.
    const ramp = (x) => clamp((x - 60) / 400, 0, 1);
    const base = (x) => ramp(x) * (1.2 * Math.sin(x / 37 + p1) + 0.7 * Math.sin(x / 13.3 + p2) + 0.3 * Math.sin(x / 5.1 + p3));

    const bumps = [];
    let bx = 70;
    while (bx < 20000) {
      bx += 40 + rnd() * 80;
      bumps.push({ x: bx, h: 0.07 + rnd() * 0.08 + Math.min(0.1, bx / 20000) });
    }

    function bumpAt(x) {
      // Binary search for the nearest bump at or after x - width.
      let lo = 0, hi = bumps.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (bumps[mid].x < x - BUMP_HALF_WIDTH) lo = mid + 1; else hi = mid;
      }
      const b = bumps[lo];
      if (!b || Math.abs(x - b.x) > BUMP_HALF_WIDTH) return 0;
      const t = (x - b.x) / BUMP_HALF_WIDTH;
      return b.h * 0.5 * (1 + Math.cos(t * Math.PI));
    }

    return {
      bumps,
      height: (x) => base(x) + bumpAt(x),
      // Bumps are left out of the slope on purpose; they act through kicks instead.
      slope: (x) => (base(x + 0.05) - base(x - 0.05)) / 0.1,
      bumpsBetween(a, b) {
        const out = [];
        for (const bump of bumps) {
          if (bump.x > b) break;
          if (bump.x > a) out.push(bump);
        }
        return out;
      },
    };
  }

  function createState() {
    return {
      x: 0, v: 0, a: 0,
      theta: 0, omega: 0,
      throttle: 0, lean: 0, braking: false,
      status: 'riding',            // riding | landed | crashed
      inWheelie: false, wheelieStartX: 0, wheelieDist: 0, wheelieTime: 0,
      score: 0, time: 0, crashT: 0,
    };
  }

  function balanceAngle(s, h) {
    return 90 * DEG - COM_ANGLE - s.lean * h.leanAngle;
  }

  function substep(s, input, h, terrain, dt) {
    s.time += dt;
    if (s.status !== 'riding') {
      s.v = Math.max(0, s.v - (s.status === 'crashed' ? 12 : 3) * dt);
      s.x += s.v * dt;
      if (s.status === 'crashed') s.crashT += dt;
      return;
    }

    const target = input.throttle ? 1 : 0;
    s.throttle += clamp(target - s.throttle, -THROTTLE_DOWN * dt, THROTTLE_UP * dt);
    s.lean += clamp((input.lean || 0) - s.lean, -LEAN_RATE * dt, LEAN_RATE * dt);
    s.braking = !!input.brake;

    const slopeAngle = Math.atan(terrain.slope(s.x));
    const vr = s.v / h.vmax;
    const drive = s.throttle * h.launch * Math.max(0, 1 - vr * vr);
    const moving = s.v > 0.01;
    const brake = s.braking && moving ? BRAKE_DECEL : 0;
    const drag = moving ? ROLL_DRAG + AIR_DRAG * s.v * s.v : 0;
    let a = drive - brake - drag - G * Math.sin(slopeAngle);
    if (s.v <= 0 && a < 0) a = 0;
    s.a = a;

    const x0 = s.x;
    s.v = Math.max(0, s.v + a * dt);
    s.x += s.v * dt;

    const phi = COM_ANGLE + s.lean * h.leanAngle;
    const moment = (PITCH_GAIN * a * Math.sin(s.theta + phi) - G * Math.cos(s.theta + phi + slopeAngle)) / h.pitchArm;
    s.omega += (moment - PITCH_DAMP * s.omega) * dt;
    s.theta += s.omega * dt;
    if (s.theta <= 0) {
      s.theta = 0;
      if (s.omega < 0) s.omega = 0;
    }

    // Bumps: the rear wheel hitting one pushes the pivot up, which drops the
    // nose. The front wheel hitting one while it's on the ground gives a small pop.
    for (const b of terrain.bumpsBetween(x0, s.x)) {
      s.omega -= b.h * s.v * 0.35;
    }
    if (s.theta < 2 * DEG) {
      const wb = h.wheelbase || 1.3;
      for (const b of terrain.bumpsBetween(x0 + wb, s.x + wb)) s.omega += b.h * s.v * 0.12;
    }

    if (s.theta >= CRASH_ANGLE) {
      s.status = 'crashed';
      s.score = s.wheelieDist;
      return;
    }

    if (!s.inWheelie && s.theta > WHEELIE_START) {
      s.inWheelie = true;
      s.wheelieStartX = s.x;
      s.wheelieTime = 0;
    }
    if (s.inWheelie) {
      s.wheelieDist = s.x - s.wheelieStartX;
      s.wheelieTime += dt;
      if (s.theta === 0) {
        s.inWheelie = false;
        if (s.wheelieTime >= MIN_WHEELIE_TIME) {
          s.status = 'landed';
          s.score = s.wheelieDist;
        } else {
          s.wheelieDist = 0;
          s.wheelieTime = 0;
        }
      }
    }
  }

  // Runs whole fixed substeps and keeps the remainder for the next frame, so
  // the result doesn't depend on frame rate.
  function step(s, input, h, terrain, dt) {
    s._acc = (s._acc || 0) + Math.min(dt, 0.1);
    while (s._acc >= FIXED_DT) {
      substep(s, input, h, terrain, FIXED_DT);
      s._acc -= FIXED_DT;
    }
  }

  const api = {
    DEG, CRASH_ANGLE, COM_ANGLE, FIXED_DT, MIN_WHEELIE_TIME,
    deriveHandling, createTerrain, createState, step, substep, balanceAngle, mulberry32,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WheelieSim = api;
})(typeof self !== 'undefined' ? self : this);
