const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../js/physics.js');
const Parts = require('../js/parts.js');
const Art = require('../js/bikeart.js');
const { BIKES } = require('../js/bikes.js');

const D = Sim.DEG;
const byId = (id) => BIKES.find((b) => b.id === id);
const SR = byId('surron-lbx'), VARG = byId('stark-varg-mx');

function flatTrack() {
  const t = Sim.createTerrain(1);
  t.obstacles.length = 0; t.bumps.length = 0; t.features.length = 0;
  return t;
}
function handlingFor(bike, build) {
  const a = Parts.apply(bike, build);
  return Sim.deriveHandling(a.spec, Object.assign({}, a.mods, { perks: a.perks, modes: a.modes }));
}
function ride(h, policy, { maxT = 10, terrain = flatTrack(), until } = {}) {
  const s = Sim.createState();
  while (s.status === 'riding' && s.time < maxT && !(until && until(s))) {
    Sim.substep(s, policy(s, h), h, terrain, Sim.FIXED_DT);
    s.events.length = 0;
  }
  return s;
}

test('every part has a name, a price, and a stock option in each slot', () => {
  for (const b of BIKES) {
    for (const slot of Parts.slotsFor(b.id)) {
      assert.equal(slot.items[0].id, 'stock', `${b.id} ${slot.id}`);
      for (const it of slot.items) {
        assert.ok(it.name && it.maker && Number.isFinite(it.price), `${b.id} ${slot.id} ${it.id}`);
        if (it.id !== 'stock') assert.ok(it.price > 0);
      }
    }
  }
});

test('a stock build is the stock bike', () => {
  for (const b of BIKES) {
    const a = Parts.apply(b, {});
    assert.equal(a.spec.peakPowerKw, b.peakPowerKw);
    assert.equal(a.spec.weightKg, b.weightKg);
    assert.equal(a.spec.topSpeedKmh, b.topSpeedKmh);
  }
});

test('the Sur-Ron battery limits what a big controller can deliver', () => {
  assert.equal(Parts.apply(SR, { controller: 'x9000' }).spec.peakPowerKw, 8.5);
  assert.equal(Parts.apply(SR, { controller: 'x9000', battery: 'ebmx' }).spec.peakPowerKw, 17);
  assert.equal(Parts.apply(SR, { controller: 'x9000', battery: 'ebmx', motor: 'tm40' }).spec.peakPowerKw, 32);
  // 72 V spins the motor faster: more top speed
  assert.ok(Parts.apply(SR, { battery: 'ebmx' }).spec.topSpeedKmh > SR.topSpeedKmh * 1.15);
  // gearing trades top speed for pull
  const g = Parts.apply(SR, { sprocket: '58' });
  assert.ok(g.spec.topSpeedKmh < SR.topSpeedKmh && g.mods.torque > 1.2);
});

test('the Varg Alpha is the 80 hp bike with traction control', () => {
  const a = Parts.apply(VARG, { power: 'alpha' });
  assert.equal(a.spec.peakPowerKw, 60);
  assert.ok(a.perks.has('traction'));
  assert.ok(!Parts.apply(VARG, {}).perks.has('traction'));
});

test('anti-loop stops a pinned throttle from looping the bike', () => {
  const pin = () => ({ throttle: true, lean: 1 });
  const stock = ride(handlingFor(SR, {}), pin);
  assert.equal(stock.cause, 'Looped out');
  const s = ride(handlingFor(SR, { controller: 'x9000', battery: 'ebmx' }), pin);
  assert.equal(s.status, 'riding', `${s.cause} at ${s.time.toFixed(1)} s`);
  assert.ok(s.inWheelie, 'still on the back wheel');
});

test('traction control gets the Varg off the line quicker in the wet', () => {
  // same power both ways: the Alpha's 80 hp with and without its traction control
  const h = handlingFor(VARG, { power: 'alpha' });
  const noTc = Object.assign({}, h, { perks: new Set(['modes']) });
  const t = flatTrack();
  t.env = Sim.createWeather(1, 'storm');
  const a = ride(h, () => ({ throttle: true, lean: -1 }), { terrain: t, maxT: 2 }).v;
  const b = ride(noTc, () => ({ throttle: true, lean: -1 }), { terrain: t, maxT: 2 }).v;
  assert.ok(a > b + 0.3, `with TC ${a.toFixed(1)} m/s, without ${b.toFixed(1)}`);
});

