#!/usr/bin/env bash
set -euo pipefail

# 小さなコミットを強制するための粒度チェック
# 環境変数で上書き可能: COMMIT_GRANULARITY_MAX_LINES, COMMIT_GRANULARITY_MAX_FILES

max_lines=${COMMIT_GRANULARITY_MAX_LINES:-300}
max_files=${COMMIT_GRANULARITY_MAX_FILES:-10}

# ステージされた差分を集計
read -r add del files <<<"$(git diff --cached --numstat | awk '{adds+=$1; dels+=$2; files++} END{print adds+0, dels+0, files+0}')"
total=$((add + del))

if [ "$files" -gt "$max_files" ] || [ "$total" -gt "$max_lines" ]; then
  echo "\n[粒度チェック] 変更が大きすぎます。" >&2
  echo "  ファイル数: $files (上限 $max_files)" >&2
  echo "  変更行数: $total (上限 $max_lines)" >&2
  echo "\nヒント: 'git add -p' で意味単位に分割、またはファイル単位で段階的にコミットしてください。" >&2
  echo "どうしても必要な場合のみ 'ALLOW_LARGE_COMMIT=1 git commit' で回避可。" >&2
  if [ "${ALLOW_LARGE_COMMIT:-0}" != "1" ]; then
    exit 1
  fi
fi

exit 0

