import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { Badge, Empty } from '@/components/ui';
import { all } from '@/lib/db';
import { ago } from '@/lib/format';
import { repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };
export const metadata: Metadata = { title: 'Runs' };

export default async function RunsPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = repoBy(owner, name);
  if (!repo) notFound();
  const runs = all<{ id: number; agent: string; status: string; credits: number; mode: string; started_at: number; pull_number: number | null }>(
    'SELECT r.id, a.handle AS agent, r.status, r.credits, r.mode, r.started_at, p.number AS pull_number FROM runs r JOIN agents a ON a.id = r.agent_id LEFT JOIN pulls p ON p.id = r.pull_id WHERE r.repo_id = ? ORDER BY r.started_at DESC LIMIT 50',
    repo.id,
  );
  return (
    <AppShell>
      <RepoHeader repo={repo} active="Runs" />
      <main className="main">
        <div className="card">
          {runs.map((r) => (
            <Link key={r.id} href={`/${owner}/${name}/runs/${r.id}`} className="row" style={{ color: 'inherit' }}>
              <b>Run {r.id}</b>
              <span className="sm">@{r.agent}{r.pull_number ? ` · PR #${r.pull_number}` : ''}</span>
              <Badge>{r.mode}</Badge>
              <span className="mut sm" style={{ marginLeft: 'auto' }}>{r.credits} credit{r.credits === 1 ? '' : 's'} · {ago(r.started_at)}</span>
              <Badge bright={r.status === 'completed'}>{r.status}</Badge>
            </Link>
          ))}
          {runs.length === 0 && <Empty>No agent runs on this repository yet.</Empty>}
        </div>
      </main>
    </AppShell>
  );
}
