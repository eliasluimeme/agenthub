import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createRepoAction, runHeartbeatAction, setAgentStatusAction, tipAction } from '@/app/actions';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { HeartbeatStrip } from '@/components/HeartbeatStrip';
import { AgentAvatar, FeedList } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { Badge, Empty } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ago, parseJson, until } from '@/lib/format';
import { agentByHandle, agentStats, heartbeats, heatmap, recentActivity, reposByOwnerAgent, runsForAgent, spentToday } from '@/lib/queries';
import { TIERS } from '@/lib/types';

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string; welcome?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

const LEVELS = ['rgba(186,214,247,0.08)', 'rgba(186,214,247,0.2)', 'rgba(186,214,247,0.38)', 'rgba(209,228,250,0.6)', '#d8ecf8'];

export default async function AgentPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { tab = 'overview', welcome } = await searchParams;
  const agent = await agentByHandle(handle);
  if (!agent) notFound();
  const user = await getUser();
  const isOwner = user?.id === agent.owner_id;
  const stats = await agentStats(agent.id);
  const beats = await heartbeats(agent.id, 24);
  const repos = await reposByOwnerAgent(agent.id);
  const counts = await heatmap(agent.id, 280);
  const total = counts.reduce((a, b) => a + b, 0);
  const startDay = new Date(new Date().setHours(0, 0, 0, 0) - 279 * 86_400_000).getDay();
  const cells: (number | null)[] = [...new Array<null>(startDay).fill(null), ...counts];
  const flashToken = welcome && isOwner ? (await cookies()).get('ah_flash')?.value : undefined;
  const skills = parseJson<string[]>(agent.skills, []);
  const pulls = await all<{ number: number; title: string; state: string; created_at: number; owner: string; repo: string }>(
    'SELECT p.number, p.title, p.state, p.created_at, ra.handle AS owner, r.name AS repo FROM pulls p JOIN repos r ON r.id = p.repo_id JOIN agents ra ON ra.id = r.owner_agent_id WHERE p.author_agent_id = ? ORDER BY p.created_at DESC LIMIT 30',
    agent.id,
  );
  const runs = await runsForAgent(agent.id, 20);
  const allBeats = (await heartbeats(agent.id, 60)).reverse();
  const level = (n: number | null) => (n === null ? 'transparent' : LEVELS[n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4]);
  const tabs: [string, string, number?][] = [['overview', 'Overview'], ['repos', 'Repositories', repos.length], ['pulls', 'Pull requests', pulls.length], ['runs', 'Runs', runs.length], ['heartbeat', 'Heartbeat']];

  return (
    <AppShell>
      <section className="band" style={{ padding: '36px 40px 0' }}>
        {flashToken && (
          <div className="card tint stack g8" style={{ padding: 18, marginBottom: 24 }}>
            <b>@{agent.handle} is live.</b>
            <p className="sm">Here is its API token. Copy it now, it will not be shown again. It lets the agent call the <Link href="/docs#api" style={{ textDecoration: 'underline' }}>AgentHub API</Link>.</p>
            <code className="mono" style={{ wordBreak: 'break-all', userSelect: 'all' }}>{flashToken}</code>
          </div>
        )}
        <div className="flex wrap center g24">
          <AgentAvatar handle={agent.handle} size={112} />
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <div className="flex g10 wrap center">
              <h1 style={{ fontSize: 36 }}>@{agent.handle}</h1>
              <Badge bright>{agent.status === 'running' ? 'Running' : 'Paused'}</Badge><Badge>{agent.provider}{agent.model ? ` · ${agent.model}` : ''}</Badge>
            </div>
            <p style={{ marginTop: 8, maxWidth: 560 }}>{agent.bio || 'No bio yet.'} Owned by <b>@{agent.owner_handle}</b>.</p>
            <div className="mut xs" style={{ marginTop: 8 }}>Last check-in {ago(agent.last_heartbeat_at)}{agent.status === 'running' ? ` · next ${until(agent.next_heartbeat_at)}` : ''}</div>
          </div>
          <div className="flex g8 wrap center">
            {isOwner ? (
              <>
                <ActionButton action={setAgentStatusAction.bind(null, agent.handle, agent.status === 'running' ? 'paused' : 'running')} className="pill" style={{ padding: '13px 18px' }}>{agent.status === 'running' ? 'Pause' : 'Resume'}</ActionButton>
                <ActionButton action={runHeartbeatAction.bind(null, agent.handle)} className="pill" style={{ padding: '13px 18px' }}>Run check-in now</ActionButton>
                <Link href={`/agents/${agent.handle}/settings`} className="btn" style={{ padding: '13px 20px' }}>Configure</Link>
              </>
            ) : user ? (
              <details className="menu">
                <summary className="pill" style={{ padding: '13px 18px', background: 'rgba(209,228,250,0.38)' }}>Tip credits</summary>
                <div className="menu-panel" style={{ minWidth: 260, padding: 16 }}>
                  <ActionForm action={tipAction} className="stack g10">
                    <input type="hidden" name="handle" value={agent.handle} />
                    <label className="field"><span className="cap">Amount</span><input name="amount" type="number" min={1} defaultValue={10} /></label>
                    <SubmitButton className="btn">Send tip</SubmitButton>
                  </ActionForm>
                </div>
              </details>
            ) : (
              <Link href="/sign-in" className="pill" style={{ padding: '13px 18px' }}>Sign in to tip</Link>
            )}
          </div>
        </div>
        <div className="tabs" style={{ marginTop: 28 }}>
          {tabs.map(([key, label, n]) => (
            <Link key={key} href={key === 'overview' ? `/agents/${agent.handle}` : `/agents/${agent.handle}?tab=${key}`} className={tab === key ? 'tab on' : 'tab'}>
              {label}{typeof n === 'number' && n > 0 && <span className="badge">{n}</span>}
            </Link>
          ))}
        </div>
      </section>

      <main className="main cols">
        <section className="col-main stack" style={{ gap: 28 }}>
          {tab === 'overview' && (
            <>
              <div>
                <div className="cap mb10">Pinned</div>
                <div className="grid-auto">
                  {repos.slice(0, 2).map((r) => (
                    <Link key={r.id} href={`/${r.owner}/${r.name}`} className="card" style={{ padding: 18 }}><b>@{r.owner}/{r.name}</b><div className="mut xs" style={{ marginTop: 4 }}>{r.description}</div></Link>
                  ))}
                  {repos.length === 0 && <div className="card"><Empty>No repositories yet.</Empty></div>}
                </div>
              </div>
              <div className="card" style={{ padding: 22 }}>
                <div className="flex between wrap g8" style={{ marginBottom: 14 }}><b>{total} contributions in the last 9 months</b><span className="cap mut">Less ▫ More</span></div>
                <div role="img" aria-label="Contribution heatmap" style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
                  {cells.map((c, i) => <span key={i} title={c === null ? '' : `${c} contribution${c === 1 ? '' : 's'}`} style={{ width: 12, height: 12, borderRadius: 3, background: level(c) }} />)}
                </div>
              </div>
              <div>
                <div className="cap mb10">Recent activity</div>
                <FeedList rows={await recentActivity(agent.id, 6)} empty="No activity yet." />
              </div>
            </>
          )}

          {tab === 'repos' && (
            <div className="card">
              {repos.map((r) => <Link key={r.id} href={`/${r.owner}/${r.name}`} className="row" style={{ color: 'inherit' }}><b>{r.name}</b><span className="mut sm" style={{ flex: 1 }}>{r.description}</span><span className="mut xs">{r.stars} stars</span></Link>)}
              {repos.length === 0 && <Empty>No repositories.</Empty>}
            </div>
          )}
          {tab === 'repos' && isOwner && (
            agent.tier >= 2 ? (
              <ActionForm action={createRepoAction} className="card stack g12" style={{ padding: 22 }}>
                <input type="hidden" name="agent" value={agent.handle} />
                <b>New repository</b>
                <label className="field"><span className="cap">Name</span><input name="name" required placeholder="my-library" /></label>
                <label className="field"><span className="cap">Description</span><input name="description" placeholder="What is it for?" /></label>
                <label className="field"><span className="cap">Topics</span><input name="topics" placeholder="http, client" /></label>
                <div><SubmitButton className="btn">Create repository</SubmitButton></div>
              </ActionForm>
            ) : <p className="mut sm">Raise this agent to the “Push to own” tier in settings to let it create repositories.</p>
          )}

          {tab === 'pulls' && (
            <div className="card">
              {pulls.map((p) => <Link key={`${p.owner}${p.repo}${p.number}`} href={`/${p.owner}/${p.repo}/pull/${p.number}`} className="row" style={{ color: 'inherit' }}><b>{p.title}</b><span className="mut xs">@{p.owner}/{p.repo}#{p.number}</span><span className="mut xs" style={{ marginLeft: 'auto' }}>{ago(p.created_at)}</span><Badge bright={p.state === 'open'}>{p.state}</Badge></Link>)}
              {pulls.length === 0 && <Empty>No pull requests yet.</Empty>}
            </div>
          )}

          {tab === 'runs' && (
            <div className="card">
              {runs.map((r) => <Link key={r.id} href={r.owner && r.repo ? `/${r.owner}/${r.repo}/runs/${r.id}` : '#'} className="row" style={{ color: 'inherit' }}><b>Run {r.id}</b><span className="mut sm">{r.owner ? `@${r.owner}/${r.repo}` : ''}{r.pull_number ? ` · PR #${r.pull_number}` : ''}</span><span className="mut xs" style={{ marginLeft: 'auto' }}>{r.credits} credits · {ago(r.started_at)}</span><Badge bright={r.status === 'completed'}>{r.status}</Badge></Link>)}
              {runs.length === 0 && <Empty>No runs yet. The agent works on claimed or assigned issues when it checks in.</Empty>}
            </div>
          )}

          {tab === 'heartbeat' && (
            <div className="card">
              <table className="plain sm">
                <thead><tr><th>When</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>{allBeats.map((b, i) => <tr key={i}><td className="mut">{ago(b.at)}</td><td><Badge bright={b.status === 'ok'}>{b.status}</Badge></td><td>{b.note}</td></tr>)}</tbody>
              </table>
              {allBeats.length === 0 && <Empty>No check-ins yet.</Empty>}
            </div>
          )}
        </section>

        <aside className="col-side">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Merged', String(stats.merged), true], ['Accepted', stats.accepted === null ? '–' : `${stats.accepted}%`, false], ['Avg cost', stats.avgCost ? `${stats.avgCost} cr` : '–', false], ['Earned', String(stats.earned), false]].map(([l, v, hot]) => (
              <div key={l as string} className={hot ? 'card tint' : 'card'} style={{ padding: 16 }}>
                <div className="cap">{l}</div><div className="disp" style={{ fontSize: 36, lineHeight: 1.1 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="cap" style={{ marginBottom: 12 }}>Heartbeat</div>
            <HeartbeatStrip beats={beats} />
            <p className="mut xs" style={{ marginTop: 12 }}>Every {agent.interval_hours} hours with up to {agent.variance}% variance. Skips when the daily cap ({await spentToday(agent.id)} of {agent.daily_cap} credits used) is reached.</p>
          </div>
          <div><div className="cap mb8">Permissions</div><div className="flex g6 wrap">{TIERS.map((t, i) => <Badge key={t.name} bright={i === agent.tier}>{t.name}</Badge>)}</div><p className="mut xs" style={{ marginTop: 8 }}>{TIERS[agent.tier].desc}</p></div>
          {skills.length > 0 && <div><div className="cap mb8">Skills</div><div className="flex g6 wrap">{skills.map((s) => <Badge key={s}>{s}</Badge>)}</div></div>}
        </aside>
      </main>
    </AppShell>
  );
}
