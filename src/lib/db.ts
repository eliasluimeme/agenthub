import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { seed } from './seed';

/**
 * Postgres data layer.
 *  - Production (Netlify DB / Neon, or any Postgres): set NETLIFY_DATABASE_URL or DATABASE_URL.
 *  - Local development without a URL: PGlite, an embedded Postgres stored in ./data/pglite
 *    (AGENTHUB_PGLITE_DIR to move it, 'memory://' for a throwaway database).
 * Queries use `?` placeholders, rewritten to $1, $2 ... Every numeric column is an integer.
 * The schema is created on first use and an empty database is filled with demo data.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
  id BIGSERIAL PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'Anthropic',
  model TEXT NOT NULL DEFAULT '',
  api_key_enc TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  tier BIGINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'running',
  daily_cap BIGINT NOT NULL DEFAULT 100,
  interval_hours BIGINT NOT NULL DEFAULT 4,
  variance BIGINT NOT NULL DEFAULT 20,
  color TEXT NOT NULL DEFAULT '#663af3',
  token_hash TEXT,
  ask_merge BIGINT NOT NULL DEFAULT 1,
  ask_spend BIGINT NOT NULL DEFAULT 25,
  skills TEXT NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL,
  last_heartbeat_at BIGINT,
  next_heartbeat_at BIGINT,
  backoff_until BIGINT,
  backoff_step BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS repos (
  id BIGSERIAL PRIMARY KEY,
  owner_agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topics TEXT NOT NULL DEFAULT '[]',
  forked_from BIGINT REFERENCES repos(id) ON DELETE SET NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  next_number BIGINT NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(owner_agent_id, name)
);
CREATE TABLE IF NOT EXISTS repo_files (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  commit_msg TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL,
  UNIQUE(repo_id, path)
);
CREATE TABLE IF NOT EXISTS repo_stars (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'star',
  PRIMARY KEY (user_id, repo_id, kind)
);
CREATE TABLE IF NOT EXISTS issues (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number BIGINT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL,
  author_kind TEXT NOT NULL DEFAULT 'agent',
  state TEXT NOT NULL DEFAULT 'open',
  labels TEXT NOT NULL DEFAULT '[]',
  bounty BIGINT NOT NULL DEFAULT 0,
  assignee TEXT,
  created_at BIGINT NOT NULL,
  closed_at BIGINT,
  UNIQUE(repo_id, number)
);
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  target_kind TEXT NOT NULL,
  target_id BIGINT NOT NULL,
  author TEXT NOT NULL,
  author_kind TEXT NOT NULL DEFAULT 'agent',
  body TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_target ON comments(target_kind, target_id);
CREATE TABLE IF NOT EXISTS pulls (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number BIGINT NOT NULL,
  title TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT '',
  author_agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  head_branch TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  issue_number BIGINT,
  changes TEXT NOT NULL DEFAULT '[]',
  tests_added BIGINT NOT NULL DEFAULT 0,
  run_id BIGINT,
  approval TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  merged_at BIGINT,
  UNIQUE(repo_id, number)
);
CREATE TABLE IF NOT EXISTS pull_events (
  id BIGSERIAL PRIMARY KEY,
  pull_id BIGINT NOT NULL REFERENCES pulls(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  author TEXT NOT NULL,
  author_kind TEXT NOT NULL DEFAULT 'agent',
  body TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS checks (
  id BIGSERIAL PRIMARY KEY,
  pull_id BIGINT NOT NULL REFERENCES pulls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bounty_claims (
  id BIGSERIAL PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'claimed',
  plan TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  UNIQUE(issue_id, agent_id)
);
CREATE TABLE IF NOT EXISTS runs (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  repo_id BIGINT REFERENCES repos(id) ON DELETE SET NULL,
  pull_id BIGINT,
  status TEXT NOT NULL DEFAULT 'completed',
  credits BIGINT NOT NULL DEFAULT 0,
  duration_sec BIGINT NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  tokens_in BIGINT NOT NULL DEFAULT 0,
  tokens_out BIGINT NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'simulated',
  started_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS run_steps (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  idx BIGINT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  dur TEXT NOT NULL DEFAULT '',
  extra TEXT
);
CREATE TABLE IF NOT EXISTS activity (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  repo_id BIGINT REFERENCES repos(id) ON DELETE SET NULL,
  verb TEXT NOT NULL,
  target TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  href TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_agent ON activity(agent_id, created_at);
CREATE TABLE IF NOT EXISTS approvals (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  pull_id BIGINT,
  amount BIGINT NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  href TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  href TEXT,
  read BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id BIGINT REFERENCES agents(id) ON DELETE SET NULL,
  delta BIGINT NOT NULL,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id, created_at);
CREATE TABLE IF NOT EXISTS heartbeats (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  at BIGINT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS heartbeats_agent ON heartbeats(agent_id, at);
`;

type Param = string | number | null;
type Row = Record<string, unknown>;
interface Executor {
  query(sql: string, params: Param[]): Promise<{ rows: Row[]; count: number }>;
}
interface Driver extends Executor {
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (ex: Executor) => Promise<T>): Promise<T>;
}

const url = () => process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

async function pgDriver(connectionString: string): Promise<Driver> {
  const { default: pg } = await import('pg');
  // BIGINT (20) and NUMERIC (1700, from SUM/AVG) arrive as strings by default.
  const types = { getTypeParser: (oid: number, format?: 'text' | 'binary') => (oid === 20 || oid === 1700 ? Number : pg.types.getTypeParser(oid, format as 'text')) };
  const pool = new pg.Pool({ connectionString, max: Number(process.env.AGENTHUB_PG_POOL ?? 3), idleTimeoutMillis: 10_000, types: types as never });
  const wrap = (c: { query: (s: string, p: Param[]) => Promise<{ rows: Row[]; rowCount: number | null }> }): Executor => ({
    query: async (s, p) => {
      const r = await c.query(s, p);
      return { rows: r.rows, count: r.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool),
    exec: async (s) => { await pool.query(s); },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.AGENTHUB_PGLITE_DIR ?? path.join(process.cwd(), 'data', 'pglite');
  if (!dir.includes('://')) mkdirSync(dir, { recursive: true });
  const db = await PGlite.create(dir, { parsers: { 20: Number, 1700: Number } });
  const wrap = (c: { query: (s: string, p: Param[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }): Executor => ({
    query: async (s, p) => {
      const r = await c.query(s, p);
      return { rows: r.rows as Row[], count: r.affectedRows ?? 0 };
    },
  });
  return {
    ...wrap(db),
    exec: async (s) => { await db.exec(s); },
    transaction: (fn) => db.transaction((t) => fn(wrap(t))),
  };
}

type G = typeof globalThis & { __agenthubDb?: Promise<Driver> };

async function open(): Promise<Driver> {
  const conn = url();
  const driver = conn ? await pgDriver(conn) : await pgliteDriver();
  await driver.exec(SCHEMA);
  if (process.env.AGENTHUB_NO_SEED !== '1') {
    // Several serverless instances may start at once: an advisory lock lets only one seed.
    await driver.transaction(async (ex) => {
      await ex.query('SELECT pg_advisory_xact_lock(7337)', []);
      const n = (await ex.query('SELECT COUNT(*)::int AS n FROM users', [])).rows[0]?.n as number;
      if (n === 0) await txStore.run(ex, () => seed());
    });
  }
  return driver;
}

/** The database, created and seeded on first use (once per server process). */
export function db(): Promise<Driver> {
  const g = globalThis as G;
  g.__agenthubDb ??= open().catch((e) => {
    g.__agenthubDb = undefined;
    throw e;
  });
  return g.__agenthubDb;
}

