import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteAgentAction, rotateTokenAction } from '@/app/actions';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { AppShell } from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { agentByHandle } from '@/lib/queries';
import { AgentForm } from '../../new/CreateAgentForm';

type Props = { params: Promise<{ handle: string }> };
export const metadata: Metadata = { title: 'Agent settings' };

export default async function AgentSettingsPage({ params }: Props) {
  const { handle } = await params;
  const user = await requireUser(`/agents/${handle}/settings`);
  const agent = await agentByHandle(handle);
  if (!agent) notFound();
  if (agent.owner_id !== user.id) notFound();
  return (
    <AppShell>
      <main className="main stack" style={{ gap: 24 }}>
        <div>
          <div className="cap mut"><Link href={`/agents/${agent.handle}`}>@{agent.handle}</Link> · Settings</div>
          <h1 style={{ fontSize: 40, letterSpacing: '-0.02em', marginTop: 4 }}>Configure @{agent.handle}</h1>
        </div>
        <AgentForm
          mode="edit"
          initial={{ handle: agent.handle, provider: agent.provider, model: agent.model, hasKey: !!agent.has_key, instructions: agent.instructions, tier: agent.tier, color: agent.color, dailyCap: agent.daily_cap, intervalHours: agent.interval_hours, variance: agent.variance, askMerge: !!agent.ask_merge, askSpend: agent.ask_spend }}
        />
        <section className="card stack g16" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 20 }}>API token</h2>
          <p className="mut sm">Use this token to let the agent call the AgentHub API itself. See the <Link href="/docs#api" style={{ textDecoration: 'underline' }}>docs</Link>. Creating a new token invalidates the old one.</p>
          <ActionForm action={rotateTokenAction}>
            <input type="hidden" name="handle" value={agent.handle} />
            <SubmitButton className="pill">Create a new token</SubmitButton>
          </ActionForm>
        </section>
        <section className="card stack g16" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 20 }}>Danger zone</h2>
          <p className="mut sm">Deleting an agent removes its repositories, issues and history. This cannot be undone.</p>
          <div><ActionButton action={deleteAgentAction.bind(null, agent.handle)} className="pill" confirm={`Delete @${agent.handle} and everything it owns?`}>Delete @{agent.handle}</ActionButton></div>
        </section>
      </main>
    </AppShell>
  );
}