test('dropping the E-Clutch kicks the front up harder than a lean pop', () => {
  const h = handlingFor(SR, { controller: 'x9000' });
  const peak = (policy) => {
    let best = 0;
    ride(h, (s) => { best = Math.max(best, s.theta); return policy(s); }, { maxT: 4.5 });
    return best;
  };
  // cruise, then either pop with a lean or rev the clutch and drop it
  const pop = peak((s) => ({ throttle: s.time < 3 ? s.v < 8 : s.time < 3.6, lean: s.time > 3 && s.time < 3.3 ? 1 : 0 }));
  const clutch = peak((s) => ({ throttle: s.time < 3 ? s.v < 8 : s.time < 3.6, clutch: s.time > 2.4 && s.time < 3 }));
  assert.ok(clutch > pop + 3 * D, `clutch ${(clutch / D).toFixed(0)}° vs pop ${(pop / D).toFixed(0)}°`);
});

test('Eco mode holds the Sur-Ron near its 47 km/h cap', () => {
  const h = handlingFor(SR, {});
  const s = ride(h, () => ({ throttle: true, lean: 0, mode: 1 }), { maxT: 20 });
  assert.ok(s.v * 3.6 < 50 && s.v * 3.6 > 40, `${(s.v * 3.6).toFixed(0)} km/h`);
});

test('launch control beats a raw launch to 50 km/h on the hot-rod Sur-Ron', () => {
  const h = handlingFor(SR, { controller: 'x9000', battery: 'ebmx', motor: 'tm40' });
  const to50 = (policy) => ride(h, policy, { maxT: 8, until: (s) => s.v > 50 / 3.6 });
  const raw = to50(() => ({ throttle: true, lean: 0 }));
  const lc = to50((s) => ({ throttle: true, brake: s.time < 0.5, lean: 0 }));
  assert.equal(lc.status, 'riding', lc.cause);
  const lcTime = lc.time - 0.5; // timed from letting go of the brake
  assert.ok(lcTime < raw.time - 0.05 || raw.status !== 'riding', `launch ${lcTime.toFixed(2)} s vs raw ${raw.time.toFixed(2)} s (${raw.cause})`);
});

test('regen slows the bike when you roll off', () => {
  const coast = (build) => {
    const h = handlingFor(SR, build);
    return ride(h, (s) => ({ throttle: s.time < 4, lean: -1 }), { maxT: 6 }).v;
  };
  assert.ok(coast({ controller: 'tc500' }) < coast({}) - 1);
});

test('better suspension loses less speed over a log', () => {
  const overLog = (build) => {
    const h = handlingFor(SR, build);
    const t = flatTrack();
    t.obstacles.push({ type: 'log', x: 60, w: 0.25, h: 0.25, tall: false, soft: false });
    const s = Sim.createState({ x: 30 });
    s.v = 14;
    while (s.x < 66) { Sim.substep(s, {}, h, t, Sim.FIXED_DT); s.events.length = 0; }
    return s.v;
  };
  assert.ok(overLog({ fork: 'ext', shock: 'ext' }) > overLog({}) + 0.2);
});

test('fitted parts change the look', () => {
  const st = Parts.apply(SR, { fork: 'ext', wheels: 'warp9', 'wheels:v': 2, paint: 'blue' }).style;
  assert.equal(st.rim, '#2457c5');
  assert.equal(st.fork.upper, '#1d1e21');
  assert.ok(st.paint.ramp.length === 3);
  // and the art can draw every part on both bikes without throwing
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && /Style|Width|Cap|Join|Alpha|Offset|font|textAlign|textBaseline|shadow|filter|globalComposite/.test(k) ? undefined : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; calls.push(k); return true; } });
  for (const b of BIKES) {
    const all = {};
    for (const slot of Parts.slotsFor(b.id)) all[slot.id] = slot.items[slot.items.length - 1].id;
    Art.drawBike(ctx, b.id, { style: Parts.apply(b, all).style, lit: true });
  }
  assert.ok(calls.length > 100);
});