const txStore = new AsyncLocalStorage<Executor>();

/** Rewrites `?` placeholders (outside string literals) to $1, $2 ... */
function toPg(sql: string): string {
  let out = '';
  let n = 0;
  let quoted = false;
  for (const ch of sql) {
    if (ch === "'") quoted = !quoted;
    out += ch === '?' && !quoted ? `$${++n}` : ch;
  }
  return out;
}

// Integer columns only: round stray floats (e.g. timestamps with jitter) as SQLite used to store them.
const clean = (params: Param[]) => params.map((p) => (typeof p === 'number' && !Number.isInteger(p) ? Math.round(p) : p));

async function query(sql: string, params: Param[]) {
  const ex = txStore.getStore() ?? (await db());
  return ex.query(toPg(sql), clean(params));
}

/** Typed helpers. */
export async function all<T = Row>(sql: string, ...params: Param[]): Promise<T[]> {
  return (await query(sql, params)).rows as T[];
}
export async function get<T = Row>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return (await query(sql, params)).rows[0] as T | undefined;
}
/** Count helper: `SELECT ... AS n` returning a number (0 when there is no row). */
export async function num(sql: string, ...params: Param[]): Promise<number> {
  return Number((await query(sql, params)).rows[0]?.n ?? 0);
}

const NO_ID = new Set(['sessions', 'repo_stars']);

/** INSERT/UPDATE/DELETE. Inserts into tables with an id column return it as lastInsertRowid. */
export async function run(sql: string, ...params: Param[]): Promise<{ lastInsertRowid: number; changes: number }> {
  const table = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(sql)?.[1];
  const returning = table && !NO_ID.has(table) && !/\bRETURNING\b/i.test(sql);
  const r = await query(returning ? `${sql} RETURNING id` : sql, params);
  return { lastInsertRowid: Number(r.rows[0]?.id ?? 0), changes: r.count };
}

/** Runs fn in one transaction; queries inside it (at any depth) use the same connection. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();
  const d = await db();
  return d.transaction((ex) => txStore.run(ex, fn));
}
