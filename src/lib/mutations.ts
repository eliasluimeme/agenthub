import 'server-only';
import { all, get, run, tx } from './db';
import { encrypt, hashPassword, randomToken, sha256, verifyPassword } from './crypto';
import { agentByHandle, agentById, getIssueById, getPullById, repoById, repoBy } from './queries';
import type { Agent, Issue, Pull, User } from './types';

export class ActionError extends Error {}

const fail = (message: string): never => {
  throw new ActionError(message);
};

const RESERVED = new Set(['new', 'api', 'agents', 'explore', 'bounties', 'dashboard', 'console', 'sign-in', 'sign-up', 'settings', 'docs', 'status', 'about', 'admin']);
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

/* ------------------------------------------------------------ notifications */

export function notify(userId: number, text: string, href?: string) {
  run('INSERT INTO notifications (user_id, text, href, read, created_at) VALUES (?,?,?,0,?)', userId, text, href ?? null, Date.now());
}

export function logActivity(agentId: number, kind: string, repoId: number | null, verb: string, target: string, note = '', href = '') {
  run('INSERT INTO activity (agent_id, kind, repo_id, verb, target, note, href, created_at) VALUES (?,?,?,?,?,?,?,?)', agentId, kind, repoId, verb, target, note, href, Date.now());
}

const ownerOfAgent = (agentId: number) => get<{ owner_id: number }>('SELECT owner_id FROM agents WHERE id = ?', agentId)?.owner_id;

function ledger(userId: number, delta: number, reason: string, agentId: number | null = null) {
  run('INSERT INTO ledger (user_id, agent_id, delta, reason, created_at) VALUES (?,?,?,?,?)', userId, agentId, delta, reason, Date.now());
}

/* ----------------------------------------------------------------- accounts */

export function signUp(input: { email: string; name: string; password: string }): User {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Enter a valid email address.');
  if (name.length < 2) fail('Enter your name.');
  if (input.password.length < 8) fail('Password must be at least 8 characters.');
  if (get('SELECT 1 FROM users WHERE email = ?', email)) fail('An account with that email already exists.');
  let handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'owner';
  while (get('SELECT 1 FROM users WHERE handle = ?', handle) || RESERVED.has(handle)) handle = `${handle.slice(0, 20)}-${Math.floor(Math.random() * 900 + 100)}`;
  const id = tx(() => {
    const r = run('INSERT INTO users (email, name, handle, password_hash, created_at) VALUES (?,?,?,?,?)', email, name, handle, hashPassword(input.password), Date.now());
    ledger(r.lastInsertRowid, 500, 'Welcome credits');
    notify(r.lastInsertRowid, 'Welcome to AgentHub. Create your first agent to get started.', '/agents/new');
    return r.lastInsertRowid;
  });
  return { id, email, name, handle, created_at: Date.now() };
}

const attempts = new Map<string, { n: number; first: number }>();

/** Basic brute-force protection: 8 failed sign-ins per email per 10 minutes. */
function checkAttempts(email: string, failed?: boolean) {
  const now = Date.now();
  const cur = attempts.get(email);
  if (!cur || now - cur.first > 10 * 60_000) {
    if (failed) attempts.set(email, { n: 1, first: now });
    else attempts.delete(email);
    return;
  }
  if (failed) cur.n++;
  else if (cur.n >= 8) fail('Too many attempts. Try again in a few minutes.');
}

export function signIn(emailRaw: string, password: string): User {
  const email = emailRaw.trim().toLowerCase();
  checkAttempts(email);
  const row = get<User & { password_hash: string }>('SELECT id, email, name, handle, created_at, password_hash FROM users WHERE email = ?', email);
  // Always verify something so timing does not reveal whether the account exists.
  const ok = verifyPassword(password, row?.password_hash ?? hashPassword('x'));
  if (!row || !ok) {
    checkAttempts(email, true);
    fail('Incorrect email or password.');
  }
  attempts.delete(email);
  run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return { id: row!.id, email: row!.email, name: row!.name, handle: row!.handle, created_at: row!.created_at };
}

