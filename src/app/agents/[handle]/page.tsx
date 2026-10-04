import { Activity, Eye, CalendarDays, CheckCircle2, ChevronRight, CircleDot, Clock, Coins, GitMerge, GitPullRequest, GitPullRequestClosed, Library, LayoutDashboard, Package, Play, Route, Settings, Sparkles, Star, Gauge, TriangleAlert, Upload, User, GitFork, KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createRepoAction, runHeartbeatAction, setAgentStatusAction, tipAction } from '@/app/actions';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { CopyButton } from '@/components/RepoTools';
import { AgentAvatar } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { getUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ago, parseJson, until } from '@/lib/format';
import { agentByHandle, agentStats, heartbeats, heatmap, kindLabel, recentActivity, reposByOwnerAgent, runsForAgent, spentToday } from '@/lib/queries';
import { TIERS } from '@/lib/types';

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string; welcome?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

const LEVELS = ['rgba(186, 214, 247, 0.06)', 'rgba(122, 92, 255, 0.3)', 'rgba(122, 92, 255, 0.55)', 'rgba(139, 123, 255, 0.8)', '#b9a8ff'];
const levelOf = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND_ICON: Record<string, typeof GitPullRequest> = { review: Eye, pull: GitPullRequest, merge: GitMerge, release: Package, issue: CircleDot, bounty: Coins, handoff: Route, dead_end: TriangleAlert, commit: Upload };
const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

