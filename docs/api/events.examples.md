# イベント例 v0.1（参照用・非拘束）

目的

- 語彙と順序（join/start/move/state）を共有するための“例”。実装の強制はしない（Phase 1）。
- 既存のログ文言・順序は保持する。ここで示すフィールドは将来のための予約・目安。

前提

- チャンネルは `room:<id>` 固定。
- すべてのイベントは共同のエンベロープ（`version,event,ts,clientId,requestId,payload`）で包む。

共通ヘッダ（参考）

```json
{
  "version": "1.0",
  "event": "join|start|move|state",
  "ts": 1739846400000,
  "clientId": "c-123",
  "requestId": "r-123-abc",
  "payload": {}
}
```

join — 入室要求（Presence 連携の前段）

```json
{
  "version": "1.0",
  "event": "join",
  "ts": 1739846400123,
  "clientId": "c-123",
  "requestId": "r-join-001",
  "payload": {
    "displayName": "Kana",
    "seat": 1,
    "features": ["vrm", "replay"],
    "client": { "ua": "Chrome", "lang": "ja" }
  }
}
```

start — ゲーム開始（ホスト通知）

```json
{
  "version": "1.0",
  "event": "start",
  "ts": 1739846401234,
  "clientId": "host-1",
  "requestId": "r-start-001",
  "payload": {
    "seed": "s-2025-01",
    "players": [
      { "id": "c-123", "seat": 1 },
      { "id": "c-456", "seat": 2 }
    ]
  }
}
```

move — 行動の伝達（最大 10 msg/sec/Client を目安）

```json
{
  "version": "1.0",
  "event": "move",
  "ts": 1739846401333,
  "clientId": "c-123",
  "requestId": "r-move-042",
  "payload": {
    "type": "pointer",
    "dx": 3,
    "dy": -1,
    "frame": 1024,
    "meta": { "accel": 0.7 }
  }
}
```

state — 軽量ステートのエコー（ハートビート兼用）

```json
{
  "version": "1.0",
  "event": "state",
  "ts": 1739846402000,
  "clientId": "host-1",
  "requestId": "r-state-010",
  "payload": {
    "frame": 1030,
    "players": {
      "c-123": { "seat": 1, "alive": true },
      "c-456": { "seat": 2, "alive": true }
    },
    "latencyMs": 72
  }
}
```

互換性と注意

- 上記は“例”であり、受信側は未知フィールドを許容/保持すること。
- 厳格な検証は SWITCH 以降に行う。Phase 1 は後方互換を最優先とする。
