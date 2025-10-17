#!/usr/bin/env node
import { stat, chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const args = process.argv.slice(2);
const isFromLintStaged = args.includes('--staged');
const filesFromArgs = args.filter((a) => !a.startsWith('--'));
const isCI = process.env.CI === 'true';
const enableAutoFix = isCI || process.env.FIX_EXEC === '1';

async function listStagedShellFiles() {
  const { stdout } = await exec('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) => f.endsWith('.sh') || f.startsWith('.husky/'));
}

async function hasBinary(cmd) {
  try {
    await exec(cmd, ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function checkExecutableBit(path) {
  try {
    const s = await stat(path);
    // any execute bit set
    return (s.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

const run = async () => {
  const files = isFromLintStaged ? await listStagedShellFiles() : filesFromArgs;
  if (!files.length) {
    return;
  }

  const hasShellcheck = await hasBinary('shellcheck');
  for (const file of files) {
    try {
      // Syntax check
      await exec('bash', ['-n', file]);
    } catch (e) {
      fail(`[shell] 構文エラー: ${file}\n${e.stderr || e.stdout || e.message}`);
    }
    // Execute bit check. CI では .husky/* の実行は想定しないため、scripts/* のみを強制。
    const requiresExec = file.startsWith('scripts/') || (!isCI && file.startsWith('.husky/'));
    if (requiresExec) {
      let ok = await checkExecutableBit(file);
      if (!ok && enableAutoFix) {
        try {
          await chmod(file, 0o755);
          ok = await checkExecutableBit(file);
          if (ok) console.log(`[fix] +x 付与: ${file}`);
        } catch (e) {
          console.log(`[info] chmod 失敗: ${file} (${e?.message || e})`);
        }
      }
      if (!ok) fail(`[shell] 実行権限(＋x)がありません: ${file}`);
    }
    // Optional: shellcheck
    if (hasShellcheck) {
      try {
        // treat only errors as failures; ignore style/info (e.g., SC2028)
        await exec('shellcheck', ['-x', '-S', 'error', '-e', 'SC2028', file]);
      } catch (e) {
        fail(`[shellcheck] 指摘あり: ${file}\n${e.stdout || e.stderr || e.message}`);
      }
    } else {
      console.log(`[info] shellcheck 未インストール: ${file} の静的解析をスキップ（CIで実施）`);
    }
  }
};

run();
