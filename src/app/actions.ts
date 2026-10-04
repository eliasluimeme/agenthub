'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, destroySession, requireUser, safeNext } from '@/lib/auth';
import { runHeartbeat } from '@/lib/heartbeat';
import * as m from '@/lib/mutations';
import { agentByHandle, getIssue, getPull, repoById } from '@/lib/queries';
import type { Agent, User } from '@/lib/types';

export interface FormState {
  error?: string;
  message?: string;
  token?: string;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '');
const int = (f: FormData, k: string, d = 0) => {
  const v = Number.parseInt(str(f, k), 10);
  return Number.isNaN(v) ? d : v;
};

/** Run a mutation, turning expected errors into form state. */
async function guarded(fn: () => Promise<FormState | void> | FormState | void): Promise<FormState> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    if (e instanceof m.ActionError) return { error: e.message };
    throw e; // includes redirect() signals and real bugs
  }
}

async function ownedAgent(user: User, handle: string): Promise<Agent> {
  const agent = await agentByHandle(handle);
  if (!agent || agent.owner_id !== user.id) throw new m.ActionError('You can only manage your own agents.');
  return agent;
}

/* ------------------------------------------------------------------- auth */

export async function signInAction(_prev: FormState, f: FormData): Promise<FormState> {
  return guarded(async () => {
    const user = await m.signIn(str(f, 'email'), str(f, 'password'));
    await createSession(user.id);
    redirect(safeNext(str(f, 'next')));
  });
}

export async function signUpAction(_prev: FormState, f: FormData): Promise<FormState> {
  return guarded(async () => {
    const user = await m.signUp({ email: str(f, 'email'), name: str(f, 'name'), password: str(f, 'password') });
    await createSession(user.id);
    redirect('/agents/new');
  });
}

export async function signOutAction() {
  await destroySession();
  redirect('/');
}

/* ----------------------------------------------------------------- agents */

function agentInput(f: FormData): m.AgentInput {
  return {
    handle: str(f, 'handle'),
    provider: str(f, 'provider'),
    model: str(f, 'model'),
    apiKey: str(f, 'apiKey'),
    instructions: str(f, 'instructions'),
    tier: int(f, 'tier', 1),
    color: /^#[0-9a-f]{6}$/i.test(str(f, 'color')) ? str(f, 'color') : '#663af3',
    dailyCap: int(f, 'dailyCap', 100),
    intervalHours: int(f, 'intervalHours', 4),
    variance: int(f, 'variance', 20),
    askMerge: f.get('askMerge') === 'on',
    askSpend: int(f, 'askSpend', 25),
  };
}

export async function createAgentAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser('/agents/new');
  return guarded(async () => {
    const { agent, token } = await m.createAgent(user.id, agentInput(f));
    revalidatePath('/dashboard');
    (await cookies()).set('ah_flash', token, { httpOnly: true, sameSite: 'lax', path: '/agents', maxAge: 120 });
    redirect(`/agents/${agent.handle}?welcome=1`);
  });
}

export async function updateAgentAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, str(f, 'handle'));
    await m.updateAgent(agent, agentInput(f));
    revalidatePath(`/agents/${agent.handle}`);
    return { message: 'Saved.' };
  });
}

export async function setAgentStatusAction(handle: string, status: 'running' | 'paused') {
  const user = await requireUser();
  const agent = await ownedAgent(user, handle);
  await m.setAgentStatus(agent, status);
  revalidatePath('/', 'layout');
}

export async function runHeartbeatAction(handle: string): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, handle);
    const res = await runHeartbeat(agent.id, { force: true });
    revalidatePath('/', 'layout');
    return { message: `${res.status === 'ok' ? 'Checked in' : 'Skipped'}: ${res.note}` };
  });
}

export async function rotateTokenAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, str(f, 'handle'));
    return { token: await m.rotateAgentToken(agent), message: 'New token created. Copy it now, it is shown once.' };
  });
}

export async function deleteAgentAction(handle: string): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, handle);
    await m.deleteAgent(agent);
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  });
}

/* ------------------------------------------------------------------ repos */

export async function createRepoAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, str(f, 'agent'));
    const repo = await m.createRepo(agent, str(f, 'name').trim(), str(f, 'description'), str(f, 'topics').split(',').map((t) => t.trim()).filter(Boolean));
    revalidatePath('/', 'layout');
    redirect(`/${repo.owner}/${repo.name}`);
  });
}

export async function updateRepoAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const repo = await repoById(int(f, 'repoId'));
    if (!repo || !await m.userMaintainsRepo(user.id, repo.id)) throw new m.ActionError('Only the repository owner can edit it.');
    await m.updateRepo(repo.id, str(f, 'description'), str(f, 'topics').split(',').map((t) => t.trim()).filter(Boolean));
    revalidatePath(`/${repo.owner}/${repo.name}`, 'layout');
    return { message: 'Saved.' };
  });
}

export async function forkRepoAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, str(f, 'agent'));
    const repo = await m.forkRepo(int(f, 'repoId'), agent);
    revalidatePath('/', 'layout');
    redirect(`/${repo.owner}/${repo.name}`);
  });
}

export async function toggleStarAction(repoId: number, kind: 'star' | 'watch') {
  const user = await requireUser();
  await m.toggleStar(user.id, repoId, kind);
  const repo = await repoById(repoId);
  if (repo) revalidatePath(`/${repo.owner}/${repo.name}`, 'layout');
}

/* ----------------------------------------------------------------- issues */

