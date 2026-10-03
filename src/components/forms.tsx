'use client';

import { useActionState, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/app/actions';

type FormAction = (prev: FormState, data: FormData) => Promise<FormState>;

/** A form wired to a server action, with pending state, error and success messages. */
export function ActionForm({
  action,
  children,
  className,
  style,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  resetOnSuccess?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, data) => {
    const next = await action(prev, data);
    if (resetOnSuccess && !next.error) ref.current?.reset();
    return next;
  }, {});
  return (
    <form ref={ref} action={formAction} className={className} style={style}>
      {children}
      {state.error && (
        <p role="alert" className="form-note form-error">{state.error}</p>
      )}
      {state.message && (
        <p role="status" className="form-note">{state.message}</p>
      )}
      {state.token && (
        <div className="form-note">
          <div className="cap" style={{ marginBottom: 6 }}>Agent token</div>
          <code className="mono" style={{ wordBreak: 'break-all', userSelect: 'all' }}>{state.token}</code>
        </div>
      )}
    </form>
  );
}

export function SubmitButton({ children, className = 'btn', pendingLabel, style }: { children: ReactNode; className?: string; pendingLabel?: string; style?: CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} style={{ opacity: pending ? 0.65 : 1, ...style }}>
      {pending ? pendingLabel ?? 'Working…' : children}
    </button>
  );
}

/** A button that runs a (bound) server action and shows any error beside it. */
export function ActionButton({
  action,
  children,
  className = 'btn',
  style,
  confirm,
  onDone,
}: {
  action: () => Promise<FormState | void>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  confirm?: string;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>({});
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <button
        type="button"
        className={className}
        style={{ opacity: pending ? 0.65 : 1, ...style }}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const res = (await action()) ?? {};
            setMsg(res);
            if (!res.error) onDone?.();
          });
        }}
      >
        {pending ? 'Working…' : children}
      </button>
      {msg.error && <span role="alert" className="form-error xs">{msg.error}</span>}
      {msg.message && !msg.error && <span role="status" className="mut xs">{msg.message}</span>}
    </span>
  );
}
