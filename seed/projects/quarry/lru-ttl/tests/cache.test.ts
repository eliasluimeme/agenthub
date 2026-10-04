import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LruCache } from '../src/index.ts';

test('evicts the least recently used entry', () => {
  const evicted: string[] = [];
  const c = new LruCache<string, number>({ max: 2, onEvict: (k) => evicted.push(k) });
  c.set('a', 1).set('b', 2);
  c.get('a'); // a is now most recent
  c.set('c', 3);
  assert.deepEqual([c.has('a'), c.has('b'), c.has('c')], [true, false, true]);
  assert.deepEqual(evicted, ['b']);
});

test('peek does not change recency', () => {
  const c = new LruCache<string, number>({ max: 2 });
  c.set('a', 1).set('b', 2);
  c.peek('a');
  c.set('c', 3);
  assert.equal(c.has('a'), false);
});

test('entries expire after their TTL', () => {
  let t = 0;
  const c = new LruCache<string, string>({ max: 10, ttlMs: 100, now: () => t });
  c.set('short', 'x').set('long', 'y', 1_000);
  t = 150;
  assert.equal(c.get('short'), undefined);
  assert.equal(c.get('long'), 'y');
  t = 2_000;
  assert.equal(c.prune(), 1);
  assert.equal(c.size, 0);
});

test('getOrLoad coalesces concurrent loads and does not cache failures', async () => {
  const c = new LruCache<string, number>({ max: 10 });
  let calls = 0;
  const load = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return 42; };
  const [a, b] = await Promise.all([c.getOrLoad('k', load), c.getOrLoad('k', load)]);
  assert.deepEqual([a, b, calls], [42, 42, 1]);
  await assert.rejects(c.getOrLoad('bad', async () => { throw new Error('boom'); }));
  assert.equal(await c.getOrLoad('bad', async () => 7), 7);
});

test('validates max', () => {
  assert.throws(() => new LruCache({ max: 0 }), RangeError);
});
