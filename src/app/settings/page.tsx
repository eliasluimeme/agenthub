import type { Metadata } from 'next';
import { signOutAction, topUpAction, updateProfileAction } from '@/app/actions';
import { ActionForm, SubmitButton } from '@/components/forms';
import { AppShell } from '@/components/Shell';
import { Empty, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { ago } from '@/lib/format';
import { creditBalance, ledgerFor } from '@/lib/queries';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser('/settings');
  const ledger = await ledgerFor(user.id, 40);
  return (
    <AppShell>
      <main className="main stack" style={{ gap: 28, maxWidth: 900 }}>
        <PageTitle cap="Account" title="Settings" />
        <section className="card stack g16" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 20 }}>Profile</h2>
          <ActionForm action={updateProfileAction} className="stack g12">
            <label className="field"><span className="cap">Name</span><input name="name" defaultValue={user.name} required /></label>
            <div className="mut sm">@{user.handle} · {user.email}</div>
            <div><SubmitButton className="btn">Save</SubmitButton></div>
          </ActionForm>
        </section>

        <section id="credits" className="card stack g16" style={{ padding: 24 }}>
          <div className="flex between wrap g12 center">
            <h2 style={{ fontSize: 20 }}>Credits</h2>
            <span className="disp" style={{ fontSize: 40 }}>{(await creditBalance(user.id)).toLocaleString('en-US')}</span>
          </div>
          <ActionForm action={topUpAction} className="flex g8 wrap center">
            <input name="amount" type="number" min={1} max={5000} defaultValue={100} aria-label="Credits to add" style={{ width: 120 }} />
            <SubmitButton className="btn">Add credits</SubmitButton>
            <span className="mut xs">Test mode: no payment is taken.</span>
          </ActionForm>
        </section>

        <section id="ledger" className="card">
          <div className="cap" style={{ padding: '14px 16px', borderBottom: '1px solid var(--hair)' }}>Credit history</div>
          {ledger.map((l) => (
            <div key={l.id} className="row sm">
              <span style={{ flex: 1 }}>{l.reason}{l.agent ? <span className="mut"> · @{l.agent}</span> : null}</span>
              <span className="mut xs">{ago(l.created_at)}</span>
              <b style={{ minWidth: 64, textAlign: 'right', fontWeight: 500 }}>{l.delta > 0 ? '+' : ''}{l.delta}</b>
            </div>
          ))}
          {ledger.length === 0 && <Empty>No credit activity yet.</Empty>}
        </section>

        <form action={signOutAction}><button className="pill">Sign out</button></form>
      </main>
    </AppShell>
  );
}
