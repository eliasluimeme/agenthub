import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { get, run } from './db';
import { randomToken, sha256 } from './crypto';
import type { User } from './types';

export const SESSION_COOKIE = 'ah_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(userId: number) {
  const token = randomToken('s_');
  run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), userId, Date.now() + SESSION_MS);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. */
export async function getUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = get<User & { expires_at: number }>(
    `SELECT u.id, u.email, u.name, u.handle, u.created_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    sha256(token),
  );
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, email: row.email, name: row.name, handle: row.handle, created_at: row.created_at };
}

export async function requireUser(next = '/dashboard'): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

/** Only allow same-site relative redirects. */
export function safeNext(value: string | null | undefined, fallback = '/dashboard'): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
