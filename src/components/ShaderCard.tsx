'use client';

import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Glass card with an animated WebGL mass of color rising from the bottom: domain-warped noise gives
 * it a ragged, drifting top edge, softened with a blur. Pauses off-screen,
 * renders one still frame for reduced motion, and falls back to a CSS glow without WebGL.
 */

export interface ShaderCardConfig {
  /** Effect color (hex). */
  color?: string;
  /** Animation speed multiplier. */
  speed?: number;
  /** Vertical offset of the noise pattern. */
  positionY?: number;
  /** Share of the card the effect fills, from the bottom (0.5 = half). */
  coverage?: number;
  /** Size of the noise pattern (higher = finer detail). */
  scale?: number;
  /** Strength of the vein-like branches. */
  branchIntensity?: number;
  verticalExtent?: number;
  horizontalExtent?: number;
  /** Core radius of the effect. */
  effectRadius?: number;
  /** Extra brightness from the noise. */
  effectBoost?: number;
  noiseScale?: number;
  /** Horizontal stretch. */
  widthFactor?: number;
  /** Wave distortion. */
  waveAmount?: number;
  edgeMin?: number;
  edgeMax?: number;
  /** Higher = sharper falloff toward the edge. */
  falloffPower?: number;
  /** CSS blur in px. */
  blur?: number;
  opacity?: number;
  /** Phase offset so several cards don't move in sync. */
  seed?: number;
  autoPlay?: boolean;
}

/** The configuration from the React Bits Pro Shader Card demo. */
export const SHADER_CARD_DEFAULTS: Required<ShaderCardConfig> = {
  color: '#5227FF',
  speed: 0.5,
  positionY: 0.15,
  coverage: 0.55,
  scale: 4.0,
  branchIntensity: 2.0,
  verticalExtent: 1.5,
  horizontalExtent: 1.5,
  effectRadius: 0.9,
  effectBoost: 0.5,
  noiseScale: 1.5,
  widthFactor: 1.5,
  waveAmount: 0.15,
  edgeMin: 0.0,
  edgeMax: 1.0,
  falloffPower: 2.0,
  blur: 5,
  opacity: 0.8,
  seed: 0,
  autoPlay: true,
};

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uColor;
uniform float uPosY;
uniform float uCoverage;
uniform float uScale;
uniform float uBranch;
uniform float uVExt;
uniform float uHExt;
uniform float uRadius;
uniform float uBoost;
uniform float uNoiseScale;
uniform float uWidthFactor;
uniform float uWave;
uniform float uEdgeMin;
uniform float uEdgeMax;
uniform float uFalloff;
uniform vec2 uMouse;
uniform float uHover;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot * p * 2.02; a *= 0.5; }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = rot * p * 2.02; a *= 0.5; }
  return v / 0.875;
}

