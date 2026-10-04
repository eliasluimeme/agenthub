import 'server-only';
import { all, get, num } from './db';
import { parseJson } from './format';
import type { Agent, Approval, Comment, Issue, Pull, PullEvent, Repo } from './types';

/* ------------------------------------------------------------------ agents */

const AGENT_SELECT = `
  SELECT a.id, a.handle, a.owner_id, u.handle AS owner_handle, a.bio, a.provider, a.model,
         (a.api_key_enc IS NOT NULL)::int AS has_key, a.instructions, a.tier, a.status, a.daily_cap,
         a.interval_hours, a.variance, a.color, a.ask_merge, a.ask_spend, a.skills, a.created_at,
         a.last_heartbeat_at, a.next_heartbeat_at, a.backoff_until, a.backoff_step
  FROM agents a JOIN users u ON u.id = a.owner_id`;

export const agentByHandle = (handle: string) => get<Agent>(`${AGENT_SELECT} WHERE a.handle = ?`, handle);
export const agentById = (id: number) => get<Agent>(`${AGENT_SELECT} WHERE a.id = ?`, id);
export const agentsByOwner = (ownerId: number) => all<Agent>(`${AGENT_SELECT} WHERE a.owner_id = ? ORDER BY a.created_at`, ownerId);
export const allAgents = () => all<Agent>(`${AGENT_SELECT} ORDER BY a.created_at`);

export async function agentColor(handle: string): Promise<string> {
  return (await get<{ color: string }>('SELECT color FROM agents WHERE handle = ?', handle))?.color ?? '#9da7ba';
}

/** Credits an agent has spent today (runs). */
export async function spentToday(agentId: number): Promise<number> {
  const since = new Date().setHours(0, 0, 0, 0);
  return await num('SELECT COALESCE(SUM(credits),0) AS n FROM runs WHERE agent_id = ? AND started_at >= ?', agentId, since);
}

export async function agentStats(agentId: number) {
  const merged = await num("SELECT COUNT(*) AS n FROM pulls WHERE author_agent_id = ? AND state = 'merged'", agentId);
  const closed = await num("SELECT COUNT(*) AS n FROM pulls WHERE author_agent_id = ? AND state IN ('merged','closed')", agentId);
  const opened = await num('SELECT COUNT(*) AS n FROM pulls WHERE author_agent_id = ?', agentId);
  const cost = (await get<{ avg: number | null }>('SELECT AVG(credits) AS avg FROM runs WHERE agent_id = ? AND pull_id IS NOT NULL', agentId))?.avg ?? 0;
  const earned = await num("SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE agent_id = ? AND delta > 0", agentId);
  return { merged, opened, accepted: closed ? Math.round((merged / closed) * 100) : null, avgCost: Math.round(cost), earned };
}

export async function heartbeats(agentId: number, limit = 24) {
  return (await all<{ at: number; status: string; note: string }>('SELECT at, status, note FROM heartbeats WHERE agent_id = ? ORDER BY at DESC LIMIT ?', agentId, limit)).reverse();
}

/** Contribution counts per day for the last `days` days (index 0 = oldest). */
export async function heatmap(agentId: number, days = 280): Promise<number[]> {
  const dayMs = 86_400_000;
  const start = new Date().setHours(0, 0, 0, 0) - (days - 1) * dayMs;
  const rows = await all<{ created_at: number }>('SELECT created_at FROM activity WHERE agent_id = ? AND created_at >= ?', agentId, start);
  const out = new Array<number>(days).fill(0);
  for (const r of rows) {
    const idx = Math.floor((r.created_at - start) / dayMs);
    if (idx >= 0 && idx < days) out[idx]++;
  }
  return out;
}

/* ------------------------------------------------------------------- repos */

const REPO_SELECT = `
  SELECT r.id, r.owner_agent_id, a.handle AS owner, r.name, r.description, r.topics, r.forked_from,
         r.default_branch, r.next_number, r.created_at, r.updated_at,
         (SELECT COUNT(*) FROM repo_stars s WHERE s.repo_id = r.id AND s.kind = 'star') AS stars,
         (SELECT COUNT(*) FROM repos f WHERE f.forked_from = r.id) AS forks,
         (SELECT COUNT(DISTINCT x) FROM (
            SELECT author_agent_id AS x FROM pulls WHERE repo_id = r.id
            UNION SELECT r.owner_agent_id) t) AS agents,
         (SELECT COUNT(*) FROM issues i WHERE i.repo_id = r.id AND i.state = 'open' AND i.bounty > 0) AS bounties
  FROM repos r JOIN agents a ON a.id = r.owner_agent_id`;

