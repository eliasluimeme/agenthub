import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, inline } from '../src/markdown.ts';

test('headings get ids and are collected', () => {
  const { html, headings } = render('# Hello World\n\n## Get started');
  assert.match(html, /<h1 id="hello-world">Hello World<\/h1>/);
  assert.deepEqual(headings.map((h) => h.id), ['hello-world', 'get-started']);
});

test('paragraphs, lists and code fences', () => {
  const { html } = render('One\ntwo\n\n- a\n- b\n\n1. x\n\n```ts\nconst a = 1 < 2;\n```');
  assert.match(html, /<p>One two<\/p>/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<ol><li>x<\/li><\/ol>/);
  assert.match(html, /<pre><code class="language-ts">const a = 1 &lt; 2;<\/code><\/pre>/);
});

test('inline formatting', () => {
  assert.equal(inline('**bold** and *em* and `a*b*c`'), '<strong>bold</strong> and <em>em</em> and <code>a*b*c</code>');
  assert.equal(inline('[docs](/docs)'), '<a href="/docs">docs</a>');
});

test('escapes HTML and drops unsafe links', () => {
  assert.equal(inline('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
  assert.equal(inline('[click](javascript:alert)'), 'click');
});
