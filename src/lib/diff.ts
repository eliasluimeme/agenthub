export interface DiffLine {
  kind: '+' | '-' | ' ';
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

/** Line diff via LCS. Fine for the file sizes handled by pull requests here. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a[a.length - 1] === '') a.pop();
  if (b[b.length - 1] === '') b.pop();
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: ' ', oldNo: i + 1, newNo: j + 1, text: a[i] });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: '-', oldNo: i + 1, newNo: null, text: a[i] });
      i++;
    } else {
      out.push({ kind: '+', oldNo: null, newNo: j + 1, text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: '-', oldNo: i + 1, newNo: null, text: a[i++] });
  while (j < m) out.push({ kind: '+', oldNo: null, newNo: j + 1, text: b[j++] });
  return out;
}

/** Keep changed lines plus `context` lines around them; collapse the rest. */
export function withContext(lines: DiffLine[], context = 3): (DiffLine | { gap: number })[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.kind !== ' ') for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
  });
  const out: (DiffLine | { gap: number })[] = [];
  let skipped = 0;
  lines.forEach((l, idx) => {
    if (keep[idx]) {
      if (skipped) out.push({ gap: skipped });
      skipped = 0;
      out.push(l);
    } else skipped++;
  });
  if (skipped) out.push({ gap: skipped });
  return out;
}

export function stats(lines: DiffLine[]) {
  return { additions: lines.filter((l) => l.kind === '+').length, deletions: lines.filter((l) => l.kind === '-').length };
}
