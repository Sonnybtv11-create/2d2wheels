const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../js/physics.js');
const { BIKES } = require('../js/bikes.js');

const D = Sim.DEG;

function ride(bike, policy, { seed = 1, maxT = 120 } = {}) {
  const h = Sim.deriveHandling(bike);
  const terrain = Sim.createTerrain(seed);
  const s = Sim.createState();
  let liftAt = null;
  while (s.status === 'riding' && s.time < maxT) {
    Sim.substep(s, policy(s, h), h, terrain, Sim.FIXED_DT);
    if (liftAt === null && s.theta > 3 * D) liftAt = s.time;
  }
  return { s, h, liftAt };
}

// A keyboard-style bot: on/off throttle and brake. It rides in the green zone
// below the balance point, but never lower than the angle its throttle can
// hold at the current speed (what players learn by feel).
const balancer = (s, h) => {
  const bal = Sim.balanceAngle(s, h);
  const push = Sim.pitchGainAt(h, s.v) * Sim.driveAt(h, s.v) - Sim.TUNE.roll;
  const holdable = Math.atan2(9.81, Math.max(0.1, push)) - (Math.PI / 2 - bal);
  const target = Math.min(bal - 3 * D, Math.max(bal - 10 * D, holdable + 4 * D));
  const err = target - s.theta - 0.3 * s.omega;
  return { throttle: err > 0, brake: err < -6 * D, lean: 1 };
};

const byId = (id) => BIKES.find((b) => b.id === id);

test('roster has five bikes with the specs the game needs', () => {
  assert.equal(BIKES.length, 5);
  assert.equal(new Set(BIKES.map((b) => b.id)).size, 5);
  for (const b of BIKES) {
    for (const k of ['peakPowerKw', 'weightKg', 'topSpeedKmh']) assert.ok(b[k] > 0, `${b.id}.${k}`);
    assert.ok(b.sources.length > 0, `${b.id} has sources`);
    assert.ok(b.look.wheelbase > 1 && b.look.wheelRadius > 0.2, `${b.id} look`);
  }
});

test('every bike can pop a wheelie with throttle and a lean back', () => {
  for (const b of BIKES) {
    const { liftAt } = ride(b, () => ({ throttle: true, lean: 1 }), { maxT: 5 });
    assert.ok(liftAt !== null && liftAt < 1, `${b.name} lifted at ${liftAt}`);
  }
});

test('pinning the throttle loops the bike out, and gives the player time to react', () => {
  for (const b of BIKES) {
    const { s } = ride(b, () => ({ throttle: true, lean: 1 }), { maxT: 10 });
    assert.equal(s.status, 'crashed', b.name);
    assert.ok(s.time > 1.2, `${b.name} looped out after only ${s.time.toFixed(2)} s`);
  }
});

test('more power means a quicker, harder-to-hold wheelie', () => {
  const t = (id) => ride(byId(id), () => ({ throttle: true, lean: 1 }), { maxT: 10 }).s.time;
  assert.ok(t('stark-varg-mx') < t('eride-pro-ss'));
  assert.ok(t('eride-pro-ss') < t('talaria-mx4'));
  assert.ok(t('talaria-mx4') < t('surron-lbx'));
});

test('letting off drops the front wheel and ends the run as a landing', () => {
  const { s } = ride(byId('surron-lbx'), (st) => ({ throttle: st.theta < 20 * D && st.time < 3, lean: 1 }));
  assert.equal(s.status, 'landed');
  assert.ok(s.wheelieTime >= Sim.MIN_WHEELIE_TIME && s.score > 0);
  assert.equal(s.theta, 0);
});

test('the rear brake brings the front down', () => {
  const b = byId('talaria-mx4');
  const h = Sim.deriveHandling(b);
  const terrain = Sim.createTerrain(1);
  const s = Sim.createState();
  while (s.theta < 30 * D) Sim.substep(s, { throttle: true, lean: 1 }, h, terrain, Sim.FIXED_DT);
  const coast = { ...s }, braked = { ...s };
  for (let i = 0; i < 60; i++) {
    Sim.substep(coast, { throttle: false }, h, terrain, Sim.FIXED_DT);
    Sim.substep(braked, { throttle: false, brake: true }, h, terrain, Sim.FIXED_DT);
  }
  assert.ok(braked.theta < coast.theta, 'braking pitches the nose down faster than coasting');
});

test('a careful rider can hold a wheelie for a minute on every bike, at speed', () => {
  for (const b of BIKES) {
    for (const seed of [1, 2, 3]) {
      const { s, h } = ride(b, balancer, { seed, maxT: 60 });
      assert.equal(s.status, 'riding', `${b.name} seed ${seed} ended (${s.status}) after ${s.wheelieTime.toFixed(1)} s`);
      assert.ok(s.v > 0.3 * h.vmax, `${b.name} seed ${seed} crawled at ${(s.v * 3.6).toFixed(0)} km/h`);
    }
  }
});

test('the throttle can still lift the nose at top speed', () => {
  // Drag acts at the centre of mass and cancels out of the pitch balance, so
  // drive force keeps lifting the front even when the bike can't go faster.
  for (const b of BIKES) {
    const h = Sim.deriveHandling(b);
    const terrain = Sim.createTerrain(1);
    const s = Sim.createState();
    s.v = h.vmax; s.theta = 30 * D; s.throttle = 1; s.lean = 1;
    Sim.substep(s, { throttle: true, lean: 1 }, h, terrain, Sim.FIXED_DT);
    assert.ok(s.omega > 0, `${b.name}: omega ${s.omega.toFixed(3)}`);
  }
});

test('a short accidental pop does not end the run', () => {
  const s = Sim.createState();
  const h = Sim.deriveHandling(byId('segway-x260'));
  const terrain = Sim.createTerrain(1);
  // Build speed with the front down, then a very short lift.
  for (let i = 0; i < 240 * 2; i++) Sim.substep(s, { throttle: true, lean: -1 }, h, terrain, Sim.FIXED_DT);
  s.theta = 4 * D; s.omega = 0;
  for (let i = 0; i < 240; i++) Sim.substep(s, { throttle: false }, h, terrain, Sim.FIXED_DT);
  assert.equal(s.status, 'riding');
  assert.equal(s.wheelieDist, 0);
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
});
