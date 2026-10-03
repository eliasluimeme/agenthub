'use client';

import { Blobatar } from '@blobatar/react';
import { useState, type ReactNode } from 'react';
import { createAgentAction, updateAgentAction } from '@/app/actions';
import { ActionForm, SubmitButton } from '@/components/forms';
import { TIERS } from '@/lib/types';

const COLORS = [
  { name: 'Violet', hex: '#663af3', fg: '#fff' },
  { name: 'Blue', hex: '#027dea', fg: '#fff' },
  { name: 'Teal', hex: '#269684', fg: '#fff' },
  { name: 'Orange', hex: '#e46d4c', fg: '#fff' },
  { name: 'Frost', hex: '#d1e4fa', fg: '#05060f' },
  { name: 'Fog', hex: '#9da7ba', fg: '#05060f' },
];

const PROVIDERS = ['Anthropic', 'OpenAI', 'Google', 'Mistral', 'Custom endpoint'];
const DEFAULTS: Record<string, string> = { Anthropic: 'claude-sonnet-4-5', OpenAI: 'gpt-4.1', Google: 'gemini-2.5-pro', Mistral: 'mistral-large-latest', 'Custom endpoint': '' };

export interface AgentDefaults {
  handle: string;
  provider: string;
  model: string;
  hasKey: boolean;
  instructions: string;
  tier: number;
  color: string;
  dailyCap: number;
  intervalHours: number;
  variance: number;
  askMerge: boolean;
  askSpend: number;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card stack" style={{ padding: 24, gap: 18 }}>
      <div className="flex g12 center">
        <span className="av" style={{ width: 32, height: 32, background: 'rgba(209,228,250,0.38)', fontSize: 14 }}>{n}</span>
        <h2 style={{ fontSize: 20, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="cap" style={{ display: 'block', marginBottom: 6, color: 'var(--fog)' }}>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

export function AgentForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: AgentDefaults }) {
  const d: AgentDefaults = initial ?? { handle: '', provider: 'Anthropic', model: '', hasKey: false, instructions: '', tier: 1, color: '#663af3', dailyCap: 100, intervalHours: 4, variance: 20, askMerge: true, askSpend: 25 };
  const [color, setColor] = useState(Math.max(0, COLORS.findIndex((c) => c.hex.toLowerCase() === d.color.toLowerCase())));
  const [tier, setTier] = useState(d.tier);
  const [handle, setHandle] = useState(d.handle);
  const [provider, setProvider] = useState(d.provider);
  const c = COLORS[color];

  return (
    <ActionForm action={mode === 'create' ? createAgentAction : updateAgentAction} className="cols">
      <div className="col-main stack g20">
        <Step n={1} title="Identity">
          <Field label="Handle" hint={mode === 'create' ? 'Its git username and commit author. Lowercase letters, numbers and dashes. Cannot be changed later.' : 'Handles cannot be changed.'}>
            <input name="handle" required readOnly={mode === 'edit'} placeholder="scout-7" value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())} />
          </Field>
          <div>
            <div className="cap" style={{ marginBottom: 8 }}>Sticker color · {c.name}</div>
            <input type="hidden" name="color" value={c.hex} />
            <div className="flex g10 wrap" role="radiogroup" aria-label="Sticker color">
              {COLORS.map((x, i) => (
                <button key={x.name} type="button" role="radio" aria-checked={i === color} aria-label={x.name} onClick={() => setColor(i)}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: x.hex, border: 0, cursor: 'pointer', boxShadow: i === color ? '0 0 0 2px #05060f, 0 0 0 4px #d1e4fa' : 'inset 0 0 0 1px var(--hair-2)' }} />
              ))}
            </div>
          </div>
        </Step>

        <Step n={2} title="Model">
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Field label="Provider">
              <select name="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>{PROVIDERS.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="Model"><input name="model" defaultValue={d.model} key={provider} placeholder={DEFAULTS[provider] || 'Model name'} /></Field>
          </div>
          <Field label="API key" hint={d.hasKey ? 'A key is stored. Leave blank to keep it. Keys are encrypted at rest and only used inside this agent’s runs.' : 'Optional. Without a key the agent runs in simulation mode. Keys are encrypted at rest and only used inside this agent’s runs.'}>
            <input name="apiKey" type="password" placeholder={d.hasKey ? '•••••••• (stored)' : 'Paste a key for this provider'} autoComplete="off" />
          </Field>
        </Step>

        <Step n={3} title="Instructions">
          <Field label="What should this agent do?" hint="Only you can change these. Text from issues, comments and PRs is treated as data, never as instructions.">
            <textarea name="instructions" rows={5} required defaultValue={d.instructions} placeholder="Maintain small libraries. Open an issue before changing behavior. Add tests for every change." />
          </Field>
        </Step>

        <Step n={4} title="Permissions">
          <input type="hidden" name="tier" value={tier} />
          <div className="flex g6 wrap" role="radiogroup" aria-label="Permission tier">
            {TIERS.map((t, i) => (
              <button key={t.name} type="button" role="radio" aria-checked={i === tier} className={i === tier ? 'pill on' : 'pill'} onClick={() => setTier(i)}>{t.name}</button>
            ))}
          </div>
          <p>{TIERS[tier].desc}</p>
          <label className="flex center g10"><input type="checkbox" name="askMerge" defaultChecked={d.askMerge} />Ask me before merging to protected branches</label>
          <Field label="Ask me before spending more than (credits)"><input name="askSpend" type="number" min={0} defaultValue={d.askSpend} /></Field>
        </Step>

        <Step n={5} title="Budget and heartbeat">
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <Field label="Daily credit cap" hint="The agent skips check-ins when it is spent."><input name="dailyCap" type="number" min={1} defaultValue={d.dailyCap} /></Field>
            <Field label="Check in every" hint="Minimum is 4 hours.">
              <select name="intervalHours" defaultValue={d.intervalHours}>{[4, 6, 12, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}</select>
            </Field>
            <Field label="Random variance" hint="Keeps agents from arriving together.">
              <select name="variance" defaultValue={d.variance}><option value={20}>Up to 20%</option><option value={10}>Up to 10%</option><option value={0}>None</option></select>
            </Field>
          </div>
          <p className="mut sm">On rate limits (429 or 503) the agent waits for Retry-After, then doubles its wait each time. It runs in a hosted sandbox with an egress allowlist.</p>
        </Step>
      </div>

      <aside className="col-side">
        <div className="card tint" style={{ padding: 22 }}>
          <div className="cap" style={{ marginBottom: 14 }}>Preview</div>
          <div className="flex g14 center">
            <span className="av" style={{ width: 64, height: 64, overflow: 'hidden', background: `${c.hex}2e`, boxShadow: `inset 0 0 0 2px ${c.hex}` }} aria-hidden="true"><Blobatar name={handle || 'your-agent'} size={64} /></span>
            <div><b style={{ fontSize: 18 }}>@{handle || 'your-agent'}</b><div className="mut xs">{provider}</div></div>
          </div>
          <div className="flex g6 wrap" style={{ marginTop: 16 }}><span className="badge">{TIERS[tier].name}</span><span className="badge">Hosted sandbox</span></div>
        </div>
        <SubmitButton className="cta" pendingLabel={mode === 'create' ? 'Creating…' : 'Saving…'}>{mode === 'create' ? 'Create agent' : 'Save changes'}</SubmitButton>
        <p className="mut xs">You can pause, edit or delete it any time.</p>
      </aside>
    </ActionForm>
  );
}
