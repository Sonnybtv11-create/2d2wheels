const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../js/physics.js');
const { BIKES } = require('../js/bikes.js');

const D = Sim.DEG;
const byId = (id) => BIKES.find((b) => b.id === id);

// A flat test track with nothing on it.
function flatTrack(seed = 1) {
  const t = Sim.createTerrain(seed);
  t.obstacles.length = 0;
  t.bumps.length = 0;
  t.features.length = 0;
  t.base = () => 0;
  t.slope = () => 0;
  return t;
}

function ride(bike, policy, { terrain = flatTrack(), maxT = 120, police = false } = {}) {
  const h = Sim.deriveHandling(bike);
  const s = Sim.createState({ police });
  let liftAt = null;
  while (s.status === 'riding' && s.time < maxT) {
    Sim.substep(s, policy(s, h), h, terrain, Sim.FIXED_DT);
    s.events.length = 0;
    if (liftAt === null && s.inWheelie) liftAt = s.time;
  }
  return { s, h, liftAt };
}

// A keyboard-style rider: on/off keys. It rides in the green zone below the
// balance point, never lower than the throttle can hold at the current
// speed, and pops the front back up if it comes down.
function balancer(s, h) {
  const bal = Sim.balanceAngle(s, h);
  const push = Sim.pitchGainAt(h, s.v) * Sim.driveAt(h, s.v) - Sim.TUNE.roll;
  const holdable = Math.atan2(9.81, Math.max(0.1, push)) - (Math.PI / 2 - bal);
  const target = Math.min(bal - 3 * D, Math.max(bal - 10 * D, holdable + 4 * D));
  if (s.frontDown) {
    s._pop = ((s._pop || 0) + 1) % 120;
    return { throttle: true, lean: s._pop < 60 ? -1 : 1 };
  }
  const err = target - s.theta - 0.3 * s.omega;
  return { throttle: err > 0, brake: err < -6 * D, lean: 1 };
}

test('roster has five bikes with the specs the game needs', () => {
  assert.equal(BIKES.length, 5);
  for (const b of BIKES) {
    for (const k of ['peakPowerKw', 'weightKg', 'topSpeedKmh']) assert.ok(b[k] > 0, `${b.id}.${k}`);
    assert.ok(b.sources.length > 0, `${b.id} has sources`);
  }
});

test('at rest the bike sits on both wheels at its static sag', () => {
  for (const b of BIKES) {
    const { s, h } = ride(b, () => ({}), { maxT: 2 });
    assert.ok(Math.abs(s.theta) < 0.5 * D, `${b.id} pitch ${s.theta / D}`);
    assert.ok(Math.abs(s.cr - h.rearSag) < 0.01 && Math.abs(s.cf - h.forkSag) < 0.01, `${b.id} sag`);
    assert.ok(s.frontDown && !s.inWheelie);
  }
});

test('every bike can pop a wheelie with throttle and a lean back', () => {
  for (const b of BIKES) {
    const { liftAt } = ride(b, () => ({ throttle: true, lean: 1 }), { maxT: 5 });
    assert.ok(liftAt !== null && liftAt < 1, `${b.name} lifted at ${liftAt}`);
  }
});

test('pinning the throttle loops the bike out, and gives the player time to react', () => {
  const times = {};
  for (const b of BIKES) {
    const { s } = ride(b, () => ({ throttle: true, lean: 1 }), { maxT: 10 });
    assert.equal(s.status, 'crashed', b.name);
    assert.equal(s.cause, 'Looped out');
    assert.ok(s.time > 1.2, `${b.name} looped out after only ${s.time.toFixed(2)} s`);
    times[b.id] = s.time;
  }
  // More power loops sooner. The Varg is grip-limited (it spins the rear), so
  // it can only match the E Ride.
  assert.ok(times['eride-pro-ss'] < times['talaria-mx4'] && times['talaria-mx4'] < times['surron-lbx']);
  assert.ok(times['stark-varg-mx'] < times['talaria-mx4']);
});

test('letting off sets the front back down on the fork and the ride goes on', () => {
  const { s } = ride(byId('surron-lbx'), (st) => ({ throttle: st.theta < 20 * D && st.time < 2, lean: st.time < 2 ? 1 : 0 }), { maxT: 6 });
  assert.equal(s.status, 'riding');
  assert.ok(s.frontDown && !s.inWheelie);
});

