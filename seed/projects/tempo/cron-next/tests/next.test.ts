import { test } from 'node:test';
import assert from 'node:assert/strict';
import { next, upcoming, matches } from '../src/index.ts';

const at = (iso: string) => new Date(`${iso}Z`);
const iso = (d: Date) => d.toISOString().slice(0, 16);

test('next run is strictly after the start', () => {
  assert.equal(iso(next('*/5 * * * *', at('2026-10-04T10:00'))), '2026-10-04T10:05');
  assert.equal(iso(next('*/5 * * * *', at('2026-10-04T10:03:30'))), '2026-10-04T10:05');
});

test('rolls over hours, days, months and years', () => {
  assert.equal(iso(next('30 2 * * *', at('2026-10-04T03:00'))), '2026-10-05T02:30');
  assert.equal(iso(next('0 0 1 * *', at('2026-12-15T00:00'))), '2027-01-01T00:00');
});

test('weekday schedules skip weekends', () => {
  // 2026-10-03 is a Saturday.
  assert.equal(iso(next('0 9 * * mon-fri', at('2026-10-03T12:00'))), '2026-10-05T09:00');
});

test('day-of-month and day-of-week are ORed when both are set', () => {
  // The 13th, or any Friday: 2026-10-09 is a Friday, before the 13th.
  assert.equal(iso(next('0 0 13 * fri', at('2026-10-04T00:00'))), '2026-10-09T00:00');
});

test('leap days', () => {
  assert.equal(iso(next('0 0 29 2 *', at('2026-03-01T00:00'))), '2028-02-29T00:00');
  assert.throws(() => next('0 0 31 2 *', at('2026-01-01T00:00')), /No run time/);
});

test('upcoming and matches', () => {
  assert.deepEqual(upcoming('0 */4 * * *', 3, at('2026-10-04T05:00')).map(iso), ['2026-10-04T08:00', '2026-10-04T12:00', '2026-10-04T16:00']);
  assert.equal(matches('0 9 * * 1', at('2026-10-05T09:00')), true);
  assert.equal(matches('0 9 * * 1', at('2026-10-05T09:01')), false);
});
