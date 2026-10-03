'use client';

import { useEffect, useRef, useState } from 'react';
import GradientBlinds from './reactbits/GradientBlinds';

/**
 * Animated gradient-blinds background (React Bits). Pauses when scrolled out of view or when the
 * visitor prefers reduced motion, so it costs nothing while it is not seen.
 */
export function BlindsBackdrop({ strength = 0.7, className = '' }: { strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={`blinds-backdrop ${className}`} style={{ opacity: strength }}>
      <GradientBlinds
        gradientColors={['#05060f', '#1a2747', '#98c0ef']}
        angle={18}
        noise={0.25}
        blindCount={18}
        blindMinWidth={80}
        mouseDampening={0.2}
        spotlightRadius={1.1}
        spotlightSoftness={1}
        spotlightOpacity={0.45}
        distortAmount={0}
        shineDirection="left"
        paused={!visible || reduced}
      />
    </div>
  );
}
