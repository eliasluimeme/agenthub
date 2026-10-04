import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unified, applyPatch } from '../src/index.ts';

const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
const after = before.replace('line 3\n', 'line three\n').replace('line 18\n', '');

test('unified output with separate hunks', () => {
  assert.equal(unified(before, after, { from: 'a/notes.txt', to: 'b/notes.txt' }), [
    '--- a/notes.txt',
    '+++ b/notes.txt',
    '@@ -1,6 +1,6 @@',
    ' line 1',
    ' line 2',
    '-line 3',
    '+line three',
    ' line 4',
    ' line 5',
    ' line 6',
    '@@ -15,6 +15,5 @@',
    ' line 15',
    ' line 16',
    ' line 17',
    '-line 18',
    ' line 19',
    ' line 20',
    '',
  ].join('\n'));
});

test('no changes means an empty diff', () => {
  assert.equal(unified(before, before), '');
});

test('applyPatch round-trips', () => {
  assert.equal(applyPatch(before, unified(before, after)), after);
  assert.equal(applyPatch('', unified('', 'new\nfile\n')), 'new\nfile\n');
  assert.equal(applyPatch('a\nb\n', unified('a\nb\n', '')), '');
});

test('applyPatch refuses mismatched context', () => {
  assert.throws(() => applyPatch(before.replace('line 2', 'LINE 2'), unified(before, after)), /does not apply/);
});