export function updateProfile(userId: number, name: string) {
  if (name.trim().length < 2) fail('Enter your name.');
  run('UPDATE users SET name = ? WHERE id = ?', name.trim(), userId);
}

export function addTestCredits(userId: number, amount: number) {
  if (process.env.AGENTHUB_ALLOW_TOPUP === '0') fail('Top-ups are disabled on this deployment.');
  if (!Number.isInteger(amount) || amount < 1 || amount > 5000) fail('Enter an amount between 1 and 5,000.');
  ledger(userId, amount, 'Top-up (test mode, no payment taken)');
}

/* ------------------------------------------------------------------- agents */

export interface AgentInput {
  handle: string;
  provider: string;
  model: string;
  apiKey?: string;
  instructions: string;
  tier: number;
  color: string;
  dailyCap: number;
  intervalHours: number;
  variance: number;
  askMerge: boolean;
  askSpend: number;
}

export const PROVIDERS = ['Anthropic', 'OpenAI', 'Google', 'Mistral', 'Custom endpoint'] as const;
export const DEFAULT_MODEL: Record<string, string> = { Anthropic: 'claude-sonnet-4-5', OpenAI: 'gpt-4.1', Google: 'gemini-2.5-pro', Mistral: 'mistral-large-latest', 'Custom endpoint': '' };

export function validateAgent(input: AgentInput, existingHandle?: string) {
  const handle = input.handle.trim().toLowerCase();
  if (!existingHandle) {
    if (!HANDLE_RE.test(handle)) fail('Handle must be 2 to 31 characters: lowercase letters, numbers and dashes, starting with a letter or number.');
    if (RESERVED.has(handle)) fail('That handle is reserved.');
    if (get('SELECT 1 FROM agents WHERE handle = ?', handle)) fail('That handle is taken.');
  }
  if (!(PROVIDERS as readonly string[]).includes(input.provider)) fail('Choose a model provider.');
  if (input.instructions.trim().length < 10) fail('Write at least a sentence of instructions.');
  if (!Number.isInteger(input.tier) || input.tier < 0 || input.tier > 3) fail('Choose a permission tier.');
  if (!Number.isInteger(input.dailyCap) || input.dailyCap < 1 || input.dailyCap > 100_000) fail('Daily credit cap must be between 1 and 100,000.');
  if (!Number.isInteger(input.intervalHours) || input.intervalHours < 4) fail('Agents check in at most once every 4 hours.');
  if (![0, 10, 20].includes(input.variance)) fail('Choose a variance of 0, 10 or 20 percent.');
  return handle;
}

export function createAgent(ownerId: number, input: AgentInput): { agent: Agent; token: string } {
  const handle = validateAgent(input);
  const token = randomToken('ah_');
  const now = Date.now();
  const id = tx(() => {
    const r = run(
      `INSERT INTO agents (handle, owner_id, bio, provider, model, api_key_enc, instructions, tier, status, daily_cap, interval_hours, variance, color, token_hash, ask_merge, ask_spend, skills, created_at, next_heartbeat_at)
       VALUES (?,?,?,?,?,?,?,?, 'running', ?,?,?,?,?,?,?, '[]', ?, ?)`,
      handle, ownerId, input.instructions.trim().slice(0, 160), input.provider, input.model.trim() || DEFAULT_MODEL[input.provider] || '',
      input.apiKey?.trim() ? encrypt(input.apiKey.trim()) : null, input.instructions.trim(), input.tier, input.dailyCap, input.intervalHours, input.variance,
      input.color, sha256(token), input.askMerge ? 1 : 0, input.askSpend, now, now + 10 * 60_000,
    );
    ledger(ownerId, 0, `Created @${handle}`, r.lastInsertRowid);
    notify(ownerId, `@${handle} was created and will check in shortly.`, `/agents/${handle}`);
    return r.lastInsertRowid;
  });
  return { agent: agentById(id)!, token };
}

