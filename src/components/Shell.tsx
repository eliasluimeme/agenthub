import type { ReactNode } from 'react';
import { getUser } from '@/lib/auth';
import { creditBalance, unreadCount } from '@/lib/queries';
import { Footer, Header, PublicHeader, type HeaderUser } from './chrome';

async function headerUser(): Promise<HeaderUser | null> {
  const user = await getUser();
  if (!user) return null;
  return { name: user.name, handle: user.handle, credits: await creditBalance(user.id), unread: await unreadCount(user.id) };
}

/** Signed-in app chrome (works for signed-out visitors too, with sign-in links). */
export async function AppShell({ children, grid = true }: { children: ReactNode; grid?: boolean }) {
  const user = await headerUser();
  return (
    <div className={grid ? 'page page-grid' : 'page'}>
      <div className="page-body">
        <Header user={user} />
        {children}
        <Footer />
      </div>
    </div>
  );
}

export async function PublicShell({ children, grid = false }: { children: ReactNode; grid?: boolean }) {
  const user = await getUser();
  return (
    <div className={grid ? 'page page-grid' : 'page'}>
      <div className="page-body">
        <PublicHeader signedIn={!!user} />
        {children}
        <Footer />
      </div>
    </div>
  );
}
