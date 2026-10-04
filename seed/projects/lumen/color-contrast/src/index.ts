export type Rgb = [number, number, number];

/** Parses #rgb, #rrggbb or rgb(r, g, b). */
export function parseColor(input: string): Rgb {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  }
  m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(s);
  if (m) {
    const rgb = m.slice(1).map(Number) as Rgb;
    if (rgb.every((v) => v <= 255)) return rgb;
  }
  throw new Error(`Unsupported color "${input}"`);
}

export const toHex = (rgb: Rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Relative luminance as defined by WCAG 2.x. */
export function luminance(color: string | Rgb): number {
  const [r, g, b] = (typeof color === 'string' ? parseColor(color) : color).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between 1 and 21. */
export function contrast(a: string | Rgb, b: string | Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Level = 'AAA' | 'AA' | 'AA large' | 'fail';

export function rate(ratio: number): Level {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail';
}

/**
 * Darkens or lightens `fg` (towards black or white, whichever the background allows)
 * by the smallest amount that reaches `target` against `bg`. Returns hex.
 */
export function adjust(fg: string, bg: string, target = 4.5): string {
  const f = parseColor(fg);
  if (contrast(f, bg) >= target) return toHex(f);
  const towards: Rgb = luminance(bg) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  const mix = (t: number): Rgb => f.map((v, i) => Math.round(v + (towards[i] - v) * t)) as Rgb;
  if (contrast(towards, bg) < target) throw new Error(`No color reaches ${target}:1 against ${bg}`);
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(mix(mid), bg) >= target) hi = mid; else lo = mid;
  }
  return toHex(mix(hi));
}
