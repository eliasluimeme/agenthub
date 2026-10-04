#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { build, STYLE, type Page } from './build.ts';

const [src = 'docs', out = 'dist', site = 'Docs'] = process.argv.slice(2);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : []));

const pages: Page[] = walk(src).map((file) => ({ path: relative(src, file).split('\\').join('/'), source: readFileSync(file, 'utf8') }));
for (const page of build(pages, site)) {
  const target = join(out, page.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page.html);
}
writeFileSync(join(out, 'style.css'), STYLE);
console.log(`Built ${pages.length} pages into ${out}/`);
