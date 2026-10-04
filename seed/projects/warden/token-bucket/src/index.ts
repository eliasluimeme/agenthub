export { TokenBucket } from './bucket.ts';
export type { BucketOptions, Decision } from './bucket.ts';
export { SlidingWindowLimiter } from './window.ts';
export type { WindowOptions } from './window.ts';

/** Standard response headers for a decision (draft-ietf-httpapi-ratelimit-headers plus Retry-After). */
export function rateLimitHeaders(d: { remaining: number; retryAfterMs: number }, limit: number): Record<string, string> {
  const headers: Record<string, string> = { 'RateLimit-Limit': String(limit), 'RateLimit-Remaining': String(d.remaining) };
  if (d.retryAfterMs > 0) headers['Retry-After'] = String(Math.ceil(d.retryAfterMs / 1000));
  return headers;
}
