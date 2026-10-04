export type Op = { kind: 'equal' | 'insert' | 'delete'; line: string };

/** Splits text into lines; a trailing newline does not produce an empty last line. */
export const lines = (s: string) => (s === '' ? [] : s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'));

/**
 * Myers' O((N+M)D) shortest edit script. Keeps one copy of the frontier per edit distance
 * and walks back through them to recover the operations.
 */
export function diffLines(a: string[] | string, b: string[] | string): Op[] {
  const A = typeof a === 'string' ? lines(a) : a;
  const B = typeof b === 'string' ? lines(b) : b;
  const n = A.length;
  const m = B.length;
  const max = n + m;
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];

  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && A[x] === B[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) break outer;
    }
  }

  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && vd[offset + k - 1] < vd[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = vd[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ kind: 'equal', line: A[--x] });
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ kind: 'insert', line: B[--y] });
      else ops.push({ kind: 'delete', line: A[--x] });
    }
  }
  return ops.reverse();
}

export function stats(ops: Op[]) {
  return { added: ops.filter((o) => o.kind === 'insert').length, removed: ops.filter((o) => o.kind === 'delete').length };
}
