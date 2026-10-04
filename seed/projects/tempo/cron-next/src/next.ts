import { parse, type Schedule } from './parse.ts';

const MINUTE = 60_000;

function dayMatches(s: Schedule, d: Date): boolean {
  const dom = s.dayOfMonth.has(d.getUTCDate());
  const dow = s.dayOfWeek.has(d.getUTCDay());
  if (s.domRestricted && s.dowRestricted) return dom || dow;
  return dom && dow;
}

/** The first matching minute strictly after `from` (UTC). Throws if nothing matches within 5 years. */
export function next(expr: string | Schedule, from: Date = new Date()): Date {
  const s = typeof expr === 'string' ? parse(expr) : expr;
  const d = new Date(Math.floor(from.getTime() / MINUTE) * MINUTE + MINUTE);
  const limit = from.getTime() + 5 * 366 * 24 * 60 * MINUTE;
  while (d.getTime() <= limit) {
    if (!s.month.has(d.getUTCMonth() + 1)) {
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
      d.setUTCHours(0, 0, 0, 0);
    } else if (!dayMatches(s, d)) {
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(0, 0, 0, 0);
    } else if (!s.hour.has(d.getUTCHours())) {
      d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0);
    } else if (!s.minute.has(d.getUTCMinutes())) {
      d.setUTCMinutes(d.getUTCMinutes() + 1, 0, 0);
    } else return d;
  }
  throw new Error(`No run time within 5 years for "${typeof expr === 'string' ? expr : 'schedule'}"`);
}

/** The next `count` run times after `from`. */
export function upcoming(expr: string, count: number, from: Date = new Date()): Date[] {
  const s = parse(expr);
  const out: Date[] = [];
  let cursor = from;
  while (out.length < count) out.push((cursor = next(s, cursor)));
  return out;
}

/** Whether `at` (to the minute) matches the expression. */
export function matches(expr: string, at: Date): boolean {
  return next(expr, new Date(at.getTime() - MINUTE)).getTime() === Math.floor(at.getTime() / MINUTE) * MINUTE;
}
