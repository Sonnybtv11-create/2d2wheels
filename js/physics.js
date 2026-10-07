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
    // Wheelies score, two wheels are fast. Sitting up in a wheelie puts the
    // rider into the air; tucked down over the bars on two wheels cuts the
    // drag. Neither is felt in pitch, so the throttle still steers a wheelie.
    wheelieDrag: 1.12,  // drag multiplier in a wheelie
    // A small arcade push in a wheelie (not felt in pitch), so a high
    // wheelie isn't a crawl. It fades out well below top speed, so a wheelie
    // is never the quickest way down the track.
    wheelieThrust: 0.14, thrustFade: [0.55, 0.85],
    tuckDrag: 0.62,     // ... tucked on two wheels: about 17% more top speed
    tuckRate: 3,        // how quickly the rider gets down into the tuck (1/s)
    tuckMaxAngle: 10 * DEG,
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

  // `mods` (from Parts.apply) adjusts the stock bike for fitted parts:
  // gearing (torque), suspension, tyre grip, brakes, how well the
  // suspension soaks up obstacles, pop strength, perks and ride modes.
  function deriveHandling(bike, mods) {
    mods = mods || {};
    const mass = bike.weightKg + RIDER_KG;
    const powerToMass = (bike.peakPowerKw * 1000) / mass;
    // Launch acceleration grows with power-to-weight, compressed so the
    // Varg is a handful rather than impossible.
    const launch = (6 + 2.5 * Math.log(powerToMass / 30)) * (mods.torque ? Math.pow(mods.torque, 0.6) : 1);
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
    // Suspension, grip and brakes, with any fitted parts.
    const su = mods.susp || {};
    h.forkK = TUNE.forkK * (su.forkK || 1);
    h.forkC = TUNE.forkC * (su.forkC || 1);
    h.forkTravel = TUNE.forkTravel + (su.forkTravel || 0) + (mods.antiBottom ? 0.015 : 0);
    h.rearK = TUNE.rearK * (su.rearK || 1);
    h.rearC = TUNE.rearC * (su.rearC || 1);
    h.rearTravel = TUNE.rearTravel + (su.rearTravel || 0) + (mods.antiBottom ? 0.015 : 0);
    h.grip = Object.assign({ dry: 1, wet: 1, mud: 1 }, mods.grip);
    h.brake = mods.brake || 1;
    h.absorb = mods.absorb || 0;
    h.pop = mods.pop || 1;
    h.perks = mods.perks || new Set(['modes']);
    h.modes = mods.modes || [{ name: 'Sport', power: 1, cap: 0, ramp: 1 }];
    // Static sag with both wheels down (and the rider sat neutral).
    const ff = (G * Math.cos(COM_ANGLE)) / TUNE.frontLever;
    h.forkSag = ff / h.forkK;
    h.rearSag = (G - ff) / h.rearK;
    return h;
  }

  function pitchGainAt(h, v) {
    return TUNE.pitchGain + (TUNE.pitchGainTop - TUNE.pitchGain) * clamp(v / h.vmax, 0, 1);
  }

  // Drive acceleration available at full throttle (before grip).
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
    // Overhead: a pipeline or a barrier arm across the track. `h` is the gap
    // underneath. A tucked rider fits under; sitting up, or with the front
    // up, you hit it.
    pipe:  { h: [1.58, 1.66], overhead: true },
    gate:  { h: [1.58, 1.62], overhead: true },
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
      let type = r < 0.27 ? 'log' : r < 0.49 ? 'rock' : r < 0.67 ? 'tyres' : r < 0.78 ? 'cones' : r < 0.9 ? 'pipe' : 'gate';
      const prev = obstacles[obstacles.length - 1];
      // room to set the front down before ducking under, and to pop after
      if (OBSTACLES[type].overhead && (ox < 150 || (prev && ox - prev.x < 32))) type = 'rock';
      if (prev && prev.overhead && ox - prev.x < 32) ox = prev.x + 32;
      const k = OBSTACLES[type];
      const hgt = k.h[0] + rnd() * (k.h[1] - k.h[0]);
      if (k.overhead) {
        obstacles.push({ type, x: ox, w: type === 'pipe' ? 0.6 : 0.12, h: hgt, tall: false, soft: false, overhead: true, seed: rnd() });
      } else if (type === 'cones') {
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
  /* Conditions: rain over time                                          */
  /* ------------------------------------------------------------------ */

  // kind: clear | rain | storm.
  function createWeather(seed, kind) {
    const rnd = mulberry32(seed ^ 0x5eed);
    const ph = rnd() * 6.28;
    const rainy = kind === 'rain' ? 0.7 : kind === 'storm' ? 1 : 0;
    return {
      kind,
      // Rain intensity 0..1, with showers coming and going.
      rain(t) {
        if (!rainy) return 0;
        return clamp(rainy * (0.65 + 0.35 * Math.sin(t * 0.05 + ph)), 0, 1);
      },
      // How wet the track is: catches up with the rain over ~20 s.
      wet: rainy ? Math.min(1, rainy * 0.9) : 0,
      lightningSeed: rnd(),
    };
  }

  const NO_WEATHER = { kind: 'clear', rain: () => 0, wet: 0 };

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
      tuck: 0,                     // 0..1, how far down into the tuck the rider is
      mode: '', launchArmed: false, launchT: 0, rev: 0, clutchHeld: false, assist: 0,
      status: 'riding',            // riding | crashed | busted
      cause: '',                   // why the run ended
      inWheelie: false, wheelieStartX: 0, wheelieDist: 0, wheelieTime: 0,
      longest: 0, wheelieTotal: 0, distance: 0,
      time: 0, crashT: 0,
      inMud: false, inPuddle: false,
      events: [],                  // impacts etc. for sound and dust; the game drains it
      hit: new Set(),              // obstacles the front wheel has reached
      hitRear: new Set(),          // ... and the rear
      police: opts.police ? createPolice(opts) : null,
      stingers: [], nextStinger: 0,
      rng: mulberry32((opts.seed || 1) ^ 0x51ce),
    };
  }

  function createPolice(opts) {
    const level = clamp(Math.round(opts.wanted || 2), 1, 5);
    const cfg = Object.assign({}, COP, WANTED[level]);
    return { x: (opts.x || 0) - cfg.startGap - COP.length, v: 0, active: false, gap: cfg.startGap, level, cfg };
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
    const mode = h.modes[(input.mode | 0) % h.modes.length];
    s.mode = mode.name;
    const perks = h.perks;
    // Launch control: hold gas and brake at a standstill to arm it, let go of
    // the brake to launch. It pins the throttle and holds the front low.
    if (perks.has('launch')) {
      if (s.v < 1 && input.throttle && input.brake) s.launchArmed = true;
      else if (s.launchArmed && !input.brake) { s.launchArmed = false; if (input.throttle) { s.launchT = 2.5; s.events.push({ type: 'launch' }); } }
      else if (!input.throttle) s.launchArmed = false;
    }
    if (s.launchT > 0) s.launchT -= dt;
    const launching = s.launchT > 0 && input.throttle;
    s.throttle += clamp((input.throttle ? 1 : 0) - s.throttle, -TUNE.throttleDown * dt, (launching ? 40 : TUNE.throttleUp * mode.ramp) * dt);
    s.brake += clamp((input.brake && !s.launchArmed ? 1 : 0) - s.brake, -TUNE.brakeDown * dt, TUNE.brakeUp * dt);
    if (s.launchArmed) { s.brake = 0; s.v = 0; }
    s.lean += clamp((input.lean || 0) - s.lean, -TUNE.leanRate * dt, TUNE.leanRate * dt);
    s.braking = s.brake > 0.3;

    const R = h.wheelRadius, WB = h.wheelbase;
    // E-Clutch: hold it and the motor spins up without driving the wheel;
    // let go and it bites, kicking the front up like a clutch-up wheelie.
    const clutchIn = perks.has('clutch') && !!input.clutch;
    if (clutchIn) {
      s.rev = clamp((s.rev || 0) + (input.throttle ? 1.8 : -2) * dt, 0, 1);
    } else if (s.clutchHeld) {
      if (s.rev > 0.15 && s.cr > 0) {
        s.omega += TUNE.pop * 1.5 * s.rev * h.pop * Math.sqrt(3 / h.pitchArm);
        s.throttle = Math.max(s.throttle, s.rev);
        s.events.push({ type: 'clutch', rev: s.rev });
      }
      s.rev = 0;
    }
    s.clutchHeld = clutchIn;
    // The pop (see TUNE.pop).
    const leanIn = input.lean || 0;
    s.popT += dt;
    if (leanIn > 0.5 && s.leanIn <= 0 && input.throttle && s.cr > 0 && s.theta < TUNE.popMaxAngle && s.popT > TUNE.popCooldown) {
      const preload = s.cf > 0 ? clamp((s.cf - h.forkSag) / 0.1, 0, 1) : 0;
      s.omega += (TUNE.pop + TUNE.popPreload * preload) * h.pop * Math.sqrt(3 / h.pitchArm);
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
    const Fr = spring(s.cr, crRate, h.rearK, h.rearC, h.rearTravel);
    const Ff = spring(s.cf, cfRate, h.forkK, h.forkC, h.forkTravel);

    s.rearLoad += (Fr / G - s.rearLoad) * Math.min(1, dt * 30);
    s.frontLoad = Ff / G;
    const rearDown = s.cr > 0;
    s.frontDown = s.cf > 0;
    s.airborne = !rearDown && !s.frontDown;

    /* --- grip, drive and brakes --- */
    const mud = terrain.mudAt(s.x);
    const puddle = env.wet > 0 && terrain.puddleAt(s.x);
    s.inMud = mud; s.inPuddle = puddle;
    // Grip: the tyre's dry grip, less in the wet (less again for tyres that
    // don't clear water), least in a puddle.
    const mu = h.grip.dry * (puddle ? 0.45 * h.grip.wet : 1 - (0.25 * env.wet) / h.grip.wet);
    const moving = s.v > 0.01;
    let want = s.throttle * driveAt(h, s.v) * mode.power;
    if (mode.cap && s.v > mode.cap / 3.6) want *= clamp(1 - (s.v - mode.cap / 3.6) / 1.5, 0, 1);
    if (clutchIn || s.launchArmed) want = 0;
    const gripLimit = rearDown ? mu * TUNE.grip * G * clamp(s.rearLoad, 0, 1.8) : 0;
    const spinning = want > gripLimit + 0.3 && rearDown;
    // A spinning tyre pushes less than one at the limit of grip. Traction
    // control (and launch control) holds it at the limit instead.
    const tc = perks.has('traction') || launching;
    let drive = spinning ? gripLimit * (tc ? 0.98 : 0.85) : Math.min(want, gripLimit);
    let assistBrake = 0;
    // Anti-loop: past the balance point the power fades out. During a launch
    // it holds the front low instead.
    // It looks a little ahead (pitch rate), like the real IMU-based systems,
    // so a fast-rising front is caught before it gets there.
    if (((perks.has('antiLoop') && !input.assistOff) || launching) && !s.frontDown && rearDown) {
      const limit = balanceAngle(s, h) - (launching ? 11 : 8) * DEG;
      const ahead = s.theta + Math.max(0, s.omega) * 0.3;
      if (ahead > limit) {
        drive *= clamp(1 - (ahead - limit) / (5 * DEG), 0, 1);
        // past the cut, it drags the motor like a dab of rear brake
        assistBrake = clamp((ahead - limit - 3 * DEG) / (6 * DEG), 0, 1) * TUNE.rearBrake * 0.7;
        s.assist = 0.3;
      }
    }
    if (s.assist > 0) s.assist -= dt;
    s.spin += ((spinning && !tc ? 1 : 0) - s.spin) * Math.min(1, dt * 8);
    const brakeMax = (s.frontDown ? TUNE.bothBrakes : TUNE.rearBrake) * h.brake;
    const brakeGrip = s.frontDown ? mu * TUNE.grip * G : gripLimit;
    // Regen: rolling off slows the rear wheel like a light brake.
    const regen = perks.has('regen') && !clutchIn && s.throttle < 0.15 && rearDown && s.v > 2 ? 1.6 * (1 - s.throttle / 0.15) : 0;
    const brake = moving ? Math.min(s.brake * brakeMax + regen + assistBrake, Math.max(brakeGrip, regen)) * (s.airborne ? 0 : 1) : 0;
    const roll = moving && !s.airborne ? TUNE.roll * (mud ? TUNE.mudRoll / h.grip.mud : 1) * (s.frontDown ? 1 : 0.6) + (puddle ? 0.4 : 0) : 0;
    s.inWheelie = !s.frontDown && rearDown && s.theta > WHEELIE_START;
    // Tuck: the rider down over the bars, leaning forward with the front
    // down (or skimming just off the ground under hard drive). It's posture,
    // so a bump that unloads the rear doesn't break it.
    const tuckWant = (input.lean || 0) < -0.5 && s.theta < TUNE.tuckMaxAngle;
    s.tuck = clamp(s.tuck + (tuckWant ? 1 : -1.6) * TUNE.tuckRate * dt, 0, 1);
    const dragMul = s.inWheelie ? TUNE.wheelieDrag : 1 - (1 - TUNE.tuckDrag) * s.tuck;
    const drag = h.dragK * s.v * s.v * dragMul;
    const [f0, f1] = TUNE.thrustFade;
    const thrust = s.inWheelie ? TUNE.wheelieThrust * h.launch * clamp((f1 - s.v / h.vmax) / (f1 - f0), 0, 1) : 0;
    let a = drive + thrust - brake - roll - drag - (s.airborne ? 0 : G * Math.sin(slope));
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
      if (c > h.rearTravel) {
        const rise = (gR - (groundR - baseR)) / dt;
        if (s.vy < rise - 1.5) s.events.push({ type: 'bottom', end: 'rear', strength: rise - s.vy });
        s.yq = h.rearSag + gR - h.rearTravel;
        s.vy = Math.max(s.vy, Math.min(rise, 2.5));
      }
    }

    /* --- pitch about the rear axle --- */
    // lying over the tank in a tuck puts more weight forward than a lean
    const phi = COM_ANGLE + s.lean * h.leanAngle - s.tuck * 8 * DEG;
    const beta = s.theta + phi;
    let alpha;
    if (s.airborne) {
      // In the air only the wheels' spin-up and braking rotate the bike.
      alpha = s.throttle * TUNE.airThrottle - s.brake * TUNE.airBrake - 0.5 * s.omega;
    } else {
      // The arcade boost stands in for the suspension pop and body English a
      // real rider uses to get the front up; it eases off towards top speed.
      const gain = pitchGainAt(h, s.v);
      const push = (rearDown ? gain * drive : 0) - TUNE.brakeGain * brake - roll - G * Math.sin(slope);
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
      if (c > h.forkTravel) {
        if (s.omega < -0.6) s.events.push({ type: 'bottom', end: 'front', strength: -s.omega * WB });
        s.theta += (c - h.forkTravel) / (WB * Math.max(0.3, Math.cos(p2)));
        s.omega = Math.max(s.omega, 0);
      }
    }

    /* --- obstacles --- */
    const psi2 = s.theta + slope;
    const fx = s.x + WB * Math.cos(psi2);
    // bottom of the front tyre with the fork hanging free, measured like the ground
    const frontFree = terrain.base(s.x) + s.yq + WB * Math.sin(psi2) - h.forkSag;
    for (const o of terrain.obstaclesNear(Math.min(x0, fx) - 1.5, fx + 1.5)) {
      if (o.overhead) {
        // Overhead: anywhere under it, the rider has to be tucked with the
        // front down. Cleared once the rear wheel is past.
        if (s.hit.has(o)) continue;
        const under = o.x + o.w / 2 > s.x - 0.2 && o.x - o.w / 2 < fx + 0.15;
        if (under && !(s.tuck > 0.6 && s.theta < TUNE.tuckMaxAngle)) {
          s.events.push({ type: 'impact', obstacle: o, strength: 2.5, end: 'rider', v: s.v });
          s.v *= 0.5;
          crash(s, o.type === 'gate' ? 'Hit the barrier' : 'Hit the pipe');
          return;
        }
        if (s.x - 0.2 > o.x + o.w / 2) { s.hit.add(o); s.events.push({ type: 'clear', obstacle: o }); }
        continue;
      }
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
          s.v *= 1 - clamp(o.h * 0.6, 0, 0.18) * (1 - h.absorb);
          s.events.push({ type: 'impact', obstacle: o, strength: o.h * s.v * 0.4 * (1 - h.absorb), end: 'front' });
        } else {
          s.events.push({ type: 'clear', obstacle: o });
        }
      }
      if (!o.soft && !s.hitRear.has(o) && Math.abs(s.x - o.x) < o.w / 2 + R * 0.35) {
        s.hitRear.add(o);
        s.v *= 1 - clamp(o.h * 0.2, 0, 0.08) * (1 - h.absorb);
        s.events.push({ type: 'impact', obstacle: o, strength: o.h * s.v * 0.3 * (1 - h.absorb), end: 'rear' });
      }
    }

    /* --- stingers --- */
    // Spike strips laid across the track ahead. The front tyre has to be off
    // the ground when it reaches one; the rear rolls over the strip after the
    // front has dragged it flat.
    const P = s.police;
    if (P && P.active && P.cfg.stingers) {
      if (!s.nextStinger) s.nextStinger = s.time + P.cfg.stingers[0] * 0.5;
      if (s.time >= s.nextStinger) {
        const [lo, hi] = P.cfg.stingers;
        s.nextStinger = s.time + lo + s.rng() * (hi - lo);
        let sx = s.x + WB + Math.max(STINGER.minAhead, s.v * STINGER.lead);
        // keep clear of obstacles, so there's room to land and pop again
        while (terrain.obstaclesNear(sx - 6, sx + 6).length) sx += 4;
        const st = { x: sx, w: STINGER.w, t: s.time, hit: false };
        s.stingers.push(st);
        s.events.push({ type: 'stinger', stinger: st });
      }
    }
    for (const st of s.stingers) {
      if (st.hit || Math.abs(fx - st.x) > st.w / 2 + R * 0.3) continue;
      st.hit = true;
      if (frontFree < terrain.base(st.x) + 0.08) {
        s.events.push({ type: 'impact', obstacle: { type: 'stinger', x: st.x, w: st.w, h: 0.04 }, strength: 2, end: 'front', v: s.v });
        crash(s, 'Stingered');
        return;
      }
      s.events.push({ type: 'clear', obstacle: { type: 'stinger', x: st.x, w: st.w, h: 0.04 }, stinger: st });
    }
    if (s.stingers.length && s.stingers[0].x < s.x - 40) s.stingers.shift();

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
    ramp: 0.005,        // ... climbing this much per second: past what a wheelie can hold
    cap: 1.1,           //     after about a minute; only a tuck stays ahead of it
    catchUp: 0.5,       // extra speed share when far behind, so the pressure stays on
    catchFrom: 45,      // ... from this gap (m), reaching full strength 60 m further back
    refCap: 30,         // pace is set from the bike's top speed, capped here (m/s), so the
                        // Varg isn't chased at a pace only its two-wheel top speed can match
    length: 4.8,        // the car
  };

  // Wanted levels: how hard the police come after you. Two stars is the
  // standard chase (COP above). From three stars they lay stingers ahead of
  // you; from four a helicopter keeps you in sight, so the cars never fall
  // far behind; at five an interceptor replaces the cruiser.
  const WANTED = [
    null,
    { startAfter: 7, base: 0.6, ramp: 0.003, cap: 1.0, catchUp: 0.3, catchFrom: 60, mult: 1 },
    { mult: 1.5 },
    { startAfter: 3, base: 0.72, ramp: 0.0055, cap: 1.12, catchFrom: 40, stingers: [24, 36], mult: 2 },
    { startAfter: 3, base: 0.74, ramp: 0.006, cap: 1.14, catchUp: 0.7, catchFrom: 28, stingers: [18, 28], heli: true, mult: 3 },
    { startAfter: 2, base: 0.76, ramp: 0.0065, cap: 1.17, catchUp: 0.8, catchFrom: 24, accel: 6, stingers: [14, 22], heli: true, interceptor: true, mult: 4 },
  ];
  const STINGER = { w: 0.5, lead: 3.2, minAhead: 55 };

  function stepPolice(s, h, dt, ended) {
    const p = s.police, C = p.cfg;
    if (!p.active && s.time > C.startAfter) p.active = true;
    if (!p.active) { p.gap = s.x - p.x - COP.length; return; }
    const gap = s.x - p.x - COP.length;
    let target = Math.min(h.vmax, COP.refCap) * Math.min(C.cap, C.base + C.ramp * s.time);
    if (gap > C.catchFrom) target *= 1 + C.catchUp * Math.min(1, (gap - C.catchFrom) / 60);
    let brake = 8;
    if (ended) {
      // pull up behind the stopped bike rather than through it
      target = Math.min(target, s.v + (gap > 2 ? 3 : 0));
      brake = clamp((p.v * p.v - s.v * s.v) / (2 * Math.max(0.5, gap - 2)), 8, 40);
    }
    p.v += clamp(target - p.v, -brake * dt, C.accel * dt);
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
      rear: Math.max(0, Math.min(s.cr, h.rearTravel + 0.02)) - h.rearSag,
      front: (s.cf > 0 ? Math.min(s.cf, h.forkTravel + 0.02) : 0) - h.forkSag,
    };
  }

  // Height of the chassis's rear axle reference above the ground line the
  // bike is drawn from (the rollers at x, plus heave).
  function chassisY(s, terrain) {
    return terrain.base(s.x) + s.yq;
  }

  const api = {
    G, DEG, CRASH_ANGLE, COM_ANGLE, FIXED_DT, FORK_RAKE, TUNE, COP, WANTED, STINGER, OBSTACLES,
    deriveHandling, driveAt, pitchGainAt, wheelOffsets, chassisY,
    createTerrain, createWeather, createState, step, substep, balanceAngle, mulberry32, obstacleProfile,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WheelieSim = api;
})(typeof self !== 'undefined' ? self : this);
