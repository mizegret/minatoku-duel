#!/usr/bin/env node
import { execSync } from 'node:child_process';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}
function trySh(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

if (!trySh('which gh')) {
  console.error('[pr-sync] gh CLI not found');
  process.exit(1);
}

const prJson = trySh(
  'gh pr view --json number,title,body,additions,deletions,labels -q "{num:.number,title:.title,body:.body,adds:.additions,dels:.deletions,labels:[.labels[].name]}"'
);
if (!prJson) {
  console.error('[pr-sync] 現在のブランチにPRがありません');
  process.exit(1);
}
const pr = JSON.parse(prJson);
const total = (pr.adds || 0) + (pr.dels || 0);
const thresholds = { XS: 50, S: 150, M: 300, L: 600 };
let size = 'XL';
if (total <= thresholds.XS) size = 'XS';
else if (total <= thresholds.S) size = 'S';
else if (total <= thresholds.M) size = 'M';
else if (total <= thresholds.L) size = 'L';

// Ensure labels
const want = new Set(['phase:switch', 'allow:code-change']);
if (['L', 'XL'].includes(size)) want.add('allow:large-pr');
const have = new Set(pr.labels || []);
const add = Array.from(want).filter((l) => !have.has(l));
if (add.length) sh(`gh pr edit ${pr.num} --add-label ${add.join(',')}`);

// Ensure body template and issue link
const need = [
  'これは「なに」を「どうした」PR',
  'なんでやるの',
  'どう変わる',
  'ためしかた',
  'リスク',
  'チェック（送る前に',
];
const hasAll = need.every((k) => (pr.body || '').includes(k));
const hasIssue = /(Closes|Fixes|Refs)\s+#\d+/i.test(pr.body || '');
if (!hasAll || !hasIssue) {
  const last = trySh('git log -1 --pretty=%s') || 'update';
  const m = (trySh('git branch --show-current') || '').match(/(?:^|\/)(\d{1,6})-?/);
  const id = m ? m[1] : '0';
  const body =
    `Closes #${id}\n\n` +
    `これは「なに」を「どうした」PR\n- ${last}\n\n` +
    `なんでやるの\n- 目的を1-2行で\n\n` +
    `どう変わる\n- 挙動/UXの変化があれば記載（なければ無し）\n\n` +
    `ためしかた\n1. npm i\n2. npm run dev:both\n3. 画面確認\n\n` +
    `リスク\n- Phase 1: 挙動不変\n\n` +
    `チェック（送る前に\n- [ ] Phase 1 方針OK\n- [ ] 親Issueに紐づけた\n- [ ] ためしかた3ステップ以上\n- [ ] 秘密情報なし\n\n----\n既存の本文:\n\n${pr.body || ''}\n`;
  sh(`gh pr edit ${pr.num} --body ${JSON.stringify(body)}`);
}

console.log('[pr-sync] labels/body を同期しました');