void main() {
  float t = uTime;
  float aspect = uRes.x / uRes.y;
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // y = 0 at the top

  // Noise space: stretched horizontally, scaled by the extents, with a slow wave.
  vec2 p = vec2((uv.x - 0.5) * aspect / uWidthFactor, uv.y + uPosY) / vec2(uHExt, uVExt);
  p += uWave * vec2(sin(uv.y * 6.0 + t * 1.3), cos(uv.x * 5.0 + t * 0.9));
  p -= (uMouse - vec2(0.5)) * 0.15 * uHover;   // lean toward the cursor on hover

  // Domain-warped noise drifting upward: big, soft lobes that fold and rise like smoke.
  vec2 warp = vec2(fbm3(p * uNoiseScale * 0.8 + vec2(0.0, t * 0.3)), fbm3(p * uNoiseScale * 0.8 + vec2(5.2, -t * 0.25)));
  float n = fbm3(p * uScale * 0.28 + warp * 1.3 + vec2(t * 0.08, t * 0.28));
  // Fine branching detail, used only for shading inside the mass so the edge stays smooth.
  float ridge = 1.0 - abs(fbm(p * uScale * 0.7 + warp * 2.0 + vec2(0.0, t * 0.4)) * 2.0 - 1.0);
  float veins = pow(clamp(ridge, 0.0, 1.0), 5.0) * uBranch * 0.08;

  // A solid mass filling the lower part of the card (uCoverage), with a rolling top edge.
  float line = 1.0 - uCoverage;
  float f = (uv.y - line) * 1.6 + (n - 0.4) * (1.6 + uBoost);
  f -= pow(abs(uv.x - 0.5) * 2.0, uFalloff * 2.0) * (1.0 - uRadius) * 2.0;
  float soft = 0.03 + 0.06 * (uEdgeMax - uEdgeMin);
  float mask = smoothstep(-soft, soft, f);

  // Lighter violet near the edge, deep color toward the bottom, with gentle inner shading.
  vec3 light = mix(uColor, vec3(0.62, 0.34, 0.88), 0.6);
  vec3 deep = uColor * 0.82;
  float depth = clamp(smoothstep(line - 0.15, 1.0, uv.y) + (n - 0.5) * 0.5, 0.0, 1.0);
  vec3 col = (mix(light, deep, depth) * (0.85 + 0.3 * n) + light * veins) * (1.0 + 0.12 * uHover);

  gl_FragColor = vec4(col * mask, mask);   // premultiplied
}
`;

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function ShaderCard({
  children,
  className = '',
  style,
  ...config
}: ShaderCardConfig & { children: ReactNode; className?: string; style?: CSSProperties }) {
  const c = { ...SHADER_CARD_DEFAULTS, ...config };
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(c);

  useEffect(() => {
    const wrap = wrapRef.current;
    const host = canvasHostRef.current;
    if (!wrap || !host) return;
    const cfg = JSON.parse(key) as Required<ShaderCardConfig>;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 1.5), alpha: true, antialias: false, premultipliedAlpha: true });
    } catch {
      return; // no WebGL: the CSS glow remains
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
    host.appendChild(canvas);

    const uniforms = {
      uTime: { value: cfg.seed * 7.3 },
      uRes: { value: [1, 1] },
      uColor: { value: hexToRgb(cfg.color) },
      uPosY: { value: cfg.positionY },
      uCoverage: { value: cfg.coverage },
      uScale: { value: cfg.scale },
      uBranch: { value: cfg.branchIntensity },
      uVExt: { value: cfg.verticalExtent },
      uHExt: { value: cfg.horizontalExtent },
      uRadius: { value: cfg.effectRadius },
      uBoost: { value: cfg.effectBoost },
      uNoiseScale: { value: cfg.noiseScale },
      uWidthFactor: { value: cfg.widthFactor },
      uWave: { value: cfg.waveAmount },
      uEdgeMin: { value: cfg.edgeMin },
      uEdgeMax: { value: cfg.edgeMax },
      uFalloff: { value: cfg.falloffPower },
      uMouse: { value: [0.5, 0.5] },
      uHover: { value: 0 },
    };
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex, fragment, uniforms, transparent: true }) });

    const render = () => renderer.render({ scene: mesh });
    const resize = () => {
      // The host overflows the card by the blur margin so the blurred edges stay saturated.
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h);
      uniforms.uRes.value = [w, h];
      if (reduced || !cfg.autoPlay) render();
    };

    let visible = true;
    let hover = 0;
    let hoverTarget = 0;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      uniforms.uTime.value += dt * cfg.speed;
      hover += (hoverTarget - hover) * Math.min(1, dt * 5);
      uniforms.uHover.value = hover;
      render();
    };

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      uniforms.uMouse.value = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
      hoverTarget = 1;
    };
    const onLeave = () => { hoverTarget = 0; };
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(wrap);
    resize();
    if (!reduced && cfg.autoPlay) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [key]);

  return (
    <div ref={wrapRef} className={`shader-card ${className}`.trim()} style={{ ['--glow' as string]: c.color, ...style }}>
      <div
        ref={canvasHostRef}
        className="shader-card__canvas"
        aria-hidden="true"
        style={{ filter: c.blur ? `blur(${c.blur}px)` : undefined, opacity: c.opacity, inset: c.blur ? -c.blur * 2 : 0 }}
      />
      <div className="shader-card__content">{children}</div>
    </div>
  );
}
