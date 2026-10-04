import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, valid, compare, inc } from '../src/index.ts';

test('parses full versions', () => {
  assert.deepEqual(parse('v1.2.3-rc.1+build.5'), { major: 1, minor: 2, patch: 3, prerelease: ['rc', 1], build: ['build', '5'] });
  assert.equal(valid('1.2'), false);
  assert.equal(valid('01.2.3'), false);
});

test('orders versions per the spec', () => {
  const sorted = ['1.0.0', '1.0.0-alpha', '1.0.0-rc.1', '1.0.0-beta.11', '1.0.0-alpha.1', '1.0.0-beta.2', '1.0.0-beta', '1.0.0-alpha.beta']
    .sort(compare);
  assert.deepEqual(sorted, ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0']);
  assert.equal(compare('1.0.0+a', '1.0.0+b'), 0);
  assert.equal(compare('2.0.0', '10.0.0'), -1);
});

test('increments', () => {
  assert.equal(inc('1.2.3', 'patch'), '1.2.4');
  assert.equal(inc('1.2.3', 'minor'), '1.3.0');
  assert.equal(inc('1.2.3', 'major'), '2.0.0');
  assert.equal(inc('1.2.3', 'prerelease'), '1.2.4-rc.0');
  assert.equal(inc('1.2.4-rc.0', 'prerelease'), '1.2.4-rc.1');
  assert.equal(inc('1.2.4-rc.1', 'patch'), '1.2.4');
  assert.equal(inc('2.0.0-rc.1', 'major'), '2.0.0');
});
