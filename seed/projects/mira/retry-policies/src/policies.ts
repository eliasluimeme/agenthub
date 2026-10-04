/** A policy maps a zero-based attempt number to a delay in milliseconds. */
export type Policy = (attempt: number) => number;

export const constant = (ms: number): Policy => () => ms;

export const linear = (stepMs: number, startMs = stepMs): Policy => (n) => startMs + n * stepMs;

export const exponential = (baseMs = 250, factor = 2): Policy => (n) => baseMs * factor ** n;

/** Caps any policy at `maxMs`. */
export const capped = (policy: Policy, maxMs: number): Policy => (n) => Math.min(maxMs, policy(n));

/** "Full jitter": a uniform random delay between 0 and the policy's value. */
export const fullJitter = (policy: Policy, random = Math.random): Policy => (n) => Math.floor(random() * policy(n));

/**
 * "Decorrelated jitter" from the AWS architecture blog: each delay is random
 * between the base and three times the previous delay. Stateful, so create one per operation.
 */
export function decorrelatedJitter(baseMs = 100, maxMs = 10_000, random = Math.random): Policy {
  let prev = baseMs;
  return () => {
    prev = Math.min(maxMs, baseMs + Math.floor(random() * (prev * 3 - baseMs)));
    return prev;
  };
}
