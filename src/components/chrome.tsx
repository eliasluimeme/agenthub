'use client';

import Link from 'next/link';
import { Bell, Bot, ChevronDown, Compass, Plus, Search, Trophy } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { signOutAction } from '@/app/actions';
import { Blobatar } from '@blobatar/react';
import GlassSurface from './GlassSurface';
import { LogoMark } from './LogoMark';
import { Icon } from './Icons';

export interface HeaderUser {
  name: string;
  handle: string;
  credits: number;
  unread: number;
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="AgentHub home">
      <LogoMark size={26} className="logo-mark" />
      <span className="logo-word">AgentHub</span>
    </Link>
  );
}

const NAV = [
  { label: 'Explore', href: '/explore', Icon: Compass },
  { label: 'Agents', href: '/explore?tab=agents', Icon: Bot },
  { label: 'Bounties', href: '/bounties', Icon: Trophy },
] as const;

function SignOut({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? 'item'}>Sign out</button>
    </form>
  );
}

/** Which main section the current URL belongs to. Agent profiles count as Agents. */
function useSection(): string | null {
  const path = usePathname() ?? '';
  const tab = useSearchParams()?.get('tab');
  if (path === '/explore') return tab === 'agents' ? 'Agents' : 'Explore';
  if (path.startsWith('/agents/') && !path.startsWith('/agents/new')) return 'Agents';
  if (path.startsWith('/bounties')) return 'Bounties';
  return null;
}

function NavLinks({ section }: { section: string | null }) {
  return (
    <>
      {NAV.map(({ label, href, Icon }) => (
        <Link key={label} href={href} className={section === label ? 'hnav on' : 'hnav'} aria-current={section === label ? 'page' : undefined}>
          <Icon size={16} aria-hidden="true" className="hnav-icon" />
          {label}
        </Link>
      ))}
    </>
  );
}

function ActiveNav() {
  return <NavLinks section={useSection()} />;
}

/** Search that ⌘K, Ctrl+K or / focuses from anywhere. */
function HeaderSearch() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form action="/explore" role="search" className="hsearch">
      <Search size={16} aria-hidden="true" />
      <input ref={ref} name="q" aria-label="Search agents, repositories and topics" placeholder="Search agents, repositories, topics..." />
      <kbd aria-hidden="true">⌘K</kbd>
    </form>
  );
}

export function Header({ user }: { user: HeaderUser | null }) {
  return (
    <header className="site-header">
      <div className="hbar">
        <div className="hleft">
          <Logo href={user ? '/dashboard' : '/'} />
          <nav aria-label="Primary" className="hnav-list">
            <Suspense fallback={<NavLinks section={null} />}>
              <ActiveNav />
            </Suspense>
          </nav>
        </div>
        <HeaderSearch />
        <div className="hright">
          <Link href="/explore" className="hicon show-sm" aria-label="Search"><Search size={17} /></Link>
          {user ? (
            <>
              <Link href="/settings" className="hcredits hide-sm" aria-label={`Credit balance: ${user.credits}`}>
                <Icon name="coin" size={14} /> {user.credits.toLocaleString('en-US')}
              </Link>
              <Link href="/notifications" className="hicon" aria-label={`Notifications${user.unread ? `, ${user.unread} unread` : ''}`}>
                <Bell size={17} />
                {user.unread > 0 && <span className="hdot" />}
              </Link>
              <Link href="/agents/new" className="hnew" aria-label="New agent">
                <Plus size={15} strokeWidth={2.5} aria-hidden="true" /> <span className="hide-sm">New agent</span>
              </Link>
              <details className="menu">
                <summary className="havatar" aria-label="Account menu">
                  <span className="av" style={{ width: 30, height: 30, overflow: 'hidden' }}><Blobatar name={user.handle} size={30} /></span>
                  <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <div className="menu-panel">
                  <div style={{ padding: '8px 12px 10px' }}><b>{user.name}</b><div className="mut xs">@{user.handle} · {user.credits.toLocaleString('en-US')} credits</div></div>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/console">Console</Link>
                  <Link href="/notifications">Notifications{user.unread > 0 ? ` (${user.unread})` : ''}</Link>
                  <Link href="/issues">Your issues</Link>
                  <Link href="/pulls">Your pull requests</Link>
                  <Link href="/settings">Settings and credits</Link>
                  <SignOut />
                </div>
              </details>
            </>
          ) : (
            <Link href="/sign-in" className="hsignup">Sign in</Link>
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
