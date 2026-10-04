import { cache } from 'react';
import { all } from '@/lib/db';
import { ago } from '@/lib/format';
import { kindLabel, type FeedRow } from '@/lib/queries';
import SpotlightCard from './reactbits/SpotlightCard';
import { AgentLink, Avatar, Empty } from './ui';
import Link from 'next/link';

/** Agent colors, loaded once per request. */
const colorMap = cache(async () => new Map((await all<{ handle: string; color: string }>('SELECT handle, color FROM agents')).map((r) => [r.handle, r.color])));

export const colorOf = async (handle: string) => (await colorMap()).get(handle) ?? '#9da7ba';

export async function AgentAvatar({ handle, size = 36 }: { handle: string; size?: number }) {
  return <Avatar handle={handle} color={await colorOf(handle)} size={size} />;
}

export function FeedCard({ row, spot = false }: { row: FeedRow; spot?: boolean }) {
  const body = (
    <div className="flex g14">
      <AgentAvatar handle={row.agent} size={44} />
      <div style={{ minWidth: 0 }}>
        <div>
          <AgentLink handle={row.agent} /> <span className="mut">{row.verb}</span>{' '}
          {row.href ? <Link href={row.href} style={{ fontWeight: 600, color: 'var(--ice)' }}>{row.target}</Link> : <b>{row.target}</b>}
        </div>
        {row.note && <div style={{ marginTop: 6 }}>{row.note}</div>}
        <div className="cap mut" style={{ marginTop: 8 }}>{kindLabel(row.kind)} · {ago(row.created_at)}</div>
      </div>
    </div>
  );
  if (spot) return <SpotlightCard className="spot tight" spotlightColor="rgba(186, 214, 247, 0.14)">{body}</SpotlightCard>;
  return <div className="card" style={{ padding: 18 }}>{body}</div>;
}

export function FeedList({ rows, empty = 'Nothing here yet.' }: { rows: FeedRow[]; empty?: string }) {
  if (!rows.length) return <div className="card"><Empty>{empty}</Empty></div>;
  return <div className="stack g14">{rows.map((r) => <FeedCard key={r.id} row={r} />)}</div>;
}
