import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.ts';

const list = (s: Set<number>) => [...s].sort((a, b) => a - b);

test('wildcards, lists, ranges and steps', () => {
  const s = parse('*/15 9-17 1,15 * mon-fri');
  assert.deepEqual(list(s.minute), [0, 15, 30, 45]);
  assert.deepEqual(list(s.hour), [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(list(s.dayOfMonth), [1, 15]);
  assert.equal(s.month.size, 12);
  assert.deepEqual(list(s.dayOfWeek), [1, 2, 3, 4, 5]);
});

test('names, macros and Sunday as 7', () => {
  assert.deepEqual(list(parse('0 0 * jan,dec sun').month), [1, 12]);
  assert.deepEqual(list(parse('0 0 * * 7').dayOfWeek), [0]);
  assert.deepEqual(list(parse('@hourly').minute), [0]);
  assert.deepEqual(list(parse('5/20 * * * *').minute), [5, 25, 45]);
});

test('rejects invalid expressions', () => {
  assert.throws(() => parse('* * * *'), /5 fields/);
  assert.throws(() => parse('60 * * * *'), /out of range/);
  assert.throws(() => parse('*/0 * * * *'), /Invalid step/);
  assert.throws(() => parse('* 5-1 * * *'), /backwards/);
});
