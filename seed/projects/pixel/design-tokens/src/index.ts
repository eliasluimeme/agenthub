import { readFileSync } from 'node:fs';
import { flatten, resolve, type TokenTree } from './flatten.ts';

export { flatten, resolve };
export type { TokenTree };

/** Loads tokens.json from the package root, flattened and resolved. */
export function loadTokens(file = new URL('../tokens.json', import.meta.url)): Record<string, string> {
  return resolve(flatten(JSON.parse(readFileSync(file, 'utf8')) as TokenTree));
}
