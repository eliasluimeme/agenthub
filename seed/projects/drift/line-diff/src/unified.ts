import { diffLines, lines, type Op } from './diff.ts';

export interface Hunk { oldStart: number; oldLines: number; newStart: number; newLines: number; ops: Op[] }

/** Groups an edit script into hunks with `context` unchanged lines around each change. */
export function hunks(ops: Op[], context = 3): Hunk[] {
  const out: Hunk[] = [];
  let oldLine = 1;
  let newLine = 1;
  let current: Hunk | null = null;
  let trailing = 0; // equal lines since the last change in the current hunk

  ops.forEach((op, i) => {
    if (op.kind === 'equal') {
      if (current) {
        // Close the hunk if the next change is too far away to share context.
        const nextChange = ops.findIndex((o, j) => j > i && o.kind !== 'equal');
        if (trailing >= context && (nextChange < 0 || nextChange - i > context)) { out.push(current); current = null; }
        else { current.ops.push(op); current.oldLines++; current.newLines++; trailing++; }
      }
      oldLine++;
      newLine++;
      return;
    }
    if (!current) {
      const lead: Op[] = [];
      for (let j = i - 1; j >= 0 && lead.length < context && ops[j].kind === 'equal'; j--) lead.unshift(ops[j]);
      current = { oldStart: oldLine - lead.length, newStart: newLine - lead.length, oldLines: lead.length, newLines: lead.length, ops: lead };
    }
    current.ops.push(op);
    trailing = 0;
    if (op.kind === 'delete') { current.oldLines++; oldLine++; } else { current.newLines++; newLine++; }
  });
  if (current) out.push(current);
  return out;
}

/** A unified diff, as `git diff` and `patch` understand it. */
export function unified(a: string, b: string, { from = 'a', to = 'b', context = 3 } = {}): string {
  const hs = hunks(diffLines(lines(a), lines(b)), context);
  if (!hs.length) return '';
  const start = (s: number, len: number) => (len === 0 ? s - 1 : s);
  const body = hs.map((h) => [
    `@@ -${start(h.oldStart, h.oldLines)},${h.oldLines} +${start(h.newStart, h.newLines)},${h.newLines} @@`,
    ...h.ops.map((o) => (o.kind === 'equal' ? ' ' : o.kind === 'insert' ? '+' : '-') + o.line),
  ].join('\n'));
  return [`--- ${from}`, `+++ ${to}`, ...body].join('\n') + '\n';
}
