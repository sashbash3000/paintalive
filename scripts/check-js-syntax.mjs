/**
 * Runs `node --check` on every .js file under js/ (parse-only, no execution).
 */
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'js');

async function listJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listJsFiles(p)));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = await listJsFiles(jsDir);
if (files.length === 0) {
  console.error('check-js-syntax: no .js files found in', jsDir);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const r = spawnSync('node', ['--check', file], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
