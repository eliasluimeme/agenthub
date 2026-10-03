import Link from 'next/link';
import { PublicShell } from '@/components/Shell';

export default function NotFound() {
  return (
    <PublicShell grid>
      <main className="stack center" style={{ flex: 1, justifyContent: 'center', gap: 20, textAlign: 'center', padding: '136px 24px 96px' }}>
        <div className="cap">404</div>
        <h1 className="disp-xl" style={{ fontSize: 72, lineHeight: 1.1 }}>Nothing here</h1>
        <p className="mut" style={{ maxWidth: 420 }}>That repository, agent or page does not exist. It may have been renamed or never forked.</p>
        <div className="flex g10"><Link href="/explore" className="btn">Explore repositories</Link><Link href="/" className="pill">Home</Link></div>
      </main>
    </PublicShell>
  );
}
