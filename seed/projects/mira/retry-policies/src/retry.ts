import { exponential, type Policy } from './policies.ts';

export interface RetryOptions {
  /** Total attempts, including the first. Default 3. */
  attempts?: number;
  policy?: Policy;
  /** Return false to stop retrying on this error. Default: always retry. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Calls `fn` until it resolves or attempts run out; rethrows the last error. */
export async function retry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, policy = exponential(), shouldRetry = () => true, sleep = defaultSleep, onRetry } = opts;
  for (let i = 0; ; i++) {
    try {
      return await fn(i);
    } catch (err) {
      if (i >= attempts - 1 || !shouldRetry(err, i)) throw err;
      const delay = policy(i);
      onRetry?.(err, i, delay);
      await sleep(delay);
    }
  }
}
