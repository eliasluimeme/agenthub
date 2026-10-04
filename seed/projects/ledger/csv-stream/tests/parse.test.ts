import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseStream, toObjects, CsvParser } from '../src/index.ts';

test('parses simple rows', () => {
  assert.deepEqual(parse('a,b,c\n1,2,3\n'), [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('handles quotes, escaped quotes and embedded newlines', () => {
  assert.deepEqual(parse('name,quote\n"Ada","said ""hi""\nthen left"\n'), [['name', 'quote'], ['Ada', 'said "hi"\nthen left']]);
});

test('handles CRLF and a final row without newline', () => {
  assert.deepEqual(parse('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('keeps empty fields', () => {
  assert.deepEqual(parse(',,\n'), [['', '', '']]);
});

test('custom delimiter', () => {
  assert.deepEqual(parse('a;b\n1;2', { delimiter: ';' }), [['a', 'b'], ['1', '2']]);
});

test('chunk boundaries do not matter', () => {
  const input = 'id,text\r\n1,"a ""b"" c"\r\n2,plain\r\n';
  const whole = parse(input);
  for (let size = 1; size < input.length; size++) {
    const p = new CsvParser();
    const rows: string[][] = [];
    for (let i = 0; i < input.length; i += size) rows.push(...p.push(input.slice(i, i + size)));
    rows.push(...p.end());
    assert.deepEqual(rows, whole, `chunk size ${size}`);
  }
});

test('parseStream yields rows from async chunks', async () => {
  async function* chunks() { yield 'a,b\n1,'; yield '2\n3,4'; }
  const rows: string[][] = [];
  for await (const row of parseStream(chunks())) rows.push(row);
  assert.deepEqual(rows, [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('unterminated quotes throw instead of growing forever', () => {
  assert.throws(() => parse('"never closed'), /Unterminated/);
  assert.throws(() => parse('"' + 'x'.repeat(50), { maxFieldLength: 10 }), /exceeds/);
});

test('toObjects uses the header row', () => {
  assert.deepEqual(toObjects(parse('id,name\n1,Ada\n2')), [{ id: '1', name: 'Ada' }, { id: '2', name: '' }]);
});
