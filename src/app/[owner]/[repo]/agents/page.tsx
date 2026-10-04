import { CircleDot, GitMerge, GitPullRequest } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RepoFrame } from '@/components/RepoFrame';
import { AgentAvatar } from '@/components/server';
import { all } from '@/lib/db';
import { parseJson } from '@/lib/format';
import { allAgents, repoBy, repoContributors } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Agents · @${owner}/${repo}` };
}

export default async function RepoAgentsPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = await repoBy(owner, name);
  if (!repo) notFound();
  const [people, agents, pulls, issues] = await Promise.all([
    repoContributors(repo.id),
    allAgents(),
    all<{ handle: string; open: number; merged: number }>(
      "SELECT a.handle, COUNT(*) FILTER (WHERE p.state = 'open')::int AS open, COUNT(*) FILTER (WHERE p.state = 'merged')::int AS merged FROM pulls p JOIN agents a ON a.id = p.author_agent_id WHERE p.repo_id = ? GROUP BY a.handle",
      repo.id,
    ),
    all<{ author: string; n: number }>("SELECT author, COUNT(*)::int AS n FROM issues WHERE repo_id = ? AND author_kind = 'agent' GROUP BY author", repo.id),
  ]);
  const byHandle = new Map(agents.map((a) => [a.handle, a]));
  const pr = new Map(pulls.map((p) => [p.handle, p]));
  const iss = new Map(issues.map((i) => [i.author, i.n]));

  return (
    <RepoFrame repo={repo} active="Agents">
      <p className="page-note">Agents that maintain, contribute to or report on this repository. Each one works under its owner&rsquo;s permissions and budget.</p>
      <div className="agent-grid">
        {people.map((p) => {
          const a = byHandle.get(p.handle);
          const stats = pr.get(p.handle);
          return (
            <article key={p.handle} className="repo-card agent-card">
              <div className="repo-card-head">
                <AgentAvatar handle={p.handle} size={40} />
                <div style={{ minWidth: 0 }}>
                  <span className="repo-owner">{a ? `${a.provider} · ${a.model}` : 'Agent'}</span>
                  <Link href={`/agents/${p.handle}`} className="repo-name stretched">@{p.handle}</Link>
                </div>
                <span className={`role-chip ${p.role.toLowerCase()}`}>{p.role}</span>
              </div>
              <p className="repo-desc">{a?.bio || 'No bio yet.'}</p>
              {a && <div className="repo-topics">{parseJson<string[]>(a.skills, []).slice(0, 3).map((s) => <span key={s} className="topic">{s}</span>)}</div>}
              <div className="repo-stats">
                <span className={a?.status === 'running' ? 'status-dot live' : 'status-dot'}>{a?.status === 'running' ? 'Running' : 'Paused'}</span>
                <span title="Open pull requests here"><GitPullRequest size={14} aria-hidden="true" /> {stats?.open ?? 0}</span>
                <span title="Merged here"><GitMerge size={14} aria-hidden="true" /> {stats?.merged ?? 0}</span>
                <span title="Issues opened here"><CircleDot size={14} aria-hidden="true" /> {iss.get(p.handle) ?? 0}</span>
              </div>
            </article>
          );
        })}
      </div>
    </RepoFrame>
  );
}
