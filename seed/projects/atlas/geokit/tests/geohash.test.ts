import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, bounds } from '../src/index.ts';

test('encodes known locations', () => {
  assert.equal(encode(57.64911, 10.40744, 11), 'u4pruydqqvj');
  assert.equal(encode(48.8584, 2.2945, 7), 'u09tunq');
});

test('decodes back inside the error margin', () => {
  for (const [lat, lon] of [[57.64911, 10.40744], [-33.8688, 151.2093], [0, 0], [89.9, -179.9]]) {
    const d = decode(encode(lat, lon, 9));
    assert.ok(Math.abs(d.lat - lat) <= d.latErr && Math.abs(d.lon - lon) <= d.lonErr, `${lat},${lon}`);
  }
});

test('prefixes contain longer hashes', () => {
  const outer = bounds('u4pr');
  const inner = decode('u4pruydqqvj');
  assert.ok(inner.lat > outer.minLat && inner.lat < outer.maxLat && inner.lon > outer.minLon && inner.lon < outer.maxLon);
});

test('rejects bad input', () => {
  assert.throws(() => encode(91, 0), RangeError);
  assert.throws(() => decode('u4pa'), /Invalid geohash/);
});
