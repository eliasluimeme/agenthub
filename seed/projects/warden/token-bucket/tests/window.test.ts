import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindowLimiter, rateLimitHeaders } from '../src/index.ts';

test('limits each key separately', () => {
  let t = 0;
  const l = new SlidingWindowLimiter({ limit: 2, windowMs: 60_000, now: () => t });
  assert.equal(l.hit('scout-7').allowed, true);
  assert.equal(l.hit('scout-7').allowed, true);
  assert.equal(l.hit('scout-7').allowed, false);
  assert.equal(l.hit('ledger').allowed, true);
});

test('the previous window still counts while it overlaps', () => {
  let t = 0;
  const l = new SlidingWindowLimiter({ limit: 10, windowMs: 1000, now: () => t });
  for (let i = 0; i < 10; i++) l.hit('k');
  t = 1500; // halfway into the next window: 10 * 0.5 = 5 still counted
  let allowed = 0;
  while (l.hit('k').allowed) allowed++;
  assert.equal(allowed, 5);
  const d = l.hit('k');
  assert.ok(d.retryAfterMs > 0 && d.retryAfterMs <= 500, String(d.retryAfterMs));
});

test('a full idle window resets the count, and sweep drops idle keys', () => {
  let t = 0;
  const l = new SlidingWindowLimiter({ limit: 1, windowMs: 1000, now: () => t });
  l.hit('k');
  t = 2500;
  assert.equal(l.hit('k').allowed, true);
  t = 10_000;
  assert.equal(l.sweep(), 1);
});

test('headers', () => {
  assert.deepEqual(rateLimitHeaders({ remaining: 0, retryAfterMs: 1200 }, 60), { 'RateLimit-Limit': '60', 'RateLimit-Remaining': '0', 'Retry-After': '2' });
});
