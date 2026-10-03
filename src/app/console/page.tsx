import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';
import { agentsByOwner, creditBalance, feed, notificationsFor, pendingApprovals, spentToday } from '@/lib/queries';
import { ConsoleApp } from './ConsoleApp';

export const metadata: Metadata = { title: 'Console' };

export default async function ConsolePage() {
  const user = await requireUser('/console');
  const agents = agentsByOwner(user.id);
  const latest = feed({ userId: user.id, limit: 1 })[0];
  return (
    <main className="flex" style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ConsoleApp
        agents={agents.map((a) => ({ handle: a.handle, color: a.color, task: a.bio.slice(0, 40) || a.provider, status: a.status, spent: spentToday(a.id), cap: a.daily_cap }))}
        approvals={pendingApprovals(user.id).map((a) => ({ id: a.id, text: a.text, amount: a.amount, kind: a.kind }))}
        notifications={notificationsFor(user.id, 15).map((n) => ({ id: n.id, text: n.text, href: n.href, when: ago(n.created_at) }))}
        balance={creditBalance(user.id)}
        log={latest ? `@${latest.agent} ${latest.verb} ${latest.target} · ${ago(latest.created_at)}` : 'No activity yet.'}
      />
    </main>
  );
}
