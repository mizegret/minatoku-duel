# Git/Issue/PR 運用ルール v1 (Phase 1)

目的

- 仕様駆動・小粒進行を支える Git/GitHub の作法を明文化。

基本方針

- 1論点=1PR。常に親Issueと子Issue（必要に応じて）で管理。
- すべてのPRは対応するIssueに紐付ける（`Closes #123` or `Refs #123`）。
- コミット前に「提案差分→承認→コミット」を原則とする（緊急以外）。

ブランチ命名

- `feat/<scope>-<topic>` 新機能
- `fix/<scope>-<topic>` 不具合
- `docs/<scope>-<topic>` 文書
- `refactor/<scope>-<topic>` リファクタ
- 例: `docs/events-envelope-v1`, `feat/net-ably-auth`

コミットメッセージ（Conventional Commits 互換）

- 形式: `type(scope): subject`
- 主な `type`: `feat` `fix` `refactor` `ui` `docs` `rule` `chore`
- 例: `docs(api): define envelope and retry backoff (draft)`

Issue 運用

- 親Issue=エピック/タスク本体、子Issue=実装/資料/検証などの具体ステップ。
- ラベル（推奨）: `type:feature` `type:bug` `type:docs` `area:net` `area:3d` `area:ui` `priority:p1-p3`。

PR 運用

- PR本文: 親Issueを最上部で参照（`Closes #<id>` または `Refs #<id>`）。
- チェックリスト: 動作影響/レビュー観点/破壊変更の有無/スクショ or 計測値。
- 小さく出す。100〜300行を目安に分割。

CLI（GitHub CLI + sub-issue）

```bash
# 親Issue（エピック）
gh issue create -t "[Epic] Ably events v1" -b "概要..." -l "type:feature,area:net" -p <owner>/<repo>

# 子Issueを作成（yahsan2/gh-sub-issue）
gh sub-issue create <parent-number> -t "Define envelope JSON Schema" -b "詳細..." -l "type:docs,area:api"

# PR を親Issueに紐付け（テンプレ利用推奨）
gh pr create -t "docs(api): envelope v1 (draft)" -b "Closes #<parent>\n- 内容..." -B main -H docs/events-envelope-v1
```

保護/品質

- 可能ならCIで「PR本文にIssue参照必須」をチェック（別途ワークフロー参照）。
- スクワッシュ・マージを基本（履歴を簡潔に）。
