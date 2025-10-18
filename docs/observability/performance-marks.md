# パフォーマンス計測点（予約名・Phase 1）

目的

- 画面/通信/3D の計測点名だけを先に決め、SWITCH 後に `performance.mark/measure` を導入しやすくする。
- 既存ログは変更しない（名称・順序・語彙は保持）。

命名規則

- 接頭辞でレイヤを区別：`app:*`, `net:*`, `assets:*`, `scene:*`, `render:*`, `ui:*`, `input:*`, `state:*`。
- 期間計測は `:start`/`:end` で囲い、必要に応じて `measure("…")` を張る。

提案リスト（予約）

- `app:init`
- `net:ably:connect:start` / `net:ably:connect:end`
- `net:ably:reconnect`
- `event:receive`（受信直後の単点）
- `state:apply:start` / `state:apply:end`
- `assets:vrm:load:start` / `assets:vrm:load:end`
- `assets:vrma:load:start` / `assets:vrma:load:end`
- `render:frame`（アニメループ内で 1 フレーム）
- `scene:setup:start` / `scene:setup:end`
- `input:move:process`
- `ui:panel:open` / `ui:panel:close`

計測の扱い

- 送信は不要。まずはローカルの `performance` に打ち、将来だけ収集を検討。
- 収集先（将来案）: Cloudflare Analytics / RUM（プライバシ保護に留意）。

注意

- Phase 1 は“予約名のみ”。実装やログ変更は行わない。
- 実装時は計測のオーバーヘッドとサンプリング率に留意する。
