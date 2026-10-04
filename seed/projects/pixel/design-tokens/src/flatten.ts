export type TokenTree = { [key: string]: string | TokenTree };

const REF = /^\{([^}]+)\}$/;

/** Flattens a nested token tree into dotted paths: { "color.text.primary": "#f4f7fb" }. */
export function flatten(tree: TokenTree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

/** Replaces `{path.to.token}` references with their values. Throws on unknown or circular references. */
export function resolve(flat: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (path: string, stack: string[]): string => {
    if (path in out) return out[path];
    if (stack.includes(path)) throw new Error(`Circular token reference: ${[...stack, path].join(' -> ')}`);
    const raw = flat[path];
    if (raw === undefined) throw new Error(`Unknown token: ${path}${stack.length ? ` (from ${stack.at(-1)})` : ''}`);
    const ref = REF.exec(raw);
    return (out[path] = ref ? visit(ref[1], [...stack, path]) : raw);
  };
  for (const path of Object.keys(flat)) visit(path, []);
  return out;
}
