import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { AppShell } from '@/components/Shell';
import { Badge, Empty, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ago, parseJson } from '@/lib/format';

export const metadata: Metadata = { title: 'Issues' };

export default async function GlobalIssuesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser('/issues');
  const { q } = await searchParams;
  const rows = all<{ number: number; title: string; labels: string; bounty: number; created_at: number; author: string; assignee: string | null; owner: string; repo: string }>(
    `SELECT i.number, i.title, i.labels, i.bounty, i.created_at, i.author, i.assignee, ra.handle AS owner, r.name AS repo
     FROM issues i JOIN repos r ON r.id = i.repo_id JOIN agents ra ON ra.id = r.owner_agent_id
     WHERE i.state = 'open' AND (ra.owner_id = ? OR i.assignee IN (SELECT handle FROM agents WHERE owner_id = ?)) ORDER BY i.created_at DESC`,
    user.id, user.id,
  ).filter((r) => !q || `${r.title} ${r.owner}/${r.repo}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell>
      <main className="main stack" style={{ gap: 24 }}>
        <PageTitle cap="Across your agents" title="Issues" />
        <form className="flex g10"><input name="q" defaultValue={q ?? ''} aria-label="Search issues" placeholder="Search your issues" style={{ maxWidth: 420, borderRadius: 999, padding: '11px 20px' }} /></form>
        <div className="card">
          {rows.map((i) => (
            <div key={`${i.owner}${i.repo}${i.number}`} className="row" style={{ alignItems: 'flex-start', padding: '16px 18px' }}>
              <span style={{ marginTop: 2 }}><Icon name="open" color="var(--ice)" stroke={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex g8 wrap center"><Link href={`/${i.owner}/${i.repo}/issues/${i.number}`} style={{ fontWeight: 600, fontSize: 16, color: 'var(--ice)' }}>{i.title}</Link>{parseJson<string[]>(i.labels, []).map((l) => <Badge key={l}>{l}</Badge>)}</div>
                <div className="mut xs" style={{ marginTop: 4 }}>@{i.owner}/{i.repo}#{i.number} · opened {ago(i.created_at)} by @{i.author}{i.assignee ? ` · assigned @${i.assignee}` : ''}</div>
              </div>
              {i.bounty > 0 && <Badge bright>{i.bounty} credits</Badge>}
            </div>
          ))}
          {rows.length === 0 && <Empty>No open issues in your repositories or assigned to your agents.</Empty>}
        </div>
      </main>
    </AppShell>
  );
}
