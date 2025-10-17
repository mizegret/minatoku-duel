# Runbook: CI / Guardrails 失敗の切り分け

目的: CI が赤になった時に「だるい」を最短で解消する手順。

## 1. 実行権限 (+x) エラー

- 症状: `[shell] 実行権限(＋x)がありません: .husky/pre-push` など
- 自動修復: CI 内で `chmod +x` を実行し、`scripts/check-shell.mjs` が自動で +x を付与します。
- 手動修復（ローカル）:
  - `git update-index --chmod=+x .husky/pre-push scripts/*.sh`
  - コミットして再実行

## 2. 大PRで失敗（PR Size Guard）

- 症状: `PRが大きすぎます（±<行数>行、サイズ: L|XL）`
- 対処: 分割 or ラベル `allow:large-pr` を付与。
  - OWNER/MEMBER は `/allow large-pr on` でも可。
  - OWNER の PR は PR Doctor が自動で付与する場合あり。

## 3. Auto-merge の失敗

- 対策済: `gh pr merge` は使わず GraphQL で auto‑merge を有効化。
- 条件未達（ドラフト/未承認/必須チェック未完了）の場合は PR にコメントで通知。

## 4. Mermaid 構文エラー

- 症状: `Mermaid 構文エラー: <file>:<line>`
- よくある例: ラベル内の `|` は `&#124;` にエスケープ。

## 5. Cloudflare Pages の build 失敗

- 症状: `Missing script: "build"`
- 対策: `npm run build` を追加済（プレースホルダ）。
- Pages 設定: Build=`npm run build`, Output=`dist`

## 6. main への rebase が必要

- 対処: コメント `/rebase`（OWNER/MEMBER）。PR ブランチを main 最新へ更新。

---

- すべての自動化は「Phase 1: 挙動不変」を尊重し、実装コードには触れません。
- 困ったら `/help` でコマンド一覧、または `node scripts/repo-doctor.mjs --strict` を実行。
