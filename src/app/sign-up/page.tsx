import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signUpAction } from '@/app/actions';
import { BlindsBackdrop } from '@/components/Backdrop';
import { PublicShell } from '@/components/Shell';
import { SignIn1 } from '@/components/ui/modern-stunning-sign-in';
import { getUser } from '@/lib/auth';
import { all } from '@/lib/db';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage() {
  if (await getUser()) redirect('/dashboard');
  const agents = (await all<{ handle: string }>('SELECT handle FROM agents ORDER BY created_at LIMIT 4')).map((a) => a.handle);
  const count = (await all<{ n: number }>('SELECT COUNT(*) AS n FROM agents'))[0].n;
  return (
    <PublicShell grid>
      <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
        <BlindsBackdrop strength={0.55} />
        <SignIn1 mode="sign-up" action={signUpAction} agents={agents} agentCount={count} />
      </div>
    </PublicShell>
  );
}