export function updateAgent(agent: Agent, input: Partial<AgentInput>) {
  const merged: AgentInput = {
    handle: agent.handle,
    provider: input.provider ?? agent.provider,
    model: input.model ?? agent.model,
    instructions: input.instructions ?? agent.instructions,
    tier: input.tier ?? agent.tier,
    color: input.color ?? agent.color,
    dailyCap: input.dailyCap ?? agent.daily_cap,
    intervalHours: input.intervalHours ?? agent.interval_hours,
    variance: input.variance ?? agent.variance,
    askMerge: input.askMerge ?? !!agent.ask_merge,
    askSpend: input.askSpend ?? agent.ask_spend,
  };
  validateAgent(merged, agent.handle);
  run(
    'UPDATE agents SET provider=?, model=?, instructions=?, bio=?, tier=?, color=?, daily_cap=?, interval_hours=?, variance=?, ask_merge=?, ask_spend=? WHERE id=?',
    merged.provider, merged.model, merged.instructions, merged.instructions.slice(0, 160), merged.tier, merged.color, merged.dailyCap, merged.intervalHours, merged.variance, merged.askMerge ? 1 : 0, merged.askSpend, agent.id,
  );
  if (input.apiKey?.trim()) run('UPDATE agents SET api_key_enc = ? WHERE id = ?', encrypt(input.apiKey.trim()), agent.id);
}

export function setAgentStatus(agent: Agent, status: 'running' | 'paused') {
  run('UPDATE agents SET status = ?, next_heartbeat_at = ? WHERE id = ?', status, status === 'running' ? Date.now() + 10 * 60_000 : null, agent.id);
}

export function rotateAgentToken(agent: Agent): string {
  const token = randomToken('ah_');
  run('UPDATE agents SET token_hash = ? WHERE id = ?', sha256(token), agent.id);
  return token;
}

export function deleteAgent(agent: Agent) {
  tx(() => {
    run('DELETE FROM approvals WHERE agent_id = ? OR pull_id IN (SELECT id FROM pulls WHERE author_agent_id = ?)', agent.id, agent.id);
    run('DELETE FROM agents WHERE id = ?', agent.id);
  });
}

/** Resolve an agent API token to its agent (for /api/v1). */
export function agentFromToken(token: string): Agent | undefined {
  const row = get<{ id: number }>('SELECT id FROM agents WHERE token_hash = ?', sha256(token));
  return row ? agentById(row.id) : undefined;
}

/* -------------------------------------------------------------------- repos */

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function createRepo(agent: Agent, name: string, description: string, topics: string[] = []) {
  if (agent.tier < 2) fail(`@${agent.handle} needs the "Push to own" tier or higher to create repositories.`);
  if (!NAME_RE.test(name)) fail('Repository names use letters, numbers, dots, dashes and underscores.');
  if (get('SELECT 1 FROM repos WHERE owner_agent_id = ? AND name = ?', agent.id, name)) fail('You already have a repository with that name.');
  const now = Date.now();
  const id = tx(() => {
    const r = run('INSERT INTO repos (owner_agent_id, name, description, topics, created_at, updated_at) VALUES (?,?,?,?,?,?)', agent.id, name, description.trim().slice(0, 300), JSON.stringify(topics.slice(0, 8)), now, now);
    run('INSERT INTO repo_files (repo_id, path, content, commit_msg, updated_at) VALUES (?,?,?,?,?)', r.lastInsertRowid, 'README.md', `# ${name}\n\n${description.trim()}\n`, 'Initial commit', now);
    logActivity(agent.id, 'release', r.lastInsertRowid, 'created', `${agent.handle}/${name}`, description.trim().slice(0, 140), `/${agent.handle}/${name}`);
    return r.lastInsertRowid;
  });
  return repoById(id)!;
}

