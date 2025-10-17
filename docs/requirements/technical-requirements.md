# 技術要件 v0.1（Phase 1: 仕様ドキュメントのみ）

目的

- 将来の移行（Vite + React + TypeScript + react-three-fiber）を前提に、現行のイベント語彙/順序（join/start/move/state）を維持しつつ、非挙動変更の“準備仕様”を固める。

スコープ（Phase 1）

- コード実装の切替は行わない。ドキュメント化と契約の明文化のみ。
- 追加フィールドは「予約/保持」のみ（SWITCH前は未使用）。

非目標（Phase 1でやらない）

- フレームワーク導入、画面/通信/ログ順序の変更。
- 新イベント名の追加、既存フィールドの削除/改名。

制約

- 配信/基盤: Cloudflare Pages（静的配信）+ Pages Functions（/api/\*）。
- 通信: Ably。チャンネル `room:<id>`、イベント語彙 `join|start|move|state` を固定。
- 言語/ツール: 将来移行方針は Vite + React 18 + TypeScript + R3F + Drei。
- CSS: UnoCSS（ユーティリティ・アトミック運用）。
- 2D/3D: Pixi は不採用。Three.js レイヤに一元化（オルソ/スプライトで2D表現）。

実行環境

- 対応ブラウザ: 最新 Chrome/Edge/Firefox/Safari。
- WebGL2 必須（モバイルは WebGL2 対応端末のみサポート）。

通信要件（概要）

- 冪等性: すべてのイベントに `version`（例: "1.0"）, `ts`（ms）, `clientId`, `requestId` を付与。
- 順序: join → start → move/state（ゲーム進行中は move と state が交互/並行）。
- 再送/重複: `requestId` で重複排除。指数バックオフ（1s,2s,4s, 最大 16s）。
- 時刻: クライアント時計ずれ ±2s を許容。断続接続時は `ts` を基準に並べ替え。

イベント契約（詳細は docs/api/events.md）

- ベースエンベロープ: `version, event, ts, clientId, requestId, payload`。
- ペイロード形状は Phase 1 では後方互換を最優先し厳格化しない。JSON Schema は“予約/草案”として定義し、実行時検証は行わない。

状態/乱数

- 1つの正準ステートマシン（将来ドキュメント化/実装）。
- 乱数は seed 固定で再現可能にする（将来 `seed` をステートに保持）。

レンダリング/UX 目標（初期予算／スマホ対応）

- FPS: 60fps 目標（1フレーム 16.6ms）。
- 初回レンダ: < 2.0s（デスクトップ/モバイル、回線 10Mbps 相当）。
- 初期 JS ペイロード: ≤ 300KB gzip（3Dアセットは遅延ロード）。

アセット

- GLTF/VRM はハッシュ名でキャッシュ。CDN 長期キャッシュ（immutable）。
- 圧縮: meshopt/ktx2 は将来導入（準備のみ記載）。

環境変数

- ローカル: `public/env.local.json`（追跡外）。
- 本番: Cloudflare Pages の環境変数/Secrets（Functions から参照）。

観測性/ログ

- 既存の `logAction(category, message)` の語彙・順序は変更しない。
- `performance.mark/measure` の導入準備（計測点名のみ定義）。

セキュリティ（概要）

- 入力サニタイズ、Origin 固定、レート制限（clientId 単位）。
- Secrets は Functions 側のみで保持しフロントには出さない。

テスト方針（段階導入）

- 契約テスト（イベントのスキーマ/順序）を最優先で文書化。実装検証は SWITCH 以降。

デプロイ

- Cloudflare Pages（`vite build` で生成される `dist` を配信予定）。
- Pages Functions で `/api/ably-token` などを提供（Phase 1 はスタブ文書のみ）。
