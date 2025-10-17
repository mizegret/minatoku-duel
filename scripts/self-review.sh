#!/usr/bin/env bash
set -euo pipefail

# インタラクティブ自己レビュー。コミット前に必ず呼ばれる。
# 目的: 「自分を信じない」仕組み化。見落し/手戻りを防ぐ。

if [ "${SELF_REVIEW:-1}" = "0" ]; then
  exit 0
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"

echo "\n==== 自己レビュー（staged）===="
git diff --cached --stat

echo "\n---- 変更内容（抜粋）----"
git diff --cached --unified=0 | sed -n '1,200p'

# 危険パターン検出
echo "\n---- 危険パターン検査 ----"
bad=0
# debugger は禁止
if git diff --cached --name-only -- '*.js' '*.ts' '*.tsx' | xargs -r grep -n "^\\+.*debugger;" -- 2>/dev/null; then
  echo "NG: 'debugger;' が含まれています。削除してください。" >&2
  bad=1
fi
# TODO/FIXME は警告（失敗はしない）
if git diff --cached | grep -E "^\\+.*(TODO|FIXME)" -n >/dev/null 2>&1; then
  echo "WARN: TODO/FIXME を含む変更があります（必要なら残してOK）。" >&2
fi

if [ $bad -ne 0 ]; then
  exit 1
fi

echo "\n- 粒度は十分に小さいですか？"
echo "- 1コミット=1論点になっていますか？"
echo "- ドキュメントは更新しましたか？（必要なら）"
echo "- 秘匿情報/PIIは含まれていませんか？"
echo "- コードコメント/PR本文は日本語ですか？"

read -r -p "自己レビューOKなら 'yes' と入力してください: " ans || true
if [ "$ans" != "yes" ]; then
  echo "自己レビュー未完了。コミットを中止しました。" >&2
  exit 1
fi

exit 0

