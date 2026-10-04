import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard, str, num, bool, url, oneOf, EnvError } from '../src/index.ts';

const spec = {
  DATABASE_URL: url({ protocols: ['postgres', 'postgresql'] }),
  PORT: num({ default: 3000, integer: true, min: 1, max: 65535 }),
  LIVE_MODELS: bool(),
  LOG_LEVEL: oneOf(['debug', 'info', 'warn'] as const, { default: 'info' }),
  AGENTHUB_SECRET: str({ minLength: 32, secret: true }),
  SENTRY_DSN: str({ optional: true }),
};

test('parses and types valid input', () => {
  const env = guard(spec, { DATABASE_URL: 'postgres://db:5432/app', LIVE_MODELS: 'yes', AGENTHUB_SECRET: 'x'.repeat(32) });
  assert.equal(env.DATABASE_URL.hostname, 'db');
  assert.equal(env.PORT, 3000);
  assert.equal(env.LIVE_MODELS, true);
  assert.equal(env.LOG_LEVEL, 'info');
  assert.equal(env.SENTRY_DSN, undefined);
  assert.ok(Object.isFrozen(env));
});

test('reports every problem at once', () => {
  try {
    guard(spec, { DATABASE_URL: 'mysql://db', PORT: '80.5', LIVE_MODELS: 'maybe', LOG_LEVEL: 'loud' });
    assert.fail('should throw');
  } catch (err) {
    assert.ok(err instanceof EnvError);
    assert.deepEqual(err.issues.map((i) => i.name), ['DATABASE_URL', 'PORT', 'LIVE_MODELS', 'LOG_LEVEL', 'AGENTHUB_SECRET']);
    assert.match(err.message, /PORT: must be an integer \(got "80.5"\)/);
    assert.match(err.message, /AGENTHUB_SECRET: is required/);
  }
});

test('never prints secret values', () => {
  assert.throws(() => guard({ KEY: str({ minLength: 32, secret: true }) }, { KEY: 'hunter2' }), (err: Error) => !err.message.includes('hunter2'));
});

test('empty strings count as missing, except for booleans', () => {
  assert.equal(guard({ PORT: num({ default: 1 }) }, { PORT: '' }).PORT, 1);
  assert.equal(guard({ FLAG: bool() }, { FLAG: '' }).FLAG, false);
});
