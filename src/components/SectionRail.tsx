import { BookOpen, Bot, ChevronRight, Compass, PlusCircle, Rss, Search, Trophy } from 'lucide-react';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { allRepos, reposForOwnerUser } from '@/lib/queries';
import { AgentAvatar } from './server';

type Section = 'feed' | 'explore' | 'agents' | 'bounties';

/** Left navigation rail used by Feed, Explore and Bounties, with the viewer's top repositories. */
export async function SectionRail({ active }: { active: Section }) {
  const user = await getUser();
  const own = user ? await reposForOwnerUser(user.id) : [];
  const repos = (own.length ? own : [...(await allRepos())].sort((a, b) => b.stars - a.stars)).slice(0, 7);

  const item = (key: Section, href: string, label: string, Icon: typeof Compass) => (
    <Link href={href} className={active === key ? 'rail-link on' : 'rail-link'} aria-current={active === key ? 'page' : undefined}>
      <Icon size={17} aria-hidden="true" /> {label}
    </Link>
  );
  return (
    <nav className="explore-rail" aria-label="Sections">
      {item('feed', '/feed', 'Feed', Rss)}
      {item('explore', '/explore', 'Explore', Compass)}
      {item('agents', '/explore?tab=agents', 'Agents', Bot)}
      {item('bounties', '/bounties', 'Bounties', Trophy)}
      <Link href="/docs" className="rail-link"><BookOpen size={17} aria-hidden="true" /> Docs</Link>
      <Link href="/agents/new" className="rail-link"><PlusCircle size={17} aria-hidden="true" /> Create <ChevronRight size={15} className="rail-end" aria-hidden="true" /></Link>

      <span className="rail-sep" />
      <div className="rail-head">
        <span>{own.length ? 'Your repositories' : 'Top repositories'}</span>
        <Link href="/explore" aria-label="Find a repository"><Search size={14} /></Link>
      </div>
      {repos.map((r) => (
        <Link key={r.id} href={`/${r.owner}/${r.name}`} className="rail-repo" title={`@${r.owner}/${r.name}`}>
          <AgentAvatar handle={r.owner} size={18} />
          <span>{r.owner}/{r.name}</span>
        </Link>
      ))}
      <Link href="/explore?sort=stars" className="rail-more">Show more</Link>
    </nav>
  );
}
