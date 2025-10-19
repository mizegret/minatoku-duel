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

const branch = sh('git branch --show-current');
const lastSubject = sh('git log -1 --pretty=%s') || 'update';
const issueMatch = branch.match(/(?:^|\/)(\d{1,6})-?/);
const issue = issueMatch ? issueMatch[1] : '';

const hasGh = !!sh('which gh');
if (!hasGh) {
  console.error('[pr-template] gh CLI が見つかりません。`gh auth login` 後に再実行してください。');
  process.exit(1);
}

// 既存PRの取得
let prJson = '';
try {
  prJson = sh('gh pr view --json number,title,body,headRefName');
} catch (_e) {
  prJson = '';
}

if (!prJson) {
  // PRが無ければ draft PR を作成
  const title = lastSubject;
  const headLine = issue ? `Refs #${issue}` : '';
  const tmpl = `\n${headLine}\n\nこれは「なに」を「どうした」PR\n- ${lastSubject}\n\nなんでやるの\n- 目的を1-2行で\n\nどう変わる\n- 挙動/UXの変化があれば記載（なければ無し）\n\nためしかた\n1. npm i\n2. npm run dev:both\n3. 画面で join → start → 矢印キー\n\nリスク\n- なし（Phase 1: 挙動不変）\n\nチェック（送る前に\n- [ ] Phase 1 方針OK\n- [ ] 親Issueに紐づけた\n- [ ] ためしかた3ステップ以上\n- [ ] 秘密情報なし\n`;
  sh(`gh pr create --draft --title ${JSON.stringify(title)} --body ${JSON.stringify(tmpl)} --fill`);
  console.log('[pr-template] 下書きPRを作成し、本文をテンプレ化しました。');
  process.exit(0);
}

const pr = JSON.parse(prJson);
const body = (pr.body || '').trim();
const missing = need.filter((k) => !body.includes(k));

if (missing.length === 0 && /Closes\s+#\d+/i.test(body)) {
  console.log('[pr-template] 既存PRはテンプレ準拠のため変更なし。');
  process.exit(0);
}

const headLine = /\b(Closes|Fixes|Refs)\s+#\d+/i.test(body) ? '' : issue ? `Closes #${issue}` : '';

const tmpl = `\n${headLine}\n\nこれは「なに」を「どうした」PR\n- ${lastSubject}\n\nなんでやるの\n- 目的を1-2行で\n\nどう変わる\n- 挙動/UXの変化があれば記載（なければ無し）\n\nためしかた\n1. npm i\n2. npm run dev:both\n3. 画面で join → start → 矢印キー\n\nリスク\n- なし（Phase 1: 挙動不変）\n\nチェック（送る前に\n- [ ] Phase 1 方針OK\n- [ ] 親Issueに紐づけた\n- [ ] ためしかた3ステップ以上\n- [ ] 秘密情報なし\n\n----\n既存の本文:\n\n${body}\n`;

sh(`gh pr edit ${pr.number} --body ${JSON.stringify(tmpl)}`);
console.log('[pr-template] PR本文をテンプレ準拠に更新しました。');
