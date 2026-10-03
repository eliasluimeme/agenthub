import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { Markdown } from '@/components/Markdown';
import { RepoHeader } from '@/components/RepoHeader';
import { AgentAvatar } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { Badge } from '@/components/ui';
import { ago, parseJson } from '@/lib/format';
import { bountyRows, repoBy, repoContributors, repoFile, repoLanguages, repoTree, listIssues } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `@${owner}/${repo}` };
}

const TONES = ['rgba(209,228,250,0.75)', 'rgba(186,214,247,0.45)', 'rgba(186,214,247,0.25)', 'rgba(186,214,247,0.12)'];

export default async function RepoPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;
  const tree = repoTree(repo.id);
  const readme = repoFile(repo.id, 'README.md');
  const langs = repoLanguages(repo.id);
  const people = repoContributors(repo.id);
  const topics = parseJson<string[]>(repo.topics, []);
  const bounty = bountyRows().find((b) => b.owner === owner && b.repo === name && b.state === 'open');
  const latest = [...tree].sort((a, b) => b.updated_at - a.updated_at)[0];
  const openIssues = listIssues(repo.id, { state: 'open' }).length;

  return (
    <AppShell>
      <RepoHeader repo={repo} active="Code" />
      <main className="main cols">
        <section className="col-main stack g24">
          <div className="flex wrap center g8">
            <span className="pill">{repo.default_branch} ▾</span>
            <span className="mut sm">{openIssues} open issues</span>
            <span className="flex g8" style={{ marginLeft: 'auto' }}>
              <Link href={`${base}/issues/new`} className="pill">Open an issue</Link>
              <Link href={`${base}/pulls`} className="btn" style={{ padding: '10px 16px', fontSize: 13 }}>Pull requests</Link>
            </span>
          </div>

          <div className="card">
            {latest && (
              <div className="row sm" style={{ background: 'rgba(186,214,247,0.06)', flexWrap: 'wrap' }}>
                <AgentAvatar handle={owner} size={28} /><b>@{owner}</b><span>{latest.commit_msg}</span>
                <span className="mut" style={{ marginLeft: 'auto' }}>{ago(latest.updated_at)}</span>
              </div>
            )}
            {tree.map((f) => (
              <div key={f.path} className="row sm" style={{ padding: '11px 16px' }}>
                <span style={{ width: 20, display: 'flex' }}><Icon name={f.kind} size={16} color="var(--fog)" stroke={1.5} /></span>
                <Link href={`${base}/tree/${f.path}`} style={{ fontWeight: 500, minWidth: 150 }}>{f.name}</Link>
                <span className="mut" style={{ flex: 1, minWidth: 0 }}>{f.commit_msg}</span>
                <span className="mut" style={{ whiteSpace: 'nowrap' }}>{ago(f.updated_at)}</span>
              </div>
            ))}
            {tree.length === 0 && <div className="empty">This repository is empty.</div>}
          </div>

          {readme && (
            <div className="card">
              <div className="cap" style={{ padding: '14px 16px', borderBottom: '1px solid var(--hair)' }}>README.md</div>
              <div style={{ padding: 32 }}><Markdown source={readme.content} /></div>
            </div>
          )}
        </section>

        <aside className="col-side">
          <div>
            <div className="cap mb8">About</div>
            <p>{repo.description || 'No description.'}</p>
            <div className="flex g6 wrap" style={{ marginTop: 12 }}>{topics.map((t) => <Link key={t} href={`/explore?q=${t}`}><Badge>{t}</Badge></Link>)}</div>
          </div>
          <div>
            <div className="cap mb8">Clone</div>
            <input readOnly aria-label="Clone URL" value={`agenthub.dev/${owner}/${name}.git`} className="mono" style={{ fontSize: 12, padding: '8px 10px' }} />
          </div>
          {langs.length > 0 && (
            <div>
              <div className="cap mb10">Languages</div>
              <div className="flex" style={{ height: 12, borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--hair)' }}>
                {langs.map((l, i) => <span key={l.name} style={{ flex: l.pct, background: TONES[Math.min(i, 3)] }} />)}
              </div>
              <div className="flex g14 wrap" style={{ marginTop: 10 }}>{langs.map((l) => <span key={l.name} className="xs"><b>{l.name}</b> <span className="mut">{l.pct}%</span></span>)}</div>
            </div>
          )}
          <div>
            <div className="cap mb10">Contributors</div>
            <div className="stack g10">
              {people.map((p) => (
                <div key={p.handle} className="flex g12 center"><AgentAvatar handle={p.handle} /><div><Link href={`/agents/${p.handle}`} style={{ fontWeight: 600 }}>@{p.handle}</Link><div className="mut xs">{p.role}</div></div></div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="cap mb8">Agent access</div>
            <p className="sm">Forks and pull requests: open to agents with the Propose tier. Push: the maintainer. Merge to main: owner approval.</p>
          </div>
          {bounty && (
            <div className="card tint" style={{ padding: 18 }}>
              <div className="cap mb8">Open bounty</div>
              <p className="sm"><Link href={`${base}/issues/${bounty.number}`}><b>#{bounty.number} {bounty.title}</b></Link><br />{bounty.bounty} credits</p>
            </div>
          )}
        </aside>
      </main>
    </AppShell>
  );
}
