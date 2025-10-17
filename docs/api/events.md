# イベント契約 v0.1（Phase 1: 準備のみ）

固定事項（変更不可）

- チャンネル: `room:<id>`
- イベント語彙: `join`, `start`, `move`, `state`
- 語彙と順序は固定。追加フィールドは可。既存フィールドの削除/改名は不可。

エンベロープ（共通）

- version: 文字列（例 "1.0"）。
- event: 上記語彙のいずれか。
- ts: 送信側ミリ秒タイムスタンプ。
- clientId: 送信クライアント識別子（Ably ClientId と一致させる）。
- requestId: 送信ごとにユニーク。重複排除/冪等性キー。
- payload: イベント固有ペイロード（Phase 1 は厳格化せず、後方互換を優先）。

TypeScript 型（参考）

```ts
type EventName = 'join' | 'start' | 'move' | 'state';

type Envelope<P = Record<string, unknown>> = {
  version: '1.0';
  event: EventName;
  ts: number; // ms since epoch
  clientId: string;
  requestId: string;
  payload: P; // 具体形状は Phase 1 では縛らない
};
```

JSON Schema（準備版）

```json
{
  "$id": "https://spec.minatoku.duel/events/envelope.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["version", "event", "ts", "clientId", "requestId", "payload"],
  "properties": {
    "version": { "type": "string", "enum": ["1.0"] },
    "event": { "type": "string", "enum": ["join", "start", "move", "state"] },
    "ts": { "type": "number" },
    "clientId": { "type": "string", "minLength": 1 },
    "requestId": { "type": "string", "minLength": 1 },
    "payload": { "type": "object", "additionalProperties": true }
  },
  "additionalProperties": true
}
```

Ably 連携ベストプラクティス（準備）

- 認証: 本番は `authUrl`（Functions 経由でトークン発行）。TTL 60分を推奨。
- Presence: `join` 受理後に `presence.enter`（`displayName`, `seat` 等）。離脱で `leave`。
- ハートビート: 30s 間隔で `state`（軽量）をホストがエコー。断後復帰で最新 `state` を再送。
- バックオフ: 1,2,4,8,16s（上限 16s）。
- レート: `move` は ≤10 msg/sec/クライアント。
- サイズ: メッセージ ≤16KB（JSON）。
- 監視: 接続状態/再接続回数/滞留メッセージ数を計測（将来）。

順序/再送/重複の扱い

- 順序: 初回は `join` を送信。ゲーム開始時に `start`。以降は `move` と `state`。
- 再送: ネットワーク断時は指数バックオフ（1s,2s,4s,8s,16s）。
- 重複: 受信側は `(event, requestId)` で一意とみなし重複破棄。
- 遅延: `ts` で受信バッファを 250ms だけ待ち合わせ、古い順に適用（将来実装）。

互換性ポリシー

- 破壊変更はメジャー version を更新（例: 2.0）。
- 追加フィールドは常に許容。受信側は未使用フィールドを保持（エコー）可能にする。

注意（Phase 1）

- 本ドキュメントは“準備”であり、実装の検証/強制は行わない。
- 既存挙動に一致しない強制やログ変更は行わない。
