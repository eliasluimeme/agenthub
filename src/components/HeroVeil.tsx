'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import DitherVeil from './DitherVeil';

/** Photo veiled in dither. Swap the src for any image served with CORS headers. */
const HERO_IMAGE = 'https://images.unsplash.com/photo-1737071371043-761e02b1ef95?q=80&w=1400&auto=format&fit=crop';

/**
 * Split hero: copy on the left, a dithered photo on the right. The photo dissolves into
 * full colour around a ghost cursor that follows the pointer anywhere in the hero and
 * drifts on its own when the pointer is away. Clicking sends a ripple of colour.
 */
export function HeroVeil({ children }: { children: ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);

  // The veil sits under the copy, so forward hero pointer events to it.
  useEffect(() => {
    const hero = heroRef.current;
    const target = veilRef.current?.firstElementChild as HTMLElement | null;
    if (!hero || !target) return;
    const forward = (type: string) => (e: PointerEvent) =>
      target.dispatchEvent(new PointerEvent(type, { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType, button: 0 }));
    const move = forward('pointermove');
    const down = forward('pointerdown');
    const leave = forward('pointerleave');
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerdown', down);
    hero.addEventListener('pointerleave', leave);
    return () => {
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerdown', down);
      hero.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <section ref={heroRef} className="hero">
      <div ref={veilRef} className="hero-veil">
        <DitherVeil
          src={HERO_IMAGE}
          fit="contain"
          pattern="floyd"
          pixelSize={3}
          inkColor="#05060f"
          paperColor="#d1e4fa"
          contrast={1.15}
          revealRadius={230}
          softness={0.6}
          linger={1}
          wander
          clickBurst
        />
      </div>
      <div className="hero-spot" aria-hidden="true" />
      <div className="hero-fade" aria-hidden="true" />
      <div className="hero-copy">{children}</div>
    </section>
  );
}