test('braking on two wheels dives the fork', () => {
  const b = byId('talaria-mx4');
  const h = Sim.deriveHandling(b);
  const t = flatTrack();
  const s = Sim.createState();
  while (s.time < 3) Sim.substep(s, { throttle: true, lean: -1 }, h, t, Sim.FIXED_DT);
  let deepest = 0;
  for (let i = 0; i < 240; i++) { Sim.substep(s, { brake: true }, h, t, Sim.FIXED_DT); deepest = Math.max(deepest, s.cf); }
  assert.ok(deepest > h.forkSag + 0.05, `fork only reached ${deepest.toFixed(3)} m`);
  assert.equal(s.status, 'riding');
});

test('hitting the end of travel is absorbed, not bounced', () => {
  // Ride the front wheel over a log at speed: the suspension soaks it up
  // without throwing the bike into the air.
  const b = byId('surron-lbx');
  const t = flatTrack();
  t.obstacles.push({ type: 'log', x: 60, w: 0.27, h: 0.27, tall: false, soft: false });
  const { s } = ride(b, (st) => ({ throttle: st.v < 15, lean: -1 }), { terrain: t, maxT: 8 });
  assert.equal(s.status, 'riding');
  let maxHeave = 0;
  const h = Sim.deriveHandling(b);
  const s2 = Sim.createState();
  while (s2.time < 8 && s2.status === 'riding') { Sim.substep(s2, { throttle: s2.v < 15, lean: -1 }, h, t, Sim.FIXED_DT); maxHeave = Math.max(maxHeave, s2.yq); }
  assert.ok(maxHeave < 0.45, `bike was thrown ${maxHeave.toFixed(2)} m up`);
});

test('a careful rider can hold wheelies for a minute on every bike', () => {
  for (const b of BIKES) {
    const { s } = ride(b, balancer, { maxT: 60 });
    assert.equal(s.status, 'riding', `${b.name}: ${s.cause} at ${s.time.toFixed(1)} s`);
    assert.ok(s.wheelieTotal / s.distance > 0.7, `${b.name} only ${(100 * s.wheelieTotal / s.distance).toFixed(0)}% on the back wheel`);
  }
});

test('the throttle can still lift the nose at top speed', () => {
  for (const b of BIKES) {
    const h = Sim.deriveHandling(b);
    const t = flatTrack();
    const s = Sim.createState();
    s.v = h.vmax; s.theta = 30 * D; s.throttle = 1; s.lean = 1; s.cr = s.crPrev = h.rearSag + 0.035; s.yq = -0.035;
    s.cfPrev = s.cf = -1;
    Sim.substep(s, { throttle: true, lean: 1 }, h, t, Sim.FIXED_DT);
    assert.ok(s.omega > 0, `${b.name}: omega ${s.omega.toFixed(3)}`);
  }
});

test('a held wheelie is faster than riding flat out on two wheels (wheelie boost)', () => {
  for (const id of ['surron-lbx', 'talaria-mx4']) {
    const { s, h } = ride(byId(id), balancer, { maxT: 45 });
    assert.ok(s.inWheelie && s.v > h.vmax, `${id}: ${(s.v * 3.6).toFixed(0)} km/h vs top ${(h.vmax * 3.6).toFixed(0)}`);
  }
});

test('the front wheel into a tyre stack crashes; a timed pop clears it', () => {
  for (const b of BIKES) {
    for (const [lead, expect] of [[null, 'crashed'], [0.6, 'riding']]) {
      const t = flatTrack();
      t.obstacles.push({ type: 'tyres', x: 100, w: 0.7, h: 0.36, tall: true, soft: false });
      const h = Sim.deriveHandling(b);
      const s = Sim.createState({ x: 40 });
      s.v = Math.min(60 / 3.6, h.vmax);
      while (s.status === 'riding' && s.x < 106) {
        const tt = (100 - (s.x + h.wheelbase)) / s.v;
        const lean = lead === null ? 0 : tt > lead + 0.2 ? 0 : tt > lead ? -1 : 1;
        Sim.substep(s, { throttle: lead !== null, lean }, h, t, Sim.FIXED_DT);
      }
      assert.equal(s.status, expect, `${b.name} ${lead === null ? 'front down' : 'popped'}: ${s.cause}`);
    }
  }
});

