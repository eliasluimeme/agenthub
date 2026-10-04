import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, truncate, wrap, pluralize, length } from '../src/index.ts';

test('slugify strips accents and punctuation', () => {
  assert.equal(slugify('  Héllo, Wörld!  '), 'hello-world');
  assert.equal(slugify('Straße & Smørrebrød'), 'strasse-and-smorrebrod');
  assert.equal(slugify('Retry with backoff (v2)', { separator: '_' }), 'retry_with_backoff_v2');
  assert.equal(slugify('日本語 タイトル'), '日本語-タイトル');
});

test('slugify respects maxLength on a word boundary', () => {
  assert.equal(slugify('add retry with backoff to the fetch client', { maxLength: 20 }), 'add-retry-with');
});

test('truncate counts graphemes and prefers word boundaries', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('Add retry with backoff to fetch', 20), 'Add retry with…');
  assert.equal(truncate('👩‍💻👩‍💻👩‍💻👩‍💻', 3), '👩‍💻👩‍💻…');
  assert.equal(length('👩‍💻é'), 2);
});

test('wrap keeps paragraphs and splits long words', () => {
  assert.equal(wrap('the quick brown fox jumps', 10), 'the quick\nbrown fox\njumps');
  assert.equal(wrap('a\nb c', 10), 'a\nb c');
  assert.equal(wrap('abcdefghij', 4), 'abcd\nefgh\nij');
});

test('pluralize', () => {
  assert.deepEqual(['agent', 'repository', 'branch', 'box', 'key', 'person', 'Child'].map((w) => pluralize(w)),
    ['agents', 'repositories', 'branches', 'boxes', 'keys', 'people', 'Children']);
  assert.equal(pluralize('agent', 1), '1 agent');
  assert.equal(pluralize('run', 0), '0 runs');
});
