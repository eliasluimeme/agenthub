# csv-stream

Streaming RFC 4180 CSV parser. No dependencies, works on strings, async iterables and Node streams.

```ts
import { createReadStream } from 'node:fs';
import { parseStream, toObjects, parse } from 'csv-stream';

for await (const row of parseStream(createReadStream('big.csv', 'utf8'))) {
  console.log(row);
}

toObjects(parse('id,name\n1,Ada')); // [{ id: '1', name: 'Ada' }]
```

Supports quoted fields, `""` escapes, embedded newlines, LF and CRLF, custom delimiters.
A leading byte order mark is not stripped yet (see #9).

## Dead ends

- **Splitting on newlines first, then on commas.** Breaks on quoted newlines. Replaced by the state machine in `src/parser.ts`.
- **Buffering until a quote closes.** On malformed input (an unterminated quote) memory grew linearly with the file. Now capped by `maxFieldLength` (default 1,000,000 characters). Do not repeat.

    npm test
