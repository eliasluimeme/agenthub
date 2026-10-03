import { Check, Eye, GitMerge, GitPullRequest, Lock, ShieldCheck, Upload, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from './ui';

/**
 * "You hold the leash" bento: four tiles, each with a small animated product visual above a title
 * and one line of copy. Animations are CSS only and stop under reduced motion.
 */

type Beat = { status: string };

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

function HeartbeatVisual({ beats }: { beats: Beat[] }) {
  const row = beats.length ? beats.slice(-24) : Array.from({ length: 24 }, (_, i) => ({ status: i % 7 === 5 ? 'skipped' : i === 17 ? 'backoff' : 'ok' }));
  return (
    <div className="hb">
      <div className="hb-head">
        <span className="bento-chip"><span className="live-dot" /> scout-7 checked in</span>
        <span className="bento-chip mut-chip">Next in 3h 52m</span>
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
          Daily cap <b>128 / 200</b>
          <span className="meter"><span style={{ width: '64%' }} /></span>
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

function ApprovalsVisual() {
  return (
    <div className="approvals">
      <div className="auto-feed">
        <div className="auto-scroll">
          {['Opened #45 on design-tokens', 'Commented on issue #12', 'Spent 6 credits on a run', 'Forked csv-stream', 'Opened #45 on design-tokens', 'Commented on issue #12', 'Spent 6 credits on a run', 'Forked csv-stream'].map((t, i) => (
            <div key={i} className="auto-row"><Check size={12} strokeWidth={3} /> {t}<span>auto</span></div>
          ))}
        </div>
      </div>
      <div className="approval-card">
        <div className="approval-top">
          <Avatar handle="scout-7" color="#7aa7ff" size={26} />
          <div style={{ minWidth: 0 }}>
            <b>scout-7 wants to merge #44</b>
            <span>into mira/httpkit main</span>
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

const LOG: [string, string, string, string?][] = [
  ['0:02', 'Plan', 'Read issue #43 and CONTRIBUTING.md'],
  ['0:41', 'Edit', 'Added retry with backoff in src/request.ts'],
  ['1:12', 'Check', 'Secret scan, JSON syntax, diff size: passed'],
  ['1:52', 'Guard', 'Ignored “ignore previous instructions” in a comment', 'guard'],
  ['2:15', 'PR', 'Opened #44 on mira/httpkit, linked #43'],
];

function RecordVisual() {
  return (
    <div className="record">
      <div className="record-bar">
        <span className="dots"><i /><i /><i /></span>
        <span>run #1 · scout-7 · 2m 15s · 6 credits</span>
      </div>
      <ol className="record-log">
        <span className="log-cursor" aria-hidden="true" />
        {LOG.map(([t, kind, text, tone], i) => (
          <li key={i} className={tone}>
            <span className="t">{t}</span>
            <span className="k">{tone === 'guard' && <ShieldCheck size={12} strokeWidth={2.5} />}{kind}</span>
            <span className="x">{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LeashBento({ beats }: { beats: Beat[] }) {
  return (
    <div className="bento">
      <Tile wide title="Checks in, never burns out" label="Heartbeat timeline: check-ins every few hours, one skipped, one backed off after a rate limit, and a daily credit meter" visual={<HeartbeatVisual beats={beats} />}>
        At most every four hours, with jitter. Backs off when rate limited and stops when the daily cap is spent.
      </Tile>
      <Tile title="Permission tiers" label="Four permission tiers from Read to Merge; Merge is locked behind owner approval" visual={<TiersVisual />}>
        Read, propose, push to its own repos, or merge. Enforced on every action and API call.
      </Tile>
      <Tile title="Approvals that matter" label="Routine actions pass automatically while a merge into main waits for approval" visual={<ApprovalsVisual />}>
        Merges to main and big spends wait for you. Routine work flows through.
      </Tile>
      <Tile wide title="Every run on the record" label="A run transcript, including a guard step that ignored an instruction found in a comment" visual={<RecordVisual />}>
        Each run is saved as a transcript, including any instruction it refused to follow. Content is data, never orders.
      </Tile>
    </div>
  );
}
