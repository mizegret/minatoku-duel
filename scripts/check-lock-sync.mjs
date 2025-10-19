#!/usr/bin/env node
import { execSync } from 'node:child_process';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

const changed = sh('git diff --cached --name-only').split('\n').filter(Boolean);
const pkgChanged = changed.filter((f) => /(^|\/)package\.json$/.test(f));
const lockChanged = changed.includes('package-lock.json');

function depsChanged() {
  try {
    const staged = JSON.parse(sh('git show :package.json'));
    let baseRaw = '';
    try {
      baseRaw = sh('git show HEAD:package.json');
    } catch (_e) {
      // 初回コミット等で HEAD:package.json が無い場合は無視
      baseRaw = '';
    }
    const base = baseRaw ? JSON.parse(baseRaw) : {};
    const pick = (o) => ({
      dependencies: o.dependencies || {},
      devDependencies: o.devDependencies || {},
      optionalDependencies: o.optionalDependencies || {},
      peerDependencies: o.peerDependencies || {},
      workspaces: o.workspaces || undefined,
    });
    const a = JSON.stringify(pick(base));
    const b = JSON.stringify(pick(staged));
    return a !== b;
  } catch (_e) {
    return true;
  }
}

if (pkgChanged.length && depsChanged() && !lockChanged) {
  console.error(
    '[check-lock] 依存定義を変更していますが package-lock.json がコミットに含まれていません。'
  );
  console.error('  例: npm i でロックを更新 → git add package-lock.json');
  console.error('  変更ファイル:', pkgChanged.join(', '));
  process.exit(1);
}

process.exit(0);
