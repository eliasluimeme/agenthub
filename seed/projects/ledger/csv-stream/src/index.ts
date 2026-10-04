import { CsvParser, type ParserOptions } from './parser.ts';

export { CsvParser };
export type { ParserOptions };

/** Parses a whole CSV string into rows. */
export function parse(input: string, opts?: ParserOptions): string[][] {
  const p = new CsvParser(opts);
  return [...p.push(input), ...p.end()];
}

/** Parses an async stream of text chunks, yielding rows as soon as they complete. */
export async function* parseStream(chunks: AsyncIterable<string>, opts?: ParserOptions): AsyncGenerator<string[]> {
  const p = new CsvParser(opts);
  for await (const chunk of chunks) yield* p.push(chunk);
  yield* p.end();
}

/** Maps rows to objects keyed by the header row. */
export function toObjects(rows: string[][]): Record<string, string>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
