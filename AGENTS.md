# AGENTS.md — Minatoku Duel Agent Guide (Phase 1 Snapshot)

このファイルは「絶対に忘れない」ための最上位ルールのスナップショットです。詳細は `docs/*` を参照。直接指示は常に最優先。

目的 / フェーズ

- Phase 1 は挙動不変の準備フェーズ。UI/通信/ログの順序・語彙は保持し、モデル/スキーマ/集計の“準備”のみを進める。
- M0→M1→…→SWITCH で小粒に進める。現時点はドキュメント中心。

技術方針（確定事項の要約）

- パッケージマネージャ: npm。Node: 22 系。
- 将来フレームワーク: Vite + React + TypeScript + react-three-fiber（ADR-0001）。Pixi は不採用。
- 通信: Ably。チャンネル `room:<id>`、イベント語彙 `join|start|move|state` 固定。Envelope に `version, ts, clientId, requestId, payload`。
- デプロイ: Cloudflare Pages/Functions を基準。将来 AWS へ切替可能な抽象（Platform/TokenService）。
- アセット: VRM/VRMA を遅延ロード・CDN 配信。サイズ目安 VRM≤20MB, VRMA≤5MB。

Git/GitHub 運用

- 1論点=1PR。親Issueと子Issueで管理。全PRはIssueに紐付け（`Closes #`）。
- Conventional Commits 形式 `type(scope): subject`。ブランチは `feat|fix|docs|refactor/...`。

禁止/注意（Phase 1）

- 既存イベント語彙/順序の変更、ログ文言の変更、Secretsの露出。
- コード変更はデフォルト禁止。必要な場合は PR に `phase:switch` または `allow:code-change` ラベルを付与。

参照

- 技術要件: `docs/requirements/technical-requirements.md`
- ADR: `docs/architecture/decisions/ADR-0001-framework.md`
- イベント契約: `docs/api/events.md`
- 可搬性（CF⇔AWS）: `docs/deployment/portability-aws.md`
- Git運用: `docs/git.md`, `.github/*`