export const repoBy = (owner: string, name: string) => get<Repo>(`${REPO_SELECT} WHERE a.handle = ? AND r.name = ?`, owner, name);
export const repoById = (id: number) => get<Repo>(`${REPO_SELECT} WHERE r.id = ?`, id);
export const reposByOwnerAgent = (agentId: number) => all<Repo>(`${REPO_SELECT} WHERE r.owner_agent_id = ? ORDER BY r.updated_at DESC`, agentId);
export const allRepos = () => all<Repo>(`${REPO_SELECT} ORDER BY r.updated_at DESC`);
export const reposForOwnerUser = (userId: number) => all<Repo>(`${REPO_SELECT} WHERE a.owner_id = ? ORDER BY r.updated_at DESC`, userId);

const EXT_LANG: Record<string, string> = { ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', py: 'Python', rs: 'Rust', go: 'Go', sh: 'Shell', json: 'JSON', md: 'Markdown', css: 'CSS' };

export async function repoLanguages(repoId: number): Promise<{ name: string; pct: number }[]> {
  const files = await all<{ path: string; len: number }>('SELECT path, LENGTH(content) AS len FROM repo_files WHERE repo_id = ?', repoId);
  const totals = new Map<string, number>();
  let sum = 0;
  for (const f of files) {
    const lang = EXT_LANG[f.path.split('.').pop() ?? ''];
    if (!lang || lang === 'Markdown' || lang === 'JSON') continue;
    totals.set(lang, (totals.get(lang) ?? 0) + f.len);
    sum += f.len;
  }
  if (!sum) return [];
  return [...totals.entries()].map(([name, n]) => ({ name, pct: Math.max(1, Math.round((n / sum) * 100)) })).sort((a, b) => b.pct - a.pct);
}

export interface TreeEntry {
  name: string;
  path: string;
  kind: 'folder' | 'file';
  commit_msg: string;
  updated_at: number;
}

export async function repoTree(repoId: number, dir = ''): Promise<TreeEntry[]> {
  const prefix = dir ? `${dir}/` : '';
  const files = await all<{ path: string; commit_msg: string; updated_at: number }>('SELECT path, commit_msg, updated_at FROM repo_files WHERE repo_id = ? ORDER BY path', repoId);
  const entries = new Map<string, TreeEntry>();
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    const [first, ...tail] = rest.split('/');
    if (!first) continue;
    const isFolder = tail.length > 0;
    const key = (isFolder ? 'd:' : 'f:') + first;
    const cur = entries.get(key);
    if (!cur || f.updated_at > cur.updated_at) {
      entries.set(key, { name: first, path: prefix + first, kind: isFolder ? 'folder' : 'file', commit_msg: f.commit_msg, updated_at: f.updated_at });
    }
  }
  return [...entries.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
}

export const repoFile = (repoId: number, path: string) =>
  get<{ path: string; content: string; commit_msg: string; updated_at: number }>('SELECT path, content, commit_msg, updated_at FROM repo_files WHERE repo_id = ? AND path = ?', repoId, path);

export async function repoContributors(repoId: number) {
  return all<{ handle: string; role: string }>(
    `SELECT handle, MIN(role) AS role FROM (
       SELECT a.handle AS handle, 'Maintainer' AS role FROM repos r JOIN agents a ON a.id = r.owner_agent_id WHERE r.id = ?
       UNION SELECT a.handle, 'Contributor' FROM pulls p JOIN agents a ON a.id = p.author_agent_id WHERE p.repo_id = ?
       UNION SELECT i.author, 'Reporter' FROM issues i WHERE i.repo_id = ? AND i.author_kind = 'agent'
     ) c GROUP BY handle ORDER BY CASE MIN(role) WHEN 'Maintainer' THEN 0 WHEN 'Contributor' THEN 1 ELSE 2 END, handle`,
    repoId, repoId, repoId,
  );
}

export async function isStarred(userId: number, repoId: number, kind = 'star'): Promise<boolean> {
  return !!await get('SELECT 1 FROM repo_stars WHERE user_id = ? AND repo_id = ? AND kind = ?', userId, repoId, kind);
}

export async function repoCounts(repoId: number) {
  const open = await num("SELECT COUNT(*) AS n FROM issues WHERE repo_id = ? AND state = 'open'", repoId);
  const closed = await num("SELECT COUNT(*) AS n FROM issues WHERE repo_id = ? AND state = 'closed'", repoId);
  const pulls = await num("SELECT COUNT(*) AS n FROM pulls WHERE repo_id = ? AND state = 'open'", repoId);
  const bounties = await num("SELECT COUNT(*) AS n FROM issues WHERE repo_id = ? AND state = 'open' AND bounty > 0", repoId);
  const agents = await num('SELECT COUNT(*) AS n FROM (SELECT DISTINCT author_agent_id FROM pulls WHERE repo_id = ? UNION SELECT owner_agent_id FROM repos WHERE id = ?) t', repoId, repoId);
  return { open, closed, pulls, bounties, agents };
}

export interface RepoFilters {
  q?: string;
  language?: string[];
  model?: string[];
  status?: string[];
  sort?: string;
}

export async function searchRepos(f: RepoFilters): Promise<(Repo & { languages: string[]; providers: string[]; hasRelease: boolean })[]> {
  const q = f.q?.trim().toLowerCase();
  const rows = await Promise.all((await allRepos()).map(async (r) => ({
    ...r,
    languages: (await repoLanguages(r.id)).map((l) => l.name),
    providers: (await all<{ provider: string }>(
      `SELECT DISTINCT a.provider FROM agents a WHERE a.id = ? OR a.id IN (SELECT author_agent_id FROM pulls WHERE repo_id = ?)`,
      r.owner_agent_id, r.id,
    )).map((x) => x.provider),
    hasRelease: !!(await get('SELECT 1 FROM activity WHERE repo_id = ? AND kind = ?', r.id, 'release')),
  })));
  let out = rows.filter((r) => {
    if (q && !`${r.owner}/${r.name} ${r.description} ${r.topics}`.toLowerCase().includes(q)) return false;
    if (f.language?.length && !f.language.some((l) => r.languages.includes(l))) return false;
    if (f.model?.length && !f.model.some((m) => r.providers.includes(m))) return false;
    if (f.status?.includes('Open bounties') && r.bounties === 0) return false;
    if (f.status?.includes('Has releases') && !r.hasRelease) return false;
    return true;
  });
  const sort = f.sort ?? 'trending';
  if (sort === 'stars') out = out.sort((a, b) => b.stars - a.stars);
  else if (sort === 'updated') out = out.sort((a, b) => b.updated_at - a.updated_at);
  else if (sort === 'forks') out = out.sort((a, b) => b.forks - a.forks);
  else out = out.sort((a, b) => b.stars + b.bounties * 2 - (a.stars + a.bounties * 2));
  return out;
}

/* ------------------------------------------------------------------ issues */

const ISSUE_SELECT = `
  SELECT i.*, (SELECT COUNT(*) FROM comments c WHERE c.target_kind = 'issue' AND c.target_id = i.id) AS comment_count,
         (SELECT status FROM bounty_claims b WHERE b.issue_id = i.id ORDER BY b.id DESC LIMIT 1) AS claim_status
  FROM issues i`;

export async function listIssues(repoId: number, opts: { state?: 'open' | 'closed'; q?: string; label?: string } = {}) {
  let rows = await all<Issue>(`${ISSUE_SELECT} WHERE i.repo_id = ? ${opts.state ? 'AND i.state = ?' : ''} ORDER BY i.created_at DESC`, ...(opts.state ? [repoId, opts.state] : [repoId]));
  if (opts.q) rows = rows.filter((i) => `${i.title} ${i.body} ${i.author}`.toLowerCase().includes(opts.q!.toLowerCase()));
  if (opts.label) rows = rows.filter((i) => parseJson<string[]>(i.labels, []).includes(opts.label!));
  return rows;
}

export const getIssue = (repoId: number, number: number) => get<Issue>(`${ISSUE_SELECT} WHERE i.repo_id = ? AND i.number = ?`, repoId, number);
export const getIssueById = (id: number) => get<Issue>(`${ISSUE_SELECT} WHERE i.id = ?`, id);

export const commentsFor = (kind: 'issue' | 'pull', id: number) =>
  all<Comment>('SELECT id, author, author_kind, body, created_at FROM comments WHERE target_kind = ? AND target_id = ? ORDER BY created_at', kind, id);

export async function claimsFor(issueId: number) {
  return all<{ id: number; agent: string; status: string; plan: string; created_at: number }>(
    'SELECT b.id, a.handle AS agent, b.status, b.plan, b.created_at FROM bounty_claims b JOIN agents a ON a.id = b.agent_id WHERE b.issue_id = ? ORDER BY b.id',
    issueId,
  );
}

/* ------------------------------------------------------------------- pulls */

const PULL_SELECT = `
  SELECT p.*, a.handle AS author, a.owner_id AS author_owner_id
  FROM pulls p JOIN agents a ON a.id = p.author_agent_id`;

export const listPulls = (repoId: number, state?: string) =>
  all<Pull>(`${PULL_SELECT} WHERE p.repo_id = ? ${state ? 'AND p.state = ?' : ''} ORDER BY p.created_at DESC`, ...(state ? [repoId, state] : [repoId]));
export const getPull = (repoId: number, number: number) => get<Pull>(`${PULL_SELECT} WHERE p.repo_id = ? AND p.number = ?`, repoId, number);
export const getPullById = (id: number) => get<Pull>(`${PULL_SELECT} WHERE p.id = ?`, id);
export const pullEvents = (pullId: number) =>
  all<PullEvent>('SELECT id, kind, author, author_kind, body, created_at FROM pull_events WHERE pull_id = ? ORDER BY created_at', pullId);
export const pullChecks = (pullId: number) => all<{ name: string; state: string }>('SELECT name, state FROM checks WHERE pull_id = ? ORDER BY id', pullId);

export async function openPullsForUser(userId: number) {
  return all<Pull & { owner: string; repo: string }>(
    `SELECT p.*, a.handle AS author, a.owner_id AS author_owner_id, ra.handle AS owner, r.name AS repo
     FROM pulls p JOIN agents a ON a.id = p.author_agent_id JOIN repos r ON r.id = p.repo_id JOIN agents ra ON ra.id = r.owner_agent_id
     WHERE p.state = 'open' AND (a.owner_id = ? OR ra.owner_id = ?) ORDER BY p.created_at DESC`,
    userId, userId,
  );
}

/* --------------------------------------------------------------- approvals */

export const pendingApprovals = (userId: number) =>
  all<Approval>(
    `SELECT ap.*, a.handle AS agent FROM approvals ap JOIN agents a ON a.id = ap.agent_id WHERE ap.owner_id = ? AND ap.status = 'pending' ORDER BY ap.created_at DESC`,
    userId,
  );
export const getApproval = (id: number) =>
  get<Approval>('SELECT ap.*, a.handle AS agent FROM approvals ap JOIN agents a ON a.id = ap.agent_id WHERE ap.id = ?', id);

/* -------------------------------------------------------------------- feed */

export interface FeedRow {
  id: number;
  agent: string;
  kind: string;
  verb: string;
  target: string;
  note: string;
  href: string | null;
  created_at: number;
}

const KIND_LABEL: Record<string, string> = { pull: 'Pull request', release: 'Release', dead_end: 'Dead end', handoff: 'Handoff', bounty: 'Bounty', commit: 'Commit', merge: 'Merge', issue: 'Issue' };
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

export async function feed(opts: { userId?: number; kind?: string; limit?: number } = {}): Promise<FeedRow[]> {
  const where = ["act.kind != 'commit' OR act.note != ''"];
  const params: (string | number)[] = [];
  if (opts.kind) { where.push('act.kind = ?'); params.push(opts.kind); }
  if (opts.userId) { where.push('a.owner_id = ?'); params.push(opts.userId); }
  return all<FeedRow>(
    `SELECT act.id, a.handle AS agent, act.kind, act.verb, act.target, act.note, act.href, act.created_at
     FROM activity act JOIN agents a ON a.id = act.agent_id
     WHERE (${where.shift()}) ${where.length ? 'AND ' + where.join(' AND ') : ''}
     ORDER BY act.created_at DESC LIMIT ?`,
    ...params, opts.limit ?? 20,
  );
}

export async function recentActivity(agentId: number, limit = 6): Promise<FeedRow[]> {
  return all<FeedRow>(
    `SELECT act.id, a.handle AS agent, act.kind, act.verb, act.target, act.note, act.href, act.created_at
     FROM activity act JOIN agents a ON a.id = act.agent_id WHERE act.agent_id = ? AND act.kind != 'commit' ORDER BY act.created_at DESC LIMIT ?`,
    agentId, limit,
  );
}

/* ----------------------------------------------------------------- bounties */

export interface BountyRow {
  issue_id: number;
  repo_id: number;
  number: number;
  title: string;
  bounty: number;
  state: string;
  owner: string;
  repo: string;
  claim_status: string | null;
  claimed_by: string | null;
  created_at: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export async function bountyRows(): Promise<BountyRow[]> {
  const rows = await all<Omit<BountyRow, 'difficulty'>>(
    `SELECT i.id AS issue_id, i.repo_id, i.number, i.title, i.bounty, i.state, ra.handle AS owner, r.name AS repo, i.created_at,
            (SELECT status FROM bounty_claims b WHERE b.issue_id = i.id ORDER BY b.id DESC LIMIT 1) AS claim_status,
            (SELECT a.handle FROM bounty_claims b JOIN agents a ON a.id = b.agent_id WHERE b.issue_id = i.id ORDER BY b.id DESC LIMIT 1) AS claimed_by
     FROM issues i JOIN repos r ON r.id = i.repo_id JOIN agents ra ON ra.id = r.owner_agent_id
     WHERE i.bounty > 0 ORDER BY i.bounty DESC`,
  );
  return rows.map((r) => ({ ...r, difficulty: r.bounty >= 30 ? 'Hard' : r.bounty >= 20 ? 'Medium' : 'Easy' }));
}

export const bountyStatus = (b: Pick<BountyRow, 'state' | 'claim_status'>): 'open' | 'claimed' | 'in_review' | 'paid' =>
  b.claim_status === 'paid' || b.state === 'closed' ? 'paid' : b.claim_status === 'in_review' ? 'in_review' : b.claim_status === 'claimed' ? 'claimed' : 'open';

/* ------------------------------------------------------------ credits, misc */

export const creditBalance = (userId: number) => num('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id = ?', userId);
export const ledgerFor = (userId: number, limit = 30) =>
  all<{ id: number; delta: number; reason: string; created_at: number; agent: string | null }>(
    'SELECT l.id, l.delta, l.reason, l.created_at, a.handle AS agent FROM ledger l LEFT JOIN agents a ON a.id = l.agent_id WHERE l.user_id = ? ORDER BY l.created_at DESC, l.id DESC LIMIT ?',
    userId, limit,
  );

/** Credits spent per day for the last 7 days (oldest first), plus total. */
export async function weeklySpend(userId: number) {
  const dayMs = 86_400_000;
  const start = new Date().setHours(0, 0, 0, 0) - 6 * dayMs;
  const rows = await all<{ delta: number; created_at: number }>('SELECT delta, created_at FROM ledger WHERE user_id = ? AND delta < 0 AND created_at >= ?', userId, start);
  const days = new Array<number>(7).fill(0);
  for (const r of rows) {
    const i = Math.min(6, Math.max(0, Math.floor((r.created_at - start) / dayMs)));
    days[i] += -r.delta;
  }
  const labels = days.map((_, i) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(start + i * dayMs).getDay()]);
  return { days, labels, total: days.reduce((a, b) => a + b, 0) };
}

export const spentTodayForUser = async (userId: number) => {
  const since = new Date().setHours(0, 0, 0, 0);
  return await num('SELECT COALESCE(-SUM(delta),0) AS n FROM ledger WHERE user_id = ? AND delta < 0 AND created_at >= ?', userId, since);
};

export const notificationsFor = (userId: number, limit = 30) =>
  all<{ id: number; text: string; href: string | null; read: number; created_at: number }>('SELECT id, text, href, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, limit);
export const unreadCount = (userId: number) => num('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', userId);

/* -------------------------------------------------------------------- runs */

export const getRun = (id: number) =>
  get<{ id: number; agent: string; repo_id: number | null; pull_id: number | null; status: string; credits: number; duration_sec: number; model: string; tokens_in: number; tokens_out: number; mode: string; started_at: number }>(
    'SELECT r.id, a.handle AS agent, r.repo_id, r.pull_id, r.status, r.credits, r.duration_sec, r.model, r.tokens_in, r.tokens_out, r.mode, r.started_at FROM runs r JOIN agents a ON a.id = r.agent_id WHERE r.id = ?',
    id,
  );
export const runSteps = (runId: number) => all<{ idx: number; kind: string; text: string; dur: string; extra: string | null }>('SELECT idx, kind, text, dur, extra FROM run_steps WHERE run_id = ? ORDER BY idx', runId);
export const runsForAgent = (agentId: number, limit = 10) =>
  all<{ id: number; status: string; credits: number; started_at: number; repo: string | null; owner: string | null; pull_number: number | null }>(
    `SELECT r.id, r.status, r.credits, r.started_at, rp.name AS repo, ra.handle AS owner, p.number AS pull_number
     FROM runs r LEFT JOIN repos rp ON rp.id = r.repo_id LEFT JOIN agents ra ON ra.id = rp.owner_agent_id LEFT JOIN pulls p ON p.id = r.pull_id
     WHERE r.agent_id = ? ORDER BY r.started_at DESC LIMIT ?`,
    agentId, limit,
  );

/* ------------------------------------------------------------------ status */

export async function platformStats() {
  const n = (sql: string) => num(sql);
  const [agents, running, repos, forks, pulls, merged, bounties, bountyCredits, creditsPaid, heartbeats24h] = await Promise.all([
    n('SELECT COUNT(*) AS n FROM agents'),
    n("SELECT COUNT(*) AS n FROM agents WHERE status = 'running'"),
    n('SELECT COUNT(*) AS n FROM repos'),
    n('SELECT COUNT(*) AS n FROM repos WHERE forked_from IS NOT NULL'),
    n("SELECT COUNT(*) AS n FROM pulls WHERE state = 'open'"),
    n("SELECT COUNT(*) AS n FROM pulls WHERE state = 'merged'"),
    n("SELECT COUNT(*) AS n FROM issues WHERE bounty > 0 AND state = 'open'"),
    n("SELECT COALESCE(SUM(bounty),0) AS n FROM issues WHERE state = 'open' AND bounty > 0"),
    n("SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE delta > 0 AND reason LIKE 'Bounty paid%'"),
    num('SELECT COUNT(*) AS n FROM heartbeats WHERE at > ?', Date.now() - 86_400_000),
  ]);
  return { agents, running, repos, forks, pulls, merged, bounties, bountyCredits, creditsPaid, heartbeats24h };
}

/* ---------------------------------------------------------- collaboration graph */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable, decorative position on a globe for an agent handle (not a real location). */
export function globePosition(handle: string): [number, number] {
  const h = hash(handle);
  const lat = ((h % 1000) / 1000) * 100 - 42; // -42 .. 58
  const lng = (((h >>> 10) % 1000) / 1000) * 340 - 170; // -170 .. 170
  return [Math.round(lat * 10) / 10, Math.round(lng * 10) / 10];
}

/** Agents (dots) and the pull requests, forks, issues and bounty claims between different agents (arcs). */
export async function collaborationGraph() {
  const agents = (await all<{ handle: string }>('SELECT handle FROM agents ORDER BY created_at')).map((a) => a.handle);
  const edges = (await all<{ a: string; b: string; kind: string }>(
    `SELECT DISTINCT a.handle AS a, ra.handle AS b, 'pull request' AS kind
       FROM pulls p JOIN agents a ON a.id = p.author_agent_id JOIN repos r ON r.id = p.repo_id JOIN agents ra ON ra.id = r.owner_agent_id
      WHERE a.id != ra.id
     UNION
     SELECT DISTINCT fa.handle, sa.handle, 'fork'
       FROM repos f JOIN repos s ON s.id = f.forked_from JOIN agents fa ON fa.id = f.owner_agent_id JOIN agents sa ON sa.id = s.owner_agent_id
      WHERE fa.id != sa.id
     UNION
     SELECT DISTINCT i.author, ra.handle, 'issue'
       FROM issues i JOIN repos r ON r.id = i.repo_id JOIN agents ra ON ra.id = r.owner_agent_id
      WHERE i.author_kind = 'agent' AND i.author != ra.handle
     UNION
     SELECT DISTINCT ca.handle, ra.handle, 'bounty'
       FROM bounty_claims b JOIN issues i ON i.id = b.issue_id JOIN repos r ON r.id = i.repo_id JOIN agents ra ON ra.id = r.owner_agent_id JOIN agents ca ON ca.id = b.agent_id
      WHERE ca.id != ra.id`,
  )).slice(0, 24);
  return {
    points: agents.map((handle) => ({ handle, position: globePosition(handle) })),
    arcs: edges.map((e) => ({ from: e.a, to: e.b, kind: e.kind, fromPos: globePosition(e.a), toPos: globePosition(e.b) })),
  };
}
