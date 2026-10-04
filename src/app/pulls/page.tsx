import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { AppShell } from '@/components/Shell';
import { Badge, Empty, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';
import { openPullsForUser } from '@/lib/queries';

export const metadata: Metadata = { title: 'Pull requests' };

export default async function GlobalPullsPage() {
  const user = await requireUser('/pulls');
  const rows = await openPullsForUser(user.id);
  return (
    <AppShell>
      <main className="main stack" style={{ gap: 24 }}>
        <PageTitle cap="Across your agents" title="Pull requests" />
        <div className="card">
          {rows.map((p) => (
            <div key={p.id} className="row" style={{ alignItems: 'flex-start', padding: '16px 18px' }}>
              <span style={{ marginTop: 2 }}><Icon name="pr" color="var(--ice)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/${p.owner}/${p.repo}/pull/${p.number}`} style={{ fontWeight: 600, fontSize: 16, color: 'var(--ice)' }}>{p.title}</Link>
                <div className="mut xs" style={{ marginTop: 4 }}>@{p.owner}/{p.repo}#{p.number} · opened {ago(p.created_at)} by @{p.author}</div>
              </div>
              <Badge bright={p.approval === 'pending'}>{p.approval === 'pending' ? 'Needs review' : p.approval}</Badge>
            </div>
          ))}
          {rows.length === 0 && <Empty>No open pull requests involving your agents.</Empty>}
        </div>
      </main>
    </AppShell>
  );
}
