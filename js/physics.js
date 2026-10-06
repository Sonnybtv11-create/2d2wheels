/*
 * Bike physics. A simplified arcade model of a chassis on two
 * spring-damped wheels:
 *   - The chassis has heave (vertical motion of the rear axle point) and
 *     pitch about that point.
 *   - The rear shock and front fork are spring-dampers with sag, travel and
 *     a stiff bottom-out stop. Wheels follow the ground with a wheel-sized
 *     envelope, so they roll over logs and rocks instead of clipping them.
 *   - Drive force at the rear tyre lifts the nose, the brakes pull it down,
 *     and gravity pulls it down until the centre of mass passes over the
 *     rear axle (the balance point). Gravity is taken in the chassis's
 *     accelerating frame, so a jolt under the rear wheel drops the nose and
 *     in free fall the bike only rotates by throttle and brake.
 *   - Rear grip depends on how much load the rear tyre carries and on how
 *     wet the track is.
 * The police chaser, the obstacles and the weather's effect on the ride live
 * here too, so all of it can be tested in Node. No DOM.
 */
(function (root) {
  'use strict';

  const G = 9.81;
  const DEG = Math.PI / 180;
  const RIDER_KG = 80;
  const COM_ANGLE = 35 * DEG;     // centre of mass elevation seen from the rear axle
  const CRASH_ANGLE = 80 * DEG;   // rear fender meets the ground
  const WHEELIE_START = 3 * DEG;
  const FIXED_DT = 1 / 240;
  const FORK_RAKE = 25 * DEG;

  // Feel knobs, kept together so tests and tuning scripts can sweep them.
  const TUNE = {
    pitchGain: 2.3,     // arcade boost on the drive moment at a standstill, so every bike can pop the front
    pitchGainTop: 1.7,  // the boost at top speed
    brakeGain: 1.6,     // how hard braking pulls the nose down, relative to its decel
    pitchArm: 3.0,      // effective lever (m); longer = slower to rotate
    pitchDamp: 4.3,
    powerDamp: 0.8,     // how much a bike's launch slows its pitch response (0 = not at all)
    knee: 0.45,         // drive is torque-limited below knee * vmax, power-limited above
    rearBrake: 6.5,     // decel from the rear brake alone (wheelie)
    bothBrakes: 9,      // decel with both wheels down (front and rear)
    roll: 0.25,         // rolling resistance (m/s²)
    throttleUp: 4, throttleDown: 7,
    brakeUp: 4, brakeDown: 10,
    leanRate: 4,
    mudRoll: 6,         // rolling resistance multiplier in mud
    grip: 1.25,         // arcade grip factor on top of the tyre's friction
    // suspension (per unit mass): rear shock and front fork
    rearK: 140, rearC: 12, rearTravel: 0.26,
    forkK: 60, forkC: 9, forkTravel: 0.24,
    rebound: 2.4,       // rebound damping relative to compression damping
    frontLever: 1.6,    // front axle distance over centre-of-mass distance, from the rear axle
    // Wheelie boost (arcade): while the front is up the bike slips through the
    // air more easily and gets a small push. Neither is felt in pitch, so the
    // throttle still steers the wheelie.
    boostDrag: 0.5,     // drag multiplier in a wheelie
    boost: 0.22,        // extra thrust, as a share of launch acceleration
    boostFrom: 1.0, boostTop: 1.2, // the push fades out between these multiples of top speed
    wind: 1.2,          // how much the wind's push on the rider pitches the bike
    airThrottle: 2.2, airBrake: 3.5, // rotation in the air from wheel spin-up / braking (rad/s²)
    // The pop: snapping into a lean-back with the front down and the throttle
    // on kicks the nose up (body weight plus the fork's rebound). Dipping
    // forward first loads the fork for a bigger pop.
    pop: 2.3,           // pitch rate kick (rad/s)
    popPreload: 1.0,    // extra kick at full extra fork compression
    popMaxAngle: 10 * DEG, // works from a low wheelie too, not just with the front down
    popCooldown: 0.5,
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
    const wheelbase = (bike.look && bike.look.wheelbase) || 1.3;
    const R = (bike.look && bike.look.wheelRadius) || 0.31;
    const h = {
      mass, launch, vmax, vKnee, wheelbase, wheelRadius: R,
      // Air drag sized so full throttle tops out at the real top speed.
      dragK: Math.max(0, (launch * vKnee) / vmax - TUNE.roll) / (vmax * vmax),
      // A light bike moves further when the rider shifts their weight.
      leanAngle: 10 * DEG * Math.min(1.2, 140 / mass),
      // Heavier, longer, more powerful bikes rotate more slowly per unit of
      // drive, so big power stays catchable rather than twitchy.
      pitchArm: TUNE.pitchArm * Math.pow(mass / 140, 0.25) * Math.pow(launch / 7, TUNE.powerDamp),
    };
    // Static sag with both wheels down (and the rider sat neutral).
    const ff = (G * Math.cos(COM_ANGLE)) / TUNE.frontLever;
    h.forkSag = ff / TUNE.forkK;
    h.rearSag = (G - ff) / TUNE.rearK;
    return h;
  }

  function pitchGainAt(h, v) {
    return TUNE.pitchGain + (TUNE.pitchGainTop - TUNE.pitchGain) * clamp(v / h.vmax, 0, 1);
  }

  // Drive acceleration available at full throttle (before grip).
  function driveAt(h, v) {
    return h.launch * Math.min(1, h.vKnee / Math.max(v, 0.5));
  }

  // Wheelie boost thrust at speed v.
  function boostAt(h, v) {
    return TUNE.boost * h.launch * clamp((TUNE.boostTop - v / h.vmax) / (TUNE.boostTop - TUNE.boostFrom), 0, 1);
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

  /* ------------------------------------------------------------------ */
  /* Terrain: rollers, bumps, whoops, mud, puddles and obstacles          */
  /* ------------------------------------------------------------------ */

  const BUMP_HALF_WIDTH = 0.35;

  // Obstacle kinds. `tall` ones can't be climbed by the front wheel: get it
  // over the top or crash. Cones are knocked flying.
  const OBSTACLES = {
    log:   { h: [0.2, 0.27], tall: false },
    rock:  { h: [0.14, 0.26], tall: false },
    tyres: { h: [0.34, 0.38], tall: true },
    cones: { h: [0.3, 0.3], tall: false, soft: true },
  };

  function obstacleProfile(o, x) {
    const u = (x - o.x) / o.w; // -0.5 .. 0.5 across the obstacle
    if (u <= -0.5 || u >= 0.5) return 0;
    switch (o.type) {
      case 'log': return o.h * Math.sqrt(Math.max(0, 1 - 4 * u * u));
      case 'rock': return o.h * Math.pow(Math.max(0, 1 - 4 * u * u), 0.6) * (1 + 0.12 * Math.sin(u * 17 + o.x));
      case 'tyres': return o.h * Math.min(1, (0.5 - Math.abs(u)) / 0.12);
      default: return 0; // cones don't hold the bike up
    }
  }

  function createTerrain(seed) {
    const rnd = mulberry32(seed);
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
    // The first stretch is flat so the player can get going.
    const ramp = (x) => clamp((x - 60) / 600, 0, 1);
    // Long rollers only: short, steep waves made high-speed wheelies a lottery.
    const base = (x) => ramp(x) * (1.1 * Math.sin(x / 41 + p1) + 0.45 * Math.sin(x / 17 + p2) + 0.05 * Math.sin(x / 7 + p3));

    // Track features: whoops (a run of rhythmic bumps) and mud (drags the
    // bike, so it needs more throttle, which lifts the nose). Puddles fill
    // up when it rains.
    const features = [];
    let fx = 150;
    while (fx < 30000) {
      const r = rnd();
      const type = r < 0.4 ? 'whoops' : r < 0.7 ? 'mud' : 'puddle';
      const len = type === 'puddle' ? 5 + rnd() * 6 : 14 + rnd() * 10;
      features.push({ type, x0: fx, x1: fx + len });
      fx += len + 70 + rnd() * 80;
    }
    const inFeature = (x, pad) => features.some((f) => x > f.x0 - pad && x < f.x1 + pad);

    const bumps = [];
    let bx = 70;
    while (bx < 30000) {
      bx += 40 + rnd() * 80;
      if (!inFeature(bx, 4)) bumps.push({ x: bx, h: 0.05 + rnd() * 0.06 });
    }
    for (const f of features) {
      if (f.type !== 'whoops') continue;
      for (let x = f.x0 + 1.5; x < f.x1; x += 3.2) bumps.push({ x, h: 0.06 + rnd() * 0.03 });
    }
    bumps.sort((a, b) => a.x - b.x);

    // Obstacles: sparse at first, closer together the further you get.
    const obstacles = [];
    let ox = 90;
    while (ox < 30000) {
      const gap = Math.max(22, 70 - ox / 40) * (0.7 + rnd() * 0.6);
      ox += gap;
      if (inFeature(ox, 6) || bumps.some((b) => Math.abs(b.x - ox) < 3)) continue;
      const r = rnd();
      const type = r < 0.34 ? 'log' : r < 0.62 ? 'rock' : r < 0.84 ? 'tyres' : 'cones';
      const k = OBSTACLES[type];
      const hgt = k.h[0] + rnd() * (k.h[1] - k.h[0]);
      if (type === 'cones') {
        for (let i = 0; i < 3; i++) obstacles.push({ type, x: ox + i * 1.6, w: 0.35, h: hgt, tall: false, soft: true, seed: rnd() });
      } else {
        const w = type === 'log' ? hgt : type === 'rock' ? hgt * (2.6 + rnd()) : 0.7;
        obstacles.push({ type, x: ox, w, h: hgt, tall: k.tall, soft: false, seed: rnd() });
      }
    }

    function firstIndex(list, x) {
      let lo = 0, hi = list.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].x < x) lo = mid + 1; else hi = mid;
      }
      return lo;
    }

    function bumpAt(x) {
      const b = bumps[firstIndex(bumps, x - BUMP_HALF_WIDTH)];
      if (!b || Math.abs(x - b.x) > BUMP_HALF_WIDTH) return 0;
      const t = (x - b.x) / BUMP_HALF_WIDTH;
      return b.h * 0.5 * (1 + Math.cos(t * Math.PI));
    }

    function obstacleAt(x) {
      let hgt = 0;
      for (let i = firstIndex(obstacles, x - 0.6); i < obstacles.length && obstacles[i].x < x + 0.6; i++) {
        hgt = Math.max(hgt, obstacleProfile(obstacles[i], x));
      }
      return hgt;
    }

    const height = (x) => base(x) + bumpAt(x) + obstacleAt(x);

    // Height of the bottom of a wheel of radius R centred over x: the
    // highest the ground pushes it, allowing for the wheel's curve.
    function wheelY(x, R) {
      let best = -Infinity;
      for (let i = -4; i <= 4; i++) {
        const dx = (i / 4) * R * 0.95;
        const y = height(x + dx) - (R - Math.sqrt(R * R - dx * dx));
        if (y > best) best = y;
      }
      return best;
    }

    function featureAt(x, type) {
      for (const f of features) {
        if (f.x0 > x) return false;
        if (f.type === type && x < f.x1) return true;
      }
      return false;
    }

    return {
      bumps, features, obstacles,
      height,
      surface: (x) => base(x) + bumpAt(x), // the dirt itself, without obstacles on it
      base,
      wheelY,
      // Rollers only; bumps and obstacles act through the wheels.
      slope: (x) => (base(x + 0.05) - base(x - 0.05)) / 0.1,
      obstaclesNear(a, b) {
        const out = [];
        for (let i = firstIndex(obstacles, a); i < obstacles.length && obstacles[i].x <= b; i++) out.push(obstacles[i]);
        return out;
      },
      mudAt: (x) => featureAt(x, 'mud'),
      puddleAt: (x) => featureAt(x, 'puddle'),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Conditions: wind and rain over time                                 */
  /* ------------------------------------------------------------------ */

  // kind: clear | windy | rain | storm.  Wind is + for a headwind.
  function createWeather(seed, kind) {
    const rnd = mulberry32(seed ^ 0x5eed);
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
    const windy = kind === 'windy' ? 1 : kind === 'storm' ? 0.85 : kind === 'rain' ? 0.35 : 0.15;
    const mean = (rnd() < 0.5 ? -1 : 1) * windy * (3 + rnd() * 3);
    const rainy = kind === 'rain' ? 0.7 : kind === 'storm' ? 1 : 0;
    return {
      kind,
      // Steady wind plus slow swings and sharp gusts.
      wind(t) {
        const swing = Math.sin(t * 0.07 + ph[0]) * 4 + Math.sin(t * 0.23 + ph[1]) * 2;
        const gust = Math.max(0, Math.sin(t * 0.9 + ph[2]) * Math.sin(t * 0.31 + ph[3])) * 9;
        return (mean + swing * windy + Math.sign(mean || 1) * gust * windy) ;
      },
      // Rain intensity 0..1, with showers coming and going.
      rain(t) {
        if (!rainy) return 0;
        return clamp(rainy * (0.65 + 0.35 * Math.sin(t * 0.05 + ph[1])), 0, 1);
      },
      // How wet the track is: catches up with the rain over ~20 s.
      wet: rainy ? Math.min(1, rainy * 0.9) : 0,
      lightningSeed: rnd(),
    };
  }

  const NO_WEATHER = { kind: 'clear', wind: () => 0, rain: () => 0, wet: 0 };

  /* ------------------------------------------------------------------ */
  /* State                                                                */
  /* ------------------------------------------------------------------ */

  function createState(opts = {}) {
    return {
      x: opts.x || 0, v: 0, a: 0,
      theta: 0, omega: 0,
      // heave: chassis height offset above its static ride height, and its speed
      yq: 0, vy: 0, ay: 0,
      cr: 0, crPrev: 0, cf: 0, cfPrev: 0, // suspension compression (m)
      rearLoad: 1, frontLoad: 0, airborne: false, frontDown: true,
      throttle: 0, brake: 0, lean: 0, braking: false,
      spin: 0, // rear wheelspin 0..1
      leanIn: 0, popT: 0, // last lean input, time since the last pop
      status: 'riding',            // riding | crashed | busted
      cause: '',                   // why the run ended
      inWheelie: false, wheelieStartX: 0, wheelieDist: 0, wheelieTime: 0,
      longest: 0, wheelieTotal: 0, distance: 0,
      time: 0, crashT: 0,
      inMud: false, inPuddle: false, wind: 0,
      events: [],                  // impacts etc. for sound and dust; the game drains it
      hit: new Set(),              // obstacles the front wheel has reached
      hitRear: new Set(),          // ... and the rear
      police: opts.police ? { x: (opts.x || 0) - 60 - 4.8, v: 0, active: false, gap: 60 } : null,
    };
  }

  function balanceAngle(s, h) {
    return 90 * DEG - COM_ANGLE - s.lean * h.leanAngle;
  }

  /* ------------------------------------------------------------------ */
  /* Step                                                                 */
  /* ------------------------------------------------------------------ */

  function substep(s, input, h, terrain, dt) {
    s.time += dt;
    const env = terrain.env || NO_WEATHER;
    if (s.status !== 'riding') {
      s.v = Math.max(0, s.v - (s.status === 'crashed' ? 12 : 6) * dt);
      s.x += s.v * dt;
      s.crashT += dt;
      if (s.police) stepPolice(s, h, dt, true);
      return;
    }

    // Keys are on/off, but throttle and brake ramp, so a tap is a small input
    // and a hold is a big one.
    s.throttle += clamp((input.throttle ? 1 : 0) - s.throttle, -TUNE.throttleDown * dt, TUNE.throttleUp * dt);
    s.brake += clamp((input.brake ? 1 : 0) - s.brake, -TUNE.brakeDown * dt, TUNE.brakeUp * dt);
    s.lean += clamp((input.lean || 0) - s.lean, -TUNE.leanRate * dt, TUNE.leanRate * dt);
    s.braking = s.brake > 0.3;

    const R = h.wheelRadius, WB = h.wheelbase;
    // The pop (see TUNE.pop).
    const leanIn = input.lean || 0;
    s.popT += dt;
    if (leanIn > 0.5 && s.leanIn <= 0 && input.throttle && s.cr > 0 && s.theta < TUNE.popMaxAngle && s.popT > TUNE.popCooldown) {
      const preload = s.cf > 0 ? clamp((s.cf - h.forkSag) / 0.1, 0, 1) : 0;
      s.omega += (TUNE.pop + TUNE.popPreload * preload) * Math.sqrt(3 / h.pitchArm);
      s.popT = 0;
      s.events.push({ type: 'pop', preload });
    }
    s.leanIn = leanIn;
    const slope = Math.atan(terrain.slope(s.x));
    const psi = s.theta + slope;

    /* --- suspension geometry --- */
    // Rear: compression = how far the chassis sits below the free ride height
    // above the rear wheel's contact.
    const groundR = terrain.wheelY(s.x, R);
    const baseR = terrain.base(s.x);
    s.cr = h.rearSag + (groundR - baseR) - s.yq;
    // Front: where the front wheel would be with the fork fully extended.
    const xf = s.x + WB * Math.cos(psi);
    const groundF = terrain.wheelY(xf, R);
    // The chassis's rear axle reference sits at baseR + yq (both wheels share
    // the same radius, so it drops out). With the fork at its static sag the
    // front axle reference is WB·sin(psi) higher.
    const frontRef = baseR + s.yq + WB * Math.sin(psi);
    s.cf = h.forkSag + groundF - frontRef;
    const crRate = (s.cr - s.crPrev) / dt;
    const cfRate = (s.cf - s.cfPrev) / dt;
    s.crPrev = s.cr; s.cfPrev = s.cf;

    // Spring plus damper. The damper's force is capped, like a real shock's
    // valving blowing off on sharp hits; the end of travel is handled as a
    // hard stop below (no bounce).
    // Rebound is damped harder than compression, as on a real shock, so a
    // hit is released slowly instead of springing the bike into the air.
    const spring = (c, rate, k, damp, travel) => {
      if (c <= 0) return 0;
      const d = rate < 0 ? damp * TUNE.rebound : damp;
      const f = k * Math.min(c, travel * 1.05) + clamp(d * rate, -3 * G, 3.5 * G);
      return Math.max(0, f);
    };
    const Fr = spring(s.cr, crRate, TUNE.rearK, TUNE.rearC, TUNE.rearTravel);
    const Ff = spring(s.cf, cfRate, TUNE.forkK, TUNE.forkC, TUNE.forkTravel);

    s.rearLoad += (Fr / G - s.rearLoad) * Math.min(1, dt * 30);
    s.frontLoad = Ff / G;
    const rearDown = s.cr > 0;
    s.frontDown = s.cf > 0;
    s.airborne = !rearDown && !s.frontDown;

    /* --- grip, drive and brakes --- */
    const mud = terrain.mudAt(s.x);
    const puddle = env.wet > 0 && terrain.puddleAt(s.x);
    s.inMud = mud; s.inPuddle = puddle;
    const mu = puddle ? 0.45 : 1 - 0.25 * env.wet;
    const moving = s.v > 0.01;
    const want = s.throttle * driveAt(h, s.v);
    const gripLimit = rearDown ? mu * TUNE.grip * G * clamp(s.rearLoad, 0, 1.8) : 0;
    const drive = Math.min(want, gripLimit);
    s.spin += ((want > gripLimit + 0.3 && rearDown ? 1 : 0) - s.spin) * Math.min(1, dt * 8);
    const brakeMax = s.frontDown ? TUNE.bothBrakes : TUNE.rearBrake;
    const brakeGrip = s.frontDown ? mu * TUNE.grip * G : gripLimit;
    const brake = moving ? Math.min(s.brake * brakeMax, brakeGrip) * (s.airborne ? 0 : 1) : 0;
    const roll = moving && !s.airborne ? TUNE.roll * (mud ? TUNE.mudRoll : 1) * (s.frontDown ? 1 : 0.6) + (puddle ? 0.4 : 0) : 0;
    s.wind = env.wind(s.time);
    const air = s.v + s.wind;
    s.inWheelie = !s.frontDown && rearDown && s.theta > WHEELIE_START;
    const drag = h.dragK * air * Math.abs(air) * (s.inWheelie ? TUNE.boostDrag : 1);
    const boost = s.inWheelie ? boostAt(h, s.v) : 0;
    let a = drive + boost - brake - roll - drag - (s.airborne ? 0 : G * Math.sin(slope));
    if (s.v <= 0 && a < 0) a = 0;
    s.a = a;

    const x0 = s.x;
    s.v = Math.max(0, s.v + a * dt);
    s.x += s.v * dt;

    /* --- heave --- */
    // Up is positive. Spring forces hold the chassis up against gravity.
    const ay = -G + Fr + Ff * Math.cos(psi);
    s.ay = ay;
    s.vy += ay * dt;
    s.yq += s.vy * dt; // relative to the rollers, which carry the bike along
    {
      // End of rear travel: the chassis can't sink further onto the wheel.
      // Inelastic, so a hard hit is absorbed rather than bounced.
      const gR = terrain.wheelY(s.x, R) - terrain.base(s.x);
      const c = h.rearSag + gR - s.yq;
      if (c > TUNE.rearTravel) {
        const rise = (gR - (groundR - baseR)) / dt;
        if (s.vy < rise - 1.5) s.events.push({ type: 'bottom', end: 'rear', strength: rise - s.vy });
        s.yq = h.rearSag + gR - TUNE.rearTravel;
        s.vy = Math.max(s.vy, Math.min(rise, 2.5));
      }
    }

    /* --- pitch about the rear axle --- */
    const phi = COM_ANGLE + s.lean * h.leanAngle;
    const beta = s.theta + phi;
    let alpha;
    if (s.airborne) {
      // In the air only the wheels' spin-up and braking rotate the bike.
      alpha = s.throttle * TUNE.airThrottle - s.brake * TUNE.airBrake - 0.5 * s.omega;
    } else {
      // The arcade boost stands in for the suspension pop and body English a
      // real rider uses to get the front up; it eases off towards top speed.
      const gain = pitchGainAt(h, s.v);
      // The wind shoves the rider, high above the centre of mass: a
      // headwind lifts the nose, a tailwind pushes it down.
      const windPush = TUNE.wind * h.dragK * (air * Math.abs(air) - s.v * s.v);
      const push = (rearDown ? gain * drive : 0) - TUNE.brakeGain * brake - roll - G * Math.sin(slope) + windPush;
      const geff = G + ay; // gravity felt in the chassis's accelerating frame
      const moment = push * Math.sin(beta) - geff * Math.cos(beta + slope) + Ff * TUNE.frontLever * Math.cos(psi);
      alpha = moment / h.pitchArm - TUNE.pitchDamp * s.omega;
    }
    s.omega += alpha * dt;
    s.theta += s.omega * dt;
    {
      // End of fork travel: the nose can't drop further onto the front wheel.
      const p2 = s.theta + slope;
      const gF = terrain.wheelY(s.x + WB * Math.cos(p2), R);
      const c = h.forkSag + gF - (terrain.base(s.x) + s.yq + WB * Math.sin(p2));
      if (c > TUNE.forkTravel) {
        if (s.omega < -0.6) s.events.push({ type: 'bottom', end: 'front', strength: -s.omega * WB });
        s.theta += (c - TUNE.forkTravel) / (WB * Math.max(0.3, Math.cos(p2)));
        s.omega = Math.max(s.omega, 0);
      }
    }

    /* --- obstacles --- */
    const psi2 = s.theta + slope;
    const fx = s.x + WB * Math.cos(psi2);
    // bottom of the front tyre with the fork hanging free, measured like the ground
    const frontFree = terrain.base(s.x) + s.yq + WB * Math.sin(psi2) - h.forkSag;
    for (const o of terrain.obstaclesNear(Math.min(x0, fx) - 1.5, fx + 1.5)) {
      if (!s.hit.has(o) && Math.abs(fx - o.x) < o.w / 2 + R * 0.35) {
        s.hit.add(o);
        const top = terrain.base(o.x) + o.h;
        const clear = frontFree > top - o.h * (o.tall ? 0.1 : 0.25);
        if (o.soft) {
          s.events.push({ type: 'cone', obstacle: o, v: s.v });
          s.v *= 0.97;
        } else if (!clear) {
          if (o.tall) {
            s.events.push({ type: 'impact', obstacle: o, strength: 3, end: 'front', v: s.v });
            s.v = Math.min(s.v, 2.5); // the stack stops the bike; the rider carries on
            crash(s, 'Hit the tyre stack');
            return;
          }
          // climbing it with the front wheel costs speed
          s.v *= 1 - clamp(o.h * 0.6, 0, 0.18);
          s.events.push({ type: 'impact', obstacle: o, strength: o.h * s.v * 0.4, end: 'front' });
        } else {
          s.events.push({ type: 'clear', obstacle: o });
        }
      }
      if (!o.soft && !s.hitRear.has(o) && Math.abs(s.x - o.x) < o.w / 2 + R * 0.35) {
        s.hitRear.add(o);
        s.v *= 1 - clamp(o.h * 0.2, 0, 0.08);
        s.events.push({ type: 'impact', obstacle: o, strength: o.h * s.v * 0.3, end: 'rear' });
      }
    }

    if (s.theta >= CRASH_ANGLE) { crash(s, 'Looped out'); return; }
    if (s.theta < -25 * DEG) { crash(s, 'Went over the bars'); return; }

    /* --- wheelie bookkeeping --- */
    const dx = s.x - x0;
    s.distance += dx;
    if (s.inWheelie) {
      if (s.wheelieTime === 0) s.wheelieStartX = x0;
      s.wheelieTime += dt;
      s.wheelieDist = s.x - s.wheelieStartX;
      s.wheelieTotal += dx;
      s.longest = Math.max(s.longest, s.wheelieDist);
    } else if (s.frontDown && s.wheelieTime > 0) {
      if (s.wheelieTime > 0.3) s.events.push({ type: 'touchdown', dist: s.wheelieDist, rate: cfRate });
      s.wheelieTime = 0;
      s.wheelieDist = 0;
    }

    if (s.police) stepPolice(s, h, dt, false);
  }

  function crash(s, cause) {
    s.status = 'crashed';
    s.cause = cause;
    s.inWheelie = false;
  }

  /* ------------------------------------------------------------------ */
  /* Police                                                               */
  /* ------------------------------------------------------------------ */

  const COP = {
    startAfter: 4,      // seconds before the cruiser rolls
    startGap: 60,       // metres behind at the start
    accel: 4.5,         // m/s²
    base: 0.7,          // cruising speed as a share of the bike's top speed at the start
    ramp: 0.005,        // ... climbing this much per second: faster than any bike on two
    cap: 1.2,           //     wheels after about a minute, so you have to wheelie
    catchUp: 0.5,       // extra speed share when far behind, so the pressure stays on
    catchFrom: 45,      // ... from this gap (m), reaching full strength 60 m further back
    refCap: 30,         // pace is set from the bike's top speed, capped here (m/s), so the
                        // Varg isn't chased at a pace only its two-wheel top speed can match
    length: 4.8,        // the car
  };

  function stepPolice(s, h, dt, ended) {
    const p = s.police;
    if (!p.active && s.time > COP.startAfter) p.active = true;
    if (!p.active) { p.gap = s.x - p.x - COP.length; return; }
    const gap = s.x - p.x - COP.length;
    let target = Math.min(h.vmax, COP.refCap) * Math.min(COP.cap, COP.base + COP.ramp * s.time);
    if (gap > COP.catchFrom) target *= 1 + COP.catchUp * Math.min(1, (gap - COP.catchFrom) / 60);
    let brake = 8;
    if (ended) {
      // pull up behind the stopped bike rather than through it
      target = Math.min(target, s.v + (gap > 2 ? 3 : 0));
      brake = clamp((p.v * p.v - s.v * s.v) / (2 * Math.max(0.5, gap - 2)), 8, 40);
    }
    p.v += clamp(target - p.v, -brake * dt, COP.accel * dt);
    p.x += p.v * dt;
    if (ended) p.x = Math.min(p.x, s.x - COP.length - 0.5);
    p.gap = s.x - p.x - COP.length;
    if (!ended && p.gap <= 0) {
      s.status = 'busted';
      s.cause = 'Busted';
      s.inWheelie = false;
      p.x = s.x - COP.length;
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

  // Suspension offsets for drawing: how far each wheel sits from its static
  // sag position, towards the chassis (positive) or away (negative).
  function wheelOffsets(s, h) {
    return {
      rear: Math.max(0, Math.min(s.cr, TUNE.rearTravel + 0.02)) - h.rearSag,
      front: (s.cf > 0 ? Math.min(s.cf, TUNE.forkTravel + 0.02) : 0) - h.forkSag,
    };
  }

  // Height of the chassis's rear axle reference above the ground line the
  // bike is drawn from (the rollers at x, plus heave).
  function chassisY(s, terrain) {
    return terrain.base(s.x) + s.yq;
  }

  const api = {
    G, DEG, CRASH_ANGLE, COM_ANGLE, FIXED_DT, FORK_RAKE, TUNE, COP, OBSTACLES,
    deriveHandling, driveAt, boostAt, pitchGainAt, wheelOffsets, chassisY,
    createTerrain, createWeather, createState, step, substep, balanceAngle, mulberry32, obstacleProfile,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WheelieSim = api;
})(typeof self !== 'undefined' ? self : this);
