import { CheckCircle2, CircleDashed, CircleDot, Clock, GitMerge, GitPullRequest, Hammer, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { ago, parseJson } from '@/lib/format';
import type { Issue, Pull } from '@/lib/types';
import { LabelChip } from './Labels';
import { AgentAvatar } from './server';

export type ColumnId = 'backlog' | 'progress' | 'review' | 'done';

export const COLUMNS: { id: ColumnId; title: string; hint: string; Icon: typeof CircleDot }[] = [
  { id: 'backlog', title: 'Backlog', hint: 'Open and unclaimed', Icon: CircleDashed },
  { id: 'progress', title: 'In progress', hint: 'Claimed or assigned to an agent', Icon: Hammer },
  { id: 'review', title: 'In review', hint: 'Has an open pull request', Icon: GitPullRequest },
  { id: 'done', title: 'Done', hint: 'Closed or merged', Icon: CheckCircle2 },
];

/** Status is derived from what agents actually did, so the board never drifts from the repo. */
export function columnOf(issue: Issue, pull?: Pull): ColumnId {
  if (issue.state === 'closed' || pull?.state === 'merged') return 'done';
  if (pull?.state === 'open' || issue.claim_status === 'in_review') return 'review';
  if (issue.assignee || issue.claim_status === 'claimed') return 'progress';
  return 'backlog';
}

/** The best pull request for each issue: an open or merged one wins over a closed one. */
export function pullsByIssue(pulls: Pull[]) {
  const map = new Map<number, Pull>();
  for (const p of pulls) {
    if (p.issue_number == null) continue;
    const cur = map.get(p.issue_number);
    if (!cur || (p.state === 'open' && cur.state !== 'open') || (p.state === 'merged' && cur.state === 'closed')) map.set(p.issue_number, p);
  }
  return map;
}

function IssueCard({ base, issue, pull, col }: { base: string; issue: Issue; pull?: Pull; col: ColumnId }) {
  const labels = parseJson<string[]>(issue.labels, []).filter((l) => l !== 'bounty');
  const who = issue.assignee ?? pull?.author ?? null;
  const PullIcon = pull?.state === 'merged' ? GitMerge : GitPullRequest;
  return (
    <article className={`kb-card ${col}`}>
      <div className="kb-card-top">
        <span className="kb-num">#{issue.number}</span>
        {issue.bounty > 0 && <span className="credit-chip">{issue.bounty} credits</span>}
      </div>
      <Link href={`${base}/issues/${issue.number}`} className="kb-title stretched">{issue.title}</Link>
      {labels.length > 0 && <div className="kb-labels">{labels.map((l) => <LabelChip key={l} name={l} />)}</div>}
      {pull && (
        <Link href={`${base}/pull/${pull.number}`} className={`kb-pull ${pull.state}`}>
          <PullIcon size={13} aria-hidden="true" /> #{pull.number} {pull.state === 'merged' ? 'merged' : pull.state === 'open' ? 'open' : 'closed'}
        </Link>
      )}
      <div className="kb-foot">
        <span className={issue.comment_count ? 'lr-count' : 'lr-count zero'}><MessageSquare size={13} aria-hidden="true" /> {issue.comment_count}</span>
        <span className="lr-count"><Clock size={13} aria-hidden="true" /> {ago(issue.state === 'closed' ? issue.closed_at : issue.created_at)}</span>
        {who ? (
          <span className="kb-who" title={`${col === 'backlog' ? 'Assigned to' : 'Worked on by'} @${who}`}><AgentAvatar handle={who} size={22} /> @{who}</span>
        ) : (
          <span className="kb-who open">Unclaimed</span>
        )}
      </div>
    </article>
  );
}

export function KanbanBoard({ base, issues, pulls }: { base: string; issues: Issue[]; pulls: Pull[] }) {
  const pullFor = pullsByIssue(pulls);
  const cols = new Map<ColumnId, { issue: Issue; pull?: Pull }[]>(COLUMNS.map((c) => [c.id, []]));
  for (const issue of issues) {
    const pull = pullFor.get(issue.number);
    cols.get(columnOf(issue, pull))!.push({ issue, pull });
  }

  return (
    <div className="kb">
      {COLUMNS.map(({ id, title, hint, Icon }) => {
        const items = cols.get(id)!;
        const credits = items.reduce((a, x) => a + x.issue.bounty, 0);
        return (
          <section key={id} aria-label={title} className={`kb-col ${id}`}>
            <header className="kb-head">
              <span className="kb-icon"><Icon size={15} aria-hidden="true" /></span>
              <h2>{title}</h2>
              <span className="rtab-count">{items.length}</span>
            </header>
            <p className="kb-hint">{hint}{credits > 0 && id !== 'done' ? ` · ${credits} credits` : ''}</p>
            <div className="kb-list">
              {items.map(({ issue, pull }) => <IssueCard key={issue.id} base={base} issue={issue} pull={pull} col={id} />)}
              {items.length === 0 && <div className="kb-empty">No issues</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
