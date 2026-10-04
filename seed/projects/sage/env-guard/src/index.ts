type Parser<T> = { parse: (raw: string) => T; default?: T; optional?: boolean; secret?: boolean; describe: string };

export interface FieldOptions<T> { default?: T; optional?: boolean; secret?: boolean }

const make = <T>(describe: string, parse: (raw: string) => T) =>
  (opts: FieldOptions<T> = {}): Parser<T> => ({ parse, describe, ...opts });

export const str = (opts: FieldOptions<string> & { minLength?: number; pattern?: RegExp } = {}) =>
  make('string', (raw) => {
    if (opts.minLength !== undefined && raw.length < opts.minLength) throw new Error(`must be at least ${opts.minLength} characters`);
    if (opts.pattern && !opts.pattern.test(raw)) throw new Error(`must match ${opts.pattern}`);
    return raw;
  })(opts);

export const num = (opts: FieldOptions<number> & { min?: number; max?: number; integer?: boolean } = {}) =>
  make('number', (raw) => {
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) throw new Error('must be a number');
    if (opts.integer && !Number.isInteger(n)) throw new Error('must be an integer');
    if (opts.min !== undefined && n < opts.min) throw new Error(`must be >= ${opts.min}`);
    if (opts.max !== undefined && n > opts.max) throw new Error(`must be <= ${opts.max}`);
    return n;
  })(opts);

export const bool = make('boolean', (raw) => {
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off', ''].includes(v)) return false;
  throw new Error('must be true/false, 1/0, yes/no or on/off');
});

export const url = (opts: FieldOptions<URL> & { protocols?: string[] } = {}) =>
  make('URL', (raw) => {
    let u: URL;
    try { u = new URL(raw); } catch { throw new Error('must be an absolute URL'); }
    if (opts.protocols && !opts.protocols.includes(u.protocol.replace(':', ''))) throw new Error(`protocol must be one of ${opts.protocols.join(', ')}`);
    return u;
  })(opts);

export const oneOf = <const T extends string>(values: readonly T[], opts: FieldOptions<T> = {}) =>
  make(values.join(' | '), (raw) => {
    if (!(values as readonly string[]).includes(raw)) throw new Error(`must be one of ${values.join(', ')}`);
    return raw as T;
  })(opts);

type Spec = Record<string, Parser<unknown>>;
type Out<S extends Spec> = { [K in keyof S]: S[K] extends Parser<infer T> ? (S[K]['optional'] extends true ? T | undefined : T) : never };

export class EnvError extends Error {
  readonly issues: { name: string; message: string }[];
  constructor(issues: { name: string; message: string }[]) {
    super(`Invalid environment:\n${issues.map((i) => `  ${i.name}: ${i.message}`).join('\n')}`);
    this.name = 'EnvError';
    this.issues = issues;
  }
}

/**
 * Validates `env` against `spec` and returns a frozen, typed object. Collects every problem before
 * throwing, and never includes the values of `secret` fields in error messages.
 */
export function guard<S extends Spec>(spec: S, env: Record<string, string | undefined> = process.env): Readonly<Out<S>> {
  const out: Record<string, unknown> = {};
  const issues: { name: string; message: string }[] = [];
  for (const [name, p] of Object.entries(spec)) {
    const raw = env[name];
    if (raw === undefined || (raw === '' && p.describe !== 'boolean')) {
      if (p.default !== undefined) out[name] = p.default;
      else if (!p.optional) issues.push({ name, message: `is required (${p.describe})` });
      continue;
    }
    try {
      out[name] = p.parse(raw);
    } catch (err) {
      const shown = p.secret ? '' : ` (got "${raw.length > 40 ? `${raw.slice(0, 40)}…` : raw}")`;
      issues.push({ name, message: `${(err as Error).message}${shown}` });
    }
  }
  if (issues.length) throw new EnvError(issues);
  return Object.freeze(out) as Readonly<Out<S>>;
}
