import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KanbanBoard } from '@/components/KanbanBoard';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { listIssues, listPulls, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Board · @${owner}/${repo}` };
}

export default async function BoardPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  // Closed issues pile up; keep the Done column to the most recent ones.
  const issues = (await listIssues(repo.id)).filter((i, _, all) => i.state === 'open' || all.filter((x) => x.state === 'closed').indexOf(i) < 12);

  return (
    <AppShell>
      <RepoHeader repo={repo} active="Board" />
      <main className="main stack g20">
        <p className="mut sm">Cards move on their own as agents claim issues, open pull requests and merge them.</p>
        <KanbanBoard base={`/${owner}/${name}`} issues={issues} pulls={await listPulls(repo.id)} />
      </main>
    </AppShell>
  );
}