export function forkRepo(repoId: number, byAgent: Agent) {
  const src = repoById(repoId);
  if (!src) return fail('Repository not found.');
  if (byAgent.tier < 1) fail(`@${byAgent.handle} needs the "Propose" tier or higher to fork.`);
  if (src!.owner_agent_id === byAgent.id) fail('You cannot fork your own repository.');
  const existing = get<{ id: number }>('SELECT id FROM repos WHERE owner_agent_id = ? AND name = ?', byAgent.id, src!.name);
  if (existing) return repoById(existing.id)!;
  const now = Date.now();
  const id = tx(() => {
    const r = run('INSERT INTO repos (owner_agent_id, name, description, topics, forked_from, next_number, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', byAgent.id, src!.name, src!.description, src!.topics, src!.id, 1, now, now);
    for (const f of all<{ path: string; content: string; commit_msg: string }>('SELECT path, content, commit_msg FROM repo_files WHERE repo_id = ?', src!.id)) {
      run('INSERT INTO repo_files (repo_id, path, content, commit_msg, updated_at) VALUES (?,?,?,?,?)', r.lastInsertRowid, f.path, f.content, f.commit_msg, now);
    }
    logActivity(byAgent.id, 'release', r.lastInsertRowid, 'forked', `@${src!.owner}/${src!.name}`, '', `/${byAgent.handle}/${src!.name}`);
    const owner = ownerOfAgent(src!.owner_agent_id);
    if (owner) notify(owner, `@${byAgent.handle} forked @${src!.owner}/${src!.name}.`, `/${byAgent.handle}/${src!.name}`);
    return r.lastInsertRowid;
  });
  return repoById(id)!;
}

export function updateRepo(repoId: number, description: string, topics: string[]) {
  run('UPDATE repos SET description = ?, topics = ?, updated_at = ? WHERE id = ?', description.trim().slice(0, 300), JSON.stringify(topics.slice(0, 8)), Date.now(), repoId);
}

export function toggleStar(userId: number, repoId: number, kind: 'star' | 'watch' = 'star') {
  const has = get('SELECT 1 FROM repo_stars WHERE user_id = ? AND repo_id = ? AND kind = ?', userId, repoId, kind);
  if (has) run('DELETE FROM repo_stars WHERE user_id = ? AND repo_id = ? AND kind = ?', userId, repoId, kind);
  else run('INSERT INTO repo_stars (user_id, repo_id, kind) VALUES (?,?,?)', userId, repoId, kind);
}

export function writeFile(repoId: number, path: string, content: string, message: string) {
  if (!/^[\w./-]{1,200}$/.test(path) || path.includes('..') || path.startsWith('/')) fail('Invalid file path.');
  if (content.length > 200_000) fail('File is too large (200 KB maximum).');
  const now = Date.now();
  run(
    `INSERT INTO repo_files (repo_id, path, content, commit_msg, updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(repo_id, path) DO UPDATE SET content = excluded.content, commit_msg = excluded.commit_msg, updated_at = excluded.updated_at`,
    repoId, path, content, message, now,
  );
  run('UPDATE repos SET updated_at = ? WHERE id = ?', now, repoId);
}

/* ------------------------------------------------------------------- issues */

function nextNumber(repoId: number): number {
  const n = get<{ next_number: number }>('SELECT next_number FROM repos WHERE id = ?', repoId)!.next_number;
  run('UPDATE repos SET next_number = ? WHERE id = ?', n + 1, repoId);
  return n;
}

export function createIssue(repoId: number, author: { handle: string; kind: 'agent' | 'user' }, input: { title: string; body: string; labels?: string[]; bounty?: number }, payerUserId?: number) {
  const title = input.title.trim();
  if (title.length < 3) fail('Give the issue a title.');
  if (title.length > 200) fail('Title is too long.');
  const bounty = Math.max(0, Math.floor(input.bounty ?? 0));
  if (bounty > 10_000) fail('Bounties are capped at 10,000 credits.');
  const repo = repoById(repoId)!;
  const number = tx(() => {
    const n = nextNumber(repoId);
    run('INSERT INTO issues (repo_id, number, title, body, author, author_kind, labels, bounty, created_at) VALUES (?,?,?,?,?,?,?,?,?)', repoId, n, title, input.body.trim().slice(0, 20_000), author.handle, author.kind, JSON.stringify((input.labels ?? []).slice(0, 6)), bounty, Date.now());
    if (bounty > 0 && payerUserId) {
      const bal = get<{ n: number }>('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', payerUserId)!.n;
      if (bal < bounty) fail('Not enough credits to fund that bounty.');
      ledger(payerUserId, -bounty, `Bounty escrow for @${repo.owner}/${repo.name}#${n}`);
    }
    return n;
  });
  const agent = author.kind === 'agent' ? agentByHandle(author.handle) : undefined;
  if (agent) logActivity(agent.id, 'issue', repoId, 'opened an issue on', `@${repo.owner}/${repo.name}`, title, `/${repo.owner}/${repo.name}/issues/${number}`);
  const maintainerOwner = ownerOfAgent(repo.owner_agent_id);
  if (maintainerOwner && author.kind === 'agent' && agent?.owner_id !== maintainerOwner) notify(maintainerOwner, `@${author.handle} opened issue #${number} on @${repo.owner}/${repo.name}.`, `/${repo.owner}/${repo.name}/issues/${number}`);
  return number;
}

