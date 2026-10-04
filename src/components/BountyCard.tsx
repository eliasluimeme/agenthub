import { CircleDot, Clock, Coins } from 'lucide-react';
import Link from 'next/link';
import { claimBountyAction } from '@/app/actions';
import { ago } from '@/lib/format';
import { bountyStatus, type BountyRow } from '@/lib/queries';
import type { Agent } from '@/lib/types';
import { ActionForm, SubmitButton } from './forms';
import { AgentAvatar } from './server';

export const STATUS_LABEL = { open: 'Open', claimed: 'Claimed', in_review: 'In review', paid: 'Paid' } as const;

/** A bounty: reward, issue, difficulty and status, with a claim form for the viewer's eligible agents. */
export function BountyCard({ b, agents = [] }: { b: BountyRow; agents?: Agent[] }) {
  const status = bountyStatus(b);
  const issue = `/${b.owner}/${b.repo}/issues/${b.number}`;
  return (
    <article className={`bounty-card ${status}`}>
      <div className="bc-top">
        <AgentAvatar handle={b.owner} size={28} />
        <Link href={`/${b.owner}/${b.repo}`} className="bc-repo">@{b.owner}/{b.repo}<span>#{b.number}</span></Link>
        <span className="bc-reward"><Coins size={15} aria-hidden="true" /><b>{b.bounty}</b><small>credits</small></span>
      </div>
      <Link href={issue} className="bc-title stretched">{b.title}</Link>
      <div className="bc-tags">
        <span className={`diff-chip ${b.difficulty.toLowerCase()}`}>{b.difficulty}</span>
        <span className={`status-chip ${status}`}>{STATUS_LABEL[status]}</span>
        {b.claimed_by && (
          <span className="bc-claimer"><AgentAvatar handle={b.claimed_by} size={18} /> @{b.claimed_by}</span>
        )}
      </div>
      <div className="bc-foot">
        <span className="bc-age"><Clock size={13} aria-hidden="true" /> {ago(b.created_at)}</span>
        {status === 'open' && agents.length > 0 ? (
          <details className="menu bc-claim">
            <summary className="light-btn sm">Claim</summary>
            <div className="menu-panel" style={{ minWidth: 300, padding: 16 }}>
              <ActionForm action={claimBountyAction} className="stack g10">
                <input type="hidden" name="repoId" value={b.repo_id} /><input type="hidden" name="number" value={b.number} />
                <label className="field"><span className="cap">Claim with</span><select name="agent">{agents.map((a) => <option key={a.id} value={a.handle}>@{a.handle}</option>)}</select></label>
                <label className="field"><span className="cap">Plan</span><textarea name="plan" rows={3} placeholder="How will it be done?" /></label>
                <SubmitButton className="cta">Claim for {b.bounty} credits</SubmitButton>
              </ActionForm>
            </div>
          </details>
        ) : (
          <Link href={issue} className="bc-link"><CircleDot size={13} aria-hidden="true" /> View issue</Link>
        )}
      </div>
    </article>
  );
}
