#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
function trySh(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}
function num(str) {
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

// Args: --issue 63 --base main --title "..." --labels "a,b"
const args = process.argv.slice(2);
function arg(name, d = '') {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
}

const base = arg('base', 'main');
const givenIssue = arg('issue', process.env.ISSUE || '');
const givenTitle = arg('title', '');

if (!trySh('which gh')) {
  console.error('[pr-open] gh CLI が見つかりません。`gh auth login` を実行してください。');
  process.exit(1);
}

const branch = sh('git branch --show-current');
// 1) Issue number
let issue = givenIssue;
if (!issue) {
  const m = branch.match(/(?:^|\/)(\d{1,6})-?/);
  if (m) issue = m[1];
}
if (!issue) {
  console.error(
    '[pr-open] Issue番号が見つかりません。--issue で指定してください（例: --issue 63）。'
  );
  process.exit(1);
}

// 2) Title
let title = givenTitle || trySh('git log -1 --pretty=%s') || `refs: #${issue}`;

// 3) Diff stats vs base
try {
  execSync(`git fetch origin ${base} --depth=1`, { stdio: 'ignore' });
} catch (_e) {
  // ignore fetch failure; diff may still be computed against local base
}
const numstat = trySh(`git diff --numstat origin/${base}...HEAD`);
let adds = 0,
  dels = 0;
const files = [];
for (const line of numstat.split('\n')) {
  if (!line) continue;
  const [a, d, f] = line.split(/\s+/);
  adds += num(a);
  dels += num(d);
  files.push(f);
}
const total = adds + dels;
const thresholds = { XS: 50, S: 150, M: 300, L: 600 };
let size = 'XL';
if (total <= thresholds.XS) size = 'XS';
else if (total <= thresholds.S) size = 'S';
else if (total <= thresholds.M) size = 'M';
else if (total <= thresholds.L) size = 'L';

// 4) Labels to attach at creation
const labels = new Set(['phase:switch', 'allow:code-change']);
if (['L', 'XL'].includes(size)) labels.add('allow:large-pr');

// 5) Body (テンプレ準拠)
const body =
  `Closes #${issue}\n\n` +
  `これは「なに」を「どうした」PR\n- ${title}\n\n` +
  `なんでやるの\n- 目的を1-2行で\n\n` +
  `どう変わる\n- 挙動/UXの変化があれば記載（なければ無し）\n\n` +
  `ためしかた\n1. npm i\n2. npm run dev:both\n3. 画面で join → start → 矢印キー\n\n` +
  `リスク\n- Phase 1: 挙動不変\n\n` +
  `チェック（送る前に\n- [ ] Phase 1 方針OK\n- [ ] 親Issueに紐づけた\n- [ ] ためしかた3ステップ以上\n- [ ] 秘密情報なし\n`;

const tmpRoot = fs.mkdtempSync(`${os.tmpdir()}${pathSep()}`);
const bodyPath = `${tmpRoot}/body.md`;
fs.writeFileSync(bodyPath, body);

// 6) Create PR with labels already attached
const labelArg = Array.from(labels).join(',');
const createCmd = [
  'gh',
  'pr',
  'create',
  '--base',
  base,
  '--title',
  title,
  '--body-file',
  bodyPath,
  '--label',
  labelArg,
];
const cr = spawnSync(createCmd[0], createCmd.slice(1), { encoding: 'utf8' });
if (cr.status !== 0) {
  console.error('[pr-open] gh pr create に失敗しました:\n', cr.stderr || cr.stdout);
  process.exit(cr.status || 1);
}
process.stdout.write(cr.stdout || '');

// 7) Verify body (local) and exit nonzero if missing
try {
  execSync('npm run -s pr:check', { stdio: 'inherit' });
} catch (_e) {
  process.exit(1);
}

function pathSep() {
  return process.platform === 'win32' ? '\\' : '/';
}
