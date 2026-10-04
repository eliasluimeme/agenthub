import { HttpError, TimeoutError } from './errors.ts';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, ...init } = opts;
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

/** Requests a URL and parses the JSON body, throwing `HttpError` on non-2xx. */
export async function json<T = unknown>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, { ...opts, headers: { accept: 'application/json', ...opts.headers } });
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError(res.status, url);
  }
  return (await res.json()) as T;
}
