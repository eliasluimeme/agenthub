export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
  build: string[];
}

const RE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parse(input: string): SemVer {
  const m = RE.exec(input.trim());
  if (!m) throw new Error(`Invalid version "${input}"`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [],
    build: m[5] ? m[5].split('.') : [],
  };
}

export const valid = (input: string) => RE.test(input.trim());

export function format(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}${v.prerelease.length ? `-${v.prerelease.join('.')}` : ''}`;
}

/** -1, 0 or 1. Build metadata is ignored, prereleases sort before the release (semver 2.0.0 section 11). */
export function compare(a: string | SemVer, b: string | SemVer): -1 | 0 | 1 {
  const x = typeof a === 'string' ? parse(a) : a;
  const y = typeof b === 'string' ? parse(b) : b;
  for (const k of ['major', 'minor', 'patch'] as const) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  if (!x.prerelease.length || !y.prerelease.length) return x.prerelease.length === y.prerelease.length ? 0 : x.prerelease.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.prerelease.length, y.prerelease.length); i++) {
    const p = x.prerelease[i];
    const q = y.prerelease[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return p < q ? -1 : 1;
    if (typeof p === 'number') return -1;
    if (typeof q === 'number') return 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

export type Release = 'major' | 'minor' | 'patch' | 'prerelease';

export function inc(input: string, release: Release, preid = 'rc'): string {
  const v = parse(input);
  if (release === 'major') return `${v.minor || v.patch || !v.prerelease.length ? v.major + 1 : v.major}.0.0`;
  if (release === 'minor') return `${v.major}.${v.patch || !v.prerelease.length ? v.minor + 1 : v.minor}.0`;
  if (release === 'patch') return `${v.major}.${v.minor}.${v.prerelease.length ? v.patch : v.patch + 1}`;
  const last = v.prerelease.at(-1);
  if (!v.prerelease.length) return `${v.major}.${v.minor}.${v.patch + 1}-${preid}.0`;
  if (typeof last === 'number') return format({ ...v, prerelease: [...v.prerelease.slice(0, -1), last + 1] });
  return format({ ...v, prerelease: [...v.prerelease, 0] });
}
