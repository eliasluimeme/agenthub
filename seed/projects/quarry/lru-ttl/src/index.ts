export interface CacheOptions<K, V> {
  /** Maximum number of entries. Least recently used entries are evicted first. */
  max: number;
  /** Default time to live in ms. 0 means entries never expire. */
  ttlMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
  onEvict?: (key: K, value: V, reason: 'lru' | 'expired' | 'deleted') => void;
}

interface Entry<V> { value: V; expires: number }

/** A Map keeps insertion order, so re-inserting on read makes the first key the least recently used. */
export class LruCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly pending = new Map<K, Promise<V>>();
  private readonly max: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly onEvict?: CacheOptions<K, V>['onEvict'];

  constructor(opts: CacheOptions<K, V>) {
    if (!Number.isInteger(opts.max) || opts.max < 1) throw new RangeError('max must be a positive integer');
    this.max = opts.max;
    this.ttlMs = opts.ttlMs ?? 0;
    this.now = opts.now ?? Date.now;
    this.onEvict = opts.onEvict;
  }

  get size() { return this.map.size; }

  get(key: K): V | undefined {
    const entry = this.live(key);
    if (!entry) return undefined;
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /** Reads without updating recency. */
  peek(key: K): V | undefined { return this.live(key)?.value; }

  has(key: K): boolean { return this.live(key) !== undefined; }

  set(key: K, value: V, ttlMs = this.ttlMs): this {
    this.map.delete(key);
    this.map.set(key, { value, expires: ttlMs > 0 ? this.now() + ttlMs : Infinity });
    while (this.map.size > this.max) {
      const [oldest, entry] = this.map.entries().next().value!;
      this.map.delete(oldest);
      this.onEvict?.(oldest, entry.value, 'lru');
    }
    return this;
  }

  delete(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    this.map.delete(key);
    this.onEvict?.(key, entry.value, 'deleted');
    return true;
  }

  clear() { this.map.clear(); }

  /**
   * Returns the cached value, or calls `load` once and caches its result. Concurrent callers for the
   * same key share one in-flight promise. Rejections are not cached.
   */
  async getOrLoad(key: K, load: (key: K) => Promise<V>, ttlMs?: number): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const p = load(key)
      .then((value) => { this.set(key, value, ttlMs); return value; })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  /** Removes expired entries. Expiry is otherwise lazy, on access. */
  prune(): number {
    let n = 0;
    for (const key of [...this.map.keys()]) if (!this.live(key)) n++;
    return n;
  }

  private live(key: K): Entry<V> | undefined {
    const entry = this.map.get(key);
    if (entry && entry.expires <= this.now()) {
      this.map.delete(key);
      this.onEvict?.(key, entry.value, 'expired');
      return undefined;
    }
    return entry;
  }
}
