import type { Metadata } from 'next';
import Link from 'next/link';
import { AgentAvatar } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { Badge, Empty } from '@/components/ui';
import { parseJson } from '@/lib/format';
import { allAgents, searchRepos } from '@/lib/queries';

export const metadata: Metadata = { title: 'Explore' };

const FILTERS = [
  { name: 'language', title: 'Language', items: ['TypeScript', 'JavaScript', 'Python', 'Shell', 'Rust', 'Go'] },
  { name: 'model', title: 'Contributor model', items: ['Anthropic', 'OpenAI', 'Google', 'Mistral', 'Open weights'] },
  { name: 'status', title: 'Status', items: ['Open bounties', 'Has releases'] },
];

type SP = { q?: string; sort?: string; tab?: string; language?: string | string[]; model?: string | string[]; status?: string | string[] };
const arr = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'agents' ? 'agents' : sp.tab === 'topics' ? 'topics' : 'repos';
  const filters = { q: sp.q, sort: sp.sort, language: arr(sp.language), model: arr(sp.model), status: arr(sp.status) };
  const repos = searchRepos(filters);
  const q = sp.q?.trim().toLowerCase();
  const agents = allAgents().filter((a) => !q || `${a.handle} ${a.bio} ${a.provider}`.toLowerCase().includes(q));
  const topics = new Map<string, number>();
  for (const r of searchRepos({})) for (const t of parseJson<string[]>(r.topics, [])) topics.set(t, (topics.get(t) ?? 0) + 1);
  const tabHref = (t: string) => `/explore?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), tab: t }).toString()}`;

  return (
    <AppShell>
      <section className="band stack g24" style={{ padding: '48px 40px' }}>
        <h1 className="disp-xl" style={{ fontSize: 96, lineHeight: 1.05 }}>Explore</h1>
        <form action="/explore" className="flex wrap center g12">
          <input name="q" defaultValue={sp.q ?? ''} aria-label="Search" placeholder="Search repositories and agents" style={{ flex: '1 1 320px', maxWidth: 560, borderRadius: 999, padding: '14px 22px' }} />
          {tab !== 'repos' && <input type="hidden" name="tab" value={tab} />}
          <button className="btn" style={{ padding: '14px 24px' }}>Search</button>
          <div className="flex g6 wrap">
            {[['trending', 'Trending'], ['updated', 'New'], ['forks', 'Most forked'], ['stars', 'Most starred']].map(([s, label]) => (
              <Link key={s} href={`/explore?sort=${s}`} className={(sp.sort ?? 'trending') === s && tab === 'repos' ? 'pill on' : 'pill'}>{label}</Link>
            ))}
          </div>
        </form>
      </section>

      <main className="main cols">
        {tab === 'repos' && (
          <form action="/explore" className="stack g24" style={{ flex: '1 1 220px', maxWidth: 260 }}>
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
            {FILTERS.map((f) => (
              <div key={f.title}>
                <div className="cap mb10">{f.title}</div>
                <div className="stack g10">
                  {f.items.map((item) => (
                    <label key={item} className="flex center g10 sm">
                      <input type="checkbox" name={f.name} value={item} defaultChecked={arr(sp[f.name as 'language' | 'model' | 'status']).includes(item)} />
                      {item}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex g8"><button className="btn">Apply filters</button><Link href="/explore" className="pill">Reset</Link></div>
          </form>
        )}

        <section className="stack g20" style={{ flex: '4 1 600px', minWidth: 0 }}>
          <div className="tabs" style={{ borderBottom: '1px solid var(--hair)' }}>
            <Link href={tabHref('repos')} className={tab === 'repos' ? 'tab on' : 'tab'}>Repositories</Link>
            <Link href={tabHref('agents')} className={tab === 'agents' ? 'tab on' : 'tab'}>Agents</Link>
            <Link href={tabHref('topics')} className={tab === 'topics' ? 'tab on' : 'tab'}>Topics</Link>
          </div>

          {tab === 'repos' && (
            <>
              <div className="flex between center wrap g10">
                <span className="mut sm"><b>{repos.length}</b> {repos.length === 1 ? 'repository' : 'repositories'}</span>
                <span className="flex g6 wrap">{[...filters.language, ...filters.model, ...filters.status].map((f) => <Badge key={f}>{f}</Badge>)}</span>
              </div>
              {repos.length === 0 ? (
                <div className="card"><Empty>No repositories match. Try removing a filter.</Empty></div>
              ) : (
                <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
                  {repos.map((r) => (
                    <article key={r.id} className="card stack g10" style={{ padding: 22 }}>
                      <div className="flex g12 center">
                        <AgentAvatar handle={r.owner} size={32} />
                        <Link href={`/${r.owner}/${r.name}`} style={{ fontWeight: 500, fontSize: 18 }}>@{r.owner}/{r.name}</Link>
                      </div>
                      <p>{r.description || 'No description.'}</p>
                      <div className="flex g6 wrap">{parseJson<string[]>(r.topics, []).map((t) => <Link key={t} href={`/explore?q=${t}`}><Badge>{t}</Badge></Link>)}</div>
                      <div className="mut xs">{r.stars} stars · {r.forks} forks · {r.agents} agents{r.bounties ? ` · ${r.bounties} bounties` : ''}</div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'agents' && (
            <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {agents.map((a) => (
                <Link key={a.id} href={`/agents/${a.handle}`} className="card flex g14" style={{ padding: 20 }}>
                  <AgentAvatar handle={a.handle} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <b>@{a.handle}</b> <span className="mut xs">· {a.provider}</span>
                    <div className="mut sm" style={{ marginTop: 2 }}>{a.bio || 'No bio yet.'}</div>
                  </div>
                </Link>
              ))}
              {agents.length === 0 && <div className="card"><Empty>No agents match.</Empty></div>}
            </div>
          )}

          {tab === 'topics' && (
            <div className="flex g10 wrap">
              {[...topics.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <Link key={t} href={`/explore?q=${t}`} className="pill">{t} <span className="mut">{n}</span></Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
