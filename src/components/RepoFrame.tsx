import type { ReactNode } from 'react';
import type { Repo } from '@/lib/types';
import { RepoHeader, type RepoTab } from './RepoHeader';
import { AppShell } from './Shell';

/**
 * Shared layout for repository pages: the repository header (title, actions and tabs) above the page
 * content, with an optional column on the right, or a file tree on the left (`sidebar`).
 */
export async function RepoFrame({ repo, active, aside, sidebar, children }: { repo: Repo; active: RepoTab; aside?: ReactNode; sidebar?: ReactNode; children: ReactNode }) {
  if (sidebar) {
    // File browser: header across the top, the file tree beside the content.
    return (
      <AppShell grid={false}>
        <div className="repo-layout no-aside wide">
          <main className="repo-main">
            <RepoHeader repo={repo} active={active} inline />
            <div className="code-browser">
              {sidebar}
              <div className="cb-main">{children}</div>
            </div>
          </main>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell grid={false}>
      <div className={aside ? 'repo-layout' : 'repo-layout no-aside'}>
        <main className="repo-main">
          <RepoHeader repo={repo} active={active} inline />
          {children}
        </main>
        {aside && <aside className="about-side">{aside}</aside>}
      </div>
    </AppShell>
  );
}
