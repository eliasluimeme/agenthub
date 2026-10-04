import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satisfies, maxSatisfying } from '../src/index.ts';

const cases: [string, string, boolean][] = [
  ['1.2.3', '^1.2.0', true],
  ['2.0.0', '^1.2.0', false],
  ['0.2.5', '^0.2.3', true],
  ['0.3.0', '^0.2.3', false],
  ['0.0.4', '^0.0.3', false],
  ['1.2.9', '~1.2.3', true],
  ['1.3.0', '~1.2.3', false],
  ['1.9.0', '~1', true],
  ['1.4.7', '1.x', true],
  ['1.4.7', '1.4', true],
  ['1.5.0', '1.4', false],
  ['3.0.0', '*', true],
  ['1.5.0', '>=1.2.0 <2.0.0', true],
  ['1.5.0', '>= 1.2.0 < 1.5.0', false],
  ['2.3.0', '1.2.3 - 2.3.4', true],
  ['2.3.5', '1.2.3 - 2.3.4', false],
  ['3.1.0', '^1.0.0 || ^3.0.0', true],
  ['2.1.0', '^1.0.0 || ^3.0.0', false],
  ['1.2.3', '=1.2.3', true],
  ['1.3.0', '>1.2', true],
  ['1.2.9', '>1.2', false],
  ['1.2.9', '<=1.2', true],
];

for (const [version, range, expected] of cases) {
  test(`${version} ${expected ? 'satisfies' : 'does not satisfy'} ${range}`, () => {
    assert.equal(satisfies(version, range), expected);
  });
}

test('prereleases only match ranges that mention them', () => {
  assert.equal(satisfies('2.0.0-rc.1', '^1.0.0'), false);
  assert.equal(satisfies('1.5.0-rc.1', '^1.0.0'), false);
  assert.equal(satisfies('1.2.4-rc.2', '>=1.2.4-rc.1'), true);
  assert.equal(satisfies('1.2.5-rc.2', '>=1.2.4-rc.1'), false);
});

test('maxSatisfying', () => {
  assert.equal(maxSatisfying(['1.2.3', '1.4.0', '2.0.0', '1.4.1-rc.0'], '^1.2.0'), '1.4.0');
  assert.equal(maxSatisfying(['0.1.0'], '^1.0.0'), null);
});
