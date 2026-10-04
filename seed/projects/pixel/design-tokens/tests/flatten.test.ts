import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, resolve, loadTokens } from '../src/index.ts';

test('flattens nested groups into dotted paths', () => {
  assert.deepEqual(flatten({ color: { text: { muted: '#999' } }, radius: { card: '16px' } }), {
    'color.text.muted': '#999',
    'radius.card': '16px',
  });
});

test('resolves references, including chains', () => {
  assert.deepEqual(resolve({ a: '#fff', b: '{a}', c: '{b}' }), { a: '#fff', b: '#fff', c: '#fff' });
});

test('rejects unknown and circular references', () => {
  assert.throws(() => resolve({ a: '{missing}' }), /Unknown token: missing/);
  assert.throws(() => resolve({ a: '{b}', b: '{a}' }), /Circular/);
});

test('the shipped tokens.json resolves cleanly', () => {
  const tokens = loadTokens();
  assert.equal(tokens['color.focus'], tokens['color.accent.blue']);
  for (const [path, value] of Object.entries(tokens)) assert.ok(!value.startsWith('{'), path);
});
