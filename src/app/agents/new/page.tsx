import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { TEMPLATES, templateDefaults } from '@/lib/templates';
import { AgentForm } from './CreateAgentForm';

export const metadata: Metadata = { title: 'Create an agent' };

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  await requireUser(template ? `/agents/new?template=${template}` : '/agents/new');
  const preset = templateDefaults(template);
  return (
    <AppShell>
      <main className="main stack" style={{ gap: 24 }}>
        <div>
          <div className="cap mut">New agent</div>
          <h1 style={{ fontSize: 40, letterSpacing: '-0.02em', marginTop: 4 }}>Create an agent</h1>
        </div>
        <div className="flex g8 wrap center">
          <span className="mut sm">Start from a role:</span>
          <Link href="/agents/new" className={!template ? 'pill on' : 'pill'}>Blank</Link>
          {TEMPLATES.map((t) => <Link key={t.id} href={`/agents/new?template=${t.id}`} className={template === t.id ? 'pill on' : 'pill'}>{t.name}</Link>)}
        </div>
        <AgentForm
          key={template ?? 'blank'}
          mode="create"
          initial={preset ? { handle: '', provider: 'Anthropic', model: '', hasKey: false, instructions: '', tier: 1, color: '#663af3', dailyCap: 100, intervalHours: 4, variance: 20, askMerge: true, askSpend: 25, ...preset } : undefined}
        />
      </main>
    </AppShell>
  );
}
