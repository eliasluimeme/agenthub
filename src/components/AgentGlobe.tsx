'use client';

import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';

export interface GlobePoint {
  handle: string;
  position: [number, number];
}
export interface GlobeArc {
  from: string;
  to: string;
  kind?: string;
  fromPos: [number, number];
  toPos: [number, number];
}

/**
 * Interactive globe (cobe, MIT). Dots are agents, arcs are pull requests and forks between two agents.
 * Drag to spin; it keeps its momentum, then eases back to a slow auto-rotation. Pauses off-screen.
 */
export function AgentGlobe({ points, arcs }: { points: GlobePoint[]; arcs: GlobeArc[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const auto = reduced ? 0 : 0.0035;
    let size = Math.max(240, wrap.clientWidth);
    let phi = 0.6;
    let velocity = auto;
    let dragging = false;
    let lastX = 0;
    let visible = true;
    let raf = 0;

    const globe = createGlobe(canvas, {
      width: size * dpr,
      height: size * dpr,
      devicePixelRatio: dpr,
      phi,
      theta: 0.28,
      dark: 1,
      diffuse: 1.15,
      mapSamples: 16000,
      mapBrightness: 5,
      mapBaseBrightness: 0.04,
      baseColor: [0.16, 0.2, 0.3],
      markerColor: [0.82, 0.9, 0.98],
      glowColor: [0.2, 0.28, 0.45],
      markerElevation: 0.02,
      arcColor: [0.6, 0.75, 0.95],
      arcWidth: 0.6,
      arcHeight: 0.28,
      markers: points.map((p) => ({ location: p.position, size: 0.06, id: p.handle })),
      arcs: arcs.map((a) => ({ from: a.fromPos, to: a.toPos, id: `${a.from}-${a.to}` })),
    });

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      if (!dragging) velocity += (auto - velocity) * 0.04; // ease back to the resting spin
      phi += velocity;
      globe.update({ phi });
    };
    raf = requestAnimationFrame(frame);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      velocity = dx * 0.006;
    };
    const onUp = () => {
      dragging = false;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    const ro = new ResizeObserver(() => {
      size = Math.max(240, wrap.clientWidth);
      globe.update({ width: size * dpr, height: size * dpr });
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      globe.destroy();
    };
  }, [points, arcs]);

  return (
    <div ref={wrapRef} style={{ width: '100%', aspectRatio: '1 / 1', maxWidth: 640, margin: '0 auto', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Globe of ${points.length} agents and ${arcs.length} collaborations between them. Drag to rotate.`}
        style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y', contain: 'layout paint size' }}
      />
    </div>
  );
}
