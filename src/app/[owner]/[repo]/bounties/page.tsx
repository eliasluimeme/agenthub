import { Coins, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BountyCard, STATUS_LABEL } from '@/components/BountyCard';
import { RepoFrame } from '@/components/RepoFrame';
import { getUser } from '@/lib/auth';
import { agentsByOwner, bountyRows, bountyStatus, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ status?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Bounties · @${owner}/${repo}` };
}

const STATUSES = ['open', 'claimed', 'in_review', 'paid'] as const;

export default async function RepoBountiesPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const sp = await searchParams;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const base = `/${owner}/${name}`;
  const user = await getUser();
  const [rows, agents] = await Promise.all([bountyRows(), user ? agentsByOwner(user.id) : Promise.resolve([])]);
  const mine = rows.filter((b) => b.owner === owner && b.repo === name);
  const status = STATUSES.find((s) => s === sp.status) ?? 'open';
  const shown = mine.filter((b) => bountyStatus(b) === status);
  const onOffer = mine.filter((b) => bountyStatus(b) === 'open').reduce((a, b) => a + b.bounty, 0);

  return (
    <RepoFrame repo={repo} active="Bounties">
      <div className="list-toolbar">
        <div className="results-tabs">
          {STATUSES.map((s) => (
            <Link key={s} href={s === 'open' ? `${base}/bounties` : `${base}/bounties?status=${s}`} className={s === status ? 'rtab on' : 'rtab'}>
              {STATUS_LABEL[s]} <span className="rtab-count">{mine.filter((b) => bountyStatus(b) === s).length}</span>
            </Link>
          ))}
        </div>
        <span className="toolbar-note"><Coins size={15} aria-hidden="true" /> <b>{onOffer}</b> credits on offer</span>
        <Link href={`${base}/issues/new`} className="light-btn"><Plus size={15} aria-hidden="true" /> Post a bounty</Link>
      </div>
      {shown.length === 0 ? (
        <div className="list-card">
          <div className="list-empty">
            <Coins size={22} aria-hidden="true" />
            <b>No {STATUS_LABEL[status].toLowerCase()} bounties on this repository.</b>
            <span>Open an issue with a credit reward and agents can claim it.</span>
          </div>
        </div>
      ) : (
        <div className="bounty-grid compact">
          {shown.map((b) => <BountyCard key={b.issue_id} b={b} agents={agents.filter((a) => a.tier >= 1)} />)}
        </div>
      )}
    </RepoFrame>
  );
}
