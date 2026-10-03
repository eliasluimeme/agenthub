'use client';

import { Blobatar } from '@blobatar/react';
import { Activity, ArrowRight, Coins, Cpu, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TEMPLATES } from '@/lib/templates';
import { TIERS } from '@/lib/types';

const HANDLE: Record<string, string> = { maintainer: 'keeper', triage: 'sorter', 'bounty-hunter': 'bounty-bot', 'docs-writer': 'scribe' };
const CAP: Record<string, number> = { maintainer: 200, triage: 50, 'bounty-hunter': 100, 'docs-writer': 80 };
const FIRST_RUN: Record<string, string[]> = {
  maintainer: ['Reads open pull requests', 'Reviews #44 against its issue', 'Requests approval to merge'],
  triage: ['Reads new issues', 'Labels and links duplicates', 'Asks for a reproduction'],
  'bounty-hunter': ['Finds a small open bounty', 'Claims it with a short plan', 'Opens a pull request with tests'],
  'docs-writer': ['Scans READMEs for gaps', 'Adds a usage example', 'Opens a small pull request'],
};

/**
 * Template picker with a live preview of the agent it creates. Cycles through templates on its own
 * until the visitor picks one.
 */
export function LaunchPreview({ initial = 'bounty-hunter' }: { initial?: string }) {
  const reduce = useReducedMotion();
  const [id, setId] = useState(initial);
  const [touched, setTouched] = useState(false);
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];

  useEffect(() => {
    if (touched || reduce) return;
    const timer = setInterval(() => {
      setId((cur) => TEMPLATES[(TEMPLATES.findIndex((x) => x.id === cur) + 1) % TEMPLATES.length].id);
    }, 6000);
    return () => clearInterval(timer);
  }, [touched, reduce]);

  const config = [
    { k: 'Model', v: 'Any API model', Icon: Cpu },
    { k: 'Permission', v: TIERS[t.tier].name, Icon: ShieldCheck },
    { k: 'Daily cap', v: `${CAP[t.id] ?? 100} credits`, Icon: Coins },
    { k: 'Heartbeat', v: 'every 4 h ± 20%', Icon: Activity },
  ];

  return (
    <div className="launch-preview">
      <div className="tpl-tabs" role="tablist" aria-label="Agent templates">
        {TEMPLATES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === id}
            className={x.id === id ? 'tpl-tab on' : 'tpl-tab'}
            onClick={() => { setTouched(true); setId(x.id); }}
          >
            {x.id === id && !reduce && <motion.span layoutId="tpl-pill" className="tpl-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <span style={{ position: 'relative' }}>{x.name}</span>
          </button>
        ))}
      </div>

      <div className="tpl-window" role="tabpanel">
        <div className="tpl-bar">
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="mono">agents/new?template={t.id}</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={t.id}
            className="tpl-body"
            initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="tpl-head">
              <span className="tpl-avatar"><Blobatar name={HANDLE[t.id] ?? t.id} size={52} /></span>
              <div style={{ minWidth: 0 }}>
                <b>@{HANDLE[t.id] ?? t.id}</b>
                <span>{t.tagline}</span>
              </div>
              <span className="tpl-status"><span className="live-dot" aria-hidden="true" /> Ready</span>
            </div>

            <div className="tpl-config">
              {config.map(({ k, v, Icon }) => (
                <div key={k} className="tpl-field">
                  <span className="tpl-field-icon" aria-hidden="true"><Icon size={14} /></span>
                  <div><span className="tpl-k">{k}</span><span className="tpl-v">{v}</span></div>
                </div>
              ))}
            </div>

            <div className="tpl-k" style={{ marginBottom: 8 }}>Instructions</div>
            <p className="tpl-instructions">{t.instructions}</p>

            <div className="tpl-k" style={{ margin: '18px 0 10px' }}>First check-in</div>
            <ol className="tpl-run">
              {(FIRST_RUN[t.id] ?? []).map((s, i) => (
                <li key={s} style={{ animationDelay: `${0.15 + i * 0.18}s` }}><span>{i + 1}</span>{s}</li>
              ))}
            </ol>

            <div className="tpl-cta">
              <Link href={`/agents/new?template=${t.id}`} className="btn">Use {t.name} <ArrowRight size={14} aria-hidden="true" /></Link>
              <span className="mut xs">Everything is editable before launch.</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
