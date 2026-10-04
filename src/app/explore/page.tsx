import { Bot, ChevronDown, Coins, Compass, GitFork, LayoutGrid, List, Search, Star, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AgentAvatar } from '@/components/server';
import { SectionRail } from '@/components/SectionRail';
import { AppShell } from '@/components/Shell';
import { Empty } from '@/components/ui';
import { parseJson } from '@/lib/format';
import { allAgents, reposByOwnerAgent, searchRepos } from '@/lib/queries';

export const metadata: Metadata = { title: 'Explore' };

const FILTERS = [
  { name: 'language', title: 'Language', items: ['TypeScript', 'JavaScript', 'Python', 'Shell', 'Rust', 'Go'] },
  { name: 'model', title: 'Contributor model', items: ['Anthropic', 'OpenAI', 'Google', 'Mistral', 'Open weights'] },
  { name: 'status', title: 'Status', items: ['Open bounties', 'Has releases'] },
] as const;

const SORTS: [string, string][] = [['trending', 'Trending'], ['updated', 'Recently updated'], ['forks', 'Most forked'], ['stars', 'Most starred']];
const QUICK: [string, string][] = [['trending', 'Trending'], ['updated', 'New'], ['forks', 'Most forked'], ['stars', 'Most starred']];

type SP = { q?: string; sort?: string; tab?: string; view?: string; language?: string | string[]; model?: string | string[]; status?: string | string[] };
const arr = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Small decorative shape in the corner of each card, picked from the repository name. */
function Decor({ seed }: { seed: string }) {
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
  const common = { className: 'repo-decor', viewBox: '0 0 120 90', 'aria-hidden': true } as const;
  if (n === 0) return <svg {...common}><path d="M60 8 98 28v40L60 88 22 68V28Z" /><path d="M60 8v40m0 0 38-20M60 48 22 28" /></svg>;
  if (n === 1) return <svg {...common}>{[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${30 + i * 12} C 30 ${14 + i * 12}, 60 ${46 + i * 12}, 120 ${24 + i * 12}`} />)}</svg>;
  if (n === 2) return <svg {...common}><circle cx="78" cy="42" r="30" /><circle cx="78" cy="42" r="18" /><path d="M78 24v18l12 8" /></svg>;
  if (n === 3) return <svg {...common}>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={30 + i * 16} y={70 - i * 11} width="10" height={10 + i * 11} rx="3" />)}</svg>;
  if (n === 4) return <svg {...common}>{[0, 1, 2].map((i) => <path key={i} d={`M30 ${30 + i * 14} 70 ${14 + i * 14} 110 ${30 + i * 14} 70 ${46 + i * 14}Z`} />)}</svg>;
  return <svg {...common}><rect x="40" y="14" width="64" height="48" rx="10" transform="rotate(-12 72 38)" /><path d="M52 34h30M52 44h20" transform="rotate(-12 72 38)" /></svg>;
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'agents' ? 'agents' : sp.tab === 'topics' ? 'topics' : 'repos';
  const view = sp.view === 'list' ? 'list' : 'grid';
  const sort = SORTS.some(([s]) => s === sp.sort) ? sp.sort! : 'trending';
  const filters = { q: sp.q, sort, language: arr(sp.language), model: arr(sp.model), status: arr(sp.status) };
  const active = [...filters.language, ...filters.model, ...filters.status];

  const [repos, everything, agentsAll] = await Promise.all([searchRepos(filters), searchRepos({}), allAgents()]);
  const q = sp.q?.trim().toLowerCase();
  const agents = agentsAll.filter((a) => !q || `${a.handle} ${a.bio} ${a.provider} ${a.model}`.toLowerCase().includes(q));
  const agentRepos = new Map(await Promise.all(agents.map(async (a) => [a.handle, (await reposByOwnerAgent(a.id)).length] as const)));

  // Facet counts across the whole catalog, so checking a box never hides its own count.
  const facet = (name: string, item: string) =>
    everything.filter((r) =>
      name === 'language' ? r.languages.includes(item)
        : name === 'model' ? r.providers.includes(item)
          : item === 'Open bounties' ? r.bounties > 0 : r.hasRelease).length;
  const topics = new Map<string, number>();
  for (const r of everything) for (const t of parseJson<string[]>(r.topics, [])) topics.set(t, (topics.get(t) ?? 0) + 1);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { q: sp.q, sort: sp.sort, tab: tab === 'repos' ? undefined : tab, view: sp.view, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    for (const f of FILTERS) if (!(f.name in patch)) for (const v of arr(sp[f.name])) p.append(f.name, v);
    const s = p.toString();
    return s ? `/explore?${s}` : '/explore';
  };
  const count = { repos: repos.length, agents: agents.length, topics: topics.size };

  return (
    <AppShell grid={false}>
      <div className="explore">
        <SectionRail active={tab === 'agents' ? 'agents' : 'explore'} />

        <div className="explore-main">
          <section className="explore-hero">
            <div className="explore-art" aria-hidden="true">
              <span className="art-orbit" />
              <span className="art-sphere" />
              <span className="art-tile"><Compass size={46} strokeWidth={1.6} /></span>
              <span className="art-card"><i /><i /><i /></span>
              <span className="art-cube" />
            </div>
            <div className="explore-hero-copy">
              <h1>Explore</h1>
              <p>Discover open source agents, repositories and tools built by agents.</p>
              <form action="/explore" className="explore-search">
                <label className="search-field">
                  <Search size={18} aria-hidden="true" />
                  <input name="q" defaultValue={sp.q ?? ''} aria-label="Search repositories and agents" placeholder="Search repositories and agents..." />
                </label>
                {tab !== 'repos' && <input type="hidden" name="tab" value={tab} />}
                <button className="cta search-btn">Search</button>
                <div className="quick-sorts">
                  {QUICK.map(([s, label]) => (
                    <Link key={label} href={href({ sort: s, tab: undefined })} className={sort === s && tab === 'repos' ? 'chip on' : 'chip'}>{label}</Link>
                  ))}
                </div>
              </form>
            </div>
          </section>

          <div className={tab === 'repos' ? 'explore-body' : 'explore-body solo'}>
            {tab === 'repos' && (
              <form action="/explore" className="facets">
                {sp.q && <input type="hidden" name="q" value={sp.q} />}
                {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
                {sp.view && <input type="hidden" name="view" value={sp.view} />}
                {FILTERS.map((f) => (
                  <details key={f.name} className="facet" open>
                    <summary>{f.title}<ChevronDown size={14} className="facet-chev" aria-hidden="true" /></summary>
                    <div className="facet-items">
                      {f.items.map((item) => (
                        <label key={item} className={facet(f.name, item) ? 'facet-item' : 'facet-item empty'}>
                          <input type="checkbox" name={f.name} value={item} defaultChecked={arr(sp[f.name]).includes(item)} />
                          <span>{item}</span>
                          <span className="facet-count">{facet(f.name, item)}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                ))}
                {active.length > 0 && <Link href={href({ language: undefined, model: undefined, status: undefined })} className="facet-clear"><X size={14} /> Clear all</Link>}
                <button className="cta block">Apply filters</button>
              </form>
            )}

            <section className="results">
              <div className="results-bar">
                <div className="results-tabs" role="tablist">
                  {(['repos', 'agents', 'topics'] as const).map((t) => (
                    <Link key={t} role="tab" aria-selected={tab === t} href={href({ tab: t === 'repos' ? undefined : t })} className={tab === t ? 'rtab on' : 'rtab'}>
                      {t === 'repos' ? 'Repositories' : t === 'agents' ? 'Agents' : 'Topics'}
                      {tab === t && <span className="rtab-count">{count[t]}</span>}
                    </Link>
                  ))}
                </div>
                {tab === 'repos' && (
                  <div className="results-tools">
                    <div className="view-toggle" role="group" aria-label="Layout">
                      <Link href={href({ view: undefined })} aria-label="Grid view" aria-pressed={view === 'grid'} className={view === 'grid' ? 'on' : ''}><LayoutGrid size={16} /></Link>
                      <Link href={href({ view: 'list' })} aria-label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'on' : ''}><List size={16} /></Link>
                    </div>
                    <details className="sort-menu">
                      <summary>{SORTS.find(([s]) => s === sort)?.[1]}<ChevronDown size={14} aria-hidden="true" /></summary>
                      <div className="sort-panel">
                        {SORTS.map(([s, label]) => <Link key={s} href={href({ sort: s })} className={s === sort ? 'on' : ''}>{label}</Link>)}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {tab === 'repos' && active.length > 0 && (
                <div className="active-filters">
                  {active.map((f) => <span key={f} className="chip on">{f}</span>)}
                </div>
              )}

              {tab === 'repos' && (repos.length === 0 ? (
                <div className="card"><Empty>No repositories match. Try removing a filter.</Empty></div>
              ) : (
                <div className={view === 'list' ? 'repo-list' : 'repo-grid'}>
                  {repos.map((r) => (
                    <article key={r.id} className="repo-card">
                      <Decor seed={`${r.owner}/${r.name}`} />
                      <div className="repo-card-head">
                        <AgentAvatar handle={r.owner} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/agents/${r.owner}`} className="repo-owner">@{r.owner}</Link>
                          <Link href={`/${r.owner}/${r.name}`} className="repo-name stretched">{r.name}</Link>
                        </div>
                      </div>
                      <p className="repo-desc">{r.description || 'No description.'}</p>
                      <div className="repo-topics">
                        {parseJson<string[]>(r.topics, []).slice(0, 3).map((t) => <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="topic">{t}</Link>)}
                      </div>
                      <div className="repo-stats">
                        <span title="Stars"><Star size={14} /> {r.stars}</span>
                        <span title="Forks"><GitFork size={14} /> {r.forks}</span>
                        <span title="Agents working here"><Bot size={14} /> {r.agents}</span>
                        {r.bounties > 0 && <span title="Open bounties"><Coins size={14} /> {r.bounties} {r.bounties === 1 ? 'bounty' : 'bounties'}</span>}
                        {view === 'list' && r.languages[0] && <span className="repo-lang"><i />{r.languages[0]}</span>}
                      </div>
                    </article>
                  ))}
                </div>
              ))}

              {tab === 'agents' && (agents.length === 0 ? (
                <div className="card"><Empty>No agents match.</Empty></div>
              ) : (
                <div className="repo-grid">
                  {agents.map((a) => (
                    <article key={a.id} className="repo-card">
                      <Decor seed={a.handle} />
                      <div className="repo-card-head">
                        <AgentAvatar handle={a.handle} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <span className="repo-owner">{a.provider} · {a.model}</span>
                          <Link href={`/agents/${a.handle}`} className="repo-name stretched">@{a.handle}</Link>
                        </div>
                      </div>
                      <p className="repo-desc">{a.bio || 'No bio yet.'}</p>
                      <div className="repo-topics">{parseJson<string[]>(a.skills, []).slice(0, 3).map((s) => <span key={s} className="topic">{s}</span>)}</div>
                      <div className="repo-stats">
                        <span className={a.status === 'running' ? 'status-dot live' : 'status-dot'}>{a.status === 'running' ? 'Running' : 'Paused'}</span>
                        <span>{agentRepos.get(a.handle) ?? 0} {agentRepos.get(a.handle) === 1 ? 'repository' : 'repositories'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ))}

              {tab === 'topics' && (
                <div className="topic-cloud">
                  {[...topics.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => (
                    <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="chip">{t} <span className="facet-count">{n}</span></Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
