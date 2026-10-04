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

export async function notify(userId: number, text: string, href?: string) {
  await run('INSERT INTO notifications (user_id, text, href, read, created_at) VALUES (?,?,?,0,?)', userId, text, href ?? null, Date.now());
}

export async function logActivity(agentId: number, kind: string, repoId: number | null, verb: string, target: string, note = '', href = '') {
  await run('INSERT INTO activity (agent_id, kind, repo_id, verb, target, note, href, created_at) VALUES (?,?,?,?,?,?,?,?)', agentId, kind, repoId, verb, target, note, href, Date.now());
}

const ownerOfAgent = async (agentId: number) => (await get<{ owner_id: number }>('SELECT owner_id FROM agents WHERE id = ?', agentId))?.owner_id;

async function ledger(userId: number, delta: number, reason: string, agentId: number | null = null) {
  await run('INSERT INTO ledger (user_id, agent_id, delta, reason, created_at) VALUES (?,?,?,?,?)', userId, agentId, delta, reason, Date.now());
}

/* ----------------------------------------------------------------- accounts */

export async function signUp(input: { email: string; name: string; password: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Enter a valid email address.');
  if (name.length < 2) fail('Enter your name.');
  if (input.password.length < 8) fail('Password must be at least 8 characters.');
  if (await get('SELECT 1 FROM users WHERE email = ?', email)) fail('An account with that email already exists.');
  let handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'owner';
  while (await get('SELECT 1 FROM users WHERE handle = ?', handle) || RESERVED.has(handle)) handle = `${handle.slice(0, 20)}-${Math.floor(Math.random() * 900 + 100)}`;
  const id = await tx(async () => {
    const r = await run('INSERT INTO users (email, name, handle, password_hash, created_at) VALUES (?,?,?,?,?)', email, name, handle, hashPassword(input.password), Date.now());
    await ledger(r.lastInsertRowid, 500, 'Welcome credits');
    await notify(r.lastInsertRowid, 'Welcome to AgentHub. Create your first agent to get started.', '/agents/new');
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

export async function signIn(emailRaw: string, password: string): Promise<User> {
  const email = emailRaw.trim().toLowerCase();
  checkAttempts(email);
  const row = await get<User & { password_hash: string }>('SELECT id, email, name, handle, created_at, password_hash FROM users WHERE email = ?', email);
  // Always verify something so timing does not reveal whether the account exists.
  const ok = verifyPassword(password, row?.password_hash ?? hashPassword('x'));
  if (!row || !ok) {
    checkAttempts(email, true);
    fail('Incorrect email or password.');
  }
  attempts.delete(email);
  await run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return { id: row!.id, email: row!.email, name: row!.name, handle: row!.handle, created_at: row!.created_at };
}

export async function updateProfile(userId: number, name: string) {
  if (name.trim().length < 2) fail('Enter your name.');
  await run('UPDATE users SET name = ? WHERE id = ?', name.trim(), userId);
}

export async function addTestCredits(userId: number, amount: number) {
  if (process.env.AGENTHUB_ALLOW_TOPUP === '0') fail('Top-ups are disabled on this deployment.');
  if (!Number.isInteger(amount) || amount < 1 || amount > 5000) fail('Enter an amount between 1 and 5,000.');
  await ledger(userId, amount, 'Top-up (test mode, no payment taken)');
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

export async function validateAgent(input: AgentInput, existingHandle?: string) {
  const handle = input.handle.trim().toLowerCase();
  if (!existingHandle) {
    if (!HANDLE_RE.test(handle)) fail('Handle must be 2 to 31 characters: lowercase letters, numbers and dashes, starting with a letter or number.');
    if (RESERVED.has(handle)) fail('That handle is reserved.');
    if (await get('SELECT 1 FROM agents WHERE handle = ?', handle)) fail('That handle is taken.');
  }
  if (!(PROVIDERS as readonly string[]).includes(input.provider)) fail('Choose a model provider.');
  if (input.instructions.trim().length < 10) fail('Write at least a sentence of instructions.');
  if (!Number.isInteger(input.tier) || input.tier < 0 || input.tier > 3) fail('Choose a permission tier.');
  if (!Number.isInteger(input.dailyCap) || input.dailyCap < 1 || input.dailyCap > 100_000) fail('Daily credit cap must be between 1 and 100,000.');
  if (!Number.isInteger(input.intervalHours) || input.intervalHours < 4) fail('Agents check in at most once every 4 hours.');
  if (![0, 10, 20].includes(input.variance)) fail('Choose a variance of 0, 10 or 20 percent.');
  return handle;
}

export async function createAgent(ownerId: number, input: AgentInput): Promise<{ agent: Agent; token: string }> {
  const handle = await validateAgent(input);
  const token = randomToken('ah_');
  const now = Date.now();
  const id = await tx(async () => {
    const r = await run(
      `INSERT INTO agents (handle, owner_id, bio, provider, model, api_key_enc, instructions, tier, status, daily_cap, interval_hours, variance, color, token_hash, ask_merge, ask_spend, skills, created_at, next_heartbeat_at)
       VALUES (?,?,?,?,?,?,?,?, 'running', ?,?,?,?,?,?,?, '[]', ?, ?)`,
      handle, ownerId, input.instructions.trim().slice(0, 160), input.provider, input.model.trim() || DEFAULT_MODEL[input.provider] || '',
      input.apiKey?.trim() ? encrypt(input.apiKey.trim()) : null, input.instructions.trim(), input.tier, input.dailyCap, input.intervalHours, input.variance,
      input.color, sha256(token), input.askMerge ? 1 : 0, input.askSpend, now, now + 10 * 60_000,
    );
    await ledger(ownerId, 0, `Created @${handle}`, r.lastInsertRowid);
    await notify(ownerId, `@${handle} was created and will check in shortly.`, `/agents/${handle}`);
    return r.lastInsertRowid;
  });
  return { agent: (await agentById(id))!, token };
}

export async function updateAgent(agent: Agent, input: Partial<AgentInput>) {
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
  await validateAgent(merged, agent.handle);
  await run(
    'UPDATE agents SET provider=?, model=?, instructions=?, bio=?, tier=?, color=?, daily_cap=?, interval_hours=?, variance=?, ask_merge=?, ask_spend=? WHERE id=?',
    merged.provider, merged.model, merged.instructions, merged.instructions.slice(0, 160), merged.tier, merged.color, merged.dailyCap, merged.intervalHours, merged.variance, merged.askMerge ? 1 : 0, merged.askSpend, agent.id,
  );
  if (input.apiKey?.trim()) await run('UPDATE agents SET api_key_enc = ? WHERE id = ?', encrypt(input.apiKey.trim()), agent.id);
}

export async function setAgentStatus(agent: Agent, status: 'running' | 'paused') {
  await run('UPDATE agents SET status = ?, next_heartbeat_at = ? WHERE id = ?', status, status === 'running' ? Date.now() + 10 * 60_000 : null, agent.id);
}

export async function rotateAgentToken(agent: Agent): Promise<string> {
  const token = randomToken('ah_');
  await run('UPDATE agents SET token_hash = ? WHERE id = ?', sha256(token), agent.id);
  return token;
}

export async function deleteAgent(agent: Agent) {
  await tx(async () => {
    await run('DELETE FROM approvals WHERE agent_id = ? OR pull_id IN (SELECT id FROM pulls WHERE author_agent_id = ?)', agent.id, agent.id);
    await run('DELETE FROM agents WHERE id = ?', agent.id);
  });
}

/** Resolve an agent API token to its agent (for /api/v1). */
export async function agentFromToken(token: string): Promise<Agent | undefined> {
  const row = await get<{ id: number }>('SELECT id FROM agents WHERE token_hash = ?', sha256(token));
  return row ? await agentById(row.id) : undefined;
}

/* -------------------------------------------------------------------- repos */

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export async function createRepo(agent: Agent, name: string, description: string, topics: string[] = []) {
  if (agent.tier < 2) fail(`@${agent.handle} needs the "Push to own" tier or higher to create repositories.`);
  if (!NAME_RE.test(name)) fail('Repository names use letters, numbers, dots, dashes and underscores.');
  if (await get('SELECT 1 FROM repos WHERE owner_agent_id = ? AND name = ?', agent.id, name)) fail('You already have a repository with that name.');
  const now = Date.now();
  const id = await tx(async () => {
    const r = await run('INSERT INTO repos (owner_agent_id, name, description, topics, created_at, updated_at) VALUES (?,?,?,?,?,?)', agent.id, name, description.trim().slice(0, 300), JSON.stringify(topics.slice(0, 8)), now, now);
    await run('INSERT INTO repo_files (repo_id, path, content, commit_msg, updated_at) VALUES (?,?,?,?,?)', r.lastInsertRowid, 'README.md', `# ${name}\n\n${description.trim()}\n`, 'Initial commit', now);
    await logActivity(agent.id, 'release', r.lastInsertRowid, 'created', `${agent.handle}/${name}`, description.trim().slice(0, 140), `/${agent.handle}/${name}`);
    return r.lastInsertRowid;
  });
  return (await repoById(id))!;
}

export async function forkRepo(repoId: number, byAgent: Agent) {
  const src = await repoById(repoId);
  if (!src) return fail('Repository not found.');
  if (byAgent.tier < 1) fail(`@${byAgent.handle} needs the "Propose" tier or higher to fork.`);
  if (src!.owner_agent_id === byAgent.id) fail('You cannot fork your own repository.');
  const existing = await get<{ id: number }>('SELECT id FROM repos WHERE owner_agent_id = ? AND name = ?', byAgent.id, src!.name);
  if (existing) return (await repoById(existing.id))!;
  const now = Date.now();
  const id = await tx(async () => {
    const r = await run('INSERT INTO repos (owner_agent_id, name, description, topics, forked_from, next_number, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', byAgent.id, src!.name, src!.description, src!.topics, src!.id, 1, now, now);
    for (const f of await all<{ path: string; content: string; commit_msg: string }>('SELECT path, content, commit_msg FROM repo_files WHERE repo_id = ?', src!.id)) {
      await run('INSERT INTO repo_files (repo_id, path, content, commit_msg, updated_at) VALUES (?,?,?,?,?)', r.lastInsertRowid, f.path, f.content, f.commit_msg, now);
    }
    await logActivity(byAgent.id, 'release', r.lastInsertRowid, 'forked', `@${src!.owner}/${src!.name}`, '', `/${byAgent.handle}/${src!.name}`);
    const owner = await ownerOfAgent(src!.owner_agent_id);
    if (owner) await notify(owner, `@${byAgent.handle} forked @${src!.owner}/${src!.name}.`, `/${byAgent.handle}/${src!.name}`);
    return r.lastInsertRowid;
  });
  return (await repoById(id))!;
}

export async function updateRepo(repoId: number, description: string, topics: string[]) {
  await run('UPDATE repos SET description = ?, topics = ?, updated_at = ? WHERE id = ?', description.trim().slice(0, 300), JSON.stringify(topics.slice(0, 8)), Date.now(), repoId);
}

export async function toggleStar(userId: number, repoId: number, kind: 'star' | 'watch' = 'star') {
  const has = await get('SELECT 1 FROM repo_stars WHERE user_id = ? AND repo_id = ? AND kind = ?', userId, repoId, kind);
  if (has) await run('DELETE FROM repo_stars WHERE user_id = ? AND repo_id = ? AND kind = ?', userId, repoId, kind);
  else await run('INSERT INTO repo_stars (user_id, repo_id, kind) VALUES (?,?,?)', userId, repoId, kind);
}

export async function writeFile(repoId: number, path: string, content: string, message: string) {
  if (!/^[\w./-]{1,200}$/.test(path) || path.includes('..') || path.startsWith('/')) fail('Invalid file path.');
  if (content.length > 200_000) fail('File is too large (200 KB maximum).');
  const now = Date.now();
  await run(
    `INSERT INTO repo_files (repo_id, path, content, commit_msg, updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(repo_id, path) DO UPDATE SET content = excluded.content, commit_msg = excluded.commit_msg, updated_at = excluded.updated_at`,
    repoId, path, content, message, now,
  );
  await run('UPDATE repos SET updated_at = ? WHERE id = ?', now, repoId);
}

/* ------------------------------------------------------------------- issues */

/** Reserves the next issue or pull request number atomically. */
async function nextNumber(repoId: number): Promise<number> {
  return (await get<{ n: number }>('UPDATE repos SET next_number = next_number + 1 WHERE id = ? RETURNING next_number - 1 AS n', repoId))!.n;
}

export async function createIssue(repoId: number, author: { handle: string; kind: 'agent' | 'user' }, input: { title: string; body: string; labels?: string[]; bounty?: number }, payerUserId?: number) {
  const title = input.title.trim();
  if (title.length < 3) fail('Give the issue a title.');
  if (title.length > 200) fail('Title is too long.');
  const bounty = Math.max(0, Math.floor(input.bounty ?? 0));
  if (bounty > 10_000) fail('Bounties are capped at 10,000 credits.');
  const repo = (await repoById(repoId))!;
  const number = await tx(async () => {
    const n = await nextNumber(repoId);
    await run('INSERT INTO issues (repo_id, number, title, body, author, author_kind, labels, bounty, created_at) VALUES (?,?,?,?,?,?,?,?,?)', repoId, n, title, input.body.trim().slice(0, 20_000), author.handle, author.kind, JSON.stringify((input.labels ?? []).slice(0, 6)), bounty, Date.now());
    if (bounty > 0 && payerUserId) {
      const bal = (await get<{ n: number }>('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', payerUserId))!.n;
      if (bal < bounty) fail('Not enough credits to fund that bounty.');
      await ledger(payerUserId, -bounty, `Bounty escrow for @${repo.owner}/${repo.name}#${n}`);
    }
    return n;
  });
  const agent = author.kind === 'agent' ? await agentByHandle(author.handle) : undefined;
  if (agent) await logActivity(agent.id, 'issue', repoId, 'opened an issue on', `@${repo.owner}/${repo.name}`, title, `/${repo.owner}/${repo.name}/issues/${number}`);
  const maintainerOwner = await ownerOfAgent(repo.owner_agent_id);
  if (maintainerOwner && author.kind === 'agent' && agent?.owner_id !== maintainerOwner) await notify(maintainerOwner, `@${author.handle} opened issue #${number} on @${repo.owner}/${repo.name}.`, `/${repo.owner}/${repo.name}/issues/${number}`);
  return number;
}

export async function setIssueState(issue: Issue, state: 'open' | 'closed') {
  await run('UPDATE issues SET state = ?, closed_at = ? WHERE id = ?', state, state === 'closed' ? Date.now() : null, issue.id);
}

export async function addComment(kind: 'issue' | 'pull', targetId: number, author: { handle: string; kind: 'agent' | 'user' }, body: string) {
  const text = body.trim();
  if (!text) fail('Write a comment first.');
  if (text.length > 20_000) fail('Comment is too long.');
  await run('INSERT INTO comments (target_kind, target_id, author, author_kind, body, created_at) VALUES (?,?,?,?,?,?)', kind, targetId, author.handle, author.kind, text, Date.now());
  // Notify owners of agents mentioned with @handle.
  for (const m of new Set([...text.matchAll(/@([a-z0-9][a-z0-9-]{1,30})/g)].map((x) => x[1]))) {
    const a = await agentByHandle(m);
    if (a && a.handle !== author.handle) await notify(a.owner_id, `${author.kind === 'user' ? author.handle : '@' + author.handle} mentioned @${a.handle}.`);
  }
}

export async function claimBounty(issue: Issue, agent: Agent, plan: string) {
  if (issue.bounty <= 0) fail('That issue has no bounty.');
  if (issue.state !== 'open') fail('That issue is closed.');
  if (agent.tier < 1) fail(`@${agent.handle} needs the "Propose" tier or higher to claim bounties.`);
  if (await get('SELECT 1 FROM bounty_claims WHERE issue_id = ? AND status IN (\'claimed\',\'in_review\') AND agent_id != ?', issue.id, agent.id)) fail('Another agent has already claimed this bounty.');
  const repo = (await repoById(issue.repo_id))!;
  await run("INSERT INTO bounty_claims (issue_id, agent_id, status, plan, created_at) VALUES (?,?,'claimed',?,?) ON CONFLICT DO NOTHING", issue.id, agent.id, plan.trim().slice(0, 2000), Date.now());
  await run('UPDATE issues SET assignee = ? WHERE id = ?', agent.handle, issue.id);
  if (plan.trim()) await addComment('issue', issue.id, { handle: agent.handle, kind: 'agent' }, `Claiming this. Plan: ${plan.trim()}`);
  await logActivity(agent.id, 'bounty', repo.id, 'claimed a bounty on', `${repo.name}#${issue.number}`, `Claimed for ${issue.bounty} credits.`, `/${repo.owner}/${repo.name}/issues/${issue.number}`);
  const owner = await ownerOfAgent(repo.owner_agent_id);
  if (owner) await notify(owner, `@${agent.handle} claimed the ${issue.bounty}-credit bounty on #${issue.number}.`, `/${repo.owner}/${repo.name}/issues/${issue.number}`);
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

export async function createPull(
  repoId: number,
  author: Agent,
  input: { title: string; intent: string; changes: { path: string; after: string }[]; issueNumber?: number | null; runId?: number | null; head?: string },
) {
  const repo = await repoById(repoId);
  if (!repo) return fail('Repository not found.');
  if (author.tier < 1) fail(`@${author.handle} needs the "Propose" tier or higher to open pull requests.`);
  if (!input.title.trim()) fail('Give the pull request a title.');
  if (!input.changes.length) fail('A pull request needs at least one file change.');
  if (input.changes.length > 50) fail('Too many files in one pull request (50 maximum).');
  const changes: FileChange[] = [];
  for (const c of input.changes) {
    if (!/^[\w./-]{1,200}$/.test(c.path) || c.path.includes('..') || c.path.startsWith('/')) fail(`Invalid path: ${c.path}`);
    const cur = await get<{ content: string }>('SELECT content FROM repo_files WHERE repo_id = ? AND path = ?', repoId, c.path);
    changes.push({ path: c.path, before: cur ? cur.content : null, after: c.after });
  }
  const checks = staticChecks(changes);
  const testsAdded = changes.filter((c) => /(^|\/)(tests?|__tests__)\//.test(c.path) || /\.(test|spec)\./.test(c.path)).length;
  const now = Date.now();
  const id = await tx(async () => {
    const n = await nextNumber(repoId);
    const r = await run(
      'INSERT INTO pulls (repo_id, number, title, intent, author_agent_id, head_branch, issue_number, changes, tests_added, run_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      repoId, n, input.title.trim().slice(0, 200), input.intent.trim().slice(0, 4000), author.id, input.head ?? `${author.handle}:work-${n}`, input.issueNumber ?? null, JSON.stringify(changes), testsAdded, input.runId ?? null, now,
    );
    await run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'opened', ?, 'agent', ?, ?)", r.lastInsertRowid, author.handle, input.intent.trim().slice(0, 1000) || 'Opened this pull request.', now);
    for (const c of checks) await run('INSERT INTO checks (pull_id, name, state) VALUES (?,?,?)', r.lastInsertRowid, c.name, c.state);
    await run("INSERT INTO checks (pull_id, name, state) VALUES (?, 'Owner approval', 'Pending')", r.lastInsertRowid);
    await run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'ci', 'sandbox-ci', 'agent', ?, ?)", r.lastInsertRowid, checks.every((c) => c.state === 'Passed') ? 'All static checks passed.' : `Failed: ${checks.filter((c) => c.state === 'Failed').map((c) => c.name).join(', ')}.`, now + 1);
    return { id: r.lastInsertRowid, number: n };
  });
  await logActivity(author.id, 'pull', repoId, 'opened a pull request on', `@${repo.owner}/${repo.name}`, input.title.trim(), `/${repo.owner}/${repo.name}/pull/${id.number}`);
  const owner = await ownerOfAgent(repo.owner_agent_id);
  if (owner) {
    await notify(owner, `@${author.handle} opened pull request #${id.number} on @${repo.owner}/${repo.name}.`, `/${repo.owner}/${repo.name}/pull/${id.number}`);
    await run("INSERT INTO approvals (owner_id, agent_id, kind, pull_id, amount, text, href, status, created_at) VALUES (?,?, 'merge', ?, 0, ?, ?, 'pending', ?)", owner, repo.owner_agent_id, id.id, `Merge pull request #${id.number} by @${author.handle} into @${repo.owner}/${repo.name}:main`, `/${repo.owner}/${repo.name}/pull/${id.number}`, now);
  }
  return id;
}

export async function addPullEvent(pull: Pull, author: { handle: string; kind: 'agent' | 'user' }, kind: 'comment' | 'review' | 'changes_requested' | 'approved', body: string) {
  if (kind !== 'approved' && !body.trim()) fail('Write something first.');
  await run('INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?,?,?,?,?,?)', pull.id, kind, author.handle, author.kind, body.trim().slice(0, 10_000) || 'Approved.', Date.now());
  if (kind === 'changes_requested') await run("UPDATE pulls SET approval = 'pending' WHERE id = ?", pull.id);
  if (author.handle !== pull.author) await notify(pull.author_owner_id, `${author.kind === 'user' ? author.handle : '@' + author.handle} ${kind === 'changes_requested' ? 'requested changes on' : 'commented on'} pull request #${pull.number}.`);
}

/** Merge a pull request. Applies file changes, closes the linked issue and pays any bounty. */
export async function mergePull(pullId: number, byLabel: string) {
  const pull = await getPullById(pullId);
  if (!pull) return fail('Pull request not found.');
  if (pull!.state !== 'open') fail('This pull request is not open.');
  const repo = (await repoById(pull!.repo_id))!;
  const changes = JSON.parse(pull!.changes) as FileChange[];
  const failed = await get<{ name: string }>("SELECT name FROM checks WHERE pull_id = ? AND state = 'Failed' LIMIT 1", pull!.id);
  if (failed) fail(`Cannot merge: "${failed.name}" failed.`);
  for (const c of changes) {
    const cur = await get<{ content: string }>('SELECT content FROM repo_files WHERE repo_id = ? AND path = ?', repo.id, c.path);
    if ((cur?.content ?? null) !== c.before) fail(`Merge conflict in ${c.path}. The file changed on main after this pull request was opened.`);
  }
  const now = Date.now();
  await tx(async () => {
    for (const c of changes) await writeFile(repo.id, c.path, c.after, pull!.title);
    await run("UPDATE pulls SET state = 'merged', approval = 'approved', merged_at = ? WHERE id = ?", now, pull!.id);
    await run("UPDATE checks SET state = 'Passed' WHERE pull_id = ? AND name = 'Owner approval'", pull!.id);
    await run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'approved', ?, 'user', ?, ?)", pull!.id, byLabel, 'Approved and merged into main.', now);
    await run("UPDATE approvals SET status = 'approved' WHERE pull_id = ? AND status = 'pending'", pull!.id);
    await logActivity(pull!.author_agent_id, 'merge', repo.id, 'merged', pull!.title, `Merged #${pull!.number} into ${repo.name}.`, `/${repo.owner}/${repo.name}/pull/${pull!.number}`);
    if (pull!.issue_number) {
      const issue = await get<Issue>('SELECT * FROM issues WHERE repo_id = ? AND number = ?', repo.id, pull!.issue_number);
      if (issue && issue.state === 'open') {
        await run("UPDATE issues SET state = 'closed', closed_at = ? WHERE id = ?", now, issue.id);
        await run('INSERT INTO comments (target_kind, target_id, author, author_kind, body, created_at) VALUES (\'issue\', ?, ?, \'agent\', ?, ?)', issue.id, pull!.author, `Closed by pull request #${pull!.number}.`, now);
        if (issue.bounty > 0) {
          const claim = await get<{ id: number }>('SELECT id FROM bounty_claims WHERE issue_id = ? AND agent_id = ?', issue.id, pull!.author_agent_id);
          await run("UPDATE bounty_claims SET status = 'paid' WHERE issue_id = ? AND agent_id = ?", issue.id, pull!.author_agent_id);
          if (claim || issue.assignee === pull!.author) {
            await ledger(pull!.author_owner_id, issue.bounty, `Bounty paid: @${repo.owner}/${repo.name}#${issue.number}`, pull!.author_agent_id);
            await notify(pull!.author_owner_id, `@${pull!.author} earned ${issue.bounty} credits for #${issue.number}.`, '/bounties');
          }
        }
      }
    }
    await notify(pull!.author_owner_id, `Pull request #${pull!.number} by @${pull!.author} was merged into @${repo.owner}/${repo.name}.`, `/${repo.owner}/${repo.name}/pull/${pull!.number}`);
  });
}

export async function closePull(pull: Pull, by: string) {
  if (pull.state !== 'open') fail('This pull request is not open.');
  await run("UPDATE pulls SET state = 'closed' WHERE id = ?", pull.id);
  await run("UPDATE approvals SET status = 'declined' WHERE pull_id = ? AND status = 'pending'", pull.id);
  await run("INSERT INTO pull_events (pull_id, kind, author, author_kind, body, created_at) VALUES (?, 'comment', ?, 'user', 'Closed this pull request.', ?)", pull.id, by, Date.now());
}

/* ---------------------------------------------------------------- approvals */

export async function resolveApproval(approvalId: number, user: User, approve: boolean) {
  const ap = await get<{ id: number; owner_id: number; agent_id: number; kind: string; pull_id: number | null; amount: number; status: string; text: string }>('SELECT * FROM approvals WHERE id = ?', approvalId);
  if (!ap || ap.owner_id !== user.id) return fail('That approval is not yours to decide.');
  if (ap!.status !== 'pending') fail('That approval was already decided.');
  if (ap!.kind === 'merge' && ap!.pull_id) {
    const pull = await getPullById(ap!.pull_id);
    if (approve) await mergePull(ap!.pull_id, `@${user.handle}`);
    else if (pull) {
      await run("UPDATE pulls SET approval = 'declined' WHERE id = ?", pull.id);
      await addPullEvent(pull, { handle: user.handle, kind: 'user' }, 'changes_requested', 'The owner declined to merge this pull request.');
      await run("UPDATE approvals SET status = 'declined' WHERE id = ?", ap!.id);
    }
    return;
  }
  if (approve && ap!.amount > 0) {
    const bal = (await get<{ n: number }>('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', user.id))!.n;
    if (bal < ap!.amount) fail('Not enough credits to approve this spend.');
    await ledger(user.id, -ap!.amount, `Approved spend for @${(await agentById(ap!.agent_id))?.handle}`, ap!.agent_id);
  }
  await run('UPDATE approvals SET status = ? WHERE id = ?', approve ? 'approved' : 'declined', ap!.id);
}

/* -------------------------------------------------------------------- tips */

export async function tipAgent(user: User, handle: string, amount: number) {
  const agent = await agentByHandle(handle);
  if (!agent) return fail('Agent not found.');
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) fail('Enter a tip between 1 and 10,000 credits.');
  if (agent!.owner_id === user.id) fail('You cannot tip your own agent.');
  const bal = (await get<{ n: number }>('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', user.id))!.n;
  if (bal < amount) fail('Not enough credits.');
  await tx(async () => {
    await ledger(user.id, -amount, `Tip to @${agent!.handle}`, agent!.id);
    await ledger(agent!.owner_id, amount, `Tip from ${user.handle}`, agent!.id);
    await notify(agent!.owner_id, `${user.name} tipped @${agent!.handle} ${amount} credits.`, `/agents/${agent!.handle}`);
  });
}

export async function markNotificationsRead(userId: number) {
  await run('UPDATE notifications SET read = 1 WHERE user_id = ?', userId);
}

export { repoBy };

/** Who may open or close an issue: its author, the repo's owner, or the assignee's owner. */
export async function canManageIssue(user: User, issue: Issue): Promise<boolean> {
  if (issue.author_kind === 'user' && issue.author === user.handle) return true;
  if (await userMaintainsRepo(user.id, issue.repo_id)) return true;
  const assignee = issue.assignee ? await agentByHandle(issue.assignee) : undefined;
  return assignee?.owner_id === user.id;
}

/** Helpers shared by actions. */
export function userOwnsAgent(userId: number, agent: Agent | undefined): agent is Agent {
  return !!agent && agent.owner_id === userId;
}
export async function userMaintainsRepo(userId: number, repoId: number): Promise<boolean> {
  const owner = await get<{ owner_id: number }>('SELECT a.owner_id FROM repos r JOIN agents a ON a.id = r.owner_agent_id WHERE r.id = ?', repoId);
  return owner?.owner_id === userId;
}
