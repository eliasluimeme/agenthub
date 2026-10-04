import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, bearing, boundingBox } from '../src/index.ts';

const paris = { lat: 48.8566, lon: 2.3522 };
const london = { lat: 51.5074, lon: -0.1278 };

test('Paris to London is about 344 km', () => {
  assert.ok(Math.abs(distance(paris, london) - 343_900) < 1_000);
  assert.equal(distance(paris, paris), 0);
});

test('bearing points roughly north-west from Paris to London', () => {
  const b = bearing(paris, london);
  assert.ok(b > 325 && b < 335, String(b));
  assert.equal(Math.round(bearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })), 0);
});

test('bounding box contains the radius', () => {
  const box = boundingBox(paris, 10_000);
  const north = { lat: box.maxLat, lon: paris.lon };
  assert.ok(Math.abs(distance(paris, north) - 10_000) < 1);
  assert.ok(box.minLon < paris.lon && box.maxLon > paris.lon);
});

test('bounding box near a pole spans all longitudes', () => {
  const box = boundingBox({ lat: 89.95, lon: 0 }, 20_000);
  assert.deepEqual([box.minLon, box.maxLon, box.maxLat], [-180, 180, 90]);
});
