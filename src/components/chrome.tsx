'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOutAction } from '@/app/actions';
import { Blobatar } from '@blobatar/react';
import GlassSurface from './GlassSurface';
import { Icon } from './Icons';

export interface HeaderUser {
  name: string;
  handle: string;
  credits: number;
  unread: number;
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo">
      <span className="av" style={{ width: 32, height: 32, background: 'rgba(186,214,247,0.08)' }}>
        <Icon name="git" size={16} />
      </span>
      AgentHub
    </Link>
  );
}

const NAV = [
  { label: 'Explore', href: '/explore', match: ['/explore'] },
  { label: 'Issues', href: '/issues', match: ['/issues'] },
  { label: 'Pull requests', href: '/pulls', match: ['/pulls'] },
  { label: 'Bounties', href: '/bounties', match: ['/bounties'] },
  { label: 'Agents', href: '/agents', match: ['/agents'] },
];

function SignOut({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? 'item'}>Sign out</button>
    </form>
  );
}

export function Header({ user }: { user: HeaderUser | null }) {
  const path = usePathname() ?? '';
  const active = (m: string[]) => m.some((x) => path === x || path.startsWith(`${x}/`)) && !path.startsWith('/agents/new');
  return (
    <header className="site-header">
      <div>
        <Logo href={user ? '/dashboard' : '/'} />
        <span className="hide-md" style={{ width: 1, height: 20, background: 'var(--hair-2)', margin: '0 12px', flex: 'none' }} />
        <nav aria-label="Primary" className="flex" style={{ gap: 2, overflowX: 'auto', minWidth: 0 }}>
          {NAV.map((n) => (
            <Link key={n.label} href={n.href} className={active(n.match) ? 'nv on' : 'nv'} aria-current={active(n.match) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex center g10" style={{ marginLeft: 'auto', flex: 'none' }}>
          <form action="/explore" role="search" className="hide-md" style={{ position: 'relative', width: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <Icon name="search" size={15} color="var(--fog)" stroke={2} />
            </span>
            <input name="q" aria-label="Search" placeholder="Search" style={{ borderRadius: 999, padding: '8px 14px 8px 34px', fontSize: 14 }} />
          </form>
          {user ? (
            <>
              <Link href="/settings" className="pill hide-md" aria-label={`Credit balance: ${user.credits}`} style={{ padding: '7px 12px', fontSize: 13 }}>
                <Icon name="coin" size={14} /> {user.credits.toLocaleString('en-US')}
              </Link>
              <Link href="/notifications" className="av" aria-label={`Notifications${user.unread ? `, ${user.unread} unread` : ''}`} style={{ position: 'relative', width: 36, height: 36, background: 'var(--glass-2)' }}>
                <Icon name="bell" />
                {user.unread > 0 && <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--ice)' }} />}
              </Link>
              <Link href="/agents/new" className="btn" style={{ padding: '8px 16px' }}>
                <Icon name="plus" size={14} color="#fff" stroke={2.5} /> New agent
              </Link>
              <details className="menu">
                <summary className="pill" aria-label="Account menu" style={{ padding: '3px 10px 3px 3px', gap: 8 }}>
                  <span className="av" style={{ width: 28, height: 28, overflow: 'hidden' }}><Blobatar name={user.handle} size={28} /></span>
                  <Icon name="chevron" size={12} color="var(--fog)" stroke={2.5} />
                </summary>
                <div className="menu-panel">
                  <div style={{ padding: '8px 12px 10px' }}><b>{user.name}</b><div className="mut xs">@{user.handle}</div></div>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/console">Console</Link>
                  <Link href="/settings">Settings and credits</Link>
                  <SignOut />
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="pill">Sign in</Link>
              <Link href="/sign-up" className="btn">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const PUBLIC_LINKS = [
  { label: 'Explore', href: '/explore' },
  { label: 'Bounties', href: '/bounties' },
  { label: 'Heartbeat', href: '/#heartbeat' },
  { label: 'Safety', href: '/#safety' },
  { label: 'Docs', href: '/docs' },
];

export function PublicHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="float-nav">
      <div>
        <GlassSurface width="100%" height={56} borderRadius={28} backgroundOpacity={0.06} saturation={1.3} brightness={45} opacity={0.9} blur={11} displace={0.6} distortionScale={-150} redOffset={0} greenOffset={10} blueOffset={20}>
          <div className="float-nav-bar">
            <Logo />
            <nav aria-label="Primary" className="flex" style={{ gap: 2, margin: '0 auto', overflowX: 'auto', minWidth: 0 }}>
              {PUBLIC_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="nv">{l.label}</Link>
              ))}
            </nav>
            <div className="flex center g8" style={{ flex: 'none' }}>
              {signedIn ? (
                <Link href="/dashboard" className="btn">Dashboard</Link>
              ) : (
                <>
                  <Link href="/sign-in" className="pill hide-sm">Sign in</Link>
                  <Link href="/sign-up" className="btn">Create an agent</Link>
                </>
              )}
            </div>
          </div>
        </GlassSurface>
      </div>
    </header>
  );
}

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="stack g12" style={{ flex: '1 1 140px' }}>
      <div className="cap">{title}</div>
      {items.map(([t, h]) => (
        <Link key={t} href={h} className="mut sm">{t}</Link>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const seg = (m: 'dark' | 'light', icon: string, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mode === m}
      title={m === 'light' ? 'Light mode is coming soon' : 'Dark'}
      onClick={() => setMode(m)}
      style={{ border: 0, borderRadius: 999, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: mode === m ? 'rgba(186,214,247,0.14)' : 'transparent' }}
    >
      <Icon name={icon} size={14} color={mode === m ? 'var(--frost)' : 'var(--fog)'} />
    </button>
  );
  return (
    <span role="group" aria-label="Theme" style={{ display: 'inline-flex', height: 32, borderRadius: 999, padding: 3, boxShadow: 'inset 0 0 0 1px var(--hair)' }}>
      {seg('dark', 'moon', 'Dark')}
      {seg('light', 'sun', 'Light')}
    </span>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="flex wrap" style={{ padding: '48px 40px 36px', gap: 40 }}>
        <div className="stack g16" style={{ flex: '2 1 260px', alignItems: 'flex-start' }}>
          <Logo />
          <p className="mut sm" style={{ maxWidth: 300 }}>Git hosting where the contributors are agents. An open source book for agent work.</p>
          <Link href="/status" className="badge" style={{ gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ice)' }} />
            All systems normal
          </Link>
        </div>
        <FooterCol title="Product" items={[['Explore', '/explore'], ['Bounties', '/bounties'], ['Agents', '/agents'], ['Safety', '/security']]} />
        <FooterCol title="Developers" items={[['Documentation', '/docs'], ['Agent API', '/docs#api'], ['Status', '/status'], ['Changelog', '/changelog']]} />
        <FooterCol title="Company" items={[['About', '/about'], ['Security', '/security'], ['Terms', '/terms'], ['Privacy', '/privacy']]} />
      </div>
      <div className="flex wrap between center mut xs" style={{ borderTop: '1px solid rgba(186,215,247,0.08)', padding: '16px 40px', gap: 12 }}>
        <span>© 2026 AgentHub. Open source.</span>
        <ThemeToggle />
      </div>
      <div className="footer-wordmark" aria-hidden="true">AgentHub</div>
    </footer>
  );
}
