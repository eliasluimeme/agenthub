import { GitPullRequest, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ago, parseJson } from '@/lib/format';
import type { Issue, Pull } from '@/lib/types';
import { AgentAvatar } from './server';
import { Badge } from './ui';

export type ColumnId = 'backlog' | 'progress' | 'review' | 'done';

const COLUMNS: { id: ColumnId; title: string; hint: string }[] = [
  { id: 'backlog', title: 'Backlog', hint: 'Open and unclaimed' },
  { id: 'progress', title: 'In progress', hint: 'Assigned or claimed by an agent' },
  { id: 'review', title: 'In review', hint: 'Has an open pull request' },
  { id: 'done', title: 'Done', hint: 'Closed or merged' },
];

/** Status is derived from what agents actually did, so the board never drifts from the repo. */
export function columnOf(issue: Issue, pull?: Pull): ColumnId {
  if (issue.state === 'closed' || pull?.state === 'merged') return 'done';
  if (pull?.state === 'open' || issue.claim_status === 'in_review') return 'review';
  if (issue.assignee || issue.claim_status === 'claimed') return 'progress';
  return 'backlog';
}

function IssueCard({ base, issue, pull }: { base: string; issue: Issue; pull?: Pull }) {
  const labels = parseJson<string[]>(issue.labels, []);
  const who = issue.assignee ?? pull?.author ?? null;
  return (
    <Card className="relative overflow-hidden transition hover:bg-(--glass-2)">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="mut xs">#{issue.number}</span>
          {issue.bounty > 0 && <Badge bright>{issue.bounty} credits</Badge>}
        </div>
        <Link href={`${base}/issues/${issue.number}`} className="block text-[15px] font-medium leading-snug text-(--ice)">
          {issue.title}
        </Link>
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => <Badge key={l}>{l}</Badge>)}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {pull && (
              <Link href={`${base}/pull/${pull.number}`} className="inline-flex items-center gap-1 text-(--frost)">
                <GitPullRequest className="size-3.5" strokeWidth={1.5} />#{pull.number}
              </Link>
            )}
            <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" strokeWidth={1.5} />{issue.comment_count}</span>
            <span>{ago(issue.state === 'closed' ? issue.closed_at : issue.created_at)}</span>
          </div>
          {who && (
            <span title={`@${who}`} className="size-6 shrink-0 ring-4 ring-(--canvas) rounded-full">
              <AgentAvatar handle={who} size={24} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ base, issues, pulls }: { base: string; issues: Issue[]; pulls: Pull[] }) {
  // Prefer the open/merged pull when several point at the same issue.
  const pullFor = new Map<number, Pull>();
  for (const p of pulls) {
    if (p.issue_number == null) continue;
    const cur = pullFor.get(p.issue_number);
    if (!cur || (p.state === 'open' && cur.state !== 'open') || (p.state === 'merged' && cur.state === 'closed')) pullFor.set(p.issue_number, p);
  }
  const cols = new Map<ColumnId, { issue: Issue; pull?: Pull }[]>(COLUMNS.map((c) => [c.id, []]));
  for (const issue of issues) {
    const pull = pullFor.get(issue.number);
    cols.get(columnOf(issue, pull))!.push({ issue, pull });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 [&_*]:border-(--hair)">
      {COLUMNS.map((c) => {
        const items = cols.get(c.id)!;
        return (
          <section key={c.id} aria-label={c.title} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-(--glass) p-3">
            <header className="flex items-center gap-2 px-1 pt-1">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => <span key={i} className={`block size-2 rounded-full border ${i === 0 && items.length ? 'bg-(--frost)' : 'bg-white/10'}`} />)}
              </span>
              <h2 className="text-sm font-medium text-white">{c.title}</h2>
              <span className="badge ml-auto">{items.length}</span>
            </header>
            <p className="mut xs px-1">{c.hint}</p>
            <div className="flex flex-col gap-3">
              {items.map(({ issue, pull }) => <IssueCard key={issue.id} base={base} issue={issue} pull={pull} />)}
              {items.length === 0 && <div className="mut sm rounded-lg border border-dashed px-3 py-8 text-center">Nothing here</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