export async function createIssueAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const repo = await repoById(int(f, 'repoId'));
    if (!repo) throw new m.ActionError('Repository not found.');
    const number = await m.createIssue(
      repo.id,
      { handle: user.handle, kind: 'user' },
      { title: str(f, 'title'), body: str(f, 'body'), labels: str(f, 'labels').split(',').map((l) => l.trim()).filter(Boolean), bounty: int(f, 'bounty') },
      user.id,
    );
    revalidatePath(`/${repo.owner}/${repo.name}`, 'layout');
    redirect(`/${repo.owner}/${repo.name}/issues/${number}`);
  });
}

export async function commentAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const kind = str(f, 'kind') === 'pull' ? 'pull' : 'issue';
    const repo = await repoById(int(f, 'repoId'));
    if (!repo) throw new m.ActionError('Repository not found.');
    const number = int(f, 'number');
    if (kind === 'issue') {
      const issue = await getIssue(repo.id, number);
      if (!issue) throw new m.ActionError('Issue not found.');
      const wantsState = f.get('close') === '1' || f.get('reopen') === '1';
      if (wantsState && !await m.canManageIssue(user, issue)) throw new m.ActionError('Only the issue author, the repository owner or the assignee can change its state.');
      await m.addComment('issue', issue.id, { handle: user.handle, kind: 'user' }, str(f, 'body'));
      if (f.get('close') === '1') await m.setIssueState(issue, 'closed');
      if (f.get('reopen') === '1') await m.setIssueState(issue, 'open');
    } else {
      const pull = await getPull(repo.id, number);
      if (!pull) throw new m.ActionError('Pull request not found.');
      await m.addPullEvent(pull, { handle: user.handle, kind: 'user' }, 'comment', str(f, 'body'));
    }
    revalidatePath(`/${repo.owner}/${repo.name}`, 'layout');
    return { message: 'Posted.' };
  });
}

export async function setIssueStateAction(repoId: number, number: number, state: 'open' | 'closed'): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const repo = await repoById(repoId);
    const issue = repo && await getIssue(repo.id, number);
    if (!repo || !issue) throw new m.ActionError('Issue not found.');
    if (!await m.canManageIssue(user, issue)) throw new m.ActionError('Only the issue author, the repository owner or the assignee can change its state.');
    await m.setIssueState(issue, state);
    revalidatePath(`/${repo.owner}/${repo.name}`, 'layout');
  });
}

export async function claimBountyAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const agent = await ownedAgent(user, str(f, 'agent'));
    const repo = await repoById(int(f, 'repoId'));
    const issue = repo && await getIssue(repo.id, int(f, 'number'));
    if (!repo || !issue) throw new m.ActionError('Issue not found.');
    await m.claimBounty(issue, agent, str(f, 'plan'));
    revalidatePath('/', 'layout');
    return { message: `@${agent.handle} claimed this bounty. It will start on its next check-in.` };
  });
}

/* ------------------------------------------------------------------ pulls */

export async function mergePullAction(repoId: number, number: number): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const repo = await repoById(repoId);
    const pull = repo && await getPull(repo.id, number);
    if (!repo || !pull) throw new m.ActionError('Pull request not found.');
    if (!await m.userMaintainsRepo(user.id, repo.id)) throw new m.ActionError(`Only the owner of @${repo.owner} can merge into this repository.`);
    await m.mergePull(pull.id, `@${user.handle}`);
    revalidatePath('/', 'layout');
    return { message: 'Merged.' };
  });
}

export async function closePullAction(repoId: number, number: number): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const repo = await repoById(repoId);
    const pull = repo && await getPull(repo.id, number);
    if (!repo || !pull) throw new m.ActionError('Pull request not found.');
    if (!await m.userMaintainsRepo(user.id, repo.id) && pull.author_owner_id !== user.id) throw new m.ActionError('You cannot close this pull request.');
    await m.closePull(pull, user.handle);
    revalidatePath('/', 'layout');
    return { message: 'Closed.' };
  });
}

export async function requestChangesAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    const repo = await repoById(int(f, 'repoId'));
    const pull = repo && await getPull(repo.id, int(f, 'number'));
    if (!repo || !pull) throw new m.ActionError('Pull request not found.');
    if (!await m.userMaintainsRepo(user.id, repo.id)) throw new m.ActionError('Only the repository owner can request changes.');
    await m.addPullEvent(pull, { handle: user.handle, kind: 'user' }, 'changes_requested', str(f, 'body') || 'Changes requested.');
    revalidatePath('/', 'layout');
    return { message: 'Requested changes.' };
  });
}

/* -------------------------------------------------------------- approvals */

export async function resolveApprovalAction(id: number, approve: boolean): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    await m.resolveApproval(id, user, approve);
    revalidatePath('/', 'layout');
    return { message: approve ? 'Approved.' : 'Declined.' };
  });
}

/* ---------------------------------------------------------------- credits */

export async function tipAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    await m.tipAgent(user, str(f, 'handle'), int(f, 'amount'));
    revalidatePath('/', 'layout');
    return { message: 'Tip sent. Thank you.' };
  });
}

export async function topUpAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    await m.addTestCredits(user.id, int(f, 'amount'));
    revalidatePath('/', 'layout');
    return { message: 'Credits added.' };
  });
}

/* ----------------------------------------------------------------- account */

export async function markReadAction() {
  const user = await requireUser();
  await m.markNotificationsRead(user.id);
  revalidatePath('/', 'layout');
}

export async function updateProfileAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  return guarded(async () => {
    await m.updateProfile(user.id, str(f, 'name'));
    revalidatePath('/', 'layout');
    return { message: 'Saved.' };
  });
}
