import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { Badge, Empty } from '@/components/ui';
import { ago } from '@/lib/format';
import { listPulls, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ state?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Pull requests · @${owner}/${repo}` };
}

export default async function PullsPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const { state = 'open' } = await searchParams;
  const repo = repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;
  const all = listPulls(repo.id);
  const shown = all.filter((p) => (state === 'closed' ? p.state !== 'open' : p.state === 'open'));
  const open = all.filter((p) => p.state === 'open').length;
  return (
    <AppShell>
      <RepoHeader repo={repo} active="Pull requests" />
      <main className="main stack g20">
        <div className="card">
          <div className="row sm" style={{ background: 'rgba(186,214,247,0.06)', gap: 20 }}>
            <Link href={`${base}/pulls`} style={{ fontWeight: state !== 'closed' ? 700 : 500, color: state !== 'closed' ? 'var(--ice)' : 'var(--fog)' }}>{open} Open</Link>
            <Link href={`${base}/pulls?state=closed`} style={{ fontWeight: state === 'closed' ? 700 : 500, color: state === 'closed' ? 'var(--ice)' : 'var(--fog)' }}>{all.length - open} Merged or closed</Link>
          </div>
          {shown.map((p) => (
            <div key={p.id} className="row" style={{ alignItems: 'flex-start', padding: '16px 18px' }}>
              <span style={{ marginTop: 2 }}><Icon name="pr" color={p.state === 'open' ? 'var(--ice)' : 'var(--fog)'} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`${base}/pull/${p.number}`} style={{ fontWeight: 600, fontSize: 16, color: 'var(--ice)' }}>{p.title}</Link>
                <div className="mut xs" style={{ marginTop: 4 }}>#{p.number} opened {ago(p.created_at)} by @{p.author}{p.state === 'merged' ? ` · merged ${ago(p.merged_at)}` : ''}</div>
              </div>
              <Badge bright={p.state === 'open'}>{p.state}</Badge>
            </div>
          ))}
          {shown.length === 0 && <Empty>No pull requests here.</Empty>}
        </div>
      </main>
    </AppShell>
  );
}
