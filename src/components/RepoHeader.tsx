import { Bot, Code2, CircleDot, Coins, Eye, GitFork, GitPullRequest, KanbanSquare, Play, Settings, Star } from 'lucide-react';
import Link from 'next/link';
import { toggleStarAction } from '@/app/actions';
import { getUser } from '@/lib/auth';
import { agentById, agentsByOwner, isStarred, repoById, repoCounts } from '@/lib/queries';
import type { Repo } from '@/lib/types';
import { ActionForm, SubmitButton } from './forms';
import { forkRepoAction } from '@/app/actions';
import { AgentAvatar } from './server';

export type RepoTab = 'Code' | 'Issues' | 'Board' | 'Pull requests' | 'Runs' | 'Bounties' | 'Agents' | 'Settings';

const TAB_ICON: Record<RepoTab, typeof Code2> = { Code: Code2, Issues: CircleDot, Board: KanbanSquare, 'Pull requests': GitPullRequest, Runs: Play, Bounties: Coins, Agents: Bot, Settings };

/** Repository title, actions and tabs. `inline` drops the full-width band (used inside the Code page layout). */
export async function RepoHeader({ repo, active, sub, inline = false }: { repo: Repo; active: RepoTab; sub?: React.ReactNode; inline?: boolean }) {
  const user = await getUser();
  const base = `/${repo.owner}/${repo.name}`;
  const counts = await repoCounts(repo.id);
  const starred = user ? await isStarred(user.id, repo.id) : false;
  const watching = user ? await isStarred(user.id, repo.id, 'watch') : false;
  const myAgents = user ? (await agentsByOwner(user.id)).filter((a) => a.tier >= 1 && a.id !== repo.owner_agent_id) : [];
  const parent = repo.forked_from ? await repoById(repo.forked_from) : undefined;

  const tabs: { label: RepoTab; href: string; count?: number }[] = [
    { label: 'Code', href: base },
    { label: 'Issues', href: `${base}/issues`, count: counts.open },
    { label: 'Board', href: `${base}/board` },
    { label: 'Pull requests', href: `${base}/pulls`, count: counts.pulls },
    { label: 'Runs', href: `${base}/runs` },
    { label: 'Bounties', href: `${base}/bounties`, count: counts.bounties },
    { label: 'Agents', href: `${base}/agents`, count: counts.agents },
    ...(user && user.id === (await agentById(repo.owner_agent_id))?.owner_id ? [{ label: 'Settings' as RepoTab, href: `${base}/settings` }] : []),
  ];
  const starAction = toggleStarAction.bind(null, repo.id, 'star');
  const watchAction = toggleStarAction.bind(null, repo.id, 'watch');

  return (
    <div className={inline ? 'repo-head inline' : 'repo-head band'}>
      <div className="repo-title-row">
        <div className="repo-title">
          <AgentAvatar handle={repo.owner} size={inline ? 34 : 40} />
          <h1>
            <Link href={`/agents/${repo.owner}`} className="repo-title-owner">{repo.owner}</Link>
            <span className="repo-title-sep">/</span>
            <Link href={base}>{repo.name}</Link>
          </h1>
          <span className="vis-badge">Public</span>
        </div>
        <div className="repo-actions">
          {user ? (
            <>
              <form action={watchAction}><button className={watching ? 'act-btn on' : 'act-btn'}><Eye size={15} aria-hidden="true" /> {watching ? 'Watching' : 'Watch'}</button></form>
              <form action={starAction}><button className={starred ? 'act-btn on' : 'act-btn'}><Star size={15} aria-hidden="true" fill={starred ? 'currentColor' : 'none'} /> {starred ? 'Starred' : 'Star'} <span className="act-count">{repo.stars}</span></button></form>
              <details className="menu">
                <summary className="act-btn"><GitFork size={15} aria-hidden="true" /> Fork <span className="act-count">{repo.forks}</span></summary>
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
            </>
          ) : (
            <>
              <Link href={`/sign-in?next=${encodeURIComponent(base)}`} className="act-btn"><Star size={15} aria-hidden="true" /> Star <span className="act-count">{repo.stars}</span></Link>
              <Link href={`/sign-in?next=${encodeURIComponent(base)}`} className="act-btn"><GitFork size={15} aria-hidden="true" /> Fork <span className="act-count">{repo.forks}</span></Link>
            </>
          )}
        </div>
      </div>
      {parent ? (
        <p className="repo-sub">Forked from <Link href={`/${parent.owner}/${parent.name}`}>@{parent.owner}/{parent.name}</Link></p>
      ) : (
        sub ?? (repo.description && <p className="repo-sub">{repo.description}</p>)
      )}
      <nav className="repo-tabs" aria-label="Repository">
        {tabs.map((t) => {
          const Icon = TAB_ICON[t.label];
          return (
            <Link key={t.label} href={t.href} className={t.label === active ? 'rtab on' : 'rtab'} aria-current={t.label === active ? 'page' : undefined}>
              <Icon size={16} aria-hidden="true" /> {t.label}
              {typeof t.count === 'number' && t.count > 0 && <span className="rtab-count">{t.count}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
