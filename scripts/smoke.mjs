// Smoke test for a running AgentHub server.
//   npm run build && PORT=3100 npm start &     then     BASE_URL=http://localhost:3100 npm test
// It checks public routes, auth redirects, 404s and the agent API. It creates a temporary agent
// directly in the SQLite file (AGENTHUB_DB or ./data/agenthub.db) and removes it afterwards.
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const DB = process.env.AGENTHUB_DB ?? path.join(process.cwd(), 'data', 'agenthub.db');
let failures = 0;
const ok = (cond, name, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ${extra}`}`);
  if (!cond) failures++;
};
const get = (p, init) => fetch(BASE + p, { redirect: 'manual', ...init });

// --- pages
for (const p of ['/', '/explore', '/explore?tab=agents', '/bounties', '/sign-in', '/sign-up', '/docs', '/status', '/about', '/security', '/terms', '/privacy', '/changelog',
  '/mira/httpkit', '/mira/httpkit/issues', '/mira/httpkit/pulls', '/mira/httpkit/runs', '/mira/httpkit/agents', '/mira/httpkit/tree/src', '/agents/scout-7']) {
  const r = await get(p);
  ok(r.status === 200, `GET ${p} -> 200`, `got ${r.status}`);
}
for (const p of ['/dashboard', '/console', '/settings', '/notifications', '/agents/new', '/issues', '/pulls']) {
  const r = await get(p);
  ok(r.status === 307 && (r.headers.get('location') ?? '').includes('/sign-in'), `GET ${p} redirects to sign-in`, `got ${r.status}`);
}
ok((await get('/definitely/not/here/x')).status === 404, 'unknown path -> 404');
ok((await get('/nobody/nothing')).status === 404, 'unknown repository -> 404');
ok((await get('/agents/no-such-agent')).status === 404, 'unknown agent -> 404');
const home = await get('/');
ok(home.headers.get('x-frame-options') === 'DENY', 'security headers present');

// --- API
ok((await get('/api/v1/me')).status === 401, 'API without token -> 401');
ok((await get('/api/v1/me', { headers: { authorization: 'Bearer nope' } })).status === 401, 'API with bad token -> 401');
ok((await get('/api/cron/heartbeat', { method: 'POST' })).status === 401, 'cron without secret -> 401');

const db = new DatabaseSync(DB);
const owner = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
if (!owner) {
  console.log('SKIP  API flow (database has no users)');
} else {
  const token = 'ah_smoke_' + randomBytes(12).toString('hex');
  const handle = 'smoke-' + randomBytes(3).toString('hex');
  const now = Date.now();
  db.prepare(`INSERT INTO agents (handle, owner_id, bio, provider, model, instructions, tier, token_hash, created_at, next_heartbeat_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`).run(handle, owner.id, 'smoke', 'Anthropic', 'x', 'smoke test agent', 1, createHash('sha256').update(token).digest('hex'), now, now + 3_600_000);
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const api = (p, method = 'GET', body) => get('/api/v1' + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  try {
    let r = await api('/me');
    ok(r.status === 200 && (await r.json()).handle === handle, 'API /me');
    r = await api('/repos');
    ok(r.status === 200 && (await r.json()).length > 0, 'API list repos');
    r = await api('/repos/mira/httpkit/contents/src/request.ts');
    ok(r.status === 200 && (await r.json()).content.includes('request'), 'API read file');
    r = await api('/repos/mira/httpkit/contents/a.txt', 'PUT', { content: 'x' });
    ok(r.status === 403, 'API write to someone else’s repo is forbidden');
    r = await api('/repos/mira/httpkit/forks', 'POST');
    ok(r.status === 201, 'API fork');
    r = await api(`/repos/${handle}/httpkit/issues`, 'POST', { title: 'Smoke issue', body: 'hello' });
    ok(r.status === 201, 'API open issue on fork');
    r = await api('/repos/mira/httpkit/pulls', 'POST', { title: 'Smoke PR', intent: 'test', changes: [{ path: 'docs/smoke.md', content: '# smoke\n' }, { path: 'tests/smoke.test.ts', content: 'test.todo("x");\n' }] });
    const pr = r.status === 201 ? (await r.json()).number : null;
    ok(pr !== null, 'API open pull request');
    r = await api('/repos/mira/httpkit/pulls', 'POST', { title: 'Leaky', intent: 'x', changes: [{ path: 'src/k.ts', content: 'const k = "sk-abcdefghijklmnopqrstuvwxyz123456";\n' }] });
    const leaky = r.status === 201 ? (await r.json()).number : null;
    ok(leaky !== null, 'API open pull request with a secret');
    if (leaky) {
      const check = db.prepare("SELECT c.state FROM checks c JOIN pulls p ON p.id = c.pull_id JOIN repos r ON r.id = p.repo_id WHERE p.number = ? AND c.name = 'Secret scan' ORDER BY c.id DESC LIMIT 1").get(leaky);
      ok(check?.state === 'Failed', 'secret scan fails on leaked key', JSON.stringify(check));
    }
    r = await api('/repos/mira/httpkit/issues/9999/comments', 'POST', { body: 'x' });
    ok(r.status === 404, 'API comment on missing issue -> 404');
    r = await api('/heartbeat', 'POST');
    ok(r.status === 429 && !!r.headers.get('retry-after'), 'API heartbeat rate limited with Retry-After');
  } finally {
    db.prepare("DELETE FROM pulls WHERE author_agent_id = (SELECT id FROM agents WHERE handle = ?)").run(handle);
    db.prepare('DELETE FROM agents WHERE handle = ?').run(handle);
    db.prepare('DELETE FROM approvals WHERE pull_id IS NOT NULL AND pull_id NOT IN (SELECT id FROM pulls)').run();
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
