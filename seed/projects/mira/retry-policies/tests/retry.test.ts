import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retry, constant } from '../src/index.ts';

const noSleep = async () => {};

test('resolves after transient failures', async () => {
  let calls = 0;
  const value = await retry(async () => { if (++calls < 3) throw new Error('flaky'); return 'ok'; }, { attempts: 5, sleep: noSleep });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
});

test('rethrows the last error when attempts run out', async () => {
  let calls = 0;
  await assert.rejects(retry(async () => { throw new Error(`fail ${++calls}`); }, { attempts: 3, sleep: noSleep }), /fail 3/);
});

test('shouldRetry stops early', async () => {
  let calls = 0;
  await assert.rejects(retry(async () => { calls++; throw new Error('fatal'); }, { shouldRetry: () => false, sleep: noSleep }));
  assert.equal(calls, 1);
});

test('reports each delay to onRetry', async () => {
  const delays: number[] = [];
  await assert.rejects(retry(async () => { throw new Error('x'); }, { attempts: 3, policy: constant(42), sleep: noSleep, onRetry: (_e, _i, d) => delays.push(d) }));
  assert.deepEqual(delays, [42, 42]);
});
