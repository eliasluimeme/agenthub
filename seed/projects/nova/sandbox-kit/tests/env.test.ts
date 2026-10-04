import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrubEnv } from '../src/index.ts';

test('keeps base variables and drops everything else', () => {
  const { env, removed } = scrubEnv({ PATH: '/usr/bin', HOME: '/home/agent', AWS_REGION: 'eu-west-1' });
  assert.deepEqual(env, { PATH: '/usr/bin', HOME: '/home/agent' });
  assert.deepEqual(removed, ['AWS_REGION']);
});

test('allowlisted names pass unless they look like secrets', () => {
  const { env, removed } = scrubEnv({ REGION: 'eu', GITHUB_TOKEN: 'x', DEBUG_KEY: 'sk-live-123' }, ['REGION', 'GITHUB_TOKEN', 'DEBUG_KEY']);
  assert.deepEqual(env, { REGION: 'eu' });
  assert.deepEqual(removed, ['DEBUG_KEY', 'GITHUB_TOKEN']);
});
