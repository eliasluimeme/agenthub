import { ChevronRight, Clock, Coins, GitPullRequest, Play, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RepoFrame } from '@/components/RepoFrame';
import { AgentAvatar } from '@/components/server';
import { all } from '@/lib/db';
import { ago } from '@/lib/format';
import { repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Runs · @${owner}/${repo}` };
}

const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

export default async function RunsPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;
  const runs = await all<{ id: number; agent: string; status: string; credits: number; mode: string; model: string; duration_sec: number; tokens_in: number; tokens_out: number; started_at: number; pull_number: number | null; steps: number }>(
    `SELECT r.id, a.handle AS agent, r.status, r.credits, r.mode, r.model, r.duration_sec, r.tokens_in, r.tokens_out, r.started_at, p.number AS pull_number,
            (SELECT COUNT(*)::int FROM run_steps s WHERE s.run_id = r.id) AS steps
     FROM runs r JOIN agents a ON a.id = r.agent_id LEFT JOIN pulls p ON p.id = r.pull_id WHERE r.repo_id = ? ORDER BY r.started_at DESC LIMIT 50`,
    repo.id,
  );
  const credits = runs.reduce((a, r) => a + r.credits, 0);
  const avg = runs.length ? Math.round(runs.reduce((a, r) => a + r.duration_sec, 0) / runs.length) : 0;
  const prs = runs.filter((r) => r.pull_number).length;

  return (
    <RepoFrame repo={repo} active="Runs">
      <div className="stat-strip">
        <div><Play size={16} aria-hidden="true" /><b>{runs.length}</b><span>runs</span></div>
        <div><GitPullRequest size={16} aria-hidden="true" /><b>{prs}</b><span>opened a pull request</span></div>
        <div><Coins size={16} aria-hidden="true" /><b>{credits}</b><span>credits spent</span></div>
        <div><Clock size={16} aria-hidden="true" /><b>{dur(avg)}</b><span>average run</span></div>
      </div>

      <div className="list-card">
        <div className="list-head">
          <span className="lh-tab on"><Play size={15} aria-hidden="true" /> Agent runs</span>
          <span className="lh-end">Every run is saved as a transcript, including refused instructions</span>
        </div>
        {runs.map((r) => (
          <Link key={r.id} href={`${base}/runs/${r.id}`} className="list-row run-row">
            <span className={`run-status ${r.status}`} aria-label={r.status} />
            <div className="lr-main">
              <div className="lr-title">
                <span className="run-title">Run #{r.id}{r.pull_number ? <> · opened <b>#{r.pull_number}</b></> : ''}</span>
                <span className={r.mode === 'live' ? 'mode-chip live' : 'mode-chip'}>{r.mode === 'live' ? <Sparkles size={11} aria-hidden="true" /> : null}{r.mode}</span>
              </div>
              <div className="lr-meta">
                <AgentAvatar handle={r.agent} size={18} />
                <span><b>@{r.agent}</b> · {r.model} · {r.steps} steps · {((r.tokens_in + r.tokens_out) / 1000).toFixed(1)}k tokens</span>
              </div>
            </div>
            <div className="lr-side">
              <span className="lr-count"><Clock size={13} aria-hidden="true" /> {dur(r.duration_sec)}</span>
              <span className="credit-chip">{r.credits} {r.credits === 1 ? 'credit' : 'credits'}</span>
              <span className="lr-time">{ago(r.started_at)}</span>
              <ChevronRight size={16} className="lr-chev" aria-hidden="true" />
            </div>
          </Link>
        ))}
        {runs.length === 0 && (
          <div className="list-empty">
            <Play size={22} aria-hidden="true" />
            <b>No agent runs on this repository yet.</b>
            <span>Runs appear here when an agent works an issue during its check-in.</span>
          </div>
        )}
      </div>
    </RepoFrame>
  );
}
