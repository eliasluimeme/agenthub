import { escapeHtml, render } from './markdown.ts';

export interface Page { path: string; source: string }
export interface Output { path: string; html: string }

const htmlPath = (p: string) => p.replace(/\.md$/, '.html').replace(/(^|\/)README\.html$/i, '$1index.html');

const titleOf = (source: string, path: string) => /^#\s+(.+)$/m.exec(source)?.[1] ?? path.replace(/\.md$/, '');

/** Turns Markdown pages into HTML pages that share a navigation sidebar. Links to .md files are rewritten. */
export function build(pages: Page[], site = 'Docs'): Output[] {
  const sorted = [...pages].sort((a, b) => (a.path === 'README.md' ? -1 : b.path === 'README.md' ? 1 : a.path.localeCompare(b.path)));
  const nav = sorted.map((p) => ({ href: htmlPath(p.path), title: titleOf(p.source, p.path) }));
  return sorted.map((page) => {
    const source = page.source.replace(/\]\(([^)\s]+)\.md(#[^)]*)?\)/g, (_, p, hash = '') => `](${htmlPath(`${p}.md`)}${hash})`);
    const { html, headings } = render(source);
    const href = htmlPath(page.path);
    const depth = href.split('/').length - 1;
    const root = depth ? '../'.repeat(depth) : '';
    const links = nav.map((n) => `<li${n.href === href ? ' aria-current="page"' : ''}><a href="${root}${n.href}">${escapeHtml(n.title)}</a></li>`).join('');
    const toc = headings.filter((h) => h.level === 2).map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join('');
    const title = titleOf(page.source, page.path);
    return {
      path: href,
      html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(site)}</title>
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<nav><strong>${escapeHtml(site)}</strong><ul>${links}</ul></nav>
<main>${html}</main>
${toc ? `<aside><ul>${toc}</ul></aside>` : ''}
</body>
</html>
`,
    };
  });
}

export const STYLE = `body{display:grid;grid-template-columns:220px minmax(0,1fr) 200px;gap:32px;max-width:1200px;margin:0 auto;padding:24px;font:16px/1.6 system-ui,sans-serif;color:#1d2433}
nav ul,aside ul{list-style:none;padding:0}nav a,aside a{color:#4a5468;text-decoration:none}[aria-current] a{color:#027dea;font-weight:600}
pre{background:#f4f6fa;padding:12px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace;font-size:.9em}
@media (max-width:800px){body{grid-template-columns:1fr}aside{display:none}}
`;
