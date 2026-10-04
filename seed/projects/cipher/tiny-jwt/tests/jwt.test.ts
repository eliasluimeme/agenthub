import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sign, verify, decodeUnsafe, JwtError } from '../src/index.ts';

const SECRET = 'test-secret-that-is-at-least-32-bytes!';
const NOW = 1_800_000_000_000;
const code = (c: string) => (err: unknown) => err instanceof JwtError && err.code === c;

test('round-trips claims', () => {
  const token = sign({ sub: 'agent:scout-7', scope: 'repo:write' }, SECRET, { now: NOW });
  const claims = verify(token, SECRET, { now: NOW });
  assert.equal(claims.sub, 'agent:scout-7');
  assert.equal(claims.scope, 'repo:write');
  assert.equal(claims.iat, NOW / 1000);
});

test('matches an independently computed signature', () => {
  const token = sign({ sub: '1' }, SECRET, { now: NOW });
  const [h, p, s] = token.split('.');
  assert.equal(s, createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url'));
});

test('rejects tampered payloads and wrong secrets', () => {
  const token = sign({ role: 'reader' }, SECRET, { now: NOW });
  const [h, , s] = token.split('.');
  const forged = `${h}.${Buffer.from(JSON.stringify({ role: 'admin' })).toString('base64url')}.${s}`;
  assert.throws(() => verify(forged, SECRET, { now: NOW }), code('signature'));
  assert.throws(() => verify(token, `${SECRET}-other`, { now: NOW }), code('signature'));
});

test('rejects alg none', () => {
  const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"x"}').toString('base64url')}.`;
  assert.throws(() => verify(none, SECRET), code('algorithm'));
});

test('enforces exp and nbf with clock skew', () => {
  const token = sign({}, SECRET, { now: NOW, expiresInSec: 60 });
  assert.doesNotThrow(() => verify(token, SECRET, { now: NOW + 80_000 }));
  assert.throws(() => verify(token, SECRET, { now: NOW + 120_000 }), code('expired'));
  const later = sign({ nbf: NOW / 1000 + 600 }, SECRET, { now: NOW });
  assert.throws(() => verify(later, SECRET, { now: NOW }), code('not_yet_valid'));
});

test('checks issuer and audience, rejects short secrets and garbage', () => {
  const token = sign({ iss: 'agenthub', aud: 'api' }, SECRET, { now: NOW });
  assert.doesNotThrow(() => verify(token, SECRET, { now: NOW, issuer: 'agenthub', audience: 'api' }));
  assert.throws(() => verify(token, SECRET, { now: NOW, audience: 'web' }), code('claim'));
  assert.throws(() => sign({}, 'short'), /32 bytes/);
  assert.throws(() => verify('not-a-token', SECRET), code('malformed'));
  assert.equal(decodeUnsafe(token).iss, 'agenthub');
});
