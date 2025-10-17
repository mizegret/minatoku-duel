#!/usr/bin/env bash
set -euo pipefail

# インタラクティブ自己レビュー。コミット前に必ず呼ばれる。
# 目的: ルールを機械化し、再現性を担保する。

if [ "${SELF_REVIEW:-1}" = "0" ]; then
  exit 0
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"

# 出力を保存してトレース可能に（直近の自己レビュー結果）
log_file=".git/self-review-latest.txt"
{
  echo "date: $(date -Iseconds)"
  echo "user: $(git config --get user.name || true)"
  echo "email: $(git config --get user.email || true)"
  echo "branch: $(git rev-parse --abbrev-ref HEAD)"
} >"$log_file" 2>/dev/null || true

echo
echo "==== 自己レビュー（staged）===="
git diff --cached --stat | tee -a "$log_file"

echo
echo "---- 変更内容（抜粋）----"
git diff --cached --unified=0 | sed -n '1,200p' | tee -a "$log_file"

# 標準チェックリスト（単一ソース）
if command -v node >/dev/null 2>&1; then
  echo
  echo "---- チェックリスト（post）----"
  node scripts/task-checklist.mjs post | tee -a "$log_file" || true
fi

# 危険パターン検出
echo
echo "---- 危険パターン検査 ----"
bad=0
# debugger は禁止
if git diff --cached --name-only -- '*.js' '*.ts' '*.tsx' | xargs -r grep -n "^\\+.*debugger;" -- 2>/dev/null; then
  echo "NG: 'debugger;' が含まれています。削除してください。" | tee -a "$log_file" >&2
  bad=1
fi
# TODO/FIXME は警告（失敗はしない）
if git diff --cached | grep -E "^\\+.*(TODO|FIXME)" -n >/dev/null 2>&1; then
  echo "WARN: TODO/FIXME を含む変更があります（必要なら残してOK）。" | tee -a "$log_file" >&2
fi

# ドキュメント同時更新の促し（対象変更があるのに docs 変更が無い）
changed_files=$(git diff --cached --name-only)
needs_docs=0
has_docs=0
for f in $changed_files; do
  case "$f" in
    package.json|.github/workflows/*|docs/api/events.md|docs/architecture/decisions/*|docs/requirements/*|src/*|public/*)
      needs_docs=1 ;;
    docs/*)
      has_docs=1 ;;
  esac
done

if [ "$needs_docs" -eq 1 ] && [ "$has_docs" -eq 0 ]; then
  echo "WARN: 影響大の変更がありますが docs/* の更新が見当たりません。" | tee -a "$log_file" >&2
  echo "      今回は不要なら 'yes' で続行してください。" | tee -a "$log_file" >&2
fi

if [ $bad -ne 0 ]; then
  exit 1
fi

# 非対話環境の検出
if [ ! -t 0 ]; then
  echo "非対話環境です。'SELF_REVIEW=0 git commit' で回避できます。" | tee -a "$log_file" >&2
  exit 1
fi

echo
echo "- 粒度は十分に小さいですか？"
echo "- 1コミット=1論点になっていますか？"
echo "- ドキュメントは更新しましたか？（必要なら）"
echo "- 秘匿情報/PIIは含まれていませんか？"
echo "- コードコメント/PR本文は日本語ですか？"

read -r -p "自己レビューOKなら 'yes' と入力してください: " ans || true
case "${ans,,}" in
  yes|y|はい) ;;
  *) echo "自己レビュー未完了。コミットを中止しました。" | tee -a "$log_file" >&2; exit 1 ;;
esac

echo "result: OK" >>"$log_file" 2>/dev/null || true
exit 0
