// Runs the test suite of every demo repository in seed/projects, and of each one with its
// pull request patches from seed/patches applied. Requires Node 23.6+ (TypeScript type stripping).
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const dirs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort() : []);

const targets = [];
for (const owner of dirs(join(root, 'seed/projects'))) {
  for (const repo of dirs(join(root, 'seed/projects', owner))) {
    const dir = join(root, 'seed/projects', owner, repo);
    targets.push({ name: `${owner}/${repo}`, dir });
    for (const number of dirs(join(root, 'seed/patches', owner, repo))) targets.push({ name: `${owner}/${repo}#${number}`, dir, patch: join(root, 'seed/patches', owner, repo, number) });
  }
}

let failed = 0;
for (const t of targets) {
  let cwd = t.dir;
  if (t.patch) {
    cwd = mkdtempSync(join(tmpdir(), 'seed-patch-'));
    cpSync(t.dir, cwd, { recursive: true });
    cpSync(t.patch, cwd, { recursive: true });
  }
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=dot'], { cwd, encoding: 'utf8' });
  if (t.patch) rmSync(cwd, { recursive: true, force: true });
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${t.name}`);
  if (r.status !== 0) { failed++; console.log(r.stdout, r.stderr); }
}
console.log(`\n${targets.length - failed}/${targets.length} suites passed`);
process.exit(failed ? 1 : 0);
