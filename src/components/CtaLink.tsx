'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import StarBorder from './reactbits/StarBorder';

/** Primary call-to-action: a link with React Bits' animated star border. */
export function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <StarBorder as={Link} href={href} className="cta-star" color="#d1e4fa" speed="5s" backgroundColor="rgba(5,6,15,0.9)" textColor="#fff" borderColor="transparent">
      {children}
    </StarBorder>
  );
}
