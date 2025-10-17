# セキュリティ脅威モデル v0.1（簡易）

資産

- Ably 認証（トークン発行、キー）
- ルームのイベントストリーム（整合性/順序）
- クライアント識別子（clientId）

想定脅威

- イベント偽装/改ざん（不正 clientId、payload 改ざん）
- リプレイ/重複投稿（requestId 使い回し）
- DoS（高頻度の move 連打）
- XSS/DOM 汚染（ユーザー入力が UI に混入）
- Origin なりすまし/不正埋め込み（clickjacking 等）

対策（Phase 1 準備）

- トークン: Pages Functions のみで発行。フロントに秘匿情報を持たせない。
- 契約: `version, ts, clientId, requestId` を必須化。重複は `(event, requestId)` で排除設計。
- 入力: UI 反映はサニタイズ/エスケープ（実装方針）。
- Origin/CSP: 既知ドメインのみ許可、`frame-ancestors 'none'` を想定（将来）。
- Rate limit: ルーム/クライアント単位での軽量スロットリング（Functions）。

運用

- 重大例外の集約（Functions 経由でサーバログに記録）。
- 依存パッケージの監査（将来 CI で `npm audit` 相当）。
