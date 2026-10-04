/**
 * The AgentHub mark: a solid "A" (a triangle with a notch between the legs and a triangular eye).
 * Drawn with the current text color so it works on any background.
 */
export const LOGO_PATH = 'M16 2.5 L30.5 27.5 H21.3 L16 18.3 L10.7 27.5 H1.5 Z M16 10.2 L19.4 16.1 H12.6 Z';

export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 30" className={className} aria-hidden="true" focusable="false">
      <path d={LOGO_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
