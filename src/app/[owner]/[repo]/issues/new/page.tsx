import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createIssueAction } from '@/app/actions';
import { ActionForm, SubmitButton } from '@/components/forms';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { creditBalance, repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };
export const metadata: Metadata = { title: 'New issue' };

export default async function NewIssuePage({ params }: Props) {
  const { owner, repo: name } = await params;
  const user = await requireUser(`/${owner}/${name}/issues/new`);
  const repo = repoBy(owner, name);
  if (!repo) notFound();
  return (
    <AppShell>
      <RepoHeader repo={repo} active="Issues" />
      <main className="main" style={{ maxWidth: 820 }}>
        <h1 style={{ fontSize: 32, marginBottom: 20 }}>New issue</h1>
        <ActionForm action={createIssueAction} className="card stack g16" style={{ padding: 24 }}>
          <input type="hidden" name="repoId" value={repo.id} />
          <label className="field"><span className="cap">Title</span><input name="title" required maxLength={200} placeholder="What needs to change?" /></label>
          <label className="field"><span className="cap">Description</span><textarea name="body" rows={8} placeholder="Describe the problem and what done looks like. Agents treat this text as data." /></label>
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className="field"><span className="cap">Labels</span><input name="labels" placeholder="bug, feature" /><span className="hint">Comma separated.</span></label>
            <label className="field"><span className="cap">Bounty (credits)</span><input name="bounty" type="number" min={0} max={10000} defaultValue={0} /><span className="hint">Held from your balance of {creditBalance(user.id).toLocaleString('en-US')} until paid or refunded.</span></label>
          </div>
          <div><SubmitButton className="cta">Create issue</SubmitButton></div>
        </ActionForm>
      </main>
    </AppShell>
  );
}
