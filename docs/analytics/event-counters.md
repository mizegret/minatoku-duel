# イベントカウンタ出力 JSON v0.1（用途と読み方・図付き）

これは「生イベント（join/start/move/state）」を時間窓で数え上げた
サマリの出力フォーマットです。
将来の集計ジョブがこれを書き出します。
UI/ダッシュボードはこの軽いサマリだけで主要指標を描画できます。
実装は Phase 1 では行いません（準備のみ）。

使う人（誰が書く／誰が読む）

- 書く人: 集計ジョブ（Workers/Functions など）。
- 読む人: ダッシュボード/運用ツール/将来の可視化（WA-API or S3/Athena/Timestream からフェッチ）。

いつ作られる？（窓）

- 1分/5分の時間窓ごとに 1 レコード（リアルタイム向け）。
- セッション要約は別スキーマ（将来）。このファイルは「時間窓のカウンタ専用」。

ざっくり構造（フィールドの意味）

- `version`: この出力のバージョン（互換性管理）。
- `windowStart` / `windowEnd`: ISO8601（UTC）の窓境界。半開区間 `[start, end)` を想定。
- `counts.join|start|move|state`: 各イベントの件数（非負整数）。
- `uniqueClients`: 窓内に一度でも現れた `clientId` の数。
- `rates.move_per_sec_p50/p95`（任意）: 窓内でのクライアント毎 move/sec の P50/P95。
- `meta`（任意）: 集計器やチャンネル等の付帯情報。

小さな例（1分窓）

```json
{
  "version": "0.1",
  "windowStart": "2025-10-19T11:03:00Z",
  "windowEnd": "2025-10-19T11:04:00Z",
  "counts": { "join": 3, "start": 1, "move": 420, "state": 30 },
  "uniqueClients": 5,
  "rates": { "move_per_sec_p50": 1.8, "move_per_sec_p95": 6.5 },
  "meta": { "roomId": "room:abc", "generator": "workers/agg@1.0" }
}
```

位置づけ（全体像）

```mermaid
flowchart LR
  A[生イベント Envelope\njoin/start/move/state] --> B[集計ジョブ\n(窓:1m/5m)]
  B --> C[Event Counters JSON\n(本スキーマ)]
  C --> D[(保管: WA-API or S3)]
  D --> E[Dashboard/UI]
```

タイムラインの直感（1分窓のイメージ）

```text
11:03 ├──── 1分 ────┤ 11:04 ├──── 1分 ────┤ 11:05
        join=3 start=1 move=420 state=30     join=1 start=0 move=260 state=22
        uniqueClients=5                      uniqueClients=4
```

他のスキーマとの関係

- 入力は `schemas/envelope.schema.json`（生イベント）。
- 出力の最小サマリが本 JSON。セッション単位の要約は別スキーマ（将来追加）。

よくある質問

- Q: 何のためにわざわざサマリ？
  - A: 生イベントを都度クエリすると高コスト。サマリを事前作成すると UI と監視が速く安定。
- Q: `rates` は必須？
  - A: 任意（あとから増やせる）。最小でも `counts` と `uniqueClients` があれば動きます。
- Q: 窓の厳密な定義は？
  - A: UTC の 1 分/5 分境界で切る想定。計算式は実装フェーズで ADR 化します。

関連

- `schemas/analytics/event-counters.schema.json`
- `docs/analytics/event-aggregation.md`
- `docs/api/events.md`
