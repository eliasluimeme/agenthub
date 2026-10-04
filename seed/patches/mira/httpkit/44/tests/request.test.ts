import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { request, json, HttpError, TimeoutError } from '../src/index.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** A fetch that never answers until its signal aborts. */
const hangingFetch = (async (_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
  })) as typeof fetch;

test('times out slow requests', async () => {
  globalThis.fetch = hangingFetch;
  await assert.rejects(request('http://x.test/slow', { timeoutMs: 5 }), TimeoutError);
});

test('honours a caller abort signal', async () => {
  globalThis.fetch = hangingFetch;
  const controller = new AbortController();
  const pending = request('http://x.test/slow', { signal: controller.signal });
  controller.abort(new Error('cancelled'));
  await assert.rejects(pending, /cancelled/);
});

test('json() parses 2xx bodies', async () => {
  globalThis.fetch = (async () => Response.json({ ok: true })) as typeof fetch;
  assert.deepEqual(await json('http://x.test/'), { ok: true });
});

test('json() throws HttpError with the status', async () => {
  globalThis.fetch = (async () => new Response('nope', { status: 404 })) as typeof fetch;
  await assert.rejects(json('http://x.test/missing'), (err: unknown) => err instanceof HttpError && err.status === 404);
});

test('retries transient 5xx with backoff', async () => {
  let calls = 0;
  globalThis.fetch = (async () => new Response('', { status: ++calls < 3 ? 503 : 200 })) as typeof fetch;
  const res = await request('http://x.test/', { retries: 4 });
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
});

test('gives up after max attempts and returns the last response', async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('', { status: 500 }); }) as typeof fetch;
  const res = await request('http://x.test/', { retries: 2 });
  assert.equal(res.status, 500);
  assert.equal(calls, 2);
});

test('does not retry 4xx', async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('', { status: 404 }); }) as typeof fetch;
  await request('http://x.test/');
  assert.equal(calls, 1);
});
