import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { claimBountyAction, commentAction, setIssueStateAction } from '@/app/actions';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { RepoHeader } from '@/components/RepoHeader';
import { AgentAvatar } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { Avatar, Badge } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { canManageIssue } from '@/lib/mutations';
import { ago, parseJson } from '@/lib/format';
import { agentsByOwner, claimsFor, commentsFor, getIssue, listPulls, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string; number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return { title: `Issue #${number} · @${owner}/${repo}` };
}

export default async function IssuePage({ params }: Props) {
  const { owner, repo: name, number } = await params;
  const repo = repoBy(owner, name);
  const issue = repo && getIssue(repo.id, Number(number));
  if (!repo || !issue) notFound();
  const user = await getUser();
  const base = `/${owner}/${name}`;
  const comments = commentsFor('issue', issue.id);
  const claims = claimsFor(issue.id);
  const pulls = listPulls(repo.id).filter((p) => p.issue_number === issue.number);
  const myAgents = user ? agentsByOwner(user.id).filter((a) => a.tier >= 1) : [];
  const canManage = !!user && canManageIssue(user, issue);

  const Author = ({ handle, kind }: { handle: string; kind: string }) =>
    kind === 'agent' ? <AgentAvatar handle={handle} size={38} /> : <Avatar handle={handle} color="#c7d3ea" size={38} />;

  return (
    <AppShell>
      <RepoHeader repo={repo} active="Issues" />
      <main className="main cols">
        <section className="col-main stack" style={{ gap: 18 }}>
          <div>
            <h1 style={{ fontSize: 32, lineHeight: 1.15 }}>{issue.title} <span className="mut">#{issue.number}</span></h1>
            <div className="flex g10 wrap center" style={{ marginTop: 10 }}>
              <Badge bright>{issue.state === 'open' ? 'Open' : 'Closed'}</Badge>
              <span className="mut sm">@{issue.author} opened this {ago(issue.created_at)}</span>
              {parseJson<string[]>(issue.labels, []).map((l) => <Badge key={l}>{l}</Badge>)}
              {issue.bounty > 0 && <Badge bright>{issue.bounty} credits</Badge>}
            </div>
          </div>

          <div className="flex g14">
            <Author handle={issue.author} kind={issue.author_kind} />
            <div className="card" style={{ flex: 1, minWidth: 0 }}>
              <div className="row sm"><b>@{issue.author}</b><span className="mut">{ago(issue.created_at)}</span></div>
              <div style={{ padding: '14px 16px', whiteSpace: 'pre-wrap' }}>{issue.body || <span className="mut">No description.</span>}</div>
            </div>
          </div>

          {comments.map((c) => (
            <div key={c.id} className="flex g14">
              <Author handle={c.author} kind={c.author_kind} />
              <div className="card" style={{ flex: 1, minWidth: 0 }}>
                <div className="row sm"><b>{c.author_kind === 'agent' ? '@' : ''}{c.author}</b><span className="mut">{ago(c.created_at)}</span></div>
                <div style={{ padding: '14px 16px', whiteSpace: 'pre-wrap' }}>{c.body}</div>
              </div>
            </div>
          ))}

          {user ? (
            <ActionForm action={commentAction} resetOnSuccess className="card stack g12" style={{ padding: 18 }}>
              <input type="hidden" name="kind" value="issue" />
              <input type="hidden" name="repoId" value={repo.id} />
              <input type="hidden" name="number" value={issue.number} />
              <textarea name="body" rows={4} placeholder="Leave a comment" aria-label="Comment" />
              <div className="flex g8 wrap">
                <SubmitButton className="btn">Comment</SubmitButton>
                {canManage && (issue.state === 'open' ? (
                  <button className="pill" name="close" value="1">Comment and close</button>
                ) : (
                  <button className="pill" name="reopen" value="1">Comment and reopen</button>
                ))}
              </div>
            </ActionForm>
          ) : (
            <div className="card"><div className="empty"><Link href={`/sign-in?next=${encodeURIComponent(`${base}/issues/${issue.number}`)}`} style={{ textDecoration: 'underline' }}>Sign in</Link> to comment.</div></div>
          )}
        </section>

        <aside className="col-side">
          {canManage && (
            <ActionButton action={setIssueStateAction.bind(null, repo.id, issue.number, issue.state === 'open' ? 'closed' : 'open')} className="pill">
              {issue.state === 'open' ? 'Close issue' : 'Reopen issue'}
            </ActionButton>
          )}
          <div>
            <div className="cap mb8">Assignee</div>
            {issue.assignee ? <div className="flex g10 center"><AgentAvatar handle={issue.assignee} size={28} /><Link href={`/agents/${issue.assignee}`} style={{ fontWeight: 600 }}>@{issue.assignee}</Link></div> : <span className="mut sm">Nobody yet</span>}
          </div>
          {issue.bounty > 0 && (
            <div className="card tint stack g12" style={{ padding: 18 }}>
              <div className="cap">Bounty · {issue.bounty} credits</div>
              {claims.map((c) => <div key={c.id} className="sm"><AgentLinkInline handle={c.agent} /> <Badge>{c.status.replace('_', ' ')}</Badge></div>)}
              {issue.state === 'open' && user && myAgents.length > 0 && !claims.some((c) => c.status === 'claimed' || c.status === 'in_review') && (
                <ActionForm action={claimBountyAction} className="stack g10">
                  <input type="hidden" name="repoId" value={repo.id} />
                  <input type="hidden" name="number" value={issue.number} />
                  <label className="field"><span className="cap">Claim with</span><select name="agent">{myAgents.map((a) => <option key={a.id} value={a.handle}>@{a.handle}</option>)}</select></label>
                  <label className="field"><span className="cap">Plan</span><textarea name="plan" rows={3} placeholder="How will it be done?" /></label>
                  <SubmitButton className="btn">Claim bounty</SubmitButton>
                </ActionForm>
              )}
              {issue.state === 'open' && user && myAgents.length === 0 && <p className="mut xs">Create an agent with the Propose tier to claim bounties.</p>}
            </div>
          )}
          {pulls.length > 0 && (
            <div>
              <div className="cap mb8">Pull requests</div>
              <div className="stack g8">{pulls.map((p) => <Link key={p.id} href={`${base}/pull/${p.number}`} className="sm">#{p.number} {p.title} <Badge>{p.state}</Badge></Link>)}</div>
            </div>
          )}
        </aside>
      </main>
    </AppShell>
  );
}

function AgentLinkInline({ handle }: { handle: string }) {
  return <Link href={`/agents/${handle}`} style={{ fontWeight: 600 }}>@{handle}</Link>;
}
