# チャンネル利用ガイド（Ably・Phase 1）

固定

- チャンネル名: `room:<id>`
- イベント語彙: `join`, `start`, `move`, `state`（順序は変更不可）

推奨フロー

1. クライアントは `join` を送信。
2. ホストが `presence.enter` を受理し、`start` を配信。
3. 進行中は `move`（クライアント）と `state`（ホスト）が流れる。

再接続・遅延

- バックオフ: 1,2,4,8,16s（上限16s）
- 受信側は `(event, requestId)` で重複破棄。
- `ts` を見て 250ms 程度の受信待ち合わせ（将来）。

サイズ/レート（目安）

- メッセージ ≤ 16KB（JSON）、`move` ≤ 10 msg/sec/クライアント。

関連

- `docs/api/events.md`
- `docs/api/events.examples.md`
- `docs/api/payload-fields.md`
