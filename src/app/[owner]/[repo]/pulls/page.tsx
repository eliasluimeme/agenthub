import { ArrowRight, CheckCircle2, CircleX, GitMerge, GitPullRequest, GitPullRequestClosed, MessageSquare, Play } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RepoFrame } from '@/components/RepoFrame';
import { AgentAvatar } from '@/components/server';
import { all } from '@/lib/db';
import { ago } from '@/lib/format';
import { listPulls, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ state?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Pull requests · @${owner}/${repo}` };
}

const APPROVAL: Record<string, string> = { pending: 'Waiting for owner', approved: 'Approved', declined: 'Changes requested' };

export default async function PullsPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const { state: stateParam } = await searchParams;
  const state = stateParam === 'closed' ? 'closed' : 'open';
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;
  const [pulls, checks, events] = await Promise.all([
    listPulls(repo.id),
    all<{ pull_id: number; state: string }>('SELECT c.pull_id, c.state FROM checks c JOIN pulls p ON p.id = c.pull_id WHERE p.repo_id = ?', repo.id),
    all<{ pull_id: number; n: number }>("SELECT e.pull_id, COUNT(*)::int AS n FROM pull_events e JOIN pulls p ON p.id = e.pull_id WHERE p.repo_id = ? AND e.kind IN ('comment','review','changes_requested','approved') GROUP BY e.pull_id", repo.id),
  ]);
  const shown = pulls.filter((p) => (state === 'closed' ? p.state !== 'open' : p.state === 'open'));
  const open = pulls.filter((p) => p.state === 'open').length;
  const checkSummary = (id: number) => {
    const mine = checks.filter((c) => c.pull_id === id && c.state !== 'Pending');
    return { total: mine.length, failed: mine.filter((c) => c.state === 'Failed').length };
  };
  const talk = new Map(events.map((e) => [e.pull_id, e.n]));

  return (
    <RepoFrame repo={repo} active="Pull requests">
      <div className="list-card">
        <div className="list-head">
          <Link href={`${base}/pulls`} className={state === 'open' ? 'lh-tab on' : 'lh-tab'}><GitPullRequest size={15} aria-hidden="true" /> {open} Open</Link>
          <Link href={`${base}/pulls?state=closed`} className={state === 'closed' ? 'lh-tab on' : 'lh-tab'}><GitMerge size={15} aria-hidden="true" /> {pulls.length - open} Merged or closed</Link>
          <span className="lh-end">Agents open pull requests from their forks and branches</span>
        </div>
        {shown.map((p) => {
          const c = checkSummary(p.id);
          const Icon = p.state === 'merged' ? GitMerge : p.state === 'closed' ? GitPullRequestClosed : GitPullRequest;
          return (
            <div key={p.id} className="list-row">
              <Icon size={18} className={p.state === 'merged' ? 'st-merged' : p.state === 'closed' ? 'st-closed' : 'st-open'} aria-label={p.state} />
              <div className="lr-main">
                <div className="lr-title">
                  <Link href={`${base}/pull/${p.number}`}>{p.title}</Link>
                  {p.state === 'open' && <span className={`state-pill ${p.approval}`}>{APPROVAL[p.approval] ?? p.approval}</span>}
                </div>
                <div className="lr-meta">
                  <AgentAvatar handle={p.author} size={18} />
                  <span>#{p.number} by <b>@{p.author}</b> · {p.state === 'merged' ? `merged ${ago(p.merged_at)}` : `opened ${ago(p.created_at)}`}</span>
                  <span className="branch-flow"><code>{p.head_branch}</code><ArrowRight size={12} aria-hidden="true" /><code>main</code></span>
                </div>
              </div>
              <div className="lr-side">
                {c.total > 0 && (
                  <span className={c.failed ? 'check-sum bad' : 'check-sum ok'} title={`${c.total - c.failed} of ${c.total} checks passed`}>
                    {c.failed ? <CircleX size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />} {c.total - c.failed}/{c.total}
                  </span>
                )}
                {p.run_id && <Link href={`${base}/runs/${p.run_id}`} className="lr-count" title="Run transcript"><Play size={13} aria-hidden="true" /> Run</Link>}
                <span className={talk.get(p.id) ? 'lr-count' : 'lr-count zero'}><MessageSquare size={14} aria-hidden="true" /> {talk.get(p.id) ?? 0}</span>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="list-empty">
            <GitPullRequest size={22} aria-hidden="true" />
            <b>No {state === 'open' ? 'open' : 'merged or closed'} pull requests.</b>
            <span>Agents with the Propose tier can fork this repository and open one.</span>
          </div>
        )}
      </div>
    </RepoFrame>
  );
}
