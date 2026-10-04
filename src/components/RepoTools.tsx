'use client';

import { Check, ChevronDown, Code2, Copy, Download, FileText, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Copies text to the clipboard and confirms for a moment. */
export function CopyButton({ text, label = 'Copy', className = 'tool-btn' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {done ? 'Copied' : label}
    </button>
  );
}

/** "Go to file": type to filter the repository's files, Enter or click to open one. Press P to focus. */
export function GoToFile({ base, paths }: { base: string; paths: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const matches = (q ? paths.filter((p) => p.toLowerCase().includes(q.toLowerCase())) : paths).slice(0, 8);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() === 'p' && (e.metaKey || e.ctrlKey || !/INPUT|TEXTAREA|SELECT/.test(t.tagName))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (p: string) => router.push(`${base}/tree/${p}`);
  return (
    <div className="goto">
      <label className="goto-field">
        <Search size={15} aria-hidden="true" />
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, matches.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
            if (e.key === 'Enter' && matches[i]) go(matches[i]);
            if (e.key === 'Escape') input.current?.blur();
          }}
          placeholder="Go to file..."
          aria-label="Go to file"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
        />
        <kbd>⌘P</kbd>
      </label>
      {open && matches.length > 0 && (
        <ul className="goto-list" id={listId} role="listbox">
          {matches.map((p, n) => (
            <li key={p} role="option" aria-selected={n === i}>
              <button type="button" className={n === i ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); go(p); }}>
                <FileText size={14} aria-hidden="true" /> {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The violet "Code" menu: clone URL and the agent API path. */
export function CloneMenu({ url, api }: { url: string; api: string }) {
  return (
    <details className="clone">
      <summary className="clone-btn"><Code2 size={16} aria-hidden="true" /> Code <span className="clone-sep" /><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="clone-panel">
        <div className="clone-k">Clone over HTTPS</div>
        <div className="clone-row"><code>{url}</code><CopyButton text={url} label="" className="icon-btn" /></div>
        <div className="clone-k" style={{ marginTop: 12 }}>Agent API</div>
        <div className="clone-row"><code>{api}</code><CopyButton text={api} label="" className="icon-btn" /></div>
        <p className="clone-note">Agents read and write files through the API with their own token.</p>
      </div>
    </details>
  );
}

/** README card: rendered preview or source with line numbers. */
export function ReadmeViewer({ name, source, rawHref, children }: { name: string; source: string; rawHref: string; children: ReactNode }) {
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const lines = source.replace(/\n$/, '').split('\n');
  return (
    <section className="readme">
      <div className="readme-bar">
        <span className="readme-name"><FileText size={15} aria-hidden="true" /> {name}</span>
        <div className="seg" role="tablist" aria-label="README view">
          <button type="button" role="tab" aria-selected={mode === 'preview'} className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>Preview</button>
          <button type="button" role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'on' : ''} onClick={() => setMode('code')}>Code</button>
        </div>
        <span className="readme-actions">
          <a href={rawHref} className="tool-btn">Raw</a>
          <CopyButton text={source} label="" className="icon-btn" />
        </span>
      </div>
      {mode === 'preview' ? (
        <div className="readme-body">{children}</div>
      ) : (
        <pre className="numbered">{lines.map((l, n) => <span key={n} className="ln"><i>{n + 1}</i>{l || ' '}</span>)}</pre>
      )}
    </section>
  );
}

/** File box: optional Preview/Code toggle (Markdown), size info, Raw, Copy and Download. */
export function FileViewer({ meta, source, rawHref, preview, code }: { meta: string; source: string; rawHref: string; preview?: ReactNode; code: ReactNode }) {
  const [mode, setMode] = useState<'preview' | 'code'>(preview ? 'preview' : 'code');
  return (
    <section className="readme file-box">
      <div className="readme-bar">
        <div className="seg" role="tablist" aria-label="View">
          {preview && <button type="button" role="tab" aria-selected={mode === 'preview'} className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>Preview</button>}
          <button type="button" role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'on' : ''} onClick={() => setMode('code')}>Code</button>
        </div>
        <span className="file-meta">{meta}</span>
        <span className="readme-actions">
          <a href={rawHref} className="tool-btn" target="_blank" rel="noreferrer">Raw</a>
          <CopyButton text={source} label="" className="icon-btn" />
          <a href={`${rawHref}?download=1`} className="icon-btn" aria-label="Download file" download><Download size={14} /></a>
        </span>
      </div>
      {mode === 'preview' && preview ? <div className="readme-body">{preview}</div> : code}
    </section>
  );
}
