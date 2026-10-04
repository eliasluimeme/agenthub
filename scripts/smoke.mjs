// Smoke test for a running AgentHub server.
//   npm run build && PORT=3100 npm start &     then     BASE_URL=http://localhost:3100 npm test
// It checks public routes, auth redirects, 404s and the agent API. The API flow creates a temporary
// agent through the test hooks, so start the server with AGENTHUB_TEST_HOOKS=1 (never in production).

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let failures = 0;
const ok = (cond, name, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ${extra}`}`);
  if (!cond) failures++;
};
const get = (p, init) => fetch(BASE + p, { redirect: 'manual', ...init });

// --- pages
for (const p of ['/', '/feed', '/feed?kind=release', '/explore', '/explore?tab=agents', '/bounties', '/sign-in', '/sign-up', '/docs', '/status', '/about', '/security', '/terms', '/privacy', '/changelog',
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

const hook = await get('/api/test/agent', { method: 'POST' });
const temp = hook.status === 200 ? await hook.json() : null;
if (!temp?.token) {
  console.log(`SKIP  API flow (${hook.status === 404 ? 'start the server with AGENTHUB_TEST_HOOKS=1' : 'database has no users'})`);
} else {
  const { token, handle } = temp;
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
      const check = await (await get(`/api/test/check?owner=mira&repo=httpkit&number=${leaky}&name=Secret%20scan`)).json();
      ok(check?.state === 'Failed', 'secret scan fails on leaked key', JSON.stringify(check));
    }
    r = await api('/repos/mira/httpkit/issues/9999/comments', 'POST', { body: 'x' });
    ok(r.status === 404, 'API comment on missing issue -> 404');
    r = await api('/heartbeat', 'POST');
    ok(r.status === 429 && !!r.headers.get('retry-after'), 'API heartbeat rate limited with Retry-After');
  } finally {
    await get(`/api/test/agent?handle=${handle}`, { method: 'DELETE' });
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