export function setIssueState(issue: Issue, state: 'open' | 'closed') {
  run('UPDATE issues SET state = ?, closed_at = ? WHERE id = ?', state, state === 'closed' ? Date.now() : null, issue.id);
}

export function addComment(kind: 'issue' | 'pull', targetId: number, author: { handle: string; kind: 'agent' | 'user' }, body: string) {
  const text = body.trim();
  if (!text) fail('Write a comment first.');
  if (text.length > 20_000) fail('Comment is too long.');
  run('INSERT INTO comments (target_kind, target_id, author, author_kind, body, created_at) VALUES (?,?,?,?,?,?)', kind, targetId, author.handle, author.kind, text, Date.now());
  // Notify owners of agents mentioned with @handle.
  for (const m of new Set([...text.matchAll(/@([a-z0-9][a-z0-9-]{1,30})/g)].map((x) => x[1]))) {
    const a = agentByHandle(m);
    if (a && a.handle !== author.handle) notify(a.owner_id, `${author.kind === 'user' ? author.handle : '@' + author.handle} mentioned @${a.handle}.`);
  }
}

export function claimBounty(issue: Issue, agent: Agent, plan: string) {
  if (issue.bounty <= 0) fail('That issue has no bounty.');
  if (issue.state !== 'open') fail('That issue is closed.');
  if (agent.tier < 1) fail(`@${agent.handle} needs the "Propose" tier or higher to claim bounties.`);
  if (get('SELECT 1 FROM bounty_claims WHERE issue_id = ? AND status IN (\'claimed\',\'in_review\') AND agent_id != ?', issue.id, agent.id)) fail('Another agent has already claimed this bounty.');
  const repo = repoById(issue.repo_id)!;
  run("INSERT OR IGNORE INTO bounty_claims (issue_id, agent_id, status, plan, created_at) VALUES (?,?,'claimed',?,?)", issue.id, agent.id, plan.trim().slice(0, 2000), Date.now());
  run('UPDATE issues SET assignee = ? WHERE id = ?', agent.handle, issue.id);
  if (plan.trim()) addComment('issue', issue.id, { handle: agent.handle, kind: 'agent' }, `Claiming this. Plan: ${plan.trim()}`);
  logActivity(agent.id, 'bounty', repo.id, 'claimed a bounty on', `${repo.name}#${issue.number}`, `Claimed for ${issue.bounty} credits.`, `/${repo.owner}/${repo.name}/issues/${issue.number}`);
  const owner = ownerOfAgent(repo.owner_agent_id);
  if (owner) notify(owner, `@${agent.handle} claimed the ${issue.bounty}-credit bounty on #${issue.number}.`, `/${repo.owner}/${repo.name}/issues/${issue.number}`);
}

/* -------------------------------------------------------------------- pulls */

export interface FileChange {
  path: string;
  before: string | null;
  after: string;
}

const SECRET_RE = /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]{10,})/;

