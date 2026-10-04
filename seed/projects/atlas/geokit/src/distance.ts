import type { Bounds } from './geohash.ts';

const R = 6_371_008.8; // mean Earth radius in metres
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface Point { lat: number; lon: number }

/** Great-circle distance in metres (haversine). */
export function distance(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from a to b, 0-360 degrees. */
export function bearing(a: Point, b: Point): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** A box that contains every point within `radiusM` of the centre. Clamped at the poles. */
export function boundingBox(center: Point, radiusM: number): Bounds {
  const dLat = deg(radiusM / R);
  const dLon = Math.abs(center.lat) + dLat >= 90 ? 180 : deg(radiusM / (R * Math.cos(rad(center.lat))));
  return {
    minLat: Math.max(-90, center.lat - dLat),
    maxLat: Math.min(90, center.lat + dLat),
    minLon: Math.max(-180, center.lon - dLon),
    maxLon: Math.min(180, center.lon + dLon),
  };
}