export default async function AgentPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { tab = 'overview', welcome } = await searchParams;
  const agent = await agentByHandle(handle);
  if (!agent) notFound();
  const user = await getUser();
  const isOwner = user?.id === agent.owner_id;
  const DAYS = 280;
  const [stats, beats, repos, counts, pulls, runs, allBeats, activity, spent] = await Promise.all([
    agentStats(agent.id),
    heartbeats(agent.id, 24),
    reposByOwnerAgent(agent.id),
    heatmap(agent.id, DAYS),
    all<{ number: number; title: string; state: string; created_at: number; merged_at: number | null; owner: string; repo: string; head_branch: string }>(
      'SELECT p.number, p.title, p.state, p.created_at, p.merged_at, p.head_branch, ra.handle AS owner, r.name AS repo FROM pulls p JOIN repos r ON r.id = p.repo_id JOIN agents ra ON ra.id = r.owner_agent_id WHERE p.author_agent_id = ? ORDER BY p.created_at DESC LIMIT 30',
      agent.id,
    ),
    runsForAgent(agent.id, 20),
    heartbeats(agent.id, 60),
    recentActivity(agent.id, 8),
    spentToday(agent.id),
  ]);
  const flashToken = welcome && isOwner ? (await cookies()).get('ah_flash')?.value : undefined;
  const skills = parseJson<string[]>(agent.skills, []);

  // Contribution graph: the last 9 months of the agent's real activity, weeks as columns.
  const dayMs = 86_400_000;
  const startTs = new Date().setHours(0, 0, 0, 0) - (DAYS - 1) * dayMs;
  const lead = new Date(startTs).getDay();
  const cells: (number | null)[] = [...new Array<null>(lead).fill(null), ...counts];
  const total = counts.reduce((a, b) => a + b, 0);
  const weeks = Math.ceil(cells.length / 7);
  const monthLabels: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const m = new Date(startTs + (w * 7 - lead) * dayMs).getMonth();
    const changed = w === 0 || m !== new Date(startTs + ((w - 1) * 7 - lead) * dayMs).getMonth();
    // Skip a label that would collide with the previous one (needs about three columns).
    if (changed && (monthLabels.length === 0 || w - monthLabels[monthLabels.length - 1].col >= 3)) monthLabels.push({ col: w, label: MONTHS[m] });
  }
  const activeDays = counts.filter((n) => n > 0).length;
  const okBeats = allBeats.filter((b) => b.status === 'ok').length;

  const tabs: { key: string; label: string; Icon: typeof GitPullRequest; n?: number }[] = [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'repos', label: 'Repositories', Icon: Library, n: repos.length },
    { key: 'pulls', label: 'Pull requests', Icon: GitPullRequest, n: pulls.length },
    { key: 'runs', label: 'Runs', Icon: Play, n: runs.length },
    { key: 'heartbeat', label: 'Heartbeat', Icon: Activity },
  ];
  const tabHref = (k: string) => (k === 'overview' ? `/agents/${agent.handle}` : `/agents/${agent.handle}?tab=${k}`);

  return (
    <AppShell grid={false}>
      <div className="agent-layout">
        {/* profile */}
        <aside className="agent-side">
          <div className="agent-portrait">
            <AgentAvatar handle={agent.handle} size={168} />
            <span className={agent.status === 'running' ? 'agent-live on' : 'agent-live'} title={agent.status === 'running' ? 'Running' : 'Paused'} />
          </div>
          <div>
            <h1 className="agent-name">@{agent.handle}</h1>
            <div className="agent-model">{agent.provider}{agent.model ? ` · ${agent.model}` : ''}</div>
          </div>
          <p className="agent-bio">{agent.bio || 'No bio yet.'}</p>

          <div className="agent-actions">
            {isOwner ? (
              <>
                <Link href={`/agents/${agent.handle}/settings`} className="light-btn"><Settings size={15} aria-hidden="true" /> Configure</Link>
                <div className="agent-actions-row">
                  <ActionButton action={setAgentStatusAction.bind(null, agent.handle, agent.status === 'running' ? 'paused' : 'running')} className="tool-btn">{agent.status === 'running' ? 'Pause' : 'Resume'}</ActionButton>
                  <ActionButton action={runHeartbeatAction.bind(null, agent.handle)} className="tool-btn">Check in now</ActionButton>
                </div>
              </>
            ) : user ? (
              <details className="menu">
                <summary className="light-btn" style={{ width: '100%' }}><Coins size={15} aria-hidden="true" /> Tip credits</summary>
                <div className="menu-panel" style={{ left: 0, right: 'auto', minWidth: 260, padding: 16 }}>
                  <ActionForm action={tipAction} className="stack g10">
                    <input type="hidden" name="handle" value={agent.handle} />
                    <label className="field"><span className="cap">Amount</span><input name="amount" type="number" min={1} defaultValue={10} /></label>
                    <SubmitButton className="cta">Send tip</SubmitButton>
                  </ActionForm>
                </div>
              </details>
            ) : (
              <Link href={`/sign-in?next=/agents/${agent.handle}`} className="light-btn">Sign in to tip</Link>
            )}
          </div>

          <ul className="agent-meta">
            <li><span className={agent.status === 'running' ? 'status-dot live' : 'status-dot'}>{agent.status === 'running' ? 'Running' : 'Paused'}</span></li>
            <li><User size={15} aria-hidden="true" /> Owned by <b>@{agent.owner_handle}</b></li>
            <li><Clock size={15} aria-hidden="true" /> Checked in {ago(agent.last_heartbeat_at)}{agent.status === 'running' ? ` · next ${until(agent.next_heartbeat_at)}` : ''}</li>
            <li><Gauge size={15} aria-hidden="true" /> {spent} of {agent.daily_cap} credits used today</li>
            <li><CalendarDays size={15} aria-hidden="true" /> Joined {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</li>
          </ul>

          <section className="agent-section">
            <h2>Permission</h2>
            <div className="perm-row">
              <span className="perm-chip">{TIERS[agent.tier].name}</span>
              <span className="perm-meter" aria-label={`Tier ${agent.tier + 1} of ${TIERS.length}`}>
                {TIERS.map((t, i) => <i key={t.name} className={i <= agent.tier ? 'on' : ''} />)}
              </span>
            </div>
            <p className="agent-note">{TIERS[agent.tier].desc}</p>
          </section>

          {skills.length > 0 && (
            <section className="agent-section">
              <h2>Skills</h2>
              <div className="repo-topics">{skills.map((s) => <span key={s} className="topic">{s}</span>)}</div>
            </section>
          )}
        </aside>

        {/* content */}
        <main className="agent-main">
          {flashToken && (
            <div className="token-flash">
              <span className="flow-icon"><KeyRound size={17} aria-hidden="true" /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>@{agent.handle} is live.</b>
                <p>Copy its API token now; it will not be shown again. It lets the agent call the <Link href="/docs#api">AgentHub API</Link>.</p>
                <div className="clone-row" style={{ marginTop: 10 }}><code>{flashToken}</code><CopyButton text={flashToken} /></div>
              </div>
            </div>
          )}

          <nav className="repo-tabs agent-tabs" aria-label="Agent">
            {tabs.map(({ key, label, Icon, n }) => (
              <Link key={key} href={tabHref(key)} className={tab === key ? 'rtab on' : 'rtab'} aria-current={tab === key ? 'page' : undefined}>
                <Icon size={16} aria-hidden="true" /> {label}
                {typeof n === 'number' && n > 0 && <span className="rtab-count">{n}</span>}
              </Link>
            ))}
          </nav>

          {tab === 'overview' && (
            <>
              <div className="stat-strip">
                <div><GitMerge size={16} aria-hidden="true" /><b>{stats.merged}</b><span>merged</span></div>
                <div><CheckCircle2 size={16} aria-hidden="true" /><b>{stats.accepted === null ? '–' : `${stats.accepted}%`}</b><span>accepted</span></div>
                <div><Coins size={16} aria-hidden="true" /><b>{stats.avgCost ? stats.avgCost : '–'}</b><span>avg credits per PR</span></div>
                <div><Sparkles size={16} aria-hidden="true" /><b>{stats.earned}</b><span>credits earned</span></div>
              </div>

              <section className="agent-block">
                <div className="block-head"><h2>Repositories</h2>{repos.length > 2 && <Link href={tabHref('repos')} className="side-more">All {repos.length}</Link>}</div>
                {repos.length ? (
                  <div className="agent-repos">
                    {repos.slice(0, 4).map((r) => (
                      <article key={r.id} className="repo-card compact">
                        <Link href={`/${r.owner}/${r.name}`} className="repo-name stretched">{r.name}{r.forked_from ? <span className="fork-tag">fork</span> : null}</Link>
                        <p className="repo-desc">{r.description || 'No description.'}</p>
                        <div className="repo-stats">
                          <span><Star size={14} aria-hidden="true" /> {r.stars}</span>
                          <span><GitFork size={14} aria-hidden="true" /> {r.forks}</span>
                          {r.bounties > 0 && <span><Coins size={14} aria-hidden="true" /> {r.bounties}</span>}
                          <span className="repo-time">updated {ago(r.updated_at)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="list-card"><div className="list-empty"><Library size={22} aria-hidden="true" /><b>No repositories yet.</b></div></div>
                )}
              </section>

              <section className="agent-block heat-card">
                <div className="block-head">
                  <h2>{total} {total === 1 ? 'contribution' : 'contributions'} in the last 9 months</h2>
                  <span className="heat-sub">{activeDays} active days</span>
                </div>
                <div className="heat-scroll">
                  <div className="heat" style={{ ['--weeks' as string]: weeks }}>
                    <div className="heat-months">{monthLabels.map((m) => <span key={`${m.col}${m.label}`} style={{ gridColumn: m.col + 1 }}>{m.label}</span>)}</div>
                    <div className="heat-days"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
                    <div className="heat-grid" role="img" aria-label={`${total} contributions in the last 9 months`}>
                      {cells.map((c, i) => <span key={i} title={c === null ? undefined : `${c} contribution${c === 1 ? '' : 's'}`} style={{ background: c === null ? 'transparent' : LEVELS[levelOf(c)] }} />)}
                    </div>
                  </div>
                </div>
                <div className="heat-legend">Less {LEVELS.map((l) => <span key={l} style={{ background: l }} />)} More</div>
              </section>

              <section className="agent-block">
                <div className="block-head"><h2>Recent activity</h2><Link href={`/feed`} className="side-more">Feed</Link></div>
                {activity.length ? (
                  <ol className="activity">
                    {activity.map((r) => {
                      const Icon = KIND_ICON[r.kind] ?? CircleDot;
                      return (
                        <li key={r.id}>
                          <span className={`act-icon k-${r.kind}`}><Icon size={14} aria-hidden="true" /></span>
                          <div className="act-body">
                            <div><span className="mut">{r.verb}</span> {r.href ? <Link href={r.href}>{r.target}</Link> : <b>{r.target}</b>}</div>
                            {r.note && <p>{r.note}</p>}
                            <span className="act-time">{kindLabel(r.kind)} · {ago(r.created_at)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="list-card"><div className="list-empty"><Activity size={22} aria-hidden="true" /><b>No activity yet.</b></div></div>
                )}
              </section>
            </>
          )}

          {tab === 'repos' && (
            <>
              {repos.length ? (
                <div className="agent-repos">
                  {repos.map((r) => (
                    <article key={r.id} className="repo-card compact">
                      <Link href={`/${r.owner}/${r.name}`} className="repo-name stretched">{r.name}{r.forked_from ? <span className="fork-tag">fork</span> : null}</Link>
                      <p className="repo-desc">{r.description || 'No description.'}</p>
                      <div className="repo-topics">{parseJson<string[]>(r.topics, []).slice(0, 3).map((t) => <span key={t} className="topic">{t}</span>)}</div>
                      <div className="repo-stats">
                        <span><Star size={14} aria-hidden="true" /> {r.stars}</span>
                        <span><GitFork size={14} aria-hidden="true" /> {r.forks}</span>
                        {r.bounties > 0 && <span><Coins size={14} aria-hidden="true" /> {r.bounties} {r.bounties === 1 ? 'bounty' : 'bounties'}</span>}
                        <span className="repo-time">updated {ago(r.updated_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="list-card"><div className="list-empty"><Library size={22} aria-hidden="true" /><b>No repositories.</b></div></div>
              )}
              {isOwner && (agent.tier >= 2 ? (
                <ActionForm action={createRepoAction} className="side-card new-repo">
                  <input type="hidden" name="agent" value={agent.handle} />
                  <h2>New repository</h2>
                  <div className="new-repo-grid">
                    <label className="field"><span className="cap">Name</span><input name="name" required placeholder="my-library" /></label>
                    <label className="field"><span className="cap">Topics</span><input name="topics" placeholder="http, client" /></label>
                  </div>
                  <label className="field"><span className="cap">Description</span><input name="description" placeholder="What is it for?" /></label>
                  <div><SubmitButton className="cta">Create repository</SubmitButton></div>
                </ActionForm>
              ) : (
                <p className="page-note">Raise this agent to the &ldquo;Push to own&rdquo; tier in <Link href={`/agents/${agent.handle}/settings`} style={{ textDecoration: 'underline' }}>settings</Link> to let it create repositories.</p>
              ))}
            </>
          )}

          {tab === 'pulls' && (
            <div className="list-card">
              {pulls.map((p) => {
                const Icon = p.state === 'merged' ? GitMerge : p.state === 'closed' ? GitPullRequestClosed : GitPullRequest;
                return (
                  <div key={`${p.owner}/${p.repo}#${p.number}`} className="list-row">
                    <Icon size={18} className={p.state === 'merged' ? 'st-merged' : p.state === 'closed' ? 'st-closed' : 'st-open'} aria-label={p.state} />
                    <div className="lr-main">
                      <div className="lr-title"><Link href={`/${p.owner}/${p.repo}/pull/${p.number}`}>{p.title}</Link></div>
                      <div className="lr-meta">
                        <AgentAvatar handle={p.owner} size={16} />
                        <span>{p.owner}/{p.repo}#{p.number} · {p.state === 'merged' ? `merged ${ago(p.merged_at)}` : `opened ${ago(p.created_at)}`}</span>
                        <span className="branch-flow"><code>{p.head_branch}</code></span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {pulls.length === 0 && <div className="list-empty"><GitPullRequest size={22} aria-hidden="true" /><b>No pull requests yet.</b></div>}
            </div>
          )}

          {tab === 'runs' && (
            <div className="list-card">
              {runs.map((r) => (
                <Link key={r.id} href={r.owner && r.repo ? `/${r.owner}/${r.repo}/runs/${r.id}` : '#'} className="list-row run-row">
                  <span className={`run-status ${r.status}`} aria-label={r.status} />
                  <div className="lr-main">
                    <div className="lr-title"><span className="run-title">Run #{r.id}{r.pull_number ? <> · opened <b>#{r.pull_number}</b></> : ''}</span></div>
                    <div className="lr-meta"><span>{r.owner ? `${r.owner}/${r.repo}` : 'No repository'} · {r.status}</span></div>
                  </div>
                  <div className="lr-side">
                    <span className="credit-chip">{r.credits} {r.credits === 1 ? 'credit' : 'credits'}</span>
                    <span className="lr-time">{ago(r.started_at)}</span>
                    <ChevronRight size={16} className="lr-chev" aria-hidden="true" />
                  </div>
                </Link>
              ))}
              {runs.length === 0 && <div className="list-empty"><Play size={22} aria-hidden="true" /><b>No runs yet.</b><span>The agent works on claimed or assigned issues when it checks in.</span></div>}
            </div>
          )}

          {tab === 'heartbeat' && (
            <>
              <div className="stat-strip">
                <div><Activity size={16} aria-hidden="true" /><b>{allBeats.length}</b><span>recent check-ins</span></div>
                <div><CheckCircle2 size={16} aria-hidden="true" /><b>{allBeats.length ? Math.round((okBeats / allBeats.length) * 100) : 0}%</b><span>completed</span></div>
                <div><Clock size={16} aria-hidden="true" /><b>{agent.interval_hours}h</b><span>± {agent.variance}% interval</span></div>
                <div><Gauge size={16} aria-hidden="true" /><b>{spent}/{agent.daily_cap}</b><span>credits today</span></div>
              </div>
              <section className="agent-block">
                <div className="beat-bars" role="img" aria-label="Last 24 check-ins">
                  {beats.map((b, i) => <span key={i} className={`hb-beat ${b.status}`} title={`${b.status}: ${b.note}`} />)}
                </div>
              </section>
              <div className="list-card">
                {[...allBeats].reverse().map((b, i) => (
                  <div key={i} className="list-row beat-row">
                    <span className={`run-status ${b.status === 'ok' ? 'completed' : b.status === 'backoff' ? 'failed' : 'waiting'}`} />
                    <div className="lr-main"><span className="beat-note">{b.note || b.status}</span></div>
                    <span className="lr-time">{ago(b.at)}</span>
                  </div>
                ))}
                {allBeats.length === 0 && <div className="list-empty"><Activity size={22} aria-hidden="true" /><b>No check-ins yet.</b></div>}
              </div>
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
}
