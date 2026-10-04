import { createHmac, timingSafeEqual } from 'node:crypto';

export interface Claims {
  sub?: string;
  iss?: string;
  aud?: string;
  /** Expiry, seconds since epoch. */
  exp?: number;
  /** Not before, seconds since epoch. */
  nbf?: number;
  iat?: number;
  [claim: string]: unknown;
}

export interface SignOptions { expiresInSec?: number; now?: number }
export interface VerifyOptions { issuer?: string; audience?: string; clockSkewSec?: number; now?: number }

export class JwtError extends Error {
  readonly code: 'malformed' | 'algorithm' | 'signature' | 'expired' | 'not_yet_valid' | 'claim';
  constructor(code: JwtError['code'], message: string) {
    super(message);
    this.name = 'JwtError';
    this.code = code;
  }
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const hmac = (data: string, secret: string | Buffer) => createHmac('sha256', secret).update(data).digest();
const seconds = (ms: number) => Math.floor(ms / 1000);

function checkSecret(secret: string | Buffer) {
  if (Buffer.byteLength(secret) < 32) throw new Error('HS256 secrets must be at least 32 bytes');
}

export function sign(claims: Claims, secret: string | Buffer, opts: SignOptions = {}): string {
  checkSecret(secret);
  const iat = seconds(opts.now ?? Date.now());
  const payload: Claims = { iat, ...claims };
  if (opts.expiresInSec !== undefined) payload.exp = iat + opts.expiresInSec;
  const head = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  return `${head}.${b64url(hmac(head, secret))}`;
}

/** Verifies signature and time claims. Only HS256 is accepted, so `alg: none` tokens are rejected. */
export function verify<T extends Claims = Claims>(token: string, secret: string | Buffer, opts: VerifyOptions = {}): T {
  checkSecret(secret);
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('malformed', 'Token must have three parts');
  const [h, p, s] = parts;
  let header: { alg?: string };
  let claims: T;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    throw new JwtError('malformed', 'Token is not valid base64url JSON');
  }
  if (header.alg !== 'HS256') throw new JwtError('algorithm', `Unsupported algorithm ${header.alg}`);
  const expected = hmac(`${h}.${p}`, secret);
  const given = Buffer.from(s, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new JwtError('signature', 'Invalid signature');

  const now = seconds(opts.now ?? Date.now());
  const skew = opts.clockSkewSec ?? 30;
  if (typeof claims.exp === 'number' && now > claims.exp + skew) throw new JwtError('expired', 'Token expired');
  if (typeof claims.nbf === 'number' && now + skew < claims.nbf) throw new JwtError('not_yet_valid', 'Token not valid yet');
  if (opts.issuer !== undefined && claims.iss !== opts.issuer) throw new JwtError('claim', 'Unexpected issuer');
  if (opts.audience !== undefined && claims.aud !== opts.audience) throw new JwtError('claim', 'Unexpected audience');
  return claims;
}

/** Reads the payload without verifying it. Never trust the result. */
export function decodeUnsafe(token: string): Claims {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
}
