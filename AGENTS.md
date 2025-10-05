# AGENTS.md — Minatoku Duel Agent Guide

本リポジトリで作業する人間/ボット（以下「エージェント」）向けの共通ルールです。ルート直下の本ファイルはリポジトリ全体に適用され、より深い階層に AGENTS.md が存在する場合は、そのディレクトリ配下ではそちらを優先します。ユーザー/オーナーからの直接指示は常に最優先で、本ガイドより上位です。

## 目的 / フェーズ
- Phase 1 は「挙動不変の準備」フェーズです。UI・通信・ログの順序を変えずに、モデル/スキーマ/集計を段階的に強化します。
- M0→M1→M2→M3→M4→M5→M6→SWITCH の順で小粒に進めます（詳細は `docs/model-evolution-plan.md`）。

## 変更の基本原則
- 1論点=1コミット。差分は最小限に保ちます。
- 提案→承認→コミット。ボットは勝手にコミットしません。必ず「何を/なぜ/挙動不変か」を明記して提案します。
- Phase 1 中は「挙動不変」。以下を変更しないこと：
  - 画面の見た目/DOM構造/文言（翻訳/句読点含む）
  - 通信のイベント名・順序・ペイロード形状（追加フィールドは可・既存は保持）
  - ログ出力の文言/順序（カテゴリ含む）
- ファイル構成や命名は現行に合わせ、安易なリネーム/分割は避けます（必要なら同コミットで関連箇所まで一貫対応）。

## プロジェクト構成（役割）
- 入口/UI統合: `public/app.js`
- 定数/ルール: `public/js/constants.js`
- 状態/購読: `public/js/state.js`
- ホスト権威: `public/js/game/host.js`
- 通信(Ably): `public/js/net/ably.js`
- UI描画/入力: `public/js/ui/{render.js,inputs.js}`
- ユーティリティ: `public/js/utils/{deck.js,cards.js,players.js,random.js}`
- 環境エンドポイント（Cloudflare Pages Functions）: `functions/env.js`
- 仕様/計画: `docs/{plan.md,model-evolution-plan.md,cards-schema.md,git.md}`

## 技術方針 / スタイル
- フロントのみ（静的）。ビルド/バンドラ/Node導入はしません（別計画で検討）。
- ES Modules（`type="module"`）。既存の命名/エクスポート形を踏襲（基本は named export）。
- フォーマット: 半角スペース2、セミコロンあり、シングルクォート優先、UTF-8（BOMなし）。
- 例外処理/ガードは既存のトーンを踏襲（`if (!x) return;`）。
- ロギング: 既存の `logAction(category, message)` と固定メッセージを使用。任意の追加ログは Phase 1 では避けます。

## 通信仕様（保証事項）
- チャンネル: `ABLY_CHANNEL_PREFIX = 'room:'`、イベント: `EVENTS = { join,start,move,state }`。
- 順序と語彙は固定。追加フィールドは OK、既存フィールドの削除/名称変更は不可。
- `createConnection()` の返却ハンドルの公開API（`publishJoin/Start/Move/State`, `isConnected`, `getClientId`, `detach`）は維持。

## データ/スキーマ（M0〜）
- 既存 `public/cards.json` は後方互換で有効。
- M0（ドキュメント）では、追加フィールドは「予約/保持のみ」。実装は変更しません。
- M1 以降で `loadCards()`/`host.summon` 等が拡張フィールドを保持しますが、加点ロジックは SWITCH まで現状維持。

## 受け入れ条件（Phase 1 共通）
- 画面/通信/ログ/メッセージ順序は既存と完全一致（挙動不変）。
- 追加するフィールド/ルールは“保持 or 準備”のみ（SWITCH前には使わない）。
- 変更は小粒コミット＆簡潔な説明（何を/なぜ/挙動不変か）。

## 作業の進め方（チェックリスト）
1) 該当仕様の該当節を確認（`docs/plan.md`, `docs/model-evolution-plan.md`, `docs/cards-schema.md`）。
2) 変更対象のファイルパスと行番号を明示（例: `public/js/game/host.js:120`）。
3) 提案差分を提示（最小のパッチ）。
4) 承認後にコミット。コミットメッセージは `docs/git.md` に準拠。

## コミットメッセージ規約（再掲）
- 形式: `type(scope): subject`
- 主な type: `feat`/`fix`/`refactor`/`ui`/`docs`/`rule`/`chore`
- 例: `docs(agents): add root AGENTS.md; phase1 rules, no behavior change`

## 禁止/注意事項（Phase 1）
- DOM ID/クラス名の変更、文言変更、スタイルの見た目変更。
- Ablyのイベント名/順序/ハンドシェイクの変更。
- ログ文言の変更、カテゴリの変更（`network`/`event` 等）。
- 秘匿情報（APIキー等）のログ出力/コミット。

## ローカル確認手順（再掲）
```bash
python3 -m http.server -d public 3000
# 別ブラウザ/シークレットで /room/<id> に参加
# ログ: 接続完了/チャンネル接続/attached/join → 手札/場/ターン/スコア/ログの同期を確認
```

## 問い合わせ様式
- 仕様/ルール: 対象ドキュメントの節リンク + 箇条書きで質問。
- 実装/設計: 触るファイルのパスと該当行（例: `public/js/game/host.js:120`）を添付。

## 参考
- 決定事項（2025-10-05）: 同点=引き分け、座席上限=3（将来可変）、preferencesは未導入、`SCORE_RULES` は M4 で導入（初期は現挙動と一致）。

