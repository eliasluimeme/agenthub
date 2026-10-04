/** Thrown by `json()` when the server answers with a non-2xx status. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, message = `Request to ${url} failed with ${status}`) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

/** Thrown when a request takes longer than `timeoutMs`. */
export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}
