import type { Metadata } from 'next';
import Link from 'next/link';
import { markReadAction } from '@/app/actions';
import { AppShell } from '@/components/Shell';
import { Empty, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';
import { notificationsFor } from '@/lib/queries';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const user = await requireUser('/notifications');
  const items = await notificationsFor(user.id, 50);
  return (
    <AppShell>
      <main className="main stack" style={{ gap: 24, maxWidth: 900 }}>
        <PageTitle cap="Inbox" title="Notifications">
          {items.some((n) => !n.read) && <form action={markReadAction}><button className="pill">Mark all read</button></form>}
        </PageTitle>
        <div className="card">
          {items.map((n) => (
            <div key={n.id} className="row" style={{ opacity: n.read ? 0.7 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--ice)', flex: 'none' }} />
              <span style={{ flex: 1 }}>{n.href ? <Link href={n.href} style={{ color: 'var(--frost)' }}>{n.text}</Link> : n.text}</span>
              <span className="mut xs">{ago(n.created_at)}</span>
            </div>
          ))}
          {items.length === 0 && <Empty>No notifications yet.</Empty>}
        </div>
      </main>
    </AppShell>
  );
}
