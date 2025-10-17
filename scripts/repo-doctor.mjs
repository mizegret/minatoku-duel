#!/usr/bin/env node
// レポジトリの整合性とツール状態を検査する"Doctor"。
// 失敗で終了: CI/--strict 指定時。ローカルは警告表示のみ。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const strict = process.argv.includes('--strict') || process.env.CI === 'true';
let failCount = 0;

function ok(msg) {
  console.log(`OK  ${msg}`);
}
function warn(msg) {
  console.warn(`WARN ${msg}`);
}
function fail(msg) {
  console.error(`NG  ${msg}`);
  failCount++;
}

async function checkNode() {
  const { stdout } = await exec('node', ['-v']);
  const version = stdout.trim().replace(/^v/, '');
  const major = parseInt(version.split('.')[0], 10);
  if (major < 22) fail(`Node 22 以上が必要。現在 v${version}`);
  else ok(`Node v${version}`);
}

async function checkPkg() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const scripts = [
    'lint',
    'format',
    'format:check',
    'test',
    'test:ui',
    'lint:md',
    'lint:md:links',
    'lint:mermaid',
    'lint:shell',
  ];
  for (const s of scripts) {
    if (!pkg.scripts?.[s]) fail(`package.json scripts に ${s} がありません`);
  }
  const devs = [
    'eslint',
    'prettier',
    'vitest',
    '@playwright/test',
    'markdownlint-cli2',
    'remark-cli',
    'secretlint',
  ];
  for (const d of devs) {
    if (!pkg.devDependencies?.[d]) warn(`devDependencies に ${d} が見つかりません（任意）`);
  }
  ok('package.json チェック');
}

async function checkFiles() {
  const required = [
    'AGENTS.md',
    'docs/requirements/technical-requirements.md',
    'docs/api/events.md',
    '.github/pull_request_template.md',
    '.github/workflows/ci.yml',
    '.github/workflows/guardrails.yml',
    '.github/dependabot.yml',
    '.github/CODEOWNERS',
    '.husky/pre-commit',
    '.husky/commit-msg',
    '.gitattributes',
  ];
  for (const f of required) {
    if (!existsSync(f)) fail(`${f} が存在しません`);
  }
  ok('必須ファイル存在確認');
}

async function checkGhExtension() {
  try {
    const { stdout } = await exec('gh', ['extension', 'list']);
    if (!/yahsan2\/gh-sub-issue/.test(stdout)) warn('gh-sub-issue 拡張が未検出（ローカル任意）');
    else ok('gh-sub-issue 拡張あり');
  } catch {
    warn('GitHub CLI が見つかりません（ローカル任意）');
  }
}

async function main() {
  await checkNode();
  await checkPkg();
  await checkFiles();
  await checkGhExtension();
  // CI/PR 状態チェック（PRが存在する場合）
  try {
    const { stdout: prOut } = await exec('gh', ['pr', 'view', '--json', 'number,headRefName,statusCheckRollup', '-q', '.', '-R', process.env.GH_REPO || '' ]);
    if (prOut) {
      const pr = JSON.parse(prOut);
      if (pr.number) {
        const fails = (pr.statusCheckRollup || []).filter(c => (c.conclusion === 'FAILURE'));
        if (fails.length) {
          warn(`PR #${pr.number} で失敗中のチェック: ${fails.map(f=>`${f.workflowName||''}:${f.name}`).join(', ')}`);
          warn('サイズガードなら label:"allow:large-pr"、Phase1ガードなら label:"allow:code-change" をPRに付与');
        } else {
          ok(`PR #${pr.number} のチェックは進行中/成功`);
        }
      }
    }
  } catch (e) {
    // gh が未設定でも doctor を継続
  }
  if (failCount > 0 && strict) process.exit(1);
}

main();
