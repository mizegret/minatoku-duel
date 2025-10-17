#!/usr/bin/env node
// Pre-push guard: detect large PR and missing issue link early
import { execFileSync } from 'node:child_process';

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

function num(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function getBranch() {
  try {
    return sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return '';
  }
}

function deriveIssueFromBranch(br) {
  const m = br.match(/(?:^|\D)(\d{1,6})(?:-|$)/);
  return m ? m[1] : '';
}

function computeDiffStats(base) {
  try {
    sh('git', ['fetch', 'origin', base, '--quiet']);
  } catch (_e) {
    /* ignore */
  }
  let adds = 0,
    dels = 0,
    files = 0;
  try {
    const out = sh('git', ['diff', '--numstat', `origin/${base}...HEAD`]);
    if (!out) return { adds: 0, dels: 0, files: 0 };
    for (const line of out.split(/\r?\n/)) {
      if (!line) continue;
      const [a, d] = line.split(/\s+/);
      adds += num(a);
      dels += num(d);
      files += 1;
    }
  } catch (_e) {
    /* ignore */
  }
  return { adds, dels, files };
}

const MAX_FILES = Number(process.env.PR_MAX_FILES || 10);
const MAX_LINES = Number(process.env.PR_MAX_LINES || 300);
const base = process.env.BASE || 'main';
const br = getBranch();
const issue = deriveIssueFromBranch(br);
const { adds, dels, files } = computeDiffStats(base);
const total = adds + dels;

let fail = false;
if (!issue && process.env.ALLOW_NO_ISSUE !== '1') {
  console.error(
    `[guard-pr] ブランチ名に課題番号が見つかりません: ${br}\n例: feat/123-title, docs/0042-note\n一時的に無視するには ALLOW_NO_ISSUE=1 を指定してください。`
  );
  fail = true;
}
if ((files > MAX_FILES || total > MAX_LINES) && process.env.ALLOW_LARGE_PR !== '1') {
  console.error(
    `[guard-pr] 変更が大きすぎます（files=${files}/${MAX_FILES}, lines=±${total}/${MAX_LINES}）。\n小さく分割するか ALLOW_LARGE_PR=1 を一時指定してください。`
  );
  fail = true;
}

if (fail) process.exit(1);
console.log(`[guard-pr] OK (files=${files}, lines=±${total}, issue=${issue || '-'})`);
