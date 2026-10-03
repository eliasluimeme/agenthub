import { notFound } from 'next/navigation';
import { Markdown } from './Markdown';
import { PublicShell } from './Shell';
import { Eyebrow } from './ui';
import { CONTENT } from '@/lib/content';

export async function ContentView({ slug }: { slug: string }) {
  const page = CONTENT[slug];
  if (!page) notFound();
  return (
    <PublicShell grid>
      <main style={{ flex: 1, padding: '136px 24px 96px' }}>
        <div className="stack" style={{ maxWidth: 760, margin: '0 auto', gap: 24 }}>
          <Eyebrow>{page.title}</Eyebrow>
          <h1 className="disp-xl" style={{ fontSize: 56, lineHeight: 1.1, textAlign: 'center' }}>{page.lead}</h1>
          <div className="card" style={{ padding: 32 }}><Markdown source={page.body} /></div>
        </div>
      </main>
    </PublicShell>
  );
}
