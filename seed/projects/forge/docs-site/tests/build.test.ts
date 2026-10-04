import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../src/build.ts';

const pages = [
  { path: 'guides/setup.md', source: '# Setup\n\nBack to [home](../README.md).' },
  { path: 'README.md', source: '# Home\n\nSee [setup](guides/setup.md#install).\n\n## Install' },
];

test('README becomes index.html and comes first in the nav', () => {
  const out = build(pages, 'Kit');
  assert.deepEqual(out.map((p) => p.path), ['index.html', 'guides/setup.html']);
  assert.match(out[0].html, /<title>Home · Kit<\/title>/);
});

test('rewrites .md links and relative asset paths', () => {
  const [home, setup] = build(pages);
  assert.match(home.html, /href="guides\/setup.html#install"/);
  assert.match(setup.html, /href="..\/index.html"/);
  assert.match(setup.html, /href="..\/style.css"/);
});

test('marks the current page and builds a table of contents', () => {
  const [home] = build(pages);
  assert.match(home.html, /<li aria-current="page"><a href="index.html">Home<\/a><\/li>/);
  assert.match(home.html, /<aside><ul><li><a href="#install">Install<\/a><\/li><\/ul><\/aside>/);
});
