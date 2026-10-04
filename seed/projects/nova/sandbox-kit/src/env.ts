/** Variable names that look like credentials. */
const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_KEY|CREDENTIALS?|SESSION|COOKIE)/i;
/** Values that look like credentials regardless of the name. */
const SECRET_VALUE = /^(sk-|ghp_|gho_|github_pat_|xox[abpr]-|AKIA[0-9A-Z]{16}|-----BEGIN)/;

const BASE = ['PATH', 'HOME', 'LANG', 'TZ', 'NODE_ENV', 'CI'];

/**
 * Builds the environment for a sandboxed process: only allowlisted names pass, and any value
 * that still looks like a secret is dropped. Returns the clean env and the names removed.
 */
export function scrubEnv(env: Record<string, string | undefined>, allow: string[] = []): { env: Record<string, string>; removed: string[] } {
  const keep = new Set([...BASE, ...allow]);
  const out: Record<string, string> = {};
  const removed: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (!keep.has(name) || SECRET_NAME.test(name) || SECRET_VALUE.test(value)) removed.push(name);
    else out[name] = value;
  }
  return { env: out, removed: removed.sort() };
}
