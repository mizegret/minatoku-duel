# イベント集計設計 v0.1（Phase 1: 準備のみ）

目的

- 既存イベント `join|start|move|state` を対象に、集計の対象・粒度・指標・重複排除・可搬性の共通理解を作る。
- Phase 1 はドキュメントのみ。挙動・ログ文言・イベント語彙/順序は一切変更しない。

入力（Event Envelope）

- 形式: `schemas/envelope.schema.json` 準拠（`version, event, ts, clientId, requestId, payload`）。
- 重複排除: `(event, requestId)` をキーに受信側で冪等化。
- セッション境界（目安）: `join` 受信で開始、Presence離脱（Ably）で終了。`start` はゲーム開始イベント。

集計窓と粒度（案）

- リアルタイム: 1分・5分ローリング。（ダッシュボード表示用）
- セッション単位: `join`〜離脱まで。（対戦の健康度）
- 日次: 日付境界で集計。（運用メトリクス）

指標（最小セット）

- `events_total{event}`: join/start/move/state のイベント数。
- `unique_clients`: 窓内の一意 `clientId` 数。
- `move_rate_per_client`: クライアント毎の move/秒（P50/P95 を窓集計）。
- `time_to_start_ms`: `join` から `start` までの時間（セッション単位）。
- `session_duration_ms`: `join` から最後の `state`/離脱まで（セッション単位）。
- `concurrency`: 同時参加の近似（Presence を利用、将来）。

SLO/監視（準備）

- アプリSLOに直結する候補: `time_to_start_ms`、`move_rate_per_client` のP95、`concurrency` とドロップ率。
- 収集は将来実装。Phase 1 では定義のみ。

可搬性（Cloudflare ⇔ AWS）

- Cloudflare: Workers Analytics Engine（WA-API）/ R2 / D1 を候補。Pages Functions から投げるラインを将来追加。
- AWS: Timestream or Kinesis Firehose + S3（Athena集計）。
- 中間レイヤ（Platform/TokenService）でベンダ依存を吸収（`docs/deployment/portability-aws.md` 参照）。

出力レコード（ドラフト）

- カウンタ集計: `schemas/analytics/event-counters.schema.json`（別PRで追加）。
- セッション要約: v0.2 以降に定義（将来）。

注意事項（Phase 1）

- 既存のログ文言変更・新イベント追加・既存イベント削除は行わない。
- 本書は実装を強制しない準備ドキュメント。

関連

- `docs/api/events.md`, `docs/api/events.examples.md`, `docs/api/channel-usage.md`, `docs/api/payload-fields.md`
