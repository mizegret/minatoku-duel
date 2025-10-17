#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const stagedOnly = args.includes('--staged');

function sh(cmd, argv) {
  return execFileSync(cmd, argv, { encoding: 'utf8' }).trim();
}

function listTargets() {
  const all = stagedOnly
    ? sh('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM']).split(/\r?\n/)
    : sh('git', ['ls-files']).split(/\r?\n/);
  return all.filter(Boolean).filter((p) => p.startsWith('.husky/') || p.startsWith('scripts/'));
}

function hasShebang(path) {
  try {
    const buf = readFileSync(path, 'utf8');
    return buf.startsWith('#!');
  } catch {
    return false;
  }
}

function ensureExec(path) {
  try {
    chmodSync(path, 0o755);
  } catch (_e) {
    // ignore
  }
  try {
    sh('git', ['update-index', '--chmod=+x', path]);
    return true;
  } catch {
    return false;
  }
}

const files = listTargets().filter(hasShebang);
let fixed = 0;
for (const f of files) {
  if (ensureExec(f)) {
    fixed++;
    console.log(`[fix-exec] +x: ${f}`);
  }
}
if (!fixed) {
  console.log('[fix-exec] no changes');
}
