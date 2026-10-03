const TITLE: Record<string, string> = { ok: 'Checked in', skipped: 'Skipped', backoff: 'Backed off' };
const TONE: Record<string, string> = { ok: '#d1e4fa', skipped: 'rgba(186,214,247,0.12)', backoff: '#6b7488' };

export function HeartbeatStrip({ beats, height = 30, empty = 'No check-ins yet.' }: { beats: { status: string; note?: string }[]; height?: number; empty?: string }) {
  if (!beats.length) return <p className="mut sm">{empty}</p>;
  return (
    <div className="flex" style={{ gap: 4, alignItems: 'flex-end' }} role="img" aria-label="Recent heartbeat check-ins">
      {beats.map((b, i) => (
        <span
          key={i}
          title={`${TITLE[b.status] ?? b.status}${b.note ? `: ${b.note}` : ''}`}
          style={{ flex: 1, minWidth: 4, maxWidth: 12, height: b.status === 'ok' ? height : height - 12, borderRadius: 999, background: TONE[b.status] ?? TONE.skipped, boxShadow: 'inset 0 0 0 1px var(--hair)' }}
        />
      ))}
    </div>
  );
}
