# 予約ペイロード項目（Phase 1・非拘束）

目的

- 語彙/順序（join/start/move/state）を変えずに、将来運用で使いそうなフィールド名を“予約”として共有する。強制はしない。

共通

- `frame`（number）: 進行フレーム番号（ホスト基準）
- `latencyMs`（number）: 推定レイテンシ
- `meta`（object）: 任意メタデータ（将来の後方互換用入れ物）

join

- `displayName`（string）
- `seat`（number）
- `client`（object）: `{ ua, lang }` など

start

- `seed`（string）: 乱数再現用シード
- `players`（array）: `{ id, seat }[]`

move

- `type`（string）: `pointer|card|skill|...`
- `dx, dy`（number）: 相対移動（例）
- `payload`（object）: move固有データの入れ物

state

- `players`（object）: `id -> { seat, alive }`

注意

- ここに書かれていない項目の追加は常に許容。削除/改名はメジャー更新（2.0）でのみ。
- Phase 1 はスキーマ検証を強制しない。
