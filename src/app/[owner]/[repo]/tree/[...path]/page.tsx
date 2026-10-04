import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { Markdown } from '@/components/Markdown';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { ago } from '@/lib/format';
import { repoBy, repoFile, repoTree } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string; path: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, path } = await params;
  return { title: `${path.join('/')} · @${owner}/${repo}` };
}

export default async function TreePage({ params }: Props) {
  const { owner, repo: name, path: segs } = await params;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const path = segs.map(decodeURIComponent).join('/');
  const base = `/${owner}/${name}`;
  const file = await repoFile(repo.id, path);
  const entries = file ? [] : await repoTree(repo.id, path);
  if (!file && entries.length === 0) notFound();

  const crumbs = path.split('/');
  const parent = crumbs.length > 1 ? `${base}/tree/${crumbs.slice(0, -1).join('/')}` : base;

  return (
    <AppShell>
      <RepoHeader repo={repo} active="Code" />
      <main className="main stack g20">
        <div className="flex center g8 wrap sm">
          <Link href={base} style={{ fontWeight: 600 }}>{name}</Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex center g8"><span className="mut">/</span>{i === crumbs.length - 1 ? <b>{c}</b> : <Link href={`${base}/tree/${crumbs.slice(0, i + 1).join('/')}`}>{c}</Link>}</span>
          ))}
        </div>

        {file ? (
          <div className="card">
            <div className="row sm" style={{ background: 'rgba(186,214,247,0.06)' }}>
              <b>{crumbs[crumbs.length - 1]}</b>
              <span className="mut">{file.content.split('\n').length} lines</span>
              <span className="mut" style={{ marginLeft: 'auto' }}>{file.commit_msg} · {ago(file.updated_at)}</span>
            </div>
            {path.endsWith('.md') ? (
              <div style={{ padding: 32 }}><Markdown source={file.content} /></div>
            ) : (
              <div className="blob">
                {file.content.replace(/\n$/, '').split('\n').map((l, i) => (
                  <div key={i}><span className="ln">{i + 1}</span>{l}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            <Link href={parent} className="row sm" style={{ color: 'var(--mut)' }}>..</Link>
            {entries.map((f) => (
              <div key={f.path} className="row sm" style={{ padding: '11px 16px' }}>
                <span style={{ width: 20, display: 'flex' }}><Icon name={f.kind} size={16} color="var(--fog)" stroke={1.5} /></span>
                <Link href={`${base}/tree/${f.path}`} style={{ fontWeight: 500, minWidth: 150 }}>{f.name}</Link>
                <span className="mut" style={{ flex: 1, minWidth: 0 }}>{f.commit_msg}</span>
                <span className="mut" style={{ whiteSpace: 'nowrap' }}>{ago(f.updated_at)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
