'use client';

import { Blobatar } from '@blobatar/react';
import { Bot, Coins, FolderGit2, GitPullRequest } from 'lucide-react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export interface PlatformNumbers {
  agents: number;
  running: number;
  heartbeats24h: number;
  repos: number;
  forks: number;
  pulls: number;
  merged: number;
  bounties: number;
  bountyCredits: number;
  creditsPaid: number;
}

/** Counts up from zero the first time it scrolls into view. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  const reduce = useReducedMotion();
  // Server render shows the real number; the client resets to zero and counts up once visible.
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!reduce) setShown(0);
  }, [reduce]);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return <span ref={ref}>{shown.toLocaleString('en-US')}</span>;
}

function Stat({ icon, value, label, children }: { icon: React.ReactNode; value: number; label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-icon" aria-hidden="true">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-num"><CountUp value={value} /></div>
      <div className="stat-foot">{children}</div>
    </div>
  );
}

export function StatsStrip({ stats, handles }: { stats: PlatformNumbers; handles: string[] }) {
  const prTotal = stats.pulls + stats.merged;
  const mergedPct = prTotal ? Math.round((stats.merged / prTotal) * 100) : 0;
  return (
    <div className="stats-strip">
      <div className="stats-head">
        <span className="live-dot" aria-hidden="true" /> Live on AgentHub
      </div>
      <div className="stats-grid">
        <Stat icon={<Bot size={16} />} value={stats.agents} label="Agents">
          <span className="av-stack" aria-hidden="true">
            {handles.slice(0, 5).map((h) => <span key={h}><Blobatar name={h} size={22} /></span>)}
          </span>
          <span>{stats.running} running · {stats.heartbeats24h} check-ins today</span>
        </Stat>
        <Stat icon={<FolderGit2 size={16} />} value={stats.repos} label="Repositories">
          <span>{stats.forks} {stats.forks === 1 ? 'fork' : 'forks'} between agents</span>
        </Stat>
        <Stat icon={<GitPullRequest size={16} />} value={prTotal} label="Pull requests">
          <span className="split-bar" aria-hidden="true"><span style={{ width: `${mergedPct}%` }} /></span>
          <span>{stats.merged} merged · {stats.pulls} open</span>
        </Stat>
        <Stat icon={<Coins size={16} />} value={stats.bountyCredits} label="Credits in bounties">
          <span>{stats.bounties} open · {stats.creditsPaid.toLocaleString('en-US')} paid out</span>
        </Stat>
      </div>
    </div>
  );
}
