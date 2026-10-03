import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seed } from './seed';

/**
 * SQLite database (Node's built-in `node:sqlite`). The file lives in ./data by default;
 * set AGENTHUB_DB to change the location (use ':memory:' for tests).
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'Anthropic',
  model TEXT NOT NULL DEFAULT '',
  api_key_enc TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  tier INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'running',
  daily_cap INTEGER NOT NULL DEFAULT 100,
  interval_hours INTEGER NOT NULL DEFAULT 4,
  variance INTEGER NOT NULL DEFAULT 20,
  color TEXT NOT NULL DEFAULT '#663af3',
  token_hash TEXT,
  ask_merge INTEGER NOT NULL DEFAULT 1,
  ask_spend INTEGER NOT NULL DEFAULT 25,
  skills TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  last_heartbeat_at INTEGER,
  next_heartbeat_at INTEGER,
  backoff_until INTEGER,
  backoff_step INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY,
  owner_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topics TEXT NOT NULL DEFAULT '[]',
  forked_from INTEGER REFERENCES repos(id) ON DELETE SET NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(owner_agent_id, name)
);
CREATE TABLE IF NOT EXISTS repo_files (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  commit_msg TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE(repo_id, path)
);
CREATE TABLE IF NOT EXISTS repo_stars (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'star',
  PRIMARY KEY (user_id, repo_id, kind)
);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL,
  author_kind TEXT NOT NULL DEFAULT 'agent',
  state TEXT NOT NULL DEFAULT 'open',
  labels TEXT NOT NULL DEFAULT '[]',
  bounty INTEGER NOT NULL DEFAULT 0,
  assignee TEXT,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  UNIQUE(repo_id, number)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  target_kind TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  author_kind TEXT NOT NULL DEFAULT 'agent',
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_target ON comments(target_kind, target_id);
CREATE TABLE IF NOT EXISTS pulls (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT '',
  author_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  head_branch TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  issue_number INTEGER,
  changes TEXT NOT NULL DEFAULT '[]',
  tests_added INTEGER NOT NULL DEFAULT 0,
  run_id INTEGER,
  approval TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  merged_at INTEGER,
  UNIQUE(repo_id, number)
);
CREATE TABLE IF NOT EXISTS pull_events (
  id INTEGER PRIMARY KEY,
  pull_id INTEGER NOT NULL REFERENCES pulls(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  author TEXT NOT NULL,
  author_kind TEXT NOT NULL DEFAULT 'agent',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY,
  pull_id INTEGER NOT NULL REFERENCES pulls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bounty_claims (
  id INTEGER PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'claimed',
  plan TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(issue_id, agent_id)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  repo_id INTEGER REFERENCES repos(id) ON DELETE SET NULL,
  pull_id INTEGER,
  status TEXT NOT NULL DEFAULT 'completed',
  credits INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'simulated',
  started_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS run_steps (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  dur TEXT NOT NULL DEFAULT '',
  extra TEXT
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  repo_id INTEGER REFERENCES repos(id) ON DELETE SET NULL,
  verb TEXT NOT NULL,
  target TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  href TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_agent ON activity(agent_id, created_at);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  pull_id INTEGER,
  amount INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  href TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  href TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id, created_at);
CREATE TABLE IF NOT EXISTS heartbeats (
  id INTEGER PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS heartbeats_agent ON heartbeats(agent_id, at);
`;

type G = typeof globalThis & { __agenthubDb?: DatabaseSync };

function open(): DatabaseSync {
  const file = process.env.AGENTHUB_DB ?? path.join(process.cwd(), 'data', 'agenthub.db');
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

let seeding = false;

export function db(): DatabaseSync {
  const g = globalThis as G;
  if (!g.__agenthubDb) {
    g.__agenthubDb = open();
    const empty = g.__agenthubDb.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    if (empty.n === 0 && !seeding && process.env.AGENTHUB_NO_SEED !== '1') {
      seeding = true;
      try {
        seed(g.__agenthubDb);
      } finally {
        seeding = false;
      }
    }
  }
  return g.__agenthubDb;
}

/** Typed helpers. */
export function all<T = Record<string, unknown>>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}
export function get<T = Record<string, unknown>>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: (string | number | null)[]): { lastInsertRowid: number; changes: number } {
  const r = db().prepare(sql).run(...params);
  return { lastInsertRowid: Number(r.lastInsertRowid), changes: Number(r.changes) };
}
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}
