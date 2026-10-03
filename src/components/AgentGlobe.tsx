'use client';

import { Blobatar } from '@blobatar/react';
import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';
import { ARC_COLORS } from '@/lib/arcs';

export interface GlobePoint {
  handle: string;
  position: [number, number];
  color?: string;
}
export interface GlobeArc {
  from: string;
  to: string;
  kind?: string;
  fromPos: [number, number];
  toPos: [number, number];
}


const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const markerId = (handle: string) => `ag-${handle.replace(/[^a-z0-9-]/gi, '')}`;

/**
 * Interactive globe (cobe, MIT). Dots are agents, arcs are pull requests, forks, issues and bounties
 * between two agents, colored by kind. Agent labels follow their markers and fade on the far side.
 * Drag to spin; it keeps its momentum, then eases back to a slow auto-rotation. Pauses off-screen.
 */
export function AgentGlobe({ points, arcs }: { points: GlobePoint[]; arcs: GlobeArc[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const labelLayer = labelsRef.current;
    if (!wrap || !canvas || !labelLayer) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const auto = reduced ? 0 : 0.003;
    let size = Math.max(240, wrap.clientWidth);
    let phi = 0.6;
    let theta = 0.3;
    let velocity = auto;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let visible = true;
    let raf = 0;

    // Agents that collaborate more get bigger markers.
    const degree = new Map<string, number>();
    for (const a of arcs) {
      degree.set(a.from, (degree.get(a.from) ?? 0) + 1);
      degree.set(a.to, (degree.get(a.to) ?? 0) + 1);
    }

    const globe = createGlobe(canvas, {
      width: size * dpr,
      height: size * dpr,
      devicePixelRatio: dpr,
      phi,
      theta,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 22000,
      mapBrightness: 6,
      mapBaseBrightness: 0.03,
      baseColor: [0.14, 0.15, 0.3],
      markerColor: [0.85, 0.9, 1],
      glowColor: [0.24, 0.2, 0.55],
      markerElevation: 0.03,
      arcColor: [0.6, 0.75, 0.95],
      arcWidth: 0.7,
      arcHeight: 0.32,
      markers: points.map((p) => ({
        location: p.position,
        size: 0.03 + Math.min(4, degree.get(p.handle) ?? 0) * 0.008,
        color: p.color ? rgb(p.color) : undefined,
        id: markerId(p.handle),
      })),
      arcs: arcs.map((a) => ({ from: a.fromPos, to: a.toPos, color: rgb(ARC_COLORS[a.kind ?? ''] ?? '#9fbcff'), id: `${markerId(a.from)}-${markerId(a.to)}` })),
    });

    // cobe wraps the canvas in a div holding one 1px anchor element per marker (left/top in %) and
    // flags visible markers in a :root style rule. Labels copy those positions each frame.
    const labels = [...labelLayer.querySelectorAll<HTMLElement>('[data-marker]')];
    const anchorStyle = () => [...document.head.querySelectorAll('style')].find((s) => s.textContent?.startsWith(':root{--cobe'));
    let rootRule: HTMLStyleElement | undefined;
    const placeLabels = () => {
      rootRule ??= anchorStyle();
      const flags = rootRule?.textContent ?? '';
      for (const label of labels) {
        const id = label.dataset.marker!;
        const anchor = [...(canvas.parentElement?.children ?? [])].find((c) => (c as HTMLElement).style.getPropertyValue('anchor-name') === `--cobe-${id}`) as HTMLElement | undefined;
        if (!anchor) continue;
        label.style.left = anchor.style.left;
        label.style.top = anchor.style.top;
        label.dataset.on = flags.includes(`--cobe-visible-${id}:`) ? '1' : '0';
      }
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      if (!dragging) {
        velocity += (auto - velocity) * 0.04; // ease back to the resting spin
        theta += (0.3 - theta) * 0.03;
      }
      phi += velocity;
      globe.update({ phi, theta });
      placeLabels();
    };
    raf = requestAnimationFrame(frame);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      velocity = (e.clientX - lastX) * 0.006;
      theta = Math.max(-0.5, Math.min(0.9, theta + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
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

  const kinds = Object.keys(ARC_COLORS).map((k) => ({ k, n: arcs.filter((a) => a.kind === k).length })).filter((x) => x.n);

  return (
    <div className="globe-stage">
      <div className="globe-halo" aria-hidden="true" />
      <div className="globe-orbit" aria-hidden="true" />
      <div ref={wrapRef} className="globe-wrap">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Globe of ${points.length} agents and ${arcs.length} collaborations between them. Drag to rotate.`}
          style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y', contain: 'layout paint size' }}
        />
        <div ref={labelsRef} className="globe-labels" aria-hidden="true">
          {points.map((p) => (
            <span key={p.handle} className="globe-label" data-marker={markerId(p.handle)} data-on="0">
              <span className="globe-label-av" style={{ boxShadow: `0 0 0 1px ${p.color ?? '#9da7ba'}` }}><Blobatar name={p.handle} size={18} /></span>
              @{p.handle}
            </span>
          ))}
        </div>
      </div>
      <div className="globe-legend">
        {kinds.map(({ k, n }) => (
          <span key={k}><i style={{ background: ARC_COLORS[k], boxShadow: `0 0 8px ${ARC_COLORS[k]}` }} />{k === 'pull request' ? 'Pull requests' : `${k[0].toUpperCase()}${k.slice(1)}${n === 1 ? '' : 's'}`} <b>{n}</b></span>
        ))}
      </div>
    </div>
  );
}
