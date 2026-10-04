'use client';

import { ChevronRight, FileText, Folder, FolderOpen, GitBranch, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface Node {
  name: string;
  path: string;
  children?: Node[];
}

/** Builds a nested tree from flat file paths: folders first, then files, alphabetical. */
function build(paths: string[]): Node[] {
  const root: Node = { name: '', path: '', children: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let cur = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;
      let next = cur.children!.find((c) => c.name === part && !!c.children === !isFile);
      if (!next) {
        next = isFile ? { name: part, path } : { name: part, path, children: [] };
        cur.children!.push(next);
      }
      cur = next;
    });
  }
  const sort = (nodes: Node[]): Node[] =>
    nodes.sort((a, b) => (!!a.children === !!b.children ? a.name.localeCompare(b.name) : a.children ? -1 : 1)).map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

/** The repository's files as a collapsible tree, with the current file or folder highlighted. */
export function FileTree({ base, paths, current, branch = 'main' }: { base: string; paths: string[]; current: string; branch?: string }) {
  const tree = useMemo(() => build(paths), [paths]);
  // Folders on the way to the current path start open.
  const [open, setOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const parts = current.split('/');
    for (let i = 1; i <= parts.length; i++) s.add(parts.slice(0, i).join('/'));
    return s;
  });
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const matches = q.trim() ? paths.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40) : [];

  const toggle = (path: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(path)) n.delete(path);
    else n.add(path);
    return n;
  });

  const render = (nodes: Node[], depth: number) => (
    <ul className="ft-list" role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map((n) => {
        const isOpen = open.has(n.path);
        const active = n.path === current;
        return (
          <li key={n.path} role="treeitem" aria-expanded={n.children ? isOpen : undefined} aria-selected={active}>
            <div className={active ? 'ft-row on' : 'ft-row'} style={{ paddingLeft: 4 + depth * 16, ['--depth' as string]: depth }}>
              {Array.from({ length: depth }, (_, d) => <span key={d} className="ft-guide" style={{ left: 12 + d * 16 }} aria-hidden="true" />)}
              {n.children ? (
                <button type="button" className="ft-twisty" onClick={() => toggle(n.path)} aria-label={isOpen ? `Collapse ${n.name}` : `Expand ${n.name}`}>
                  <ChevronRight size={13} className={isOpen ? 'open' : ''} />
                </button>
              ) : <span className="ft-twisty" />}
              {n.children ? (isOpen ? <FolderOpen size={14} className="ft-folder" aria-hidden="true" /> : <Folder size={14} className="ft-folder" aria-hidden="true" />) : <FileText size={14} className="ft-file" aria-hidden="true" />}
              <Link href={`${base}/tree/${n.path}`} className="ft-name" onClick={() => n.children && !isOpen && toggle(n.path)}>{n.name}</Link>
            </div>
            {n.children && isOpen && render(n.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  if (collapsed) {
    return (
      <aside className="ft collapsed">
        <button type="button" className="ft-icon" onClick={() => setCollapsed(false)} aria-label="Show files"><PanelLeftOpen size={15} /></button>
      </aside>
    );
  }
  return (
    <aside className="ft" aria-label="Files">
      <div className="ft-head">
        <b>Files</b>
        <Link href={base} className="ft-branch" title={`Branch: ${branch}`}><GitBranch size={12} aria-hidden="true" /> {branch}</Link>
        <button type="button" className="ft-icon" onClick={() => setCollapsed(true)} aria-label="Hide files"><PanelLeftClose size={15} /></button>
      </div>
      <label className="ft-search">
        <Search size={13} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to file" aria-label="Filter files" />
        {q && <button type="button" className="ft-clear" onClick={() => setQ('')} aria-label="Clear filter">×</button>}
      </label>
      <div className="ft-scroll">
        {q.trim() ? (
          matches.length ? (
            <ul className="ft-list">
              {matches.map((p) => (
                <li key={p}><Link href={`${base}/tree/${p}`} className={p === current ? 'ft-row ft-match on' : 'ft-row ft-match'}><FileText size={14} className="ft-file" aria-hidden="true" /> <span className="ft-name">{p}</span></Link></li>
              ))}
            </ul>
          ) : <p className="ft-none">No matching files.</p>
        ) : render(tree, 0)}
      </div>
    </aside>
  );
}
