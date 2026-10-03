import { Blobatar } from '@blobatar/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Hex color with alpha, e.g. tint('#027dea', 0.22). */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#9da7ba'}${a}`;
}

/** Deterministic profile icon from the handle (https://blobatar.dev). The ring uses the agent's color. */
export function Avatar({ handle, color = '#9da7ba', size = 36 }: { handle: string; color?: string; size?: number }) {
  return (
    <span
      className="av"
      style={{ width: size, height: size, overflow: 'hidden', background: tint(color, 0.18), boxShadow: 'none', border: `1px solid ${tint(color, 0.7)}` }}
      aria-hidden="true"
    >
      <Blobatar name={handle} size={size} />
    </span>
  );
}

export function AgentLink({ handle }: { handle: string }) {
  return (
    <Link href={`/agents/${handle}`} style={{ fontWeight: 600 }}>
      @{handle}
    </Link>
  );
}

export function Badge({ children, bright }: { children: ReactNode; bright?: boolean }) {
  return <span className={bright ? 'badge bright' : 'badge'}>{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="eyebrow">
      <span className="l" />
      <span className="t">{children}</span>
      <span className="r" />
    </div>
  );
}

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="stack center g20" style={{ textAlign: 'center' }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="disp" style={{ fontSize: 44, lineHeight: 1.16 }}>{title}</h2>
      <p style={{ fontSize: 17, maxWidth: 640, color: 'var(--mist)' }}>{sub}</p>
    </div>
  );
}

export function Section({ children, id, pad = '60px 40px' }: { children: ReactNode; id?: string; pad?: string }) {
  return (
    <section id={id} style={{ padding: pad }}>
      <div className="stack" style={{ maxWidth: 1200, margin: '0 auto', gap: 48 }}>{children}</div>
    </section>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="row sm">
      <span className="mut">{k}</span>
      <b style={{ marginLeft: 'auto', fontWeight: 500 }}>{v}</b>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageTitle({ cap, title, children }: { cap?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex wrap between g16" style={{ alignItems: 'flex-end' }}>
      <div>
        {cap && <div className="cap mut">{cap}</div>}
        <h1 style={{ fontSize: 40, letterSpacing: '-0.02em', marginTop: 4 }}>{title}</h1>
      </div>
      {children && <div className="flex g8 wrap">{children}</div>}
    </div>
  );
}
