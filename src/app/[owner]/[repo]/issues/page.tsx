import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { Badge, Empty } from '@/components/ui';
import { ago, parseJson } from '@/lib/format';
import { listIssues, repoBy, repoCounts } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ state?: string; q?: string; label?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Issues · @${owner}/${repo}` };
}

export default async function IssuesPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const sp = await searchParams;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const state = sp.state === 'closed' ? 'closed' : 'open';
  const base = `/${owner}/${name}`;
  const counts = await repoCounts(repo.id);
  const issues = await listIssues(repo.id, { state, q: sp.q, label: sp.label });
  const labels = [...new Set((await listIssues(repo.id)).flatMap((i) => parseJson<string[]>(i.labels, [])))].sort();
  const href = (s: string) => `${base}/issues?${new URLSearchParams({ state: s, ...(sp.q ? { q: sp.q } : {}), ...(sp.label ? { label: sp.label } : {}) })}`;

  return (
    <AppShell>
      <RepoHeader repo={repo} active="Issues" />
      <main className="main stack g20">
        <div className="flex wrap center g10">
          <form className="flex g10" style={{ flex: '1 1 320px' }}>
            <input type="hidden" name="state" value={state} />
            {sp.label && <input type="hidden" name="label" value={sp.label} />}
            <input name="q" defaultValue={sp.q ?? ''} aria-label="Search issues" placeholder="Search issues" style={{ borderRadius: 999, padding: '11px 20px', fontSize: 14 }} />
          </form>
          <details className="menu">
            <summary className="pill">Labels{sp.label ? `: ${sp.label}` : ''}</summary>
            <div className="menu-panel" style={{ left: 0, right: 'auto' }}>
              <Link href={href(state).replace(/&?label=[^&]*/, '')}>All labels</Link>
              {labels.map((l) => <Link key={l} href={`${href(state).replace(/&?label=[^&]*/, '')}&label=${encodeURIComponent(l)}`}>{l}</Link>)}
            </div>
          </details>
          <Link href={`${base}/issues/new`} className="btn">New issue</Link>
        </div>

        <div className="card">
          <div className="row sm" style={{ background: 'rgba(186,214,247,0.06)', gap: 20 }}>
            <Link href={href('open')} style={{ fontWeight: state === 'open' ? 700 : 500, color: state === 'open' ? 'var(--ice)' : 'var(--fog)' }}>{counts.open} Open</Link>
            <Link href={href('closed')} style={{ fontWeight: state === 'closed' ? 700 : 500, color: state === 'closed' ? 'var(--ice)' : 'var(--fog)' }}>{counts.closed} Closed</Link>
            <span className="mut" style={{ marginLeft: 'auto' }}>{counts.bounties} with bounties</span>
          </div>
          {issues.map((i) => (
            <div key={i.id} className="row" style={{ alignItems: 'flex-start', padding: '16px 18px' }}>
              <span style={{ marginTop: 2 }}><Icon name={i.state === 'open' ? 'open' : 'closed'} color={i.state === 'open' ? 'var(--ice)' : 'var(--fog)'} stroke={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex g8 wrap center">
                  <Link href={`${base}/issues/${i.number}`} style={{ fontWeight: 600, fontSize: 16, color: 'var(--ice)' }}>{i.title}</Link>
                  {parseJson<string[]>(i.labels, []).map((l) => <Badge key={l}>{l}</Badge>)}
                </div>
                <div className="mut xs" style={{ marginTop: 4 }}>#{i.number} {i.state === 'open' ? 'opened' : 'closed'} {ago(i.state === 'open' ? i.created_at : i.closed_at)} by @{i.author}{i.assignee ? ` · assigned @${i.assignee}` : ''}</div>
              </div>
              <div className="flex g10 center">
                {i.bounty > 0 && <Badge bright>{i.bounty} credits</Badge>}
                <span className="mut xs">{i.comment_count} comments</span>
              </div>
            </div>
          ))}
          {issues.length === 0 && <Empty>No {state} issues{sp.q ? ` matching “${sp.q}”` : ''}.</Empty>}
        </div>
      </main>
    </AppShell>
  );
}
