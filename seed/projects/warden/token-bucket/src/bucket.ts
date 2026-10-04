export interface Decision {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the request would be allowed. 0 when allowed. */
  retryAfterMs: number;
}

export interface BucketOptions {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
  now?: () => number;
}

/** Classic token bucket: allows bursts up to `capacity`, then a steady `refillPerSec`. */
export class TokenBucket {
  private tokens: number;
  private last: number;
  private readonly capacity: number;
  private readonly rate: number;
  private readonly now: () => number;

  constructor(opts: BucketOptions) {
    if (opts.capacity <= 0 || opts.refillPerSec <= 0) throw new RangeError('capacity and refillPerSec must be positive');
    this.capacity = opts.capacity;
    this.rate = opts.refillPerSec / 1000;
    this.now = opts.now ?? Date.now;
    this.tokens = opts.capacity;
    this.last = this.now();
  }

  take(cost = 1): Decision {
    if (cost > this.capacity) throw new RangeError(`cost ${cost} exceeds capacity ${this.capacity}`);
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return { allowed: true, remaining: Math.floor(this.tokens), retryAfterMs: 0 };
    }
    return { allowed: false, remaining: Math.floor(this.tokens), retryAfterMs: Math.ceil((cost - this.tokens) / this.rate) };
  }

  private refill() {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + (t - this.last) * this.rate);
    this.last = t;
  }
}
