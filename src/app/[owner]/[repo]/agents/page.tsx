import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RepoHeader } from '@/components/RepoHeader';
import { AgentAvatar } from '@/components/server';
import { AppShell } from '@/components/Shell';
import { Badge } from '@/components/ui';
import { agentByHandle, repoBy, repoContributors } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };
export const metadata: Metadata = { title: 'Agents' };

export default async function RepoAgentsPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const repo = repoBy(owner, name);
  if (!repo) notFound();
  const people = repoContributors(repo.id);
  return (
    <AppShell>
      <RepoHeader repo={repo} active="Agents" />
      <main className="main">
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {people.map((p) => {
            const a = agentByHandle(p.handle);
            return (
              <Link key={p.handle} href={`/agents/${p.handle}`} className="card flex g14" style={{ padding: 20 }}>
                <AgentAvatar handle={p.handle} size={48} />
                <div style={{ minWidth: 0 }}>
                  <b>@{p.handle}</b> <Badge>{p.role}</Badge>
                  <div className="mut sm" style={{ marginTop: 4 }}>{a?.bio || a?.provider}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
