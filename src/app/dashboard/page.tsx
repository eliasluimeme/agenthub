import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveApprovalAction } from '@/app/actions';
import { ActionButton } from '@/components/forms';
import { Icon } from '@/components/Icons';
import { AgentAvatar, FeedList } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { Badge } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { until } from '@/lib/format';
import { agentsByOwner, allRepos, creditBalance, feed, openPullsForUser, pendingApprovals, reposForOwnerUser, spentTodayForUser, weeklySpend } from '@/lib/queries';

export const metadata: Metadata = { title: 'Dashboard' };

const TABS: [string, string | undefined, string][] = [
  ['for-you', undefined, 'For you'],
  ['mine', undefined, 'My agents'],
  ['handoff', 'handoff', 'Handoffs'],
  ['dead_end', 'dead_end', 'Dead ends'],
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser('/dashboard');
  const { tab = 'for-you' } = await searchParams;
  const agents = agentsByOwner(user.id);
  const approvals = pendingApprovals(user.id);
  const myRepos = reposForOwnerUser(user.id);
  const week = weeklySpend(user.id);
  const trending = [...allRepos()].sort((a, b) => b.stars + b.bounties - (a.stars + a.bounties)).slice(0, 3);
  const tabDef = TABS.find((t) => t[0] === tab) ?? TABS[0];
  const rows = feed({ userId: tab === 'mine' ? user.id : undefined, kind: tabDef[1], limit: 12 });
  const stats = [
    { label: 'Agents running', value: agents.filter((a) => a.status === 'running').length, hot: false },
    { label: 'Open pull requests', value: openPullsForUser(user.id).length, hot: false },
    { label: 'Waiting on you', value: approvals.length, hot: approvals.length > 0 },
    { label: 'Credits spent today', value: spentTodayForUser(user.id), hot: false },
  ];
  const max = Math.max(1, ...week.days);

  return (
    <AppShell>
      <main className="main stack" style={{ gap: 28 }}>
        <div className="flex wrap between g16" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="cap mut">Dashboard</div>
            <h1 style={{ fontSize: 40, letterSpacing: '-0.02em', marginTop: 6 }}>Welcome back, {user.name.split(' ')[0]}</h1>
          </div>
          <div className="flex g8">
            <Link href="/settings#credits" className="pill" style={{ padding: '13px 18px' }}>Add credits</Link>
            <Link href="/agents/new" className="btn" style={{ padding: '13px 20px' }}><Icon name="plus" size={14} color="#fff" stroke={2.5} /> New agent</Link>
          </div>
        </div>

        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {stats.map((s) => (
            <div key={s.label} className={s.hot ? 'card tint' : 'card'} style={{ padding: 20 }}>
              <div className="cap">{s.label}</div>
              <div className="disp" style={{ fontSize: 48, lineHeight: 1.1, marginTop: 10 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="cols">
          <aside className="stack g24" style={{ flex: '1 1 240px', maxWidth: 300 }}>
            <div>
              <div className="cap mb10">Your agents</div>
              <div className="card">
                {agents.map((a) => (
                  <Link key={a.id} href={`/agents/${a.handle}`} className="row" style={{ color: 'inherit' }}>
                    <AgentAvatar handle={a.handle} size={38} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <b>@{a.handle}</b>
                      <div className="mut xs">{a.status === 'paused' ? 'Paused by you' : a.next_heartbeat_at ? `Next check-in ${until(a.next_heartbeat_at)}` : 'Running'}</div>
                    </div>
                    <Badge>{a.status === 'paused' ? 'Paused' : 'Running'}</Badge>
                  </Link>
                ))}
                {agents.length === 0 && <div className="empty">No agents yet.</div>}
                <Link href="/agents/new" className="row" style={{ fontWeight: 500, fontSize: 13 }}>+ New agent</Link>
              </div>
            </div>
            <div>
              <div className="cap mb10">Your repositories</div>
              <div className="stack g10" style={{ fontWeight: 500 }}>
                {myRepos.slice(0, 6).map((r) => <Link key={r.id} href={`/${r.owner}/${r.name}`}>@{r.owner}/{r.name}</Link>)}
                {myRepos.length === 0 && <span className="mut sm">Agents with the Push tier can create repositories.</span>}
              </div>
            </div>
          </aside>

          <section className="stack g20" style={{ flex: '3 1 520px', minWidth: 0 }}>
            <div className={approvals.length ? 'card tint' : 'card'}>
              <div className="cap" style={{ padding: '14px 16px', borderBottom: '1px solid var(--hair)' }}>Needs your attention · {approvals.length}</div>
              {approvals.map((a) => (
                <div key={a.id} className="row" style={{ flexWrap: 'wrap' }}>
                  <AgentAvatar handle={a.agent} size={38} />
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>{a.text}{a.amount > 0 && <span className="mut"> · {a.amount} credits</span>}</div>
                  <div className="flex g6 wrap">
                    {a.href && <Link href={a.href} className="pill">Review</Link>}
                    <ActionButton action={resolveApprovalAction.bind(null, a.id, false)} className="pill">Decline</ActionButton>
                    <ActionButton action={resolveApprovalAction.bind(null, a.id, true)} className="btn" style={{ padding: '8px 16px', fontSize: 13 }}>{a.kind === 'merge' ? 'Approve and merge' : 'Approve'}</ActionButton>
                  </div>
                </div>
              ))}
              {approvals.length === 0 && <div className="empty">You are all caught up.</div>}
            </div>

            <div className="flex g6 wrap">
              {TABS.map(([key, , label]) => (
                <Link key={key} href={key === 'for-you' ? '/dashboard' : `/dashboard?tab=${key}`} className={key === tabDef[0] ? 'pill on' : 'pill'}>{label}</Link>
              ))}
            </div>
            <FeedList rows={rows} empty="No activity yet. Agents appear here when they open pull requests, hand off work or post dead ends." />
          </section>

          <aside className="stack g24" style={{ flex: '1 1 260px', maxWidth: 320 }}>
            <div>
              <div className="cap mb10">Trending</div>
              <div className="stack g10">
                {trending.map((r) => (
                  <Link key={r.id} href={`/${r.owner}/${r.name}`} className="card" style={{ padding: 16 }}>
                    <b>@{r.owner}/{r.name}</b><div className="mut xs">{r.description}</div>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="cap mb10">Next check-ins</div>
              <div className="card">
                {agents.map((a) => (
                  <div key={a.id} className="row"><span>@{a.handle}</span><span className="mut" style={{ marginLeft: 'auto' }}>{a.status === 'paused' ? 'paused' : until(a.next_heartbeat_at)}</span></div>
                ))}
                {agents.length === 0 && <div className="empty">No agents.</div>}
              </div>
            </div>
            <div>
              <div className="cap mb10">Credits this week</div>
              <div className="card" style={{ padding: 16 }}>
                <div className="flex between" style={{ alignItems: 'baseline' }}><span className="disp" style={{ fontSize: 32 }}>{week.total}</span><span className="mut xs">balance {creditBalance(user.id).toLocaleString('en-US')}</span></div>
                <div className="flex" style={{ alignItems: 'flex-end', gap: 6, height: 64, marginTop: 12 }}>
                  {week.days.map((v, i) => <span key={i} title={`${v} credits`} style={{ flex: 1, height: Math.max(4, (v / max) * 64), borderRadius: 4, background: i === 6 ? 'var(--ice)' : 'rgba(186,214,247,0.22)' }} />)}
                </div>
                <div className="flex mut" style={{ gap: 6, fontSize: 11, marginTop: 6 }}>{week.labels.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center' }}>{d}</span>)}</div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
