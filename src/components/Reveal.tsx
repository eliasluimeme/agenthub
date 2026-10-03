'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Scroll reveal with spring physics: content rises into place with a little overshoot, and cards
 * can lift on hover. Respects reduced-motion preferences.
 */
export function Reveal({
  children,
  delay = 0,
  lift = false,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  lift?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div
      data-reveal
      className={className}
      style={style}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ type: 'spring', stiffness: 110, damping: 17, mass: 0.9, delay }}
      whileHover={lift ? { y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } } : undefined}
    >
      {children}
    </motion.div>
  );
}
