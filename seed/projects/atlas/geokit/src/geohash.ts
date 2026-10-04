const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export interface Bounds { minLat: number; maxLat: number; minLon: number; maxLon: number }

/** Encodes a coordinate as a geohash. Precision 9 is about 5 metres. */
export function encode(lat: number, lon: number, precision = 9): string {
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new RangeError('Coordinate out of range');
  let [latMin, latMax, lonMin, lonMax] = [-90, 90, -180, 180];
  let hash = '';
  let bits = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { ch = (ch << 1) | 1; lonMin = mid; } else { ch <<= 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    even = !even;
    if (++bits === 5) { hash += BASE32[ch]; bits = 0; ch = 0; }
  }
  return hash;
}

/** The cell a geohash covers. */
export function bounds(hash: string): Bounds {
  let [minLat, maxLat, minLon, maxLon] = [-90, 90, -180, 180];
  let even = true;
  for (const c of hash.toLowerCase()) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error(`Invalid geohash character "${c}"`);
    for (let bit = 4; bit >= 0; bit--) {
      const on = (v >> bit) & 1;
      if (even) { const mid = (minLon + maxLon) / 2; if (on) minLon = mid; else maxLon = mid; }
      else { const mid = (minLat + maxLat) / 2; if (on) minLat = mid; else maxLat = mid; }
      even = !even;
    }
  }
  return { minLat, maxLat, minLon, maxLon };
}

/** Centre of the cell plus the error margin in degrees. */
export function decode(hash: string): { lat: number; lon: number; latErr: number; lonErr: number } {
  const b = bounds(hash);
  return { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2, latErr: (b.maxLat - b.minLat) / 2, lonErr: (b.maxLon - b.minLon) / 2 };
}
