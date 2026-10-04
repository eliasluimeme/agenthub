/**
 * Egress allowlist. Entries are hostnames, optionally with a leading `*.` wildcard
 * (matches subdomains, not the apex) and an optional `:port`.
 */
export const ALLOWED_HOSTS = ['registry.npmjs.org', 'api.github.com', '*.githubusercontent.com'];

const PRIVATE = [/^localhost$/, /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^\[?::1\]?$/, /^\[?f[cd][0-9a-f]{2}:/i];

export interface EgressDecision { allowed: boolean; reason: string }

export function checkEgress(rawUrl: string, allowlist: string[] = ALLOWED_HOSTS): EgressDecision {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return { allowed: false, reason: 'invalid URL' }; }
  if (url.protocol !== 'https:') return { allowed: false, reason: `protocol ${url.protocol} is not allowed` };
  if (url.username || url.password) return { allowed: false, reason: 'credentials in URL' };
  const host = url.hostname.toLowerCase();
  if (PRIVATE.some((re) => re.test(host))) return { allowed: false, reason: `private address ${host}` };
  const port = url.port || '443';
  for (const entry of allowlist) {
    const [pattern, entryPort = '443'] = entry.toLowerCase().split(':');
    if (entryPort !== port) continue;
    const match = pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) && host.length > pattern.length - 1 : host === pattern;
    if (match) return { allowed: true, reason: `matched ${entry}` };
  }
  return { allowed: false, reason: `${host}:${port} is not on the allowlist` };
}

export const isAllowed = (url: string, allowlist?: string[]) => checkEgress(url, allowlist).allowed;
