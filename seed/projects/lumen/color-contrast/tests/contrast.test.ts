import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, contrast, rate, adjust, luminance } from '../src/index.ts';

const round = (n: number) => Math.round(n * 100) / 100;

test('parses hex and rgb()', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
  assert.deepEqual(parseColor('#027DEA'), [2, 125, 234]);
  assert.deepEqual(parseColor('rgb(5, 6, 15)'), [5, 6, 15]);
  assert.throws(() => parseColor('rgb(300,0,0)'));
  assert.throws(() => parseColor('blue'));
});

test('known contrast ratios', () => {
  assert.equal(round(contrast('#000', '#fff')), 21);
  assert.equal(round(contrast('#fff', '#fff')), 1);
  assert.equal(round(contrast('#777', '#fff')), 4.48);
  assert.equal(luminance('#fff'), 1);
});

test('ratings follow WCAG thresholds', () => {
  assert.deepEqual([7, 4.5, 3, 2.9].map(rate), ['AAA', 'AA', 'AA large', 'fail']);
});

test('adjust finds a passing color close to the original', () => {
  const fixed = adjust('#777777', '#ffffff');
  assert.ok(contrast(fixed, '#ffffff') >= 4.5);
  assert.ok(contrast(fixed, '#ffffff') < 4.7, 'should not overshoot much');
  const onDark = adjust('#3a3f55', '#05060f', 7);
  assert.ok(contrast(onDark, '#05060f') >= 7);
  assert.equal(adjust('#000000', '#ffffff'), '#000000');
});
