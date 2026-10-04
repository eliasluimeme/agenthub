import { Folder, FileText, History } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CodeView, languageName } from '@/components/CodeView';
import { FileTree } from '@/components/FileTree';
import { Markdown } from '@/components/Markdown';
import { RepoFrame } from '@/components/RepoFrame';
import { CopyButton, FileViewer, ReadmeViewer } from '@/components/RepoTools';
import { AgentAvatar } from '@/components/server';
import { sha256 } from '@/lib/crypto';
import { all } from '@/lib/db';
import { ago } from '@/lib/format';
import { repoBy, repoFile, repoTree } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string; path: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, path } = await params;
  return { title: `${path.map(decodeURIComponent).join('/')} · @${owner}/${repo}` };
}

const size = (n: number) => (n < 1024 ? `${n} Bytes` : `${(n / 1024).toFixed(2)} KB`);

export default async function TreePage({ params }: Props) {
  const { owner, repo: name, path: segs } = await params;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const path = segs.map(decodeURIComponent).join('/');
  const base = `/${owner}/${name}`;
  const [file, paths] = await Promise.all([
    repoFile(repo.id, path),
    all<{ path: string; updated_at: number; commit_msg: string }>('SELECT path, updated_at, commit_msg FROM repo_files WHERE repo_id = ? ORDER BY path', repo.id),
  ]);
  const entries = file ? [] : await repoTree(repo.id, path);
  if (!file && entries.length === 0) notFound();

  const crumbs = path.split('/');
  // Latest change: the file itself, or the newest file inside the folder.
  const latest = file ?? [...paths].filter((p) => p.path.startsWith(`${path}/`)).sort((a, b) => b.updated_at - a.updated_at)[0];
  const folderReadme = !file ? await repoFile(repo.id, `${path}/README.md`) : undefined;

  return (
    <RepoFrame repo={repo} active="Code" sidebar={<FileTree base={base} paths={paths.map((p) => p.path)} current={path} branch={repo.default_branch} />}>
      <div className="crumbs">
        <Link href={base} className="crumb-root">{name}</Link>
        {crumbs.map((c, i) => (
          <span key={i} className="crumb">
            <span className="crumb-sep">/</span>
            {i === crumbs.length - 1 ? <b>{c}</b> : <Link href={`${base}/tree/${crumbs.slice(0, i + 1).join('/')}`}>{c}</Link>}
          </span>
        ))}
        <CopyButton text={path} label="" className="icon-btn crumb-copy" />
      </div>

      {latest && (
        <div className="file-table">
          <div className="commit-row">
            <AgentAvatar handle={owner} size={26} />
            <b>{owner}</b>
            <span className="commit-msg">{latest.commit_msg}</span>
            <span className="commit-meta"><code>{sha256(`${repo.id}:${latest.path}:${latest.updated_at}`).slice(0, 7)}</code> · {ago(latest.updated_at)}</span>
            <Link href={`${base}/runs`} className="commit-history"><History size={15} aria-hidden="true" /> History</Link>
          </div>
        </div>
      )}

      {file ? (
        <FileViewer
          meta={`${file.content.replace(/\n$/, '').split('\n').length} lines (${file.content.split('\n').filter((l) => l.trim()).length} loc) · ${size(new TextEncoder().encode(file.content).length)} · ${languageName(path)}`}
          source={file.content}
          rawHref={`${base}/raw/${path}`}
          preview={path.toLowerCase().endsWith('.md') ? <Markdown source={file.content} /> : undefined}
          code={<CodeView path={path} source={file.content} />}
        />
      ) : (
        <>
          <div className="file-table">
            <Link href={crumbs.length > 1 ? `${base}/tree/${crumbs.slice(0, -1).join('/')}` : base} className="file-row up"><Folder size={17} className="ico-folder" aria-hidden="true" /><span className="file-name">..</span></Link>
            {entries.map((f) => (
              <div key={f.path} className="file-row">
                {f.kind === 'folder' ? <Folder size={17} className="ico-folder" aria-hidden="true" /> : <FileText size={17} className="ico-file" aria-hidden="true" />}
                <Link href={`${base}/tree/${f.path}`} className="file-name">{f.name}</Link>
                <span className="file-msg">{f.commit_msg}</span>
                <span className="file-time">{ago(f.updated_at)}</span>
              </div>
            ))}
          </div>
          {folderReadme && (
            <ReadmeViewer name="README.md" source={folderReadme.content} rawHref={`${base}/raw/${path}/README.md`}>
              <Markdown source={folderReadme.content} />
            </ReadmeViewer>
          )}
        </>
      )}
    </RepoFrame>
  );
}
