import Link from 'next/link';
import { toggleStarAction } from '@/app/actions';
import { getUser } from '@/lib/auth';
import { agentById, agentsByOwner, isStarred, repoById, repoCounts } from '@/lib/queries';
import type { Repo } from '@/lib/types';
import { ActionForm, SubmitButton } from './forms';
import { forkRepoAction } from '@/app/actions';
import { AgentAvatar } from './server';
import { Badge } from './ui';

export type RepoTab = 'Code' | 'Issues' | 'Board' | 'Pull requests' | 'Runs' | 'Bounties' | 'Agents' | 'Settings';

export async function RepoHeader({ repo, active, sub }: { repo: Repo; active: RepoTab; sub?: React.ReactNode }) {
  const user = await getUser();
  const base = `/${repo.owner}/${repo.name}`;
  const counts = repoCounts(repo.id);
  const starred = user ? isStarred(user.id, repo.id) : false;
  const watching = user ? isStarred(user.id, repo.id, 'watch') : false;
  const myAgents = user ? agentsByOwner(user.id).filter((a) => a.tier >= 1 && a.id !== repo.owner_agent_id) : [];
  const parent = repo.forked_from ? repoById(repo.forked_from) : undefined;

  const tabs: { label: RepoTab; href: string; count?: number }[] = [
    { label: 'Code', href: base },
    { label: 'Issues', href: `${base}/issues`, count: counts.open },
    { label: 'Board', href: `${base}/board` },
    { label: 'Pull requests', href: `${base}/pulls`, count: counts.pulls },
    { label: 'Runs', href: `${base}/runs` },
    { label: 'Bounties', href: `/bounties?repo=${repo.owner}/${repo.name}`, count: counts.bounties },
    { label: 'Agents', href: `${base}/agents`, count: counts.agents },
    ...(user && user.id === agentById(repo.owner_agent_id)?.owner_id ? [{ label: 'Settings' as RepoTab, href: `${base}/settings` }] : []),
  ];
  const starAction = toggleStarAction.bind(null, repo.id, 'star');
  const watchAction = toggleStarAction.bind(null, repo.id, 'watch');

  return (
    <div className="band" style={{ padding: '28px 40px 0' }}>
      <div className="flex wrap center between g16">
        <div className="flex center wrap g14">
          <AgentAvatar handle={repo.owner} size={44} />
          <div>
            <div className="flex center g8 wrap" style={{ fontSize: 24, fontWeight: 500, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--ice)' }}>
              <Link href={`/agents/${repo.owner}`} className="mut">@{repo.owner}</Link> / <Link href={base} style={{ color: 'inherit' }}>{repo.name}</Link> <Badge>Public</Badge>
            </div>
            {parent ? (
              <div className="mut xs" style={{ marginTop: 2 }}>Forked from <Link href={`/${parent.owner}/${parent.name}`} style={{ fontWeight: 500 }}>@{parent.owner}/{parent.name}</Link></div>
            ) : (
              sub
            )}
          </div>
        </div>
        <div className="flex g6 wrap">
          {user ? (
            <>
              <form action={watchAction}><button className={watching ? 'pill on' : 'pill'}>{watching ? 'Watching' : 'Watch'}</button></form>
              <details className="menu">
                <summary className="pill">Fork <span className="mut">{repo.forks}</span></summary>
                <div className="menu-panel" style={{ minWidth: 280, padding: 16 }}>
                  {myAgents.length ? (
                    <ActionForm action={forkRepoAction} className="stack g10">
                      <input type="hidden" name="repoId" value={repo.id} />
                      <label className="field"><span className="cap">Fork as</span>
                        <select name="agent">{myAgents.map((a) => <option key={a.id} value={a.handle}>@{a.handle}</option>)}</select>
                      </label>
                      <SubmitButton className="btn">Create fork</SubmitButton>
                    </ActionForm>
                  ) : (
                    <p className="mut sm">You need an agent with the Propose tier or higher to fork. <Link href="/agents/new" style={{ textDecoration: 'underline' }}>Create one</Link>.</p>
                  )}
                </div>
              </details>
              <form action={starAction}><button className="pill" style={{ background: starred ? 'rgba(209,228,250,0.38)' : undefined }}>{starred ? 'Starred' : 'Star'} <span>{repo.stars}</span></button></form>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="pill">Fork <span className="mut">{repo.forks}</span></Link>
              <Link href="/sign-in" className="pill">Star <span>{repo.stars}</span></Link>
            </>
          )}
        </div>
      </div>
      <div className="tabs" style={{ marginTop: 22 }}>
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} className={t.label === active ? 'tab on' : 'tab'}>
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && <span className="badge">{t.count}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
