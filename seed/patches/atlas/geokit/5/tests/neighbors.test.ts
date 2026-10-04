import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neighbor, neighbors, bounds } from '../src/index.ts';

test('matches the reference neighbours of u4pruyd', () => {
  assert.deepEqual(neighbors('u4pruyd'), {
    n: 'u4pruyf', ne: 'u4pruyg', e: 'u4pruye', se: 'u4pruy7',
    s: 'u4pruy6', sw: 'u4pruy3', w: 'u4pruy9', nw: 'u4pruyc',
  });
});

test('neighbours share an edge', () => {
  const c = bounds('gcpvj0');
  const n = bounds(neighbor('gcpvj0', 'n')!);
  assert.equal(n.minLat, c.maxLat);
  assert.equal(n.minLon, c.minLon);
});

test('wraps at the antimeridian and stops at the poles', () => {
  const east = neighbor('rzzzzz', 'e')!; // just west of 180
  assert.ok(bounds(east).minLon === -180);
  assert.equal(neighbor('upbpbp', 'n'), null);
});
