const test = require('node:test');
const assert = require('node:assert/strict');
const Art = require('../js/bikeart.js');
const { BIKES } = require('../js/bikes.js');

test('every bike in the roster has traced art', () => {
  for (const b of BIKES) assert.ok(Art.COMPILED[b.id], `${b.id} has art`);
});

test('art calibration matches the wheelbase and wheel size the physics uses', () => {
  for (const b of BIKES) {
    const a = Art.COMPILED[b.id];
    assert.equal(a.WB, b.look.wheelbase, `${b.id} wheelbase`);
    assert.ok(Math.abs(a.R - b.look.wheelRadius) < 0.005, `${b.id} wheel radius ${a.R.toFixed(3)} vs ${b.look.wheelRadius}`);
  }
});

test('traced points land in a sensible box around the bike', () => {
  for (const b of BIKES) {
    const a = Art.COMPILED[b.id];
    for (const part of a.parts) {
      for (const [x, y] of part.p || []) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${b.id} ${part.k} finite`);
        assert.ok(x > -0.6 && x < a.WB + 0.6, `${b.id} ${part.k} x=${x.toFixed(2)}`);
        assert.ok(y > -0.05 && y < 1.5, `${b.id} ${part.k} y=${y.toFixed(2)}`);
      }
    }
  }
});

test('rider sits above the pegs with the hands at the bars', () => {
  for (const b of BIKES) {
    const r = Art.COMPILED[b.id].rider;
    assert.ok(r.hip[1] > r.peg[1] + 0.3, `${b.id} hip above peg`);
    assert.ok(r.grip[0] > r.hip[0], `${b.id} grips ahead of hips`);
    assert.ok(r.grip[1] > r.hip[1], `${b.id} grips above hips`);
  }
});
