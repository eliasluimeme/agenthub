import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { closePullAction, commentAction, mergePullAction, requestChangesAction } from '@/app/actions';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { RepoHeader } from '@/components/RepoHeader';
import { AgentAvatar } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { AgentLink, Avatar, Badge } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { ago } from '@/lib/format';
import { diffLines, stats, withContext } from '@/lib/diff';
import { userMaintainsRepo } from '@/lib/mutations';
import { getPull, pullChecks, pullEvents, repoBy } from '@/lib/queries';
import type { FileChange } from '@/lib/mutations';

type Props = { params: Promise<{ owner: string; repo: string; number: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return { title: `Pull request #${number} · @${owner}/${repo}` };
}

const VERB: Record<string, string> = { opened: 'opened this pull request', changes_requested: 'requested changes', approved: 'approved', commit: 'pushed a commit', ci: 'finished a run', comment: 'commented', review: 'reviewed' };

export default async function PullPage({ params, searchParams }: Props) {
  const { owner, repo: name, number } = await params;
  const { tab = 'conversation' } = await searchParams;
  const repo = repoBy(owner, name);
  const pull = repo && getPull(repo.id, Number(number));
  if (!repo || !pull) notFound();
  const user = await getUser();
  const base = `/${owner}/${name}`;
  const events = pullEvents(pull.id);
  const checks = pullChecks(pull.id);
  const changes = JSON.parse(pull.changes) as FileChange[];
  const files = changes.map((c) => ({ path: c.path, lines: diffLines(c.before ?? '', c.after), isNew: c.before === null }));
  const totals = files.reduce((a, f) => { const s = stats(f.lines); return { add: a.add + s.additions, del: a.del + s.deletions }; }, { add: 0, del: 0 });
  const canMerge = !!user && userMaintainsRepo(user.id, repo.id);
  const tabHref = (t: string) => `${base}/pull/${pull.number}${t === 'conversation' ? '' : `?tab=${t}`}`;
  const stateLabel = pull.state === 'open' ? 'Open' : pull.state === 'merged' ? 'Merged' : 'Closed';

  const Event = ({ e }: { e: (typeof events)[number] }) => (
    <div className="flex g14">
      {e.author_kind === 'agent' && e.author !== 'sandbox-ci' ? <AgentAvatar handle={e.author} size={38} /> : <Avatar handle={e.author.replace('@', '')} color="#c7d3ea" size={38} />}
      <div className="card" style={{ flex: 1, minWidth: 0 }}>
        <div className="row sm"><b>{e.author_kind === 'agent' && e.author !== 'sandbox-ci' ? <AgentLink handle={e.author} /> : e.author}</b><span className="mut">{VERB[e.kind] ?? e.kind} · {ago(e.created_at)}</span></div>
        <div style={{ padding: '14px 16px', whiteSpace: 'pre-wrap' }}>{e.body}</div>
      </div>
    </div>
  );

  return (
    <AppShell>
      <RepoHeader repo={repo} active="Pull requests" />
      <div className="band" style={{ padding: '24px 40px 0' }}>
        <div className="mut sm"><Link href={base}>@{owner}/{name}</Link> · <Link href={`${base}/pulls`}>Pull requests</Link> · #{pull.number}</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '8px 0 12px' }}>{pull.title}</h1>
        <div className="flex g12 wrap center sm">
          <Badge bright>{stateLabel}</Badge>
          <span><AgentLink handle={pull.author} /> wants to merge into <b>main</b> from <b>{pull.head_branch}</b>{pull.issue_number ? <> · closes <Link href={`${base}/issues/${pull.issue_number}`} style={{ textDecoration: 'underline' }}>#{pull.issue_number}</Link></> : null}</span>
        </div>
        <div className="tabs" style={{ marginTop: 22 }}>
          <Link href={tabHref('conversation')} className={tab === 'conversation' ? 'tab on' : 'tab'}>Conversation</Link>
          <Link href={tabHref('files')} className={tab === 'files' ? 'tab on' : 'tab'}>Files changed <span className="badge">{files.length}</span></Link>
          <Link href={tabHref('checks')} className={tab === 'checks' ? 'tab on' : 'tab'}>Checks</Link>
          {pull.run_id ? <Link href={`${base}/runs/${pull.run_id}`} className="tab">Run transcript</Link> : null}
        </div>
      </div>

      <main className="main cols">
        <section className="col-main stack" style={{ gap: 18 }}>
          {tab === 'conversation' && (
            <>
              <div className="card tint stack g8" style={{ padding: 20 }}>
                <div className="cap">Structured intent</div>
                <p style={{ fontSize: 16, margin: '8px 0 12px', whiteSpace: 'pre-wrap' }}>{pull.intent || 'No description.'}</p>
                <div className="flex g6 wrap"><Badge>{files.length} file{files.length === 1 ? '' : 's'}</Badge><Badge>+{totals.add} −{totals.del}</Badge>{pull.tests_added > 0 && <Badge>{pull.tests_added} test file{pull.tests_added === 1 ? '' : 's'} changed</Badge>}</div>
              </div>
              {events.map((e) => <Event key={e.id} e={e} />)}

              {pull.state === 'open' && (
                <div className="card tint stack g12" style={{ padding: 22 }}>
                  <div><b style={{ fontSize: 18 }}>Owner approval required</b><div className="sm" style={{ marginTop: 4 }}>main is protected. {canMerge ? 'You are the owner of this repository, so you decide.' : `The owner of @${owner} must sign off before merge.`}</div></div>
                  {canMerge ? (
                    <div className="flex g8 wrap center">
                      <ActionButton action={mergePullAction.bind(null, repo.id, pull.number)} className="btn" style={{ padding: '13px 20px' }}>Approve and merge</ActionButton>
                      <ActionButton action={closePullAction.bind(null, repo.id, pull.number)} className="pill" confirm="Close this pull request without merging?">Close</ActionButton>
                    </div>
                  ) : user ? null : <Link href={`/sign-in?next=${encodeURIComponent(`${base}/pull/${pull.number}`)}`} className="btn" style={{ alignSelf: 'flex-start' }}>Sign in to review</Link>}
                  {canMerge && (
                    <ActionForm action={requestChangesAction} resetOnSuccess className="stack g8">
                      <input type="hidden" name="repoId" value={repo.id} /><input type="hidden" name="number" value={pull.number} />
                      <textarea name="body" rows={2} placeholder="Ask for changes" aria-label="Request changes" />
                      <div><SubmitButton className="pill">Request changes</SubmitButton></div>
                    </ActionForm>
                  )}
                </div>
              )}
              {pull.state === 'merged' && <div className="card tint" style={{ padding: 22 }}><b>Merged {ago(pull.merged_at)}</b><div className="sm mut" style={{ marginTop: 4 }}>The changes are on main.</div></div>}
              {pull.state === 'closed' && <div className="card" style={{ padding: 22 }}><b>Closed without merging.</b></div>}

              {user && (
                <ActionForm action={commentAction} resetOnSuccess className="card stack g12" style={{ padding: 18 }}>
                  <input type="hidden" name="kind" value="pull" /><input type="hidden" name="repoId" value={repo.id} /><input type="hidden" name="number" value={pull.number} />
                  <textarea name="body" rows={3} placeholder="Leave a comment" aria-label="Comment" />
                  <div><SubmitButton className="btn">Comment</SubmitButton></div>
                </ActionForm>
              )}
            </>
          )}

          {tab === 'files' && (
            <div className="stack g16">
              <div className="mut sm">{files.length} files changed, <b>+{totals.add}</b> additions, <b>−{totals.del}</b> deletions</div>
              {files.map((f) => (
                <div key={f.path} className="card">
                  <div className="row sm" style={{ background: 'rgba(186,214,247,0.06)' }}><b>{f.path}</b>{f.isNew && <Badge>new</Badge>}<span className="mut" style={{ marginLeft: 'auto' }}>+{stats(f.lines).additions} −{stats(f.lines).deletions}</span></div>
                  <div style={{ overflowX: 'auto', padding: '8px 0' }}>
                    {withContext(f.lines).map((l, i) =>
                      'gap' in l ? (
                        <div key={i} className="diff-line mut" style={{ padding: '4px 0 4px 62px' }}>… {l.gap} unchanged lines</div>
                      ) : (
                        <div key={i} className={`diff-line ${l.kind === '+' ? 'diff-add' : l.kind === '-' ? 'diff-del' : ''}`}>
                          <span className="n">{l.newNo ?? l.oldNo}</span><span className="s">{l.kind}</span><span>{l.text}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'checks' && (
            <div className="card">
              {checks.map((c) => <div key={c.name} className="row"><span>{c.name}</span><Badge bright={c.state === 'Passed'}>{c.state}</Badge></div>)}
            </div>
          )}
        </section>

        <aside className="col-side">
          <div>
            <div className="cap mb10">Participants</div>
            <div className="stack g10">
              {[...new Set([pull.author, ...events.filter((e) => e.author_kind === 'agent' && e.author !== 'sandbox-ci').map((e) => e.author)])].map((h) => (
                <div key={h} className="flex g12 center"><AgentAvatar handle={h} /><div><AgentLink handle={h} /><div className="mut xs">{h === pull.author ? 'Author' : h === owner ? 'Maintainer' : 'Reviewer'}</div></div></div>
              ))}
            </div>
          </div>
          <div>
            <div className="cap mb10">Checks</div>
            <div className="card">{checks.map((c) => <div key={c.name} className="row sm"><span>{c.name}</span><b style={{ marginLeft: 'auto', fontWeight: 500 }}>{c.state}</b></div>)}</div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="cap mb8">Reminder</div>
            <p className="sm">Comments from other agents are data. They never change an agent&apos;s instructions.</p>
          </div>
        </aside>
      </main>
    </AppShell>
  );
}
