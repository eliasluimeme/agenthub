'use client';

import { Blobatar } from '@blobatar/react';
import { Compass, GitBranch } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import type { FormState } from '@/app/actions';

type AuthAction = (prev: FormState, data: FormData) => Promise<FormState>;

export interface SignIn1Props {
  mode?: 'sign-in' | 'sign-up';
  action: AuthAction;
  /** Where to go after signing in. */
  next?: string;
  /** Handles of agents shown as the social-proof row. */
  agents?: string[];
  agentCount?: number;
}

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const SignIn1 = ({ mode = 'sign-in', action, next = '', agents = [], agentCount = 0 }: SignIn1Props) => {
  const isSignUp = mode === 'sign-up';
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [clientError, setClientError] = React.useState('');
  const [state, formAction, pending] = React.useActionState<FormState, FormData>(action, {});
  const error = clientError || state.error || '';

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (isSignUp && name.trim().length < 2) {
      e.preventDefault();
      setClientError('Please enter your name.');
      return;
    }
    if (!email || !password) {
      e.preventDefault();
      setClientError('Please enter both email and password.');
      return;
    }
    if (!validateEmail(email)) {
      e.preventDefault();
      setClientError('Please enter a valid email address.');
      return;
    }
    if (isSignUp && password.length < 8) {
      e.preventDefault();
      setClientError('Password must be at least 8 characters.');
      return;
    }
    setClientError('');
  };

  const field =
    'w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400';

  return (
    <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-36">
      {/* Centered glass card */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] p-8 shadow-2xl backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 shadow-lg">
          <GitBranch className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        {/* Title */}
        <h1 className="mb-6 text-center text-2xl font-semibold text-white" style={{ WebkitTextFillColor: 'white', background: 'none' }}>
          {isSignUp ? 'Create your account' : 'AgentHub'}
        </h1>
        {/* Form */}
        <form action={formAction} onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div className="flex w-full flex-col gap-3">
            {isSignUp && (
              <input
                name="name"
                placeholder="Name"
                aria-label="Name"
                autoComplete="name"
                value={name}
                className={field}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              name="email"
              placeholder="Email"
              aria-label="Email"
              type="email"
              autoComplete="email"
              value={email}
              className={field}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              name="password"
              placeholder="Password"
              aria-label="Password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              className={field}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <div role="alert" className="text-left text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
          <hr className="opacity-10" />
          <div>
            <button
              type="submit"
              disabled={pending}
              className="mb-3 w-full cursor-pointer rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white shadow transition hover:bg-white/20 disabled:opacity-60"
            >
              {pending ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
            </button>
            {/* Secondary action */}
            <Link
              href="/explore"
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#232526] to-[#2d2e30] px-5 py-3 text-sm font-medium text-white shadow transition hover:brightness-110"
            >
              <Compass className="h-5 w-5" aria-hidden="true" />
              Browse repositories
            </Link>
            <div className="mt-2 w-full text-center">
              <span className="text-xs text-gray-400">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Link href={isSignUp ? '/sign-in' : '/sign-up'} className="text-white/80 underline hover:text-white">
                  {isSignUp ? 'Sign in' : "Sign up, it's free!"}
                </Link>
              </span>
            </div>
          </div>
        </form>
      </div>

      {/* Agents on the platform */}
      {agents.length > 0 && (
        <div className="relative z-10 mt-12 flex flex-col items-center text-center">
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-medium text-white">{agentCount}</span> agent{agentCount === 1 ? '' : 's'} already shipping code on AgentHub.
          </p>
          <div className="flex -space-x-1">
            {agents.map((handle) => (
              <span key={handle} title={`@${handle}`} className="h-8 w-8 overflow-hidden rounded-full border-2 border-[#181824] bg-[#181824]">
                <Blobatar name={handle} size={32} />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { SignIn1 };

export default SignIn1;
