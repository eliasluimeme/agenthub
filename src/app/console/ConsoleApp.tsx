'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { resolveApprovalAction, setAgentStatusAction } from '@/app/actions';
import { Icon } from '@/components/Icons';
import { Avatar } from '@/components/ui';

export interface ConsoleAgent {
  handle: string;
  color: string;
  task: string;
  status: 'running' | 'paused';
  spent: number;
  cap: number;
}
export interface ConsoleApproval {
  id: number;
  text: string;
  amount: number;
  kind: string;
}
export interface ConsoleNotification {
  id: number;
  text: string;
  href: string | null;
  when: string;
}

export function ConsoleApp({ agents, approvals, notifications, balance, log }: { agents: ConsoleAgent[]; approvals: ConsoleApproval[]; notifications: ConsoleNotification[]; balance: number; log: string }) {
  const [tab, setTab] = useState<'Agents' | 'Inbox' | 'Credits'>('Agents');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      const res = await fn();
      setError(res && res.error ? res.error : '');
    });

  return (
    <div className="stack" style={{ width: 390, maxWidth: '100%', height: 844, background: 'var(--canvas)', overflow: 'hidden', borderRadius: 24, boxShadow: '0 0 0 1px var(--hair), 0 24px 64px rgba(0,0,0,0.5)' }}>
      <div className="flex between" style={{ padding: '18px 20px 10px', alignItems: 'flex-end' }}>
        <div>
          <div className="cap">{tab === 'Agents' ? 'Your agents' : tab}</div>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, marginTop: 8 }}>Console</h1>
        </div>
        <Link href="/agents/new" className="av" aria-label="New agent" style={{ width: 44, height: 44, background: 'var(--glass-3)' }}><Icon name="plus" size={16} color="#fff" stroke={2.5} /></Link>
      </div>
      {error && <p role="alert" className="form-error sm" style={{ padding: '0 20px' }}>{error}</p>}

      <div className="stack g10" style={{ flex: 1, overflow: 'auto', padding: '8px 20px' }}>
        {tab === 'Agents' && (
          <>
            {approvals.length > 0 && (
              <div className="card tint" style={{ padding: '14px 16px' }}>
                <div className="cap" style={{ marginBottom: 6 }}>{approvals.length} waiting for you</div>
                <div style={{ lineHeight: 1.35, marginBottom: 12 }}>{approvals[0].text}</div>
                <div className="flex g8">
                  <button className="pill block" style={{ justifyContent: 'center', minHeight: 44 }} disabled={pending} onClick={() => run(() => resolveApprovalAction(approvals[0].id, false))}>Decline</button>
                  <button className="btn block" style={{ minHeight: 44, fontSize: 13 }} disabled={pending} onClick={() => run(() => resolveApprovalAction(approvals[0].id, true))}>Approve</button>
                </div>
              </div>
            )}
            {agents.map((a) => (
              <div key={a.handle} className="card stack g10" style={{ padding: '14px 16px' }}>
                <div className="flex center g12">
                  <Avatar handle={a.handle} color={a.color} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}><Link href={`/agents/${a.handle}`}><b>@{a.handle}</b></Link><div className="mut xs">{a.task}</div></div>
                  <span className="cap">{a.status === 'running' ? 'Running' : 'Paused'}</span>
                </div>
                <div className="flex between center">
                  <span className="mut" style={{ fontSize: 12 }}>Credits {a.spent} of {a.cap} today</span>
                  <button className="pill" style={{ minHeight: 44, padding: '0 18px' }} disabled={pending} onClick={() => run(() => setAgentStatusAction(a.handle, a.status === 'running' ? 'paused' : 'running'))}>
                    {a.status === 'running' ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            ))}
            {agents.length === 0 && <div className="empty">No agents yet. Create one from the + button.</div>}
          </>
        )}
        {tab === 'Inbox' && (
          <>
            {notifications.map((n) => (
              <Link key={n.id} href={n.href ?? '#'} className="card" style={{ padding: '12px 16px' }}><div className="sm">{n.text}</div><div className="mut xs">{n.when}</div></Link>
            ))}
            {notifications.length === 0 && <div className="empty">Nothing new.</div>}
          </>
        )}
        {tab === 'Credits' && (
          <div className="card" style={{ padding: 20 }}>
            <div className="cap">Balance</div>
            <div className="disp" style={{ fontSize: 56, lineHeight: 1.1 }}>{balance.toLocaleString('en-US')}</div>
            <Link href="/settings#credits" className="btn" style={{ marginTop: 12 }}>Add credits</Link>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--glass-2)', fontSize: 12, lineHeight: 1.5 }}>
        <div className="cap" style={{ marginBottom: 4 }}>Latest</div>
        {log}
      </div>

      <nav aria-label="Console" className="flex" style={{ borderTop: '1px solid var(--hair)', background: 'rgba(5,6,15,0.97)', height: 60 }}>
        {(['Agents', 'Inbox', 'Credits'] as const).map((t, i) => (
          <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
            style={{ flex: 1, border: 0, borderLeft: i ? '1px solid var(--hair)' : 0, background: tab === t ? 'var(--glass-3)' : 'transparent', color: '#fff', font: '500 12px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}
