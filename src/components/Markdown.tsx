import Link from 'next/link';
import type { ReactNode } from 'react';
import { fenceLanguage, highlight } from './CodeView';
import { CopyButton } from './RepoTools';

/** A small, safe Markdown renderer (headings, bullet and numbered lists, tables, code, links, bold). Never injects raw HTML. */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/)!;
      const safe = /^(https?:\/\/|\/|#|mailto:)/.test(href);
      out.push(
        safe ? (
          href.startsWith('/') || href.startsWith('#') ? <Link key={key} href={href}>{label}</Link> : <a key={key} href={href} rel="noopener noreferrer nofollow" target="_blank">{label}</a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    }
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Fenced code: language label, line numbers and a copy button. */
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{lang || 'text'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="numbered">{code.split('\n').map((l, n) => <span key={n} className="ln"><i>{n + 1}</i>{l ? highlight(l, fenceLanguage(lang)) : ' '}</span>)}</pre>
    </div>
  );
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push(<CodeBlock key={k++} lang={fence[1]} code={code.join('\n')} />);
      continue;
    }
    if (/^ {4}\S/.test(line)) {
      const code: string[] = [];
      while (i < lines.length && (/^ {4}/.test(lines[i]) || !lines[i].trim())) code.push(lines[i++].slice(4));
      blocks.push(<pre key={k++} className="code">{code.join('\n').trimEnd()}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const Tag = (`h${h[1].length}`) as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={k++}>{inline(h[2], `h${k}`)}</Tag>);
      i++;
      continue;
    }
    // GitHub-style pipe table: header row, a --- separator row, then body rows.
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={k++} className="md-table">
          <table>
            <thead><tr>{head.map((h, n) => <th key={n}>{inline(h, `th${k}-${n}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, n) => <td key={n}>{inline(r[n] ?? '', `td${k}-${ri}-${n}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      const start = Number(line.match(/^(\d+)/)![1]);
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+[.)]\s+/, ''));
      blocks.push(<ol key={k++} start={start}>{items.map((it, n) => <li key={n}>{inline(it, `ol${k}-${n}`)}</li>)}</ol>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      blocks.push(<ul key={k++}>{items.map((it, n) => <li key={n}>{inline(it, `li${k}-${n}`)}</li>)}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|[-*]\s|\d+[.)]\s| {4}\S|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