test('logs can be ridden over with the front down, at a cost in speed', () => {
  const b = byId('talaria-mx4');
  const t = flatTrack();
  t.obstacles.push({ type: 'log', x: 60, w: 0.25, h: 0.25, tall: false, soft: false });
  const h = Sim.deriveHandling(b);
  const s = Sim.createState({ x: 30 });
  s.v = 14;
  let before = 0;
  while (s.x < 66) {
    if (s.x < 58) before = s.v;
    Sim.substep(s, {}, h, t, Sim.FIXED_DT);
  }
  assert.equal(s.status, 'riding');
  assert.ok(s.v < before - 1, `kept ${s.v.toFixed(1)} of ${before.toFixed(1)} m/s`);
});

test('the police catch a rider who dawdles, but not one holding a fast wheelie', () => {
  const b = byId('surron-lbx');
  const slow = ride(b, (st) => ({ throttle: st.v < 6, lean: -1 }), { maxT: 60, police: true });
  assert.equal(slow.s.status, 'busted');
  const fast = ride(b, balancer, { maxT: 45, police: true });
  assert.equal(fast.s.status, 'riding', `${fast.s.cause} at ${fast.s.time.toFixed(1)} s`);
});

test('a wet track gives less grip than a dry one', () => {
  const b = byId('eride-pro-ss');
  const launch = (env) => {
    const t = flatTrack();
    t.env = env;
    const { s } = ride(b, () => ({ throttle: true, lean: -1 }), { terrain: t, maxT: 1.5 });
    return s.v;
  };
  assert.ok(launch(Sim.createWeather(1, 'storm')) < launch(undefined) - 0.5);
});

test('a headwind lifts the nose, a tailwind pushes it down', () => {
  const b = byId('surron-lbx');
  const h = Sim.deriveHandling(b);
  const omegaWith = (w) => {
    const t = flatTrack();
    t.env = { kind: 'test', wind: () => w, rain: () => 0, wet: 0 };
    const s = Sim.createState();
    s.v = 15; s.theta = 30 * D; s.lean = 1; s.cr = s.crPrev = h.rearSag + 0.035; s.yq = -0.035; s.cf = s.cfPrev = -1;
    Sim.substep(s, { lean: 1 }, h, t, Sim.FIXED_DT);
    return s.omega;
  };
  assert.ok(omegaWith(12) > omegaWith(0) && omegaWith(0) > omegaWith(-12));
});

test('mud slows the bike', () => {
  const b = byId('surron-lbx');
  const h = Sim.deriveHandling(b);
  const coast = (mud) => {
    const t = flatTrack();
    if (mud) t.features.push({ type: 'mud', x0: 0, x1: 100 });
    const s = Sim.createState({ x: 10 });
    s.v = 8;
    for (let i = 0; i < 120; i++) Sim.substep(s, {}, h, t, Sim.FIXED_DT);
    return s.v;
  };
  assert.ok(coast(true) < coast(false) - 0.3);
});

test('step is frame-rate independent', () => {
  const b = byId('surron-lbx');
  const run = (dt) => {
    const h = Sim.deriveHandling(b), terrain = Sim.createTerrain(7), s = Sim.createState();
    const frames = Math.round(1.5 / dt);
    for (let i = 0; i < frames; i++) Sim.step(s, { throttle: true, lean: 1 }, h, terrain, dt);
    return s;
  };
  const a = run(1 / 60), c = run(1 / 144);
  assert.ok(Math.abs(a.theta - c.theta) < 0.02, `${a.theta} vs ${c.theta}`);
  assert.ok(Math.abs(a.x - c.x) < 0.1);
});

test('terrain is deterministic per seed and starts flat', () => {
  const t1 = Sim.createTerrain(42), t2 = Sim.createTerrain(42);
  for (const x of [0, 10, 100, 523.7, 4000]) assert.equal(t1.height(x), t2.height(x));
  for (let x = 0; x < 60; x += 1) assert.equal(t1.slope(x), 0);
  assert.ok(t1.obstacles.length > 50 && t1.obstacles.some((o) => o.tall) && t1.obstacles.some((o) => o.type === 'log'));
});
