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
  const CRASH_ANGLE = 80 * DEG;   // rear fender meets the ground
  const WHEELIE_START = 3 * DEG;
  const MIN_WHEELIE_TIME = 0.75;  // seconds; a shorter lift is a failed pop and the run goes on
  const STALL_SPEED = 1.4;        // m/s (~5 km/h); slower than this the front comes down
  const FIXED_DT = 1 / 240;

  // Feel knobs, kept together so tests and tuning scripts can sweep them.
  const TUNE = {
    pitchGain: 2.3,     // arcade boost on the drive moment at a standstill, so every bike can pop the front
    pitchGainTop: 1.7,  // the boost at top speed
    brakeGain: 1.6,     // how hard the rear brake pulls the nose down, relative to its decel
    pitchArm: 3.0,      // effective lever (m); longer = slower to rotate
    pitchDamp: 4.3,
    powerDamp: 0.8,     // how much a bike's launch slows its pitch response (0 = not at all)
    knee: 0.45,         // drive is torque-limited below knee * vmax, power-limited above
    brakeDecel: 6.5,
    roll: 0.25,         // rolling resistance (m/s²)
    throttleUp: 4, throttleDown: 7,
    brakeUp: 4, brakeDown: 10,
    leanRate: 4,
    mudRoll: 6,         // rolling resistance multiplier in mud
    bumpKick: 0.12,     // extra nose-drop (rad/s per metre of bump) for each m/s of speed
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function deriveHandling(bike) {
    const mass = bike.weightKg + RIDER_KG;
    const powerToMass = (bike.peakPowerKw * 1000) / mass;
    // Launch acceleration grows with power-to-weight, compressed so the
    // Varg is a handful rather than impossible.
    const launch = 6 + 2.5 * Math.log(powerToMass / 30);
    const vmax = bike.topSpeedKmh / 3.6;
    const vKnee = TUNE.knee * vmax;
    return {
      mass,
      launch,
      vmax,
      vKnee,
      // Air drag sized so full throttle tops out at the real top speed.
      dragK: Math.max(0, (launch * vKnee) / vmax - TUNE.roll) / (vmax * vmax),
      // A light bike moves further when the rider shifts their weight.
      leanAngle: 10 * DEG * Math.min(1.2, 140 / mass),
      // Heavier, longer, more powerful bikes rotate more slowly per unit of
      // drive, so big power stays catchable rather than twitchy.
      pitchArm: TUNE.pitchArm * Math.pow(mass / 140, 0.25) * Math.pow(launch / 7, TUNE.powerDamp),
      wheelbase: (bike.look && bike.look.wheelbase) || 1.3,
      wheelRadius: (bike.look && bike.look.wheelRadius) || 0.31,
    };
  }

  function pitchGainAt(h, v) {
    return TUNE.pitchGain + (TUNE.pitchGainTop - TUNE.pitchGain) * clamp(v / h.vmax, 0, 1);
  }

  // Drive acceleration available at full throttle.
  function driveAt(h, v) {
    return h.launch * Math.min(1, h.vKnee / Math.max(v, 0.5));
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
    const ramp = (x) => clamp((x - 60) / 600, 0, 1);
    // Long rollers only: short, steep waves made high-speed wheelies a lottery.
    const base = (x) => ramp(x) * (1.1 * Math.sin(x / 41 + p1) + 0.45 * Math.sin(x / 17 + p2) + 0.05 * Math.sin(x / 7 + p3));

    // Track features: whoops (a run of rhythmic bumps) and mud (drags the
    // bike, so it needs more throttle, which lifts the nose).
    const features = [];
    let fx = 130;
    while (fx < 20000) {
      const len = 14 + rnd() * 10;
      features.push({ type: rnd() < 0.55 ? 'whoops' : 'mud', x0: fx, x1: fx + len });
      fx += len + 90 + rnd() * 90;
    }
    const inFeature = (x, pad) => features.some((f) => x > f.x0 - pad && x < f.x1 + pad);

    const bumps = [];
    let bx = 70;
    while (bx < 20000) {
      bx += 40 + rnd() * 80;
      if (!inFeature(bx, 4)) bumps.push({ x: bx, h: 0.06 + rnd() * 0.07 + Math.min(0.06, bx / 30000) });
    }
    for (const f of features) {
      if (f.type !== 'whoops') continue;
      for (let x = f.x0 + 1.5; x < f.x1; x += 3.2) bumps.push({ x, h: 0.06 + rnd() * 0.03 });
    }
    bumps.sort((a, b) => a.x - b.x);

    // Charge pickups float in short lines at heights the front wheel reaches
    // at a given wheelie angle, so collecting them means steering the pitch.
    // Low lines sit under a comfortable wheelie, high ones above the
    // leaned-back balance point (sit up to reach them).
    const PATTERNS = [
      [18, 25, 32, 40, 48], [48, 40, 32, 25, 18], [18, 18, 18], [48, 48, 48],
      [20, 44, 20, 44], [32, 48, 32], [18, 32, 48, 32, 18], [26, 26, 26, 26],
    ];
    const pickups = [];
    let px = 40;
    while (px < 20000) {
      const pat = PATTERNS[Math.floor(rnd() * PATTERNS.length)];
      for (const deg of pat) { pickups.push({ x: px, pitch: deg * DEG }); px += 3.6; }
      px += 22 + rnd() * 26;
    }

    // First bump index at or after x.
    function firstBump(x) {
      let lo = 0, hi = bumps.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (bumps[mid].x < x) lo = mid + 1; else hi = mid;
      }
      return lo;
    }

    function bumpAt(x) {
      const b = bumps[firstBump(x - BUMP_HALF_WIDTH)];
      if (!b || Math.abs(x - b.x) > BUMP_HALF_WIDTH) return 0;
      const t = (x - b.x) / BUMP_HALF_WIDTH;
      return b.h * 0.5 * (1 + Math.cos(t * Math.PI));
    }

    return {
      bumps, features, pickups,
      height: (x) => base(x) + bumpAt(x),
      // Bumps are left out of the slope on purpose; they act through kicks instead.
      slope: (x) => (base(x + 0.05) - base(x - 0.05)) / 0.1,
      bumpsBetween(a, b) {
        const out = [];
        for (let i = firstBump(a); i < bumps.length && bumps[i].x <= b; i++) if (bumps[i].x > a) out.push(bumps[i]);
        return out;
      },
      mudAt(x) {
        for (const f of features) {
          if (f.x0 > x) return false;
          if (f.type === 'mud' && x < f.x1) return true;
        }
        return false;
      },
    };
  }

  // Where the front axle is in the world (x along the track, y up).
  function frontAxle(s, h, terrain) {
    const ang = Math.atan(terrain.slope(s.x)) + s.theta;
    const c = Math.cos(ang), sn = Math.sin(ang);
    return [s.x + h.wheelbase * c - h.wheelRadius * sn, terrain.height(s.x) + h.wheelbase * sn + h.wheelRadius * c];
  }

  const PICKUP_RADIUS = 0.2;  // how close the front hub must pass (m)

  // Height above the ground of the front hub at a pickup's wheelie angle.
  function pickupHeight(p, h) {
    return h.wheelbase * Math.sin(p.pitch) + h.wheelRadius * Math.cos(p.pitch);
  }

  function createState() {
    return {
      x: 0, v: 0, a: 0,
      theta: 0, omega: 0,
      throttle: 0, brake: 0, lean: 0, braking: false,
      status: 'riding',            // riding | landed | crashed
      inWheelie: false, wheelieStartX: 0, wheelieDist: 0, wheelieTime: 0,
      score: 0, time: 0, crashT: 0, stalled: false,
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
      if (s.status === 'landed' && s.theta > 0) {
        // the front settles back down
        s.omega -= 3 * dt;
        s.theta = Math.max(0, s.theta + s.omega * dt);
      }
      return;
    }

    // Keys are on/off, but throttle and brake ramp, so a tap is a small input
    // and a hold is a big one.
    s.throttle += clamp((input.throttle ? 1 : 0) - s.throttle, -TUNE.throttleDown * dt, TUNE.throttleUp * dt);
    s.brake += clamp((input.brake ? 1 : 0) - s.brake, -TUNE.brakeDown * dt, TUNE.brakeUp * dt);
    s.lean += clamp((input.lean || 0) - s.lean, -TUNE.leanRate * dt, TUNE.leanRate * dt);
    s.braking = s.brake > 0.3;

    const slopeAngle = Math.atan(terrain.slope(s.x));
    const moving = s.v > 0.01;
    const drive = s.throttle * driveAt(h, s.v);
    const brake = moving ? s.brake * TUNE.brakeDecel : 0;
    const mud = terrain.mudAt ? terrain.mudAt(s.x) : false;
    s.inMud = mud;
    const roll = moving ? TUNE.roll * (mud ? TUNE.mudRoll : 1) : 0;
    const drag = h.dragK * s.v * s.v;
    let a = drive - brake - roll - drag - G * Math.sin(slopeAngle);
    if (s.v <= 0 && a < 0) a = 0;
    s.a = a;

    const x0 = s.x;
    s.v = Math.max(0, s.v + a * dt);
    s.x += s.v * dt;

    // Pitch about the rear contact patch. Drive force at the tyre lifts the
    // nose and the rear brake pulls it down. Air drag acts at the centre of
    // mass, so it cancels out of the pitch balance and the throttle keeps
    // its bite at top speed. Gravity pulls the nose down until the centre of
    // mass passes over the rear axle.
    const phi = COM_ANGLE + s.lean * h.leanAngle;
    const beta = s.theta + phi;
    // The arcade boost stands in for the suspension pop and body English a
    // real rider uses to get the front up; it eases off towards top speed.
    const gain = pitchGainAt(h, s.v);
    const push = gain * drive - TUNE.brakeGain * brake - roll - G * Math.sin(slopeAngle);
    const moment = (push * Math.sin(beta) - G * Math.cos(beta + slopeAngle)) / h.pitchArm;
    s.omega += (moment - TUNE.pitchDamp * s.omega) * dt;
    s.theta += s.omega * dt;
    if (s.theta <= 0) {
      s.theta = 0;
      if (s.omega < 0) s.omega = 0;
    }

    // Bumps: the rear wheel hitting one pushes the pivot up, which drops the
    // nose. The front wheel hitting one while it's on the ground gives a small pop.
    for (const b of terrain.bumpsBetween(x0, s.x)) {
      // at speed the tyre skims the bump rather than climbing it, so the kick levels off
      s.omega -= b.h * (1.5 + TUNE.bumpKick * Math.min(s.v, 15));
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
      // You can't hold a wheelie at walking pace: let the speed bleed away
      // and the front comes down.
      if (s.wheelieTime > 1 && s.v < STALL_SPEED && s.theta > 0) {
        s.inWheelie = false;
        s.status = 'landed';
        s.stalled = true;
        s.score = s.wheelieDist;
        return;
      }
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
    DEG, CRASH_ANGLE, COM_ANGLE, FIXED_DT, MIN_WHEELIE_TIME, STALL_SPEED, TUNE,
    deriveHandling, driveAt, pitchGainAt, frontAxle, pickupHeight, PICKUP_RADIUS, createTerrain, createState, step, substep, balanceAngle, mulberry32,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WheelieSim = api;
})(typeof self !== 'undefined' ? self : this);
