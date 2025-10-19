#!/usr/bin/env node
import { execSync } from 'node:child_process';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (_e) {
    return '';
  }
}

const need = [
  'これは「なに」を「どうした」PR',
  'なんでやるの',
  'どう変わる',
  'ためしかた',
  'リスク',
  'チェック（送る前に',
];

if (!sh('which gh')) {
  console.error('[pr-check] gh CLI not found. Skipping.');
  process.exit(0);
}

const prJson = sh('gh pr view --json number,body,headRefName 2>/dev/null');
if (!prJson) {
  console.log('[pr-check] PRがまだありません（初回push前）。スキップします。');
  process.exit(0);
}
const pr = JSON.parse(prJson);
const body = (pr.body || '').trim();
const missing = need.filter((k) => !body.includes(k));
if (missing.length) {
  console.error('[pr-check] PR 本文に次の見出しが足りません:', missing.join(', '));
  process.exit(1);
}
// ためしかたの3ステップ（番号付き）確認
const stepsMatch = body.match(/ためしかた[\s\S]*?(?:\n|\r\n)([\s\S]*?)(?:\n\n|$)/);
if (stepsMatch) {
  const lines = stepsMatch[1].split(/\n/).filter((l) => /^\s*\d+\./.test(l));
  if (lines.length < 3) {
    console.error('[pr-check] ためしかた の手順は3つ以上にしてください。');
    process.exit(1);
  }
}
console.log('[pr-check] OK: テンプレ準拠');
process.exit(0);
