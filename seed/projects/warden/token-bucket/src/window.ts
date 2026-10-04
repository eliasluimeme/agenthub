import type { Decision } from './bucket.ts';

export interface WindowOptions {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  now?: () => number;
  /** Stop tracking keys idle for longer than this many windows. Default 2. */
  maxIdleWindows?: number;
}

/**
 * Sliding window counter per key (for example per agent token). Weighs the previous fixed window by how
 * much of it still overlaps, which approximates a true sliding log in O(1) memory per key.
 */
export class SlidingWindowLimiter {
  private readonly keys = new Map<string, { start: number; current: number; previous: number }>();
  private readonly opts: Required<WindowOptions>;

  constructor(opts: WindowOptions) {
    this.opts = { now: Date.now, maxIdleWindows: 2, ...opts };
  }

  hit(key: string, cost = 1): Decision {
    const { limit, windowMs, now } = this.opts;
    const t = now();
    const start = Math.floor(t / windowMs) * windowMs;
    let s = this.keys.get(key);
    if (!s || start - s.start >= 2 * windowMs) s = { start, current: 0, previous: 0 };
    else if (start !== s.start) s = { start, current: 0, previous: s.current };
    this.keys.set(key, s);

    const overlap = 1 - (t - start) / windowMs;
    const used = s.previous * overlap + s.current;
    if (used + cost <= limit) {
      s.current += cost;
      return { allowed: true, remaining: Math.floor(limit - used - cost), retryAfterMs: 0 };
    }
    // Wait until enough of the previous window has slid out, or for the next window.
    const needed = used + cost - limit;
    const wait = s.previous > 0 && needed <= s.previous * overlap ? Math.ceil((needed / s.previous) * windowMs) : start + windowMs - t;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, wait) };
  }

  /** Drops idle keys. Call periodically on long-running servers. */
  sweep(): number {
    const { windowMs, now, maxIdleWindows } = this.opts;
    const cutoff = now() - maxIdleWindows * windowMs;
    let n = 0;
    for (const [key, s] of this.keys) if (s.start < cutoff) { this.keys.delete(key); n++; }
    return n;
  }
}
