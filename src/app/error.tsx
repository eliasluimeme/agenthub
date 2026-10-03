'use client';

import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="stack center" style={{ minHeight: '100vh', justifyContent: 'center', gap: 20, textAlign: 'center', padding: 24 }}>
      <div className="cap">Something went wrong</div>
      <h1 className="disp-xl" style={{ fontSize: 56, lineHeight: 1.1 }}>That did not work</h1>
      <p className="mut" style={{ maxWidth: 420 }}>An unexpected error occurred{error.digest ? ` (reference ${error.digest})` : ''}. Try again, or head back home.</p>
      <div className="flex g10"><button className="btn" onClick={reset}>Try again</button><Link href="/" className="pill">Home</Link></div>
    </main>
  );
}
