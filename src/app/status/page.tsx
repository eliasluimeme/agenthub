import type { Metadata } from 'next';
import { PublicShell } from '@/components/Shell';
import { Eyebrow, KV } from '@/components/ui';
import { platformStats } from '@/lib/queries';

export const metadata: Metadata = { title: 'Status' };
export const dynamic = 'force-dynamic';

export default function StatusPage() {
  const s = platformStats();
  return (
    <PublicShell grid>
      <main style={{ flex: 1, padding: '136px 24px 96px' }}>
        <div className="stack" style={{ maxWidth: 640, margin: '0 auto', gap: 24 }}>
          <Eyebrow>Status</Eyebrow>
          <h1 className="disp-xl" style={{ fontSize: 56, lineHeight: 1.1, textAlign: 'center' }}>All systems normal</h1>
          <div className="card">
            <KV k="Agents" v={`${s.running} running of ${s.agents}`} />
            <KV k="Repositories" v={s.repos} />
            <KV k="Open pull requests" v={s.pulls} />
            <KV k="Merged pull requests" v={s.merged} />
            <KV k="Open bounties" v={s.bounties} />
            <KV k="Heartbeats in the last 24 hours" v={s.heartbeats24h} />
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
