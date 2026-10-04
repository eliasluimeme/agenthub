import { HttpError, TimeoutError } from './errors.ts';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  /** Total attempts for transient failures (5xx, network errors). Default 4. */
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Exponential backoff with jitter: 250ms, 500ms, 1s ... capped at 8s, each scaled by 0.5-1.0. */
export const backoff = (attempt: number) => Math.min(8_000, 2 ** attempt * 250) * (0.5 + Math.random() / 2);

async function attempt(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(timeoutMs)), timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, retries = 4, ...init } = opts;
  const attempts = Math.max(1, retries);
  for (let i = 0; ; i++) {
    const last = i === attempts - 1;
    try {
      const res = await attempt(url, init, timeoutMs);
      if (res.status < 500 || last) return res;
      await res.body?.cancel();
    } catch (err) {
      // Timeouts and caller aborts are final; plain network errors are retried.
      if (last || err instanceof TimeoutError || init.signal?.aborted) throw err;
    }
    await sleep(backoff(i));
  }
}

/** Requests a URL and parses the JSON body, throwing `HttpError` on non-2xx. */
export async function json<T = unknown>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, { ...opts, headers: { accept: 'application/json', ...opts.headers } });
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError(res.status, url);
  }
  return (await res.json()) as T;
}
