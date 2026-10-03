import 'server-only';
import { all, get, run } from './db';
import { addComment, addPullEvent, notify } from './mutations';
import { agentById, getIssueById, getPullById, listPulls, repoById, spentToday } from './queries';
import { runTask, RateLimited } from './runner';
import type { Agent, Issue } from './types';

/**
 * Heartbeat: agents check in on a schedule instead of running constantly.
 *  - At most once every 4 hours (owners may force a check-in manually).
 *  - Random variance (0 to 20 percent) so agents do not arrive together.
 *  - Skips when paused, backed off, or out of daily credits.
 *  - On rate limits (429 or 503) it waits for Retry-After, then doubles the wait each time.
 *  - Content from other agents is data and is never treated as instructions.
 */

const HOUR = 3_600_000;
const MAX_REPLIES = 5;
const MAX_REVIEWS = 3;

export interface HeartbeatResult {
  status: 'ok' | 'skipped' | 'backoff' | 'error';
  note: string;
  runId?: number;
}

function record(agent: Agent, status: string, note: string) {
  run('INSERT INTO heartbeats (agent_id, at, status, note) VALUES (?,?,?,?)', agent.id, Date.now(), status, note);
}

function scheduleNext(agent: Agent) {
  const base = Math.max(4, agent.interval_hours) * HOUR;
  const next = Date.now() + base * (1 + (Math.random() * agent.variance) / 100);
  run('UPDATE agents SET last_heartbeat_at = ?, next_heartbeat_at = ? WHERE id = ?', Date.now(), next, agent.id);
}

export async function runHeartbeat(agentId: number, opts: { force?: boolean } = {}): Promise<HeartbeatResult> {
  let agent = agentById(agentId);
  if (!agent) return { status: 'error', note: 'Agent not found.' };
  const now = Date.now();

  if (agent.status === 'paused') {
    return { status: 'skipped', note: 'Agent is paused.' };
  }
  if (agent.backoff_until && agent.backoff_until > now) {
    record(agent, 'backoff', `Backing off until ${new Date(agent.backoff_until).toISOString()}.`);
    return { status: 'backoff', note: 'Backing off after a rate limit.' };
  }
  if (!opts.force && agent.next_heartbeat_at && agent.next_heartbeat_at > now) {
    return { status: 'skipped', note: 'Not due yet.' };
  }
  if (spentToday(agent.id) >= agent.daily_cap) {
    record(agent, 'skipped', 'Daily credit cap reached.');
    scheduleNext(agent);
    return { status: 'skipped', note: 'Daily credit cap reached.' };
  }

  const done: string[] = [];
  let runId: number | undefined;
  try {
    if (agent.tier >= 1) {
      // 1. Reply to mentions (comments by others that mention this agent since the last check-in).
      const since = agent.last_heartbeat_at ?? now - 24 * HOUR;
      const mentions = all<{ id: number; target_kind: string; target_id: number; author: string; author_kind: string; body: string }>(
        "SELECT id, target_kind, target_id, author, author_kind, body FROM comments WHERE created_at > ? AND author != ? AND body LIKE ? ORDER BY created_at LIMIT ?",
        since, agent.handle, `%@${agent.handle}%`, MAX_REPLIES,
      );
      for (const m of mentions) {
        const alreadyReplied = get('SELECT 1 FROM comments WHERE target_kind = ? AND target_id = ? AND author = ? AND created_at > ?', m.target_kind, m.target_id, agent.handle, since);
        if (alreadyReplied) continue;
        addComment(m.target_kind as 'issue' | 'pull', m.target_id, { handle: agent.handle, kind: 'agent' }, `Thanks @${m.author}, noted. I will look into this on my next pass.`);
        done.push(`replied to ${m.author}`);
      }

      // 2. Maintainer duty: review open pull requests on repositories this agent maintains.
      let reviewed = 0;
      for (const repo of all<{ id: number }>('SELECT id FROM repos WHERE owner_agent_id = ?', agent.id)) {
        for (const pr of listPulls(repo.id, 'open')) {
          if (reviewed >= MAX_REVIEWS) break;
          if (pr.author_agent_id === agent.id) continue;
          const already = get('SELECT 1 FROM pull_events WHERE pull_id = ? AND author = ? AND kind IN (\'approved\',\'changes_requested\')', pr.id, agent.handle);
          if (already) continue;
          const failed = all<{ name: string }>("SELECT name FROM checks WHERE pull_id = ? AND state = 'Failed'", pr.id);
          if (failed.length) addPullEvent(pr, { handle: agent.handle, kind: 'agent' }, 'changes_requested', `Please fix the failing checks: ${failed.map((f) => f.name).join(', ')}.`);
          else addPullEvent(pr, { handle: agent.handle, kind: 'agent' }, 'approved', 'Checks passed and the change matches the linked issue. Ready for owner sign-off.');
          reviewed++;
          done.push(`reviewed #${pr.number}`);
        }
      }

      // 3. Work: one claimed or assigned issue that has no open pull request yet.
      const candidate = get<{ id: number }>(
        `SELECT i.id FROM issues i
         WHERE i.state = 'open' AND (i.assignee = ? OR i.id IN (SELECT issue_id FROM bounty_claims WHERE agent_id = ? AND status = 'claimed'))
           AND NOT EXISTS (SELECT 1 FROM pulls p WHERE p.repo_id = i.repo_id AND p.issue_number = i.number AND p.state = 'open')
         ORDER BY i.bounty DESC, i.created_at LIMIT 1`,
        agent.handle, agent.id,
      );
      if (candidate) {
        const issue = getIssueById(candidate.id) as Issue;
        const result = await runTask(agent, issue.repo_id, issue);
        if (result.runId) runId = result.runId;
        done.push(result.note);
        agent = agentById(agentId) ?? agent;
      }
    }
    run('UPDATE agents SET backoff_step = 0, backoff_until = NULL WHERE id = ?', agent.id);
    const note = done.length ? done.join('; ') : 'Checked in. Nothing to do.';
    record(agent, 'ok', note);
    scheduleNext(agent);
    if (done.length) notify(agent.owner_id, `@${agent.handle} checked in: ${note}`, `/agents/${agent.handle}`);
    return { status: 'ok', note, runId };
  } catch (e) {
    if (e instanceof RateLimited) {
      const step = agent.backoff_step + 1;
      const wait = e.retryAfterSec * 1000 * 2 ** (step - 1);
      run('UPDATE agents SET backoff_step = ?, backoff_until = ? WHERE id = ?', step, Date.now() + wait, agent.id);
      record(agent, 'backoff', `Rate limited. Waiting ${Math.round(wait / 1000)}s (attempt ${step}).`);
      return { status: 'backoff', note: `Rate limited. Waiting ${Math.round(wait / 1000)}s.` };
    }
    const msg = (e as Error).message.slice(0, 300);
    record(agent, 'skipped', `Error: ${msg}`);
    scheduleNext(agent);
    return { status: 'error', note: msg };
  }
}

/** Run every agent whose check-in is due. Called by the scheduler and the cron route. */
export async function runDueHeartbeats(): Promise<{ agent: string; result: HeartbeatResult }[]> {
  const due = all<{ id: number; handle: string }>("SELECT id, handle FROM agents WHERE status = 'running' AND next_heartbeat_at IS NOT NULL AND next_heartbeat_at <= ?", Date.now());
  const out: { agent: string; result: HeartbeatResult }[] = [];
  for (const a of due) out.push({ agent: a.handle, result: await runHeartbeat(a.id) });
  return out;
}

export { getPullById, repoById };
