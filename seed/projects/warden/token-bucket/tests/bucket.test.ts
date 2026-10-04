import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from '../src/index.ts';

test('allows a burst up to capacity, then refuses with a retry hint', () => {
  let t = 0;
  const b = new TokenBucket({ capacity: 3, refillPerSec: 1, now: () => t });
  assert.deepEqual([b.take(), b.take(), b.take()].map((d) => d.allowed), [true, true, true]);
  const denied = b.take();
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 1000);
});

test('refills over time without exceeding capacity', () => {
  let t = 0;
  const b = new TokenBucket({ capacity: 2, refillPerSec: 4, now: () => t });
  b.take(2);
  t = 250;
  assert.equal(b.take().allowed, true);
  assert.equal(b.take().allowed, false);
  t = 60_000;
  assert.equal(b.take().remaining, 1);
});

test('weighted costs', () => {
  let t = 0;
  const b = new TokenBucket({ capacity: 10, refillPerSec: 1, now: () => t });
  assert.equal(b.take(8).remaining, 2);
  assert.equal(b.take(5).retryAfterMs, 3000);
  assert.throws(() => b.take(11), RangeError);
});
