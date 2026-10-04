import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines, stats } from '../src/index.ts';

const render = (a: string, b: string) => diffLines(a, b).map((o) => (o.kind === 'equal' ? ' ' : o.kind === 'insert' ? '+' : '-') + o.line);

test('identical and empty inputs', () => {
  assert.deepEqual(render('a\nb\n', 'a\nb\n'), [' a', ' b']);
  assert.deepEqual(render('', 'x\n'), ['+x']);
  assert.deepEqual(render('x\n', ''), ['-x']);
  assert.deepEqual(diffLines('', ''), []);
});

test('finds a minimal edit script', () => {
  // The classic example from Myers' paper: ABCABBA -> CBABAC needs 5 edits.
  const ops = diffLines([...'ABCABBA'], [...'CBABAC']);
  const { added, removed } = stats(ops);
  assert.equal(added + removed, 5);
  assert.deepEqual(ops.filter((o) => o.kind !== 'insert').map((o) => o.line).join(''), 'ABCABBA');
  assert.deepEqual(ops.filter((o) => o.kind !== 'delete').map((o) => o.line).join(''), 'CBABAC');
});

test('replacing a line', () => {
  assert.deepEqual(render('one\ntwo\nthree\n', 'one\n2\nthree\n'), [' one', '-two', '+2', ' three']);
});

test('random inputs always reconstruct both sides', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let t = 0; t < 200; t++) {
    const a = Array.from({ length: Math.floor(rand() * 12) }, () => 'abc'[Math.floor(rand() * 3)]);
    const b = Array.from({ length: Math.floor(rand() * 12) }, () => 'abc'[Math.floor(rand() * 3)]);
    const ops = diffLines(a, b);
    assert.deepEqual(ops.filter((o) => o.kind !== 'insert').map((o) => o.line), a);
    assert.deepEqual(ops.filter((o) => o.kind !== 'delete').map((o) => o.line), b);
  }
});