/** Real, static checks that run on every pull request. */
export function staticChecks(changes: FileChange[]): { name: string; state: 'Passed' | 'Failed' }[] {
  const secrets = changes.some((c) => SECRET_RE.test(c.after));
  const badJson = changes.some((c) => c.path.endsWith('.json') && (() => { try { JSON.parse(c.after); return false; } catch { return true; } })());
  const size = changes.reduce((a, c) => a + c.after.length, 0);
  const tests = changes.some((c) => /(^|\/)(tests?|__tests__)\//.test(c.path) || /\.(test|spec)\./.test(c.path));
  return [
    { name: 'Secret scan', state: secrets ? 'Failed' : 'Passed' },
    { name: 'JSON syntax', state: badJson ? 'Failed' : 'Passed' },
    { name: 'Diff size', state: size > 100_000 ? 'Failed' : 'Passed' },
    { name: 'Tests included', state: tests ? 'Passed' : 'Failed' },
  ];
}

export function createPull(
  repoId: number,
  author: Agent,
  input: { title: string; intent: string; changes: { path: string; after: string }[]; issueNumber?: number | null; runId?: number | null; head?: string },
) {
  const repo = repoById(repoId);
  if (!repo) return fail('Repository not found.');
  if (author.tier < 1) fail(`@${author.handle} needs the "Propose" tier or higher to open pull requests.`);
  if (!input.title.trim()) fail('Give the pull request a title.');
  if (!input.changes.length) fail('A pull request needs at least one file change.');
  if (input.changes.length > 50) fail('Too many files in one pull request (50 maximum).');
  const changes: FileChange[] = input.changes.map((c) => {
    if (!/^[\w./-]{1,200}$/.test(c.path) || c.path.includes('..') || c.path.startsWith('/')) fail(`Invalid path: ${c.path}`);
    const cur = get<{ content: string }>('SELECT content FROM repo_files WHERE repo_id = ? AND path = ?', repoId, c.path);
    return { path: c.path, before: cur ? cur.content : null, after: c.after };
  });
  const checks = staticChecks(changes);
  const testsAdded = changes.filter((c) => /(^|\/)(tests?|__tests__)\//.test(c.path) || /\.(test|spec)\./.test(c.path)).length;
  const now = Date.now();
  const id = tx(() => {
    const n = nextNumber(repoId);
    const r = run(
      'INSERT INTO pulls (repo_id, number, title, intent, author_agent_id, head_branch, issue_number, changes, tests_added, run_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      repoId, n, input.title.trim().slice(0, 200), input.intent.trim().slice(0, 4000), author.id, input.head ?? `${author.handle}:work-${n}`, input.issueNumber ?? null, JSON.stringify(changes), testsAdded, input.runId ?? null, now,
    );
    run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'opened', ?, 'agent', ?, ?)", r.lastInsertRowid, author.handle, input.intent.trim().slice(0, 1000) || 'Opened this pull request.', now);
    for (const c of checks) run('INSERT INTO checks (pull_id, name, state) VALUES (?,?,?)', r.lastInsertRowid, c.name, c.state);
    run("INSERT INTO checks (pull_id, name, state) VALUES (?, 'Owner approval', 'Pending')", r.lastInsertRowid);
    run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'ci', 'sandbox-ci', 'agent', ?, ?)", r.lastInsertRowid, checks.every((c) => c.state === 'Passed') ? 'All static checks passed.' : `Failed: ${checks.filter((c) => c.state === 'Failed').map((c) => c.name).join(', ')}.`, now + 1);
    return { id: r.lastInsertRowid, number: n };
  });
  logActivity(author.id, 'pull', repoId, 'opened a pull request on', `@${repo.owner}/${repo.name}`, input.title.trim(), `/${repo.owner}/${repo.name}/pull/${id.number}`);
  const owner = ownerOfAgent(repo.owner_agent_id);
  if (owner) {
    notify(owner, `@${author.handle} opened pull request #${id.number} on @${repo.owner}/${repo.name}.`, `/${repo.owner}/${repo.name}/pull/${id.number}`);
    run("INSERT INTO approvals (owner_id, agent_id, kind, pull_id, amount, text, href, status, created_at) VALUES (?,?, 'merge', ?, 0, ?, ?, 'pending', ?)", owner, repo.owner_agent_id, id.id, `Merge pull request #${id.number} by @${author.handle} into @${repo.owner}/${repo.name}:main`, `/${repo.owner}/${repo.name}/pull/${id.number}`, now);
  }
  return id;
}

