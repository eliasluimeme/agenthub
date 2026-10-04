import { compare, parse, type SemVer } from './version.ts';

type Comparator = { op: '<' | '<=' | '>' | '>=' | '='; v: SemVer };

const PARTIAL = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?$/;

/** Expands `1.2`, `1.x`, `^1.2.3`, `~1.2`, `1.2.3 - 2.0.0` and plain comparators into lower/upper bounds. */
function expand(token: string): Comparator[] {
  const m = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(token)!;
  const op = m[1] ?? '';
  const p = PARTIAL.exec(m[2]);
  if (!p) throw new Error(`Invalid comparator "${token}"`);
  const wild = (s?: string) => s === undefined || /^[xX*]$/.test(s);
  const [M, mi, pa] = [p[1], p[2], p[3]].map((s) => (wild(s) ? null : Number(s)));
  const pre = p[4] ? `-${p[4]}` : '';
  const v = (a: number, b: number, c: number, suffix = '') => parse(`${a}.${b}.${c}${suffix}`);

  if (M === null) return op === '<' || op === '>' ? [{ op: '<', v: v(0, 0, 0, '-0') }] : [];
  if (op === '^') {
    const lo = v(M, mi ?? 0, pa ?? 0, pre);
    if (M > 0 || mi === null) return [{ op: '>=', v: lo }, { op: '<', v: v(M + 1, 0, 0, '-0') }];
    if (mi > 0 || pa === null) return [{ op: '>=', v: lo }, { op: '<', v: v(0, mi + 1, 0, '-0') }];
    return [{ op: '>=', v: lo }, { op: '<', v: v(0, 0, pa + 1, '-0') }];
  }
  if (op === '~') {
    const lo = v(M, mi ?? 0, pa ?? 0, pre);
    return [{ op: '>=', v: lo }, { op: '<', v: mi === null ? v(M + 1, 0, 0, '-0') : v(M, mi + 1, 0, '-0') }];
  }
  if (mi === null || pa === null) {
    // Partial versions: 1 means >=1.0.0 <2.0.0, 1.2 means >=1.2.0 <1.3.0.
    const lo = v(M, mi ?? 0, 0);
    const hi = mi === null ? v(M + 1, 0, 0, '-0') : v(M, mi + 1, 0, '-0');
    if (op === '' || op === '=') return [{ op: '>=', v: lo }, { op: '<', v: hi }];
    if (op === '>') return [{ op: '>=', v: hi }];
    if (op === '>=') return [{ op: '>=', v: lo }];
    if (op === '<') return [{ op: '<', v: lo }];
    return [{ op: '<', v: hi }];
  }
  return [{ op: (op || '=') as Comparator['op'], v: v(M, mi, pa, pre) }];
}

function parseSet(src: string): Comparator[] {
  const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(src);
  if (hyphen) return [...expand(`>=${hyphen[1]}`), ...expand(`<=${hyphen[2]}`)];
  return src.trim().replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1').split(/\s+/).filter(Boolean).flatMap(expand);
}

const test = (c: Comparator, v: SemVer) => {
  const r = compare(v, c.v);
  return c.op === '=' ? r === 0 : c.op === '<' ? r < 0 : c.op === '<=' ? r <= 0 : c.op === '>' ? r > 0 : r >= 0;
};

/**
 * npm semantics: a prerelease only satisfies a set if some comparator in that set
 * has a prerelease on the same major.minor.patch.
 */
export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  return range.split('||').some((part) => {
    const set = parseSet(part);
    if (!set.every((c) => test(c, v))) return false;
    if (!v.prerelease.length) return true;
    return set.some((c) => c.v.prerelease.length > 0 && c.v.prerelease[0] !== 0 && c.v.major === v.major && c.v.minor === v.minor && c.v.patch === v.patch);
  });
}

/** The highest version in `versions` that satisfies `range`, or null. */
export function maxSatisfying(versions: string[], range: string): string | null {
  return versions.filter((v) => satisfies(v, range)).sort((a, b) => compare(b, a))[0] ?? null;
}
