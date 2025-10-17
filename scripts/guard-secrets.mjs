#!/usr/bin/env node
// Guard: block committing obvious secrets and env files
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
}

const staged = sh('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'])
  .split(/\r?\n/)
  .filter(Boolean);
if (!staged.length) process.exit(0);

const forbiddenName = /(^|\/)env(\.[a-z]+)?\.json$/i;
const forbiddenInDist = /(^|\/)dist\//;
const SKIP = (p) => p.startsWith('docs/') || /\.md$/.test(p) || /\.example$/.test(p);
// assignment-like ABLY key only
const ablyAssign = /ABLY_API_KEY[^\n]{0,80}['":=]\s*['"][A-Za-z0-9._:-]{16,}['"]/;
const tokenPatterns = [
  ablyAssign,
  /sk_[A-Za-z0-9_-]{20,}/, // generic sk_ token
  /xox[baprs]-[A-Za-z0-9-]{10,}/, // slack-like
];

let bad = [];
for (const p of staged) {
  if (forbiddenName.test(p) || (forbiddenInDist.test(p) && /env/i.test(p))) {
    bad.push({ path: p, reason: 'forbidden file name' });
    continue;
  }
  if (SKIP(p)) continue;
  try {
    const content = readFileSync(p, 'utf8');
    for (const re of tokenPatterns) {
      if (re.test(content)) {
        bad.push({ path: p, reason: `secret pattern: ${re}` });
        break;
      }
    }
  } catch (_e) {
    /* ignore */
  }
}

if (bad.length) {
  console.error('\n[secrets] 機微情報らしき変更を検知しました。コミットを中止します。');
  for (const b of bad) console.error(` - ${b.path} (${b.reason})`);
  console.error(
    '\n対処:\n 1) ファイルを削除/除外（.gitignore）\n 2) 値は GitHub/Cloudflare の Secrets に保存し、コードは環境変数で参照\n 3) 既に公開されたキーは直ちにローテーション'
  );
  process.exit(1);
}

// Also validate that no env* files are tracked under dist
const ls = spawnSync('git', ['ls-files', 'dist/env*'], { encoding: 'utf8' });
if (ls.status === 0 && ls.stdout.trim()) {
  console.error('\n[secrets] dist/env* が追跡されています。コミットから除外してください。');
  process.exit(1);
}
