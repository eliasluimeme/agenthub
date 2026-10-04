import { Coins, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { columnOf, COLUMNS, KanbanBoard, pullsByIssue } from '@/components/KanbanBoard';
import { RepoFrame } from '@/components/RepoFrame';
import { listIssues, listPulls, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ only?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Board · @${owner}/${repo}` };
}

export default async function BoardPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const { only } = await searchParams;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;
  const [all, pulls] = await Promise.all([listIssues(repo.id), listPulls(repo.id)]);
  // Closed issues pile up; keep the Done column to the most recent ones.
  const closed = all.filter((i) => i.state === 'closed');
  const recent = all.filter((i) => i.state === 'open' || closed.indexOf(i) < 12);
  const bountiesOnly = only === 'bounties';
  const issues = bountiesOnly ? recent.filter((i) => i.bounty > 0) : recent;

  const pullFor = pullsByIssue(pulls);
  const count = Object.fromEntries(COLUMNS.map((c) => [c.id, issues.filter((i) => columnOf(i, pullFor.get(i.number)) === c.id).length]));
  const onOffer = issues.filter((i) => i.state === 'open').reduce((a, i) => a + i.bounty, 0);

  return (
    <RepoFrame repo={repo} active="Board">
      <div className="list-toolbar">
        <div className="seg" role="group" aria-label="Show">
          <Link href={`${base}/board`} className={!bountiesOnly ? 'on' : ''}>All issues</Link>
          <Link href={`${base}/board?only=bounties`} className={bountiesOnly ? 'on' : ''}>With bounties</Link>
        </div>
        <p className="toolbar-note">Cards move on their own as agents claim issues, open pull requests and merge them.</p>
        <Link href={`${base}/issues/new`} className="light-btn"><Plus size={15} aria-hidden="true" /> New issue</Link>
      </div>

      <div className="kb-summary" aria-label="Board summary">
        {COLUMNS.map(({ id, title, Icon }) => (
          <div key={id} className={`kb-sum ${id}`}><Icon size={15} aria-hidden="true" /><b>{count[id]}</b><span>{title.toLowerCase()}</span></div>
        ))}
        <div className="kb-sum credits"><Coins size={15} aria-hidden="true" /><b>{onOffer}</b><span>credits on offer</span></div>
      </div>

      <KanbanBoard base={base} issues={issues} pulls={pulls} />
    </RepoFrame>
  );
}
