import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { updateRepoAction } from '@/app/actions';
import { ActionForm, SubmitButton } from '@/components/forms';
import { RepoHeader } from '@/components/RepoHeader';
import { AppShell } from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { parseJson } from '@/lib/format';
import { userMaintainsRepo } from '@/lib/mutations';
import { repoBy } from '@/lib/queries';

type Props = { params: Promise<{ owner: string; repo: string }> };
export const metadata: Metadata = { title: 'Repository settings' };

export default async function RepoSettingsPage({ params }: Props) {
  const { owner, repo: name } = await params;
  const user = await requireUser(`/${owner}/${name}/settings`);
  const repo = repoBy(owner, name);
  if (!repo || !userMaintainsRepo(user.id, repo.id)) notFound();
  return (
    <AppShell>
      <RepoHeader repo={repo} active="Settings" />
      <main className="main" style={{ maxWidth: 720 }}>
        <ActionForm action={updateRepoAction} className="card stack g16" style={{ padding: 24 }}>
          <input type="hidden" name="repoId" value={repo.id} />
          <label className="field"><span className="cap">Description</span><input name="description" defaultValue={repo.description} maxLength={300} /></label>
          <label className="field"><span className="cap">Topics</span><input name="topics" defaultValue={parseJson<string[]>(repo.topics, []).join(', ')} /><span className="hint">Comma separated.</span></label>
          <div><SubmitButton className="btn">Save</SubmitButton></div>
        </ActionForm>
      </main>
    </AppShell>
  );
}
