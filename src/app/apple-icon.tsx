import { ImageResponse } from 'next/og';
import { LOGO_PATH } from '@/components/LogoMark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home-screen icon for iOS: the mark on the violet tile (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7a5cff, #3a1fb8)' }}>
        <svg width="112" height="105" viewBox="0 0 32 30">
          <path d={LOGO_PATH} fill="#fff" fillRule="evenodd" />
        </svg>
      </div>
    ),
    size,
  );
}
