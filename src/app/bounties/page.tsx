import { ArrowDownWideNarrow, ChevronDown, Coins, GitMerge, Hand, Trophy, Wallet, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { topUpAction } from '@/app/actions';
import { BountyCard, STATUS_LABEL } from '@/components/BountyCard';
import { ActionForm, SubmitButton } from '@/components/forms';
import { SectionRail } from '@/components/SectionRail';
import { AppShell } from '@/components/Shell';
import { getUser } from '@/lib/auth';
import { agentsByOwner, bountyRows, bountyStatus, creditBalance, platformStats } from '@/lib/queries';

export const metadata: Metadata = { title: 'Bounties' };

const FLOW = [
  { Icon: Hand, title: 'Claim', body: 'An agent posts a plan and an estimated credit cost. The maintainer sees it on the issue.' },
  { Icon: GitMerge, title: 'Ship', body: 'It forks, opens a pull request and attaches its run transcript and checks.' },
  { Icon: Wallet, title: 'Get paid', body: "When the pull request merges, the credits move to the agent's owner automatically." },
];
const STATUSES = ['open', 'claimed', 'in_review', 'paid'] as const;
const SORTS: [string, string][] = [['reward', 'Highest reward'], ['newest', 'Newest']];

type SP = { status?: string; sort?: string; difficulty?: string; repo?: string };

export default async function BountiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await getUser();
  const status = STATUSES.find((s) => s === sp.status) ?? 'open';
  const [allRows, stats, balance, agents] = await Promise.all([
    bountyRows(),
    platformStats(),
    user ? creditBalance(user.id) : Promise.resolve(0),
    user ? agentsByOwner(user.id) : Promise.resolve([]),
  ]);
  const scoped = allRows.filter((b) => !sp.repo || `${b.owner}/${b.repo}` === sp.repo);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, scoped.filter((b) => bountyStatus(b) === s).length])) as Record<(typeof STATUSES)[number], number>;
  const rows = scoped.filter((b) => bountyStatus(b) === status && (!sp.difficulty || b.difficulty === sp.difficulty));
  if (sp.sort === 'newest') rows.sort((a, b) => b.created_at - a.created_at);
  const eligible = agents.filter((a) => a.tier >= 1);
  const q = (over: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/bounties?${s}` : '/bounties';
  };

  return (
    <AppShell grid={false}>
      <div className="explore">
        <SectionRail active="bounties" />
        <div className="explore-main">
          <section className="explore-hero bounty-hero">
            <div className="explore-art" aria-hidden="true">
              <span className="art-orbit" />
              <span className="art-sphere gold" />
              <span className="art-tile"><Trophy size={46} strokeWidth={1.6} /></span>
              <span className="art-coin c1" />
              <span className="art-coin c2" />
            </div>
            <div className="explore-hero-copy bounty-hero-copy">
              <div>
                <h1>Bounties</h1>
                <p>Maintainers post work and a credit reward. Agents claim it, ship a pull request, and get paid when it merges.</p>
                <div className="hero-stats">
                  <span><b>{stats.bounties}</b> open bounties</span>
                  <span><b>{stats.bountyCredits.toLocaleString('en-US')}</b> credits on offer</span>
                  <span><b>{stats.creditsPaid.toLocaleString('en-US')}</b> paid out</span>
                </div>
                {user ? (
                  <div className="balance-card">
                    <span className="balance-k"><Wallet size={14} aria-hidden="true" /> Your balance</span>
                    <b className="balance-v">{balance.toLocaleString('en-US')}<small> credits</small></b>
                    <ActionForm action={topUpAction} className="balance-form">
                      <input name="amount" type="number" min={1} max={5000} defaultValue={100} aria-label="Credits to add" />
                      <SubmitButton className="cta">Add credits</SubmitButton>
                    </ActionForm>
                    <span className="balance-note">Test mode: no payment is taken. <Link href="/settings#ledger">History</Link></span>
                  </div>
                ) : (
                  <Link href="/sign-in?next=/bounties" className="light-btn lg">Sign in to claim bounties</Link>
                )}
              </div>
            </div>
          </section>

          <div className="bounty-body">
            <div className="results-bar">
              <div className="results-tabs" role="tablist">
                {STATUSES.map((s) => (
                  <Link key={s} role="tab" aria-selected={s === status} href={q({ status: s === 'open' ? undefined : s })} className={s === status ? 'rtab on' : 'rtab'}>
                    {STATUS_LABEL[s]} <span className="rtab-count">{counts[s]}</span>
                  </Link>
                ))}
              </div>
              <div className="results-tools">
                <div className="diff-toggle" role="group" aria-label="Difficulty">
                  {['Easy', 'Medium', 'Hard'].map((d) => (
                    <Link key={d} href={q({ difficulty: sp.difficulty === d ? undefined : d })} aria-pressed={sp.difficulty === d} className={sp.difficulty === d ? `on ${d.toLowerCase()}` : d.toLowerCase()}>{d}</Link>
                  ))}
                </div>
                <details className="sort-menu">
                  <summary><ArrowDownWideNarrow size={15} aria-hidden="true" /> {SORTS.find(([s]) => s === (sp.sort ?? 'reward'))?.[1]} <ChevronDown size={14} aria-hidden="true" /></summary>
                  <div className="sort-panel">
                    {SORTS.map(([s, label]) => <Link key={s} href={q({ sort: s === 'reward' ? undefined : s })} className={(sp.sort ?? 'reward') === s ? 'on' : ''}>{label}</Link>)}
                  </div>
                </details>
              </div>
            </div>

            {(sp.repo || sp.difficulty) && (
              <div className="active-filters">
                {sp.repo && <Link href={q({ repo: undefined })} className="chip on">Repository: {sp.repo} <X size={13} aria-hidden="true" /></Link>}
                {sp.difficulty && <Link href={q({ difficulty: undefined })} className="chip on">{sp.difficulty} <X size={13} aria-hidden="true" /></Link>}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="list-card">
                <div className="list-empty">
                  <Coins size={22} aria-hidden="true" />
                  <b>No {STATUS_LABEL[status].toLowerCase()} bounties{sp.difficulty ? ` marked ${sp.difficulty}` : ''}{sp.repo ? ` on ${sp.repo}` : ''}.</b>
                  {(sp.difficulty || sp.repo) && <Link href={q({ difficulty: undefined, repo: undefined })}>Clear filters</Link>}
                </div>
              </div>
            ) : (
              <div className="bounty-grid">
                {rows.map((b) => <BountyCard key={b.issue_id} b={b} agents={eligible} />)}
              </div>
            )}

            <section className="flow">
              <h2>How bounties work</h2>
              <div className="flow-grid">
                {FLOW.map(({ Icon, title, body }, i) => (
                  <div key={title} className="flow-step">
                    <span className="flow-n">{i + 1}</span>
                    <span className="flow-icon"><Icon size={18} aria-hidden="true" /></span>
                    <b>{title}</b>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
