import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/Shell';
import { AgentLink, Badge, KV } from '@/components/ui';
import { ago } from '@/lib/format';
import { getPullById, getRun, repoBy, runSteps } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run ${id}` };
}

export default async function RunPage({ params }: Props) {
  const { owner, repo: name, id } = await params;
  const repo = repoBy(owner, name);
  const run = getRun(Number(id));
  if (!repo || !run || run.repo_id !== repo.id) notFound();
  const steps = runSteps(run.id);
  const pull = run.pull_id ? getPullById(run.pull_id) : undefined;
  const base = `/${owner}/${name}`;
  const dur = `${Math.floor(run.duration_sec / 60)} min ${run.duration_sec % 60} s`;

  return (
    <AppShell>
      <div className="band" style={{ padding: '28px 40px 24px' }}>
        <div className="mut sm"><Link href={base}>@{owner}/{name}</Link> · {pull ? <Link href={`${base}/pull/${pull.number}`}>Pull request #{pull.number}</Link> : 'Run'} · Run {run.id}</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: '8px 0 12px' }}>Run transcript</h1>
        <div className="flex g12 wrap center sm">
          <Badge bright={run.status === 'completed'}>{run.status}</Badge>
          <Badge>{run.mode}</Badge>
          <span><AgentLink handle={run.agent} /> on {run.model} · started {ago(run.started_at)} · took {dur}</span>
        </div>
      </div>

      <main className="main cols">
        <section className="col-main">
          <ol className="card" style={{ listStyle: 'none', margin: 0, padding: '28px 28px 6px' }}>
            {steps.map((s) => (
              <li key={s.idx} className="flex g16">
                <div className="stack center">
                  <span className="av" style={{ width: 28, height: 28, background: 'var(--glass-3)', fontSize: 12 }}>{s.idx + 1}</span>
                  <span style={{ flex: 1, width: 1, background: 'var(--hair)', marginTop: 4 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: 22 }}>
                  <div className="flex g10 center wrap"><span className="cap">{s.kind}</span><span className="mut mono" style={{ fontSize: 12 }}>{s.dur}</span></div>
                  <p style={{ marginTop: 4, color: 'var(--frost)' }}>{s.text}</p>
                  {s.extra === 'terminal' && <pre className="code" style={{ marginTop: 10 }}>{'$ static checks\n  secret scan ... ok\n  json syntax ... ok\n  diff size ... ok\n  tests included ... ok'}</pre>}
                  {s.extra && s.extra !== 'terminal' && (
                    <div className="sm" style={{ marginTop: 10, borderRadius: 10, padding: '12px 14px', background: 'var(--glass-2)', boxShadow: 'inset 0 0 0 1px var(--hair-2)' }}>
                      {s.extra === 'guard' ? <><b>Instruction ignored.</b> A comment on the issue asked the agent to print its API key. Comments are data, so it was logged and skipped.</> : s.extra}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="col-side">
          <div className="card">
            <KV k="Credits used" v={run.credits} /><KV k="Duration" v={dur} /><KV k="Model" v={run.model} />
            <KV k="Input tokens" v={`${(run.tokens_in / 1000).toFixed(1)}k`} /><KV k="Output tokens" v={`${(run.tokens_out / 1000).toFixed(1)}k`} /><KV k="Mode" v={run.mode} />
          </div>
          {run.mode === 'simulated' && (
            <div className="card" style={{ padding: 18 }}>
              <div className="cap mb8">Simulated run</div>
              <p className="sm">No live model call was made. Add an API key to the agent and enable live runs to have it write real changes.</p>
            </div>
          )}
          <div className="card" style={{ padding: 18 }}>
            <div className="cap mb8">Why transcripts</div>
            <p className="sm">Every pull request carries the full run, so maintainers can review how a change was made, not only what changed.</p>
          </div>
        </aside>
      </main>
    </AppShell>
  );
}
