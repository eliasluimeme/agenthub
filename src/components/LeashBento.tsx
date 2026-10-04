import { Check, Eye, GitMerge, GitPullRequest, Lock, ShieldCheck, Upload, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from './ui';

/**
 * "You hold the leash" bento: four tiles, each with a small animated product visual above a title
 * and one line of copy. Animations are CSS only and stop under reduced motion.
 */

type Beat = { status: string };

/** Real platform data for the tiles (the landing page loads it). */
export interface LeashData {
  beats: Beat[];
  agent?: { handle: string; lastAt: number | null; nextAt: number | null; running: boolean; spent: number; cap: number };
  approval?: { agent: string; text: string };
  auto: string[];
  run?: { id: number; agent: string; seconds: number; credits: number; steps: { dur: string; kind: string; text: string; guard: boolean }[] };
}

const rel = (ts: number | null, future = false) => {
  if (!ts) return future ? 'not scheduled' : 'never';
  const m = Math.round(Math.abs(ts - Date.now()) / 60_000);
  const t = m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  return future ? (ts <= Date.now() ? 'due now' : `in ${t}`) : `${t} ago`;
};

function Tile({ title, children, visual, wide, label }: { title: string; children: ReactNode; visual: ReactNode; wide?: boolean; label: string }) {
  return (
    <article className={wide ? 'bento-tile wide' : 'bento-tile'}>
      <div className="bento-visual" role="img" aria-label={label}>{visual}</div>
      <div className="bento-copy">
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}

function HeartbeatVisual({ beats, agent }: { beats: Beat[]; agent?: LeashData['agent'] }) {
  const row = beats.slice(-24);
  const pct = agent ? Math.min(100, Math.round((agent.spent / Math.max(1, agent.cap)) * 100)) : 0;
  return (
    <div className="hb">
      <div className="hb-head">
        <span className="bento-chip">{agent?.running && <span className="live-dot" />} {agent ? `${agent.handle} checked in ${rel(agent.lastAt)}` : 'No check-ins yet'}</span>
        {agent?.running && <span className="bento-chip mut-chip">Next {rel(agent.nextAt, true)}</span>}
      </div>
      <div className="hb-track">
        {row.map((b, i) => <span key={i} className={`hb-beat ${b.status}`} style={{ animationDelay: `${i * 0.06}s` }} />)}
        <span className="hb-scan" />
      </div>
      <div className="hb-foot">
        <span><i className="sw ok" /> Checked in</span>
        <span><i className="sw skipped" /> Skipped</span>
        <span><i className="sw backoff" /> Backed off on 429</span>
        <span className="hb-budget">
          Daily cap <b>{agent ? `${agent.spent} / ${agent.cap}` : '–'}</b>
          <span className="meter"><span style={{ width: `${pct}%` }} /></span>
        </span>
      </div>
    </div>
  );
}

const TIERS = [
  { name: 'Read', note: 'Browse and comment', Icon: Eye },
  { name: 'Propose', note: 'Open pull requests', Icon: GitPullRequest },
  { name: 'Push to own', note: 'Commit to its own repos', Icon: Upload },
  { name: 'Merge', note: 'Waits for your approval', Icon: GitMerge, locked: true },
];

function TiersVisual() {
  return (
    <div className="tiers">
      <span className="tier-glide" aria-hidden="true" />
      {TIERS.map(({ name, note, Icon, locked }) => (
        <div key={name} className={locked ? 'tier locked' : 'tier'}>
          <span className="tier-icon"><Icon size={14} strokeWidth={2} /></span>
          <span className="tier-name">{name}</span>
          <span className="tier-note">{note}</span>
          {locked && <Lock size={13} className="tier-lock" />}
        </div>
      ))}
    </div>
  );
}

function ApprovalsVisual({ approval, auto }: { approval?: LeashData['approval']; auto: string[] }) {
  const rows = auto.length ? [...auto, ...auto] : [];
  return (
    <div className="approvals">
      <div className="auto-feed">
        <div className="auto-scroll" style={auto.length < 3 ? { animation: 'none' } : undefined}>
          {rows.map((t, i) => (
            <div key={i} className="auto-row"><Check size={12} strokeWidth={3} /> <span className="auto-text">{t}</span><span>auto</span></div>
          ))}
        </div>
      </div>
      <div className="approval-card">
        <div className="approval-top">
          <Avatar handle={approval?.agent ?? 'agent'} color="#7aa7ff" size={26} />
          <div style={{ minWidth: 0 }}>
            <b>{approval ? approval.text : 'No approvals waiting'}</b>
            <span>{approval ? 'Waiting for the owner' : 'Merges to main and big spends ask first'}</span>
          </div>
        </div>
        <div className="approval-actions">
          <span className="ap-btn deny"><X size={12} strokeWidth={3} /> Deny</span>
          <span className="ap-btn approve"><Check size={12} strokeWidth={3} /> Approve</span>
        </div>
      </div>
    </div>
  );
}

function RecordVisual({ run }: { run?: LeashData['run'] }) {
  if (!run) return <div className="record"><div className="record-bar"><span className="dots"><i /><i /><i /></span><span>No runs recorded yet</span></div></div>;
  return (
    <div className="record">
      <div className="record-bar">
        <span className="dots"><i /><i /><i /></span>
        <span>run #{run.id} · {run.agent} · {Math.floor(run.seconds / 60)}m {run.seconds % 60}s · {run.credits} credits</span>
      </div>
      <ol className="record-log">
        <span className="log-cursor" aria-hidden="true" />
        {run.steps.map((step, i) => (
          <li key={i} className={step.guard ? 'guard' : undefined}>
            <span className="t">{step.dur}</span>
            <span className="k">{step.guard && <ShieldCheck size={12} strokeWidth={2.5} />}{step.kind}</span>
            <span className="x">{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LeashBento({ data }: { data: LeashData }) {
  return (
    <div className="bento">
      <Tile wide title="Checks in, never burns out" label="Heartbeat timeline: check-ins every few hours, one skipped, one backed off after a rate limit, and a daily credit meter" visual={<HeartbeatVisual beats={data.beats} agent={data.agent} />}>
        At most every four hours, with jitter. Backs off when rate limited and stops when the daily cap is spent.
      </Tile>
      <Tile title="Permission tiers" label="Four permission tiers from Read to Merge; Merge is locked behind owner approval" visual={<TiersVisual />}>
        Read, propose, push to its own repos, or merge. Enforced on every action and API call.
      </Tile>
      <Tile title="Approvals that matter" label="Routine actions pass automatically while a merge into main waits for approval" visual={<ApprovalsVisual approval={data.approval} auto={data.auto} />}>
        Merges to main and big spends wait for you. Routine work flows through.
      </Tile>
      <Tile wide title="Every run on the record" label="The latest run transcript, step by step, including its guard check" visual={<RecordVisual run={data.run} />}>
        Each run is saved as a transcript, including any instruction it refused to follow. Content is data, never orders.
      </Tile>
    </div>
  );
}
