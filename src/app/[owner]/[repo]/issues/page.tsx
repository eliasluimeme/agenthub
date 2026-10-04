import { CheckCircle2, ChevronDown, CircleDot, MessageSquare, Plus, Search, Tags } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LabelChip } from '@/components/Labels';
import { RepoFrame } from '@/components/RepoFrame';
import { AgentAvatar } from '@/components/server';
import { ago, parseJson } from '@/lib/format';
import { listIssues, repoBy, repoCounts } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ state?: string; q?: string; label?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Issues · @${owner}/${repo}` };
}

export default async function IssuesPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const sp = await searchParams;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const state = sp.state === 'closed' ? 'closed' : 'open';
  const base = `/${owner}/${name}`;
  const [counts, issues, everything] = await Promise.all([repoCounts(repo.id), listIssues(repo.id, { state, q: sp.q, label: sp.label }), listIssues(repo.id)]);
  const labels = [...new Set(everything.flatMap((i) => parseJson<string[]>(i.labels, [])))].sort();
  const href = (over: { state?: string; label?: string | null }) => {
    const p = new URLSearchParams();
    const st = over.state ?? state;
    if (st === 'closed') p.set('state', 'closed');
    if (sp.q) p.set('q', sp.q);
    const label = over.label === null ? undefined : over.label ?? sp.label;
    if (label) p.set('label', label);
    const s = p.toString();
    return s ? `${base}/issues?${s}` : `${base}/issues`;
  };

  return (
    <RepoFrame repo={repo} active="Issues">
      <div className="list-toolbar">
        <form className="list-search">
          <Search size={15} aria-hidden="true" />
          {state === 'closed' && <input type="hidden" name="state" value="closed" />}
          {sp.label && <input type="hidden" name="label" value={sp.label} />}
          <input name="q" defaultValue={sp.q ?? ''} aria-label="Search issues" placeholder="Search issues by title, body or author" />
        </form>
        <details className="sort-menu">
          <summary><Tags size={15} aria-hidden="true" /> {sp.label ?? 'Labels'} <ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="sort-panel">
            <Link href={href({ label: null })} className={!sp.label ? 'on' : ''}>All labels</Link>
            {labels.map((l) => <Link key={l} href={href({ label: l })} className={sp.label === l ? 'on' : ''}><LabelChip name={l} /></Link>)}
          </div>
        </details>
        <Link href={`${base}/issues/new`} className="light-btn"><Plus size={15} aria-hidden="true" /> New issue</Link>
      </div>

      <div className="list-card">
        <div className="list-head">
          <Link href={href({ state: 'open' })} className={state === 'open' ? 'lh-tab on' : 'lh-tab'}><CircleDot size={15} aria-hidden="true" /> {counts.open} Open</Link>
          <Link href={href({ state: 'closed' })} className={state === 'closed' ? 'lh-tab on' : 'lh-tab'}><CheckCircle2 size={15} aria-hidden="true" /> {counts.closed} Closed</Link>
          {sp.label && <Link href={href({ label: null })} className="lh-filter">Label: <LabelChip name={sp.label} /> ×</Link>}
          <span className="lh-end">{counts.bounties} with bounties</span>
        </div>
        {issues.map((i) => (
          <div key={i.id} className="list-row">
            {i.state === 'open' ? <CircleDot size={18} className="st-open" aria-label="Open" /> : <CheckCircle2 size={18} className="st-done" aria-label="Closed" />}
            <div className="lr-main">
              <div className="lr-title">
                <Link href={`${base}/issues/${i.number}`}>{i.title}</Link>
                {parseJson<string[]>(i.labels, []).filter((l) => l !== 'bounty').map((l) => <LabelChip key={l} name={l} />)}
              </div>
              <div className="lr-meta">
                <AgentAvatar handle={i.author} size={18} />
                <span>#{i.number} {i.state === 'open' ? 'opened' : 'closed'} {ago(i.state === 'open' ? i.created_at : i.closed_at)} by <b>@{i.author}</b></span>
              </div>
            </div>
            <div className="lr-side">
              {i.bounty > 0 && <span className="credit-chip">{i.bounty} credits</span>}
              {i.assignee && <span title={`Assigned to @${i.assignee}`}><AgentAvatar handle={i.assignee} size={24} /></span>}
              <span className={i.comment_count ? 'lr-count' : 'lr-count zero'}><MessageSquare size={14} aria-hidden="true" /> {i.comment_count}</span>
            </div>
          </div>
        ))}
        {issues.length === 0 && (
          <div className="list-empty">
            <CircleDot size={22} aria-hidden="true" />
            <b>No {state} issues{sp.q ? ` matching “${sp.q}”` : ''}{sp.label ? ` labelled ${sp.label}` : ''}.</b>
            {(sp.q || sp.label) && <Link href={`${base}/issues`}>Clear filters</Link>}
          </div>
        )}
      </div>
    </RepoFrame>
  );
}
