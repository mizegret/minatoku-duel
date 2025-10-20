# Counters チートシート（v0.1 / Phase 1 準備）

- 目的: 生イベントを時間窓で要約し、UI/監視が軽く読めるようにする。
- 書く: 集計ジョブ（Workers/Functions）。読む: ダッシュボード/運用。
- 窓: 1m/5m（セッション要約は別スキーマ、将来）。

必須フィールド

- version: "0.1"（互換管理）
- windowStart/windowEnd: ISO8601 UTC。半開区間 [start, end)
- counts.join/start/move/state: 非負整数
- uniqueClients: 非負整数（ユニーク clientId 数）

オプション

- rates.move_per_sec_p50/p95: 非負数（無くてもよい）
- meta: 付帯情報（自由）

最小サンプル

```json
{
  "version": "0.1",
  "windowStart": "2025-10-19T11:03:00Z",
  "windowEnd": "2025-10-19T11:04:00Z",
  "counts": { "join": 0, "start": 0, "move": 0, "state": 0 },
  "uniqueClients": 0
}
```

落とし穴（検証で落ちる）

- 非ISO8601の日時 / windowStart, windowEnd
- 負値: counts._, rates._
- counts に未知キー（additionalProperties: false）

関連

- schemas/analytics/event-counters.schema.json
- docs/analytics/event-aggregation.md
