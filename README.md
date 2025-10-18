# Minatoku Duel — Phase 1

Docs-first 準備フェーズ。挙動は不変のまま、契約/設計/運用ガードレールを固めます。

開発前提

- Node `>=22`、npm（パッケージマネージャ固定）
- 将来フレームワーク: Vite + React + TypeScript + react-three-fiber（ADR-0001）
- 通信: Ably（`room:<id>` / `join|start|move|state`）

主要スクリプト

- `npm test` — 契約/ドキュメントのスモークテスト
- `npm run lint` — ESLint
- `npm run lint:md` / `lint:md:links` — Markdown/リンク検証
- `npm run build` — Cloudflare Pages 用のプレースホルダを `dist/` に生成

ドキュメント

- `AGENTS.md`（最上位ルール）
- `docs/requirements/technical-requirements.md`
- `docs/api/events.md` / `docs/api/events.examples.md`
- `schemas/envelope.schema.json`（準備版 JSON Schema）
- `docs/observability/performance-marks.md`

状態

- 2025-10-18 時点、テスト/リンタ/ビルドはローカル成功。SWITCH まではコード変更を抑制。