export function addPullEvent(pull: Pull, author: { handle: string; kind: 'agent' | 'user' }, kind: 'comment' | 'review' | 'changes_requested' | 'approved', body: string) {
  if (kind !== 'approved' && !body.trim()) fail('Write something first.');
  run('INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?,?,?,?,?,?)', pull.id, kind, author.handle, author.kind, body.trim().slice(0, 10_000) || 'Approved.', Date.now());
  if (kind === 'changes_requested') run("UPDATE pulls SET approval = 'pending' WHERE id = ?", pull.id);
  if (author.handle !== pull.author) notify(pull.author_owner_id, `${author.kind === 'user' ? author.handle : '@' + author.handle} ${kind === 'changes_requested' ? 'requested changes on' : 'commented on'} pull request #${pull.number}.`);
}

/** Merge a pull request. Applies file changes, closes the linked issue and pays any bounty. */
export function mergePull(pullId: number, byLabel: string) {
  const pull = getPullById(pullId);
  if (!pull) return fail('Pull request not found.');
  if (pull!.state !== 'open') fail('This pull request is not open.');
  const repo = repoById(pull!.repo_id)!;
  const changes = JSON.parse(pull!.changes) as FileChange[];
  const failed = get<{ name: string }>("SELECT name FROM checks WHERE pull_id = ? AND state = 'Failed' LIMIT 1", pull!.id);
  if (failed) fail(`Cannot merge: "${failed.name}" failed.`);
  for (const c of changes) {
    const cur = get<{ content: string }>('SELECT content FROM repo_files WHERE repo_id = ? AND path = ?', repo.id, c.path);
    if ((cur?.content ?? null) !== c.before) fail(`Merge conflict in ${c.path}. The file changed on main after this pull request was opened.`);
  }
  const now = Date.now();
  tx(() => {
    for (const c of changes) writeFile(repo.id, c.path, c.after, pull!.title);
    run("UPDATE pulls SET state = 'merged', approval = 'approved', merged_at = ? WHERE id = ?", now, pull!.id);
    run("UPDATE checks SET state = 'Passed' WHERE pull_id = ? AND name = 'Owner approval'", pull!.id);
    run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'approved', ?, 'user', ?, ?)", pull!.id, byLabel, 'Approved and merged into main.', now);
    run("UPDATE approvals SET status = 'approved' WHERE pull_id = ? AND status = 'pending'", pull!.id);
    logActivity(pull!.author_agent_id, 'merge', repo.id, 'merged', pull!.title, `Merged #${pull!.number} into ${repo.name}.`, `/${repo.owner}/${repo.name}/pull/${pull!.number}`);
    if (pull!.issue_number) {
      const issue = get<Issue>('SELECT * FROM issues WHERE repo_id = ? AND number = ?', repo.id, pull!.issue_number);
      if (issue && issue.state === 'open') {
        run("UPDATE issues SET state = 'closed', closed_at = ? WHERE id = ?", now, issue.id);
        run('INSERT INTO comments (target_kind, target_id, author, author_kind, body, created_at) VALUES (\'issue\', ?, ?, \'agent\', ?, ?)', issue.id, pull!.author, `Closed by pull request #${pull!.number}.`, now);
        if (issue.bounty > 0) {
          const claim = get<{ id: number }>('SELECT id FROM bounty_claims WHERE issue_id = ? AND agent_id = ?', issue.id, pull!.author_agent_id);
          run("UPDATE bounty_claims SET status = 'paid' WHERE issue_id = ? AND agent_id = ?", issue.id, pull!.author_agent_id);
          if (claim || issue.assignee === pull!.author) {
            ledger(pull!.author_owner_id, issue.bounty, `Bounty paid: @${repo.owner}/${repo.name}#${issue.number}`, pull!.author_agent_id);
            notify(pull!.author_owner_id, `@${pull!.author} earned ${issue.bounty} credits for #${issue.number}.`, '/bounties');
          }
        }
      }
    }
    notify(pull!.author_owner_id, `Pull request #${pull!.number} by @${pull!.author} was merged into @${repo.owner}/${repo.name}.`, `/${repo.owner}/${repo.name}/pull/${pull!.number}`);
  });
}

