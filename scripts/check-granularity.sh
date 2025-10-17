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
  printf "\n[粒度チェック] 変更が大きすぎます。\n" >&2
  printf "  ファイル数: %s (上限 %s)\n" "$files" "$max_files" >&2
  printf "  変更行数: %s (上限 %s)\n" "$total" "$max_lines" >&2
  printf "\nヒント: 'git add -p' で意味単位に分割、またはファイル単位で段階的にコミットしてください。\n" >&2
  printf "どうしても必要な場合のみ 'ALLOW_LARGE_COMMIT=1 git commit' で回避可。\n" >&2
  if [ "${ALLOW_LARGE_COMMIT:-0}" != "1" ]; then
    exit 1
  fi
fi

exit 0
