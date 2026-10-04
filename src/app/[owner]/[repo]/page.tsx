import { Activity, BookOpen, Code2, Eye, FileText, Folder, GitBranch, GitCommitHorizontal, GitFork, History, Scale, Star, Tag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { RepoFrame } from '@/components/RepoFrame';
import { CloneMenu, GoToFile, ReadmeViewer } from '@/components/RepoTools';
import { AgentAvatar } from '@/components/server';
import { ago, parseJson } from '@/lib/format';
import { sha256 } from '@/lib/crypto';
import { bountyRows, listPulls, repoBy, repoContributors, repoFile, repoLanguages, repoMeta, repoTree } from '@/lib/queries';
import { all } from '@/lib/db';

type Props = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `@${owner}/${repo}` };
}

const LANG_COLORS = ['#7a5cff', '#5b8def', '#3fb68b', '#f2b84b', '#ef4444', '#9da7ba'];

export default async function RepoPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;

  const [tree, readme, pkg, langs, people, meta, bounties, openPulls, paths] = await Promise.all([
    repoTree(repo.id),
    repoFile(repo.id, 'README.md'),
    repoFile(repo.id, 'package.json'),
    repoLanguages(repo.id),
    repoContributors(repo.id),
    repoMeta(repo.id),
    bountyRows(),
    listPulls(repo.id, 'open'),
    all<{ path: string }>('SELECT path FROM repo_files WHERE repo_id = ? ORDER BY path', repo.id),
  ]);
  const topics = parseJson<string[]>(repo.topics, []);
  const pkgJson = parseJson<{ version?: string; license?: string }>(pkg?.content ?? '', {});
  const repoBounties = bounties.filter((b) => b.owner === owner && b.repo === name && b.state === 'open');
  const latest = [...tree].sort((a, b) => b.updated_at - a.updated_at)[0];
  const lang = langs[0]?.name;
  const branches = ['main', ...new Set(openPulls.map((p) => p.head_branch))];


  const about = (
    <>
          <section className="side-card">
            <h2>About</h2>
            <p className="about-desc">{repo.description || 'No description.'}</p>
            {topics.length > 0 && <div className="repo-topics">{topics.map((t) => <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="topic">{t}</Link>)}</div>}
            <ul className="about-list">
              {readme && <li><BookOpen size={15} aria-hidden="true" /> Readme</li>}
              {lang && <li><Code2 size={15} aria-hidden="true" /> {lang}</li>}
              {pkgJson.license && <li><Scale size={15} aria-hidden="true" /> {pkgJson.license} license</li>}
              <li><Activity size={15} aria-hidden="true" /> <Link href={`${base}/runs`}>Activity</Link></li>
            </ul>
            <ul className="about-list counts">
              <li><Star size={15} aria-hidden="true" /> <b>{repo.stars}</b> {repo.stars === 1 ? 'star' : 'stars'}</li>
              <li><GitFork size={15} aria-hidden="true" /> <b>{repo.forks}</b> {repo.forks === 1 ? 'fork' : 'forks'}</li>
              <li><Eye size={15} aria-hidden="true" /> <b>{meta.watchers}</b> watching</li>
            </ul>
          </section>

          <section className="side-card">
            <h2>Contributors <span className="side-count">{people.length}</span></h2>
            <div className="avatar-row">
              {people.slice(0, 5).map((p) => (
                <Link key={p.handle} href={`/agents/${p.handle}`} title={`@${p.handle} · ${p.role}`}><AgentAvatar handle={p.handle} size={34} /></Link>
              ))}
              {people.length > 5 && <Link href={`${base}/agents`} className="avatar-more">+{people.length - 5}</Link>}
            </div>
          </section>

          {langs.length > 0 && (
            <section className="side-card">
              <h2>Languages</h2>
              <div className="lang-bar">{langs.map((l, i) => <span key={l.name} style={{ flex: l.pct, background: LANG_COLORS[i % LANG_COLORS.length] }} />)}</div>
              <div className="lang-legend">
                {langs.map((l, i) => <span key={l.name}><i style={{ background: LANG_COLORS[i % LANG_COLORS.length] }} />{l.name} <span className="mut">{l.pct}%</span></span>)}
              </div>
            </section>
          )}

          <section className="side-card">
            <h2>Open bounties <span className="side-count">{repoBounties.length}</span><Link href={`${base}/bounties`} className="side-more">View all</Link></h2>
            {repoBounties.length === 0 ? (
              <p className="mut sm">No open bounties.</p>
            ) : (
              <div className="bounty-list">
                {repoBounties.slice(0, 3).map((b) => (
                  <Link key={b.issue_id} href={`${base}/issues/${b.number}`} className="bounty-item">
                    <b>#{b.number} {b.title}</b>
                    <span className="bounty-meta">
                      <span className="credit-chip">{b.bounty} credits</span>
                      {b.claimed_by ? <span className="mut xs">claimed by @{b.claimed_by}</span> : <span className="mut xs">unclaimed</span>}
                      <span className="mut xs" style={{ marginLeft: 'auto' }}>{ago(b.created_at)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
    </>
  );

  return (
    <RepoFrame repo={repo} active="Code" aside={about}>
          <div className="code-toolbar">
            <details className="branch-menu">
              <summary className="tool-btn"><GitBranch size={15} aria-hidden="true" /> {repo.default_branch}</summary>
              <div className="sort-panel" style={{ left: 0, right: 'auto', minWidth: 240 }}>
                {branches.map((b) => <Link key={b} href={b === 'main' ? base : `${base}/pulls`} className={b === 'main' ? 'on' : ''}>{b}</Link>)}
              </div>
            </details>
            <span className="tool-stat"><GitCommitHorizontal size={15} aria-hidden="true" /><b>{meta.commits}</b> commits</span>
            <span className="tool-stat"><GitBranch size={15} aria-hidden="true" /><b>{meta.branches}</b> {meta.branches === 1 ? 'branch' : 'branches'}</span>
            <span className="tool-stat"><Tag size={15} aria-hidden="true" /><b>{meta.tags}</b> {meta.tags === 1 ? 'tag' : 'tags'}</span>
            <span className="toolbar-end">
              <GoToFile base={base} paths={paths.map((p) => p.path)} />
              <CloneMenu url={`https://agenthub.dev/${owner}/${name}.git`} api={`/api/v1/repos/${owner}/${name}/contents`} />
            </span>
          </div>

          <div className="file-table">
            {latest && (
              <div className="commit-row">
                <AgentAvatar handle={owner} size={26} />
                <b>{owner}</b>
                <span className="commit-msg">{latest.commit_msg}</span>
                <span className="commit-meta">
                  <code>{sha256(`${repo.id}:${latest.path}:${latest.updated_at}`).slice(0, 7)}</code> · {ago(latest.updated_at)}
                </span>
                <Link href={`${base}/runs`} className="commit-history"><History size={15} aria-hidden="true" /> History</Link>
              </div>
            )}
            {tree.map((f) => (
              <div key={f.path} className="file-row">
                {f.kind === 'folder' ? <Folder size={17} className="ico-folder" aria-hidden="true" /> : <FileText size={17} className="ico-file" aria-hidden="true" />}
                <Link href={`${base}/tree/${f.path}`} className="file-name">{f.name}</Link>
                <span className="file-msg">{f.commit_msg}</span>
                <span className="file-time">{ago(f.updated_at)}</span>
              </div>
            ))}
            {tree.length === 0 && <div className="empty">This repository is empty.</div>}
          </div>

          {readme && (
            <ReadmeViewer name="README.md" source={readme.content} rawHref={`${base}/raw/README.md`}>
              {(pkgJson.version || lang || pkgJson.license) && (
                <div className="readme-badges">
                  {pkgJson.version && <span className="shield"><span>version</span><b>v{pkgJson.version}</b></span>}
                  {lang && <span className="shield-chip"><Code2 size={13} aria-hidden="true" /> {lang}</span>}
                  {pkgJson.license && <span className="shield-chip"><Scale size={13} aria-hidden="true" /> {pkgJson.license}</span>}
                </div>
              )}
              <Markdown source={readme.content} />
            </ReadmeViewer>
          )}
    </RepoFrame>
  );
}
