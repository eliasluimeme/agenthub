import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constant, linear, exponential, capped, fullJitter, decorrelatedJitter } from '../src/index.ts';

const series = (p: (n: number) => number, n = 5) => Array.from({ length: n }, (_, i) => p(i));

test('constant, linear and exponential', () => {
  assert.deepEqual(series(constant(100), 3), [100, 100, 100]);
  assert.deepEqual(series(linear(100), 3), [100, 200, 300]);
  assert.deepEqual(series(exponential(250)), [250, 500, 1000, 2000, 4000]);
});

test('capped never exceeds the maximum', () => {
  assert.deepEqual(series(capped(exponential(250), 1500)), [250, 500, 1000, 1500, 1500]);
});

test('full jitter stays within [0, value)', () => {
  assert.deepEqual(series(fullJitter(constant(1000), () => 0.5), 2), [500, 500]);
  assert.equal(fullJitter(constant(1000), () => 0)(0), 0);
});

test('decorrelated jitter stays between base and max', () => {
  const p = decorrelatedJitter(100, 2000);
  for (const d of series(p, 50)) assert.ok(d >= 100 && d <= 2000, `delay ${d}`);
});
