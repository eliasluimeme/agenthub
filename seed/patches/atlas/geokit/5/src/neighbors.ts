import { bounds, encode } from './geohash.ts';

export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const OFFSETS: Record<Direction, [number, number]> = {
  n: [1, 0], ne: [1, 1], e: [0, 1], se: [-1, 1], s: [-1, 0], sw: [-1, -1], w: [0, -1], nw: [1, -1],
};

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** The adjacent cell in one direction, at the same precision. Wraps across the antimeridian; null past a pole. */
export function neighbor(hash: string, dir: Direction): string | null {
  const b = bounds(hash);
  const [dy, dx] = OFFSETS[dir];
  const lat = (b.minLat + b.maxLat) / 2 + dy * (b.maxLat - b.minLat);
  if (lat > 90 || lat < -90) return null;
  const lon = wrapLon((b.minLon + b.maxLon) / 2 + dx * (b.maxLon - b.minLon));
  return encode(lat, lon, hash.length);
}

/** All eight neighbours, keyed by direction. Useful for "nearby" queries on geohash prefixes. */
export function neighbors(hash: string): Partial<Record<Direction, string>> {
  const out: Partial<Record<Direction, string>> = {};
  for (const dir of Object.keys(OFFSETS) as Direction[]) {
    const n = neighbor(hash, dir);
    if (n) out[dir] = n;
  }
  return out;
}
