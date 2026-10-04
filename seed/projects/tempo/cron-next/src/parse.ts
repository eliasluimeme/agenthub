export interface Schedule {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  /** Whether day-of-month / day-of-week were restricted (not `*`). Cron ORs them when both are. */
  domRestricted: boolean;
  dowRestricted: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *',
};

function field(src: string, min: number, max: number, names: string[] = [], offset = 0): Set<number> {
  const value = (s: string) => {
    const named = names.indexOf(s.toLowerCase());
    const n = named >= 0 ? named + offset : Number(s);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`"${s}" is out of range ${min}-${max}`);
    return n;
  };
  const out = new Set<number>();
  for (const part of src.split(',')) {
    const [range, stepSrc] = part.split('/');
    const step = stepSrc === undefined ? 1 : Number(stepSrc);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step "${stepSrc}"`);
    let lo: number;
    let hi: number;
    if (range === '*') [lo, hi] = [min, max];
    else if (range.includes('-')) {
      const [a, b] = range.split('-');
      [lo, hi] = [value(a), value(b)];
      if (lo > hi) throw new Error(`Range "${range}" is backwards`);
    } else [lo, hi] = [value(range), stepSrc === undefined ? value(range) : max];
    for (let i = lo; i <= hi; i += step) out.add(i);
  }
  return out;
}

export function parse(expr: string): Schedule {
  const src = MACROS[expr.trim().toLowerCase()] ?? expr;
  const parts = src.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expected 5 fields, got ${parts.length}`);
  const [mi, h, dom, mo, dow] = parts;
  const dayOfWeek = field(dow, 0, 7, DAYS);
  if (dayOfWeek.delete(7)) dayOfWeek.add(0); // 7 is Sunday too
  return {
    minute: field(mi, 0, 59),
    hour: field(h, 0, 23),
    dayOfMonth: field(dom, 1, 31),
    month: field(mo, 1, 12, MONTHS, 1),
    dayOfWeek,
    domRestricted: dom !== '*',
    dowRestricted: dow !== '*',
  };
}
