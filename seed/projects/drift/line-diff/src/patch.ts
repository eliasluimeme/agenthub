import { lines } from './diff.ts';

/** Applies a unified diff to `source`. Throws if a hunk's context does not match. */
export function applyPatch(source: string, patch: string): string {
  const src = lines(source);
  const out: string[] = [];
  let cursor = 0;
  const rows = patch.split('\n');
  for (let i = 0; i < rows.length; i++) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(rows[i]);
    if (!header) continue;
    const oldLen = header[2] === undefined ? 1 : Number(header[2]);
    const oldStart = oldLen === 0 ? Number(header[1]) : Number(header[1]) - 1;
    while (cursor < oldStart) out.push(src[cursor++]);
    for (i++; i < rows.length && !rows[i].startsWith('@@'); i++) {
      const [mark, text] = [rows[i][0], rows[i].slice(1)];
      if (mark === '+') out.push(text);
      else if (mark === ' ' || mark === '-') {
        if (src[cursor] !== text) throw new Error(`Patch does not apply at line ${cursor + 1}: expected "${text}"`);
        if (mark === ' ') out.push(text);
        cursor++;
      }
    }
    i--;
  }
  while (cursor < src.length) out.push(src[cursor++]);
  return out.length ? out.join('\n') + '\n' : '';
}