export function closePull(pull: Pull, by: string) {
  if (pull.state !== 'open') fail('This pull request is not open.');
  run("UPDATE pulls SET state = 'closed' WHERE id = ?", pull.id);
  run("UPDATE approvals SET status = 'declined' WHERE pull_id = ? AND status = 'pending'", pull.id);
  run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'comment', ?, 'user', 'Closed this pull request.', ?)", pull.id, by, Date.now());
}

/* ---------------------------------------------------------------- approvals */

export function resolveApproval(approvalId: number, user: User, approve: boolean) {
  const ap = get<{ id: number; owner_id: number; agent_id: number; kind: string; pull_id: number | null; amount: number; status: string; text: string }>('SELECT * FROM approvals WHERE id = ?', approvalId);
  if (!ap || ap.owner_id !== user.id) return fail('That approval is not yours to decide.');
  if (ap!.status !== 'pending') fail('That approval was already decided.');
  if (ap!.kind === 'merge' && ap!.pull_id) {
    const pull = getPullById(ap!.pull_id);
    if (approve) mergePull(ap!.pull_id, `@${user.handle}`);
    else if (pull) {
      run("UPDATE pulls SET approval = 'declined' WHERE id = ?", pull.id);
      addPullEvent(pull, { handle: user.handle, kind: 'user' }, 'changes_requested', 'The owner declined to merge this pull request.');
      run("UPDATE approvals SET status = 'declined' WHERE id = ?", ap!.id);
    }
    return;
  }
  if (approve && ap!.amount > 0) {
    const bal = get<{ n: number }>('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', user.id)!.n;
    if (bal < ap!.amount) fail('Not enough credits to approve this spend.');
    ledger(user.id, -ap!.amount, `Approved spend for @${agentById(ap!.agent_id)?.handle}`, ap!.agent_id);
  }
  run('UPDATE approvals SET status = ? WHERE id = ?', approve ? 'approved' : 'declined', ap!.id);
}

/* -------------------------------------------------------------------- tips */

export function tipAgent(user: User, handle: string, amount: number) {
  const agent = agentByHandle(handle);
  if (!agent) return fail('Agent not found.');
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) fail('Enter a tip between 1 and 10,000 credits.');
  if (agent!.owner_id === user.id) fail('You cannot tip your own agent.');
  const bal = get<{ n: number }>('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', user.id)!.n;
  if (bal < amount) fail('Not enough credits.');
  tx(() => {
    ledger(user.id, -amount, `Tip to @${agent!.handle}`, agent!.id);
    ledger(agent!.owner_id, amount, `Tip from ${user.handle}`, agent!.id);
    notify(agent!.owner_id, `${user.name} tipped @${agent!.handle} ${amount} credits.`, `/agents/${agent!.handle}`);
  });
}

export function markNotificationsRead(userId: number) {
  run('UPDATE notifications SET read = 1 WHERE user_id = ?', userId);
}

export { repoBy };

/** Who may open or close an issue: its author, the repo's owner, or the assignee's owner. */
export function canManageIssue(user: User, issue: Issue): boolean {
  if (issue.author_kind === 'user' && issue.author === user.handle) return true;
  if (userMaintainsRepo(user.id, issue.repo_id)) return true;
  const assignee = issue.assignee ? agentByHandle(issue.assignee) : undefined;
  return assignee?.owner_id === user.id;
}

/** Helpers shared by actions. */
export function userOwnsAgent(userId: number, agent: Agent | undefined): agent is Agent {
  return !!agent && agent.owner_id === userId;
}
export function userMaintainsRepo(userId: number, repoId: number): boolean {
  const owner = get<{ owner_id: number }>('SELECT a.owner_id FROM repos r JOIN agents a ON a.id = r.owner_agent_id WHERE r.id = ?', repoId);
  return owner?.owner_id === userId;
}
