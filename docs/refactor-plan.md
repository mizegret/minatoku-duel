# Refactor Plan (Temporary)

本ファイルは一時的なリファクタリング計画のトラッキング用です。全項目が完了したら削除します。

## 方針
- 1タスクずつ挙動不変で進める（画面/通信/ログ一致）。
- 小さな関数抽出・共通化・定数化で読みやすさと変更コストを下げる。
- 影響範囲が広いものは段階導入（Phase A→B）。

## Phase A（Quick Wins）
- [x] A1: イベント/アクション名の定数化
  - 追加: `public/js/constants.js` に `EVENTS` / `ACTIONS` を定義。
  - 置換: `app.js` / `js/net/ably.js` / `js/game/host.js` で文字列直書きを定数参照へ。
  - 受け入れ: メッセージ送受信・ログの文言/順序が完全一致。

- [ ] A2: lastAction 文言生成の関数化
  - 追加: `formatLastAction(la, actorLabel)` を `public/app.js`（もしくは `ui/render.js`）に抽出。
  - 受け入れ: ログ出力が完全一致（時刻除外）。

- [x] A3: ラウンド表示算出の関数化
  - 追加: `computeDisplayRound({ phase, round, myTurn, roundHalf })`。
  - 受け入れ: 表示ターンが全条件で従来と一致。

- [x] A4: 手札取り出しの共通化
  - 追加: `takeFromHand(game, actorId, { cardId, type })`（`public/js/utils/deck.js` か `public/js/game/host.js` 内）。
  - 受け入れ: summon/decorate/play の取り出し挙動が一致（ID優先→type）。

- [x] A5: スコア加算の共通化
  - 追加: `applyScoreDelta(scores, { charm = 0, oji = 0 })`（`host.js`）。
  - 受け入れ: 加算後の `total` 更新を含め従来と一致。

- [x] A6: UI描画で DocumentFragment を使用
  - 変更: `ui/render.js` の `renderHand` / `renderField` を Fragment 経由に。
  - 受け入れ: DOM出力（innerHTML/テキスト/属性）が一致。視覚挙動も不変。

## Phase B（中規模・任意）
- [ ] B1: `state` 購読の導入（最小）
  - 追加: `state.subscribe(key, fn)` / `setState` から通知（まず `turn` / `scores` / `log`）。
  - 受け入れ: 既存の明示的UI更新と結果が一致（段階的に置換）。

- [ ] B2: Ablyラッパのハンドル化
  - 変更: `net/ably.js` をファクトリ（`createConnection`）にしてグローバルを閉じ込め。
  - 受け入れ: 接続/attach/join/送受信の挙動・ログが一致。

- [ ] B3: デッキ/手札ユーティリティの整理
  - 追加: `popFirstByIdOrType(hand, { cardId, type })` を `utils/deck.js` に集約（A4の一般化）。
  - 受け入れ: 現状と完全一致。

## メモ
- 各タスクは完了後にこのファイルのチェックを入れる。
- 完了時に本ファイルは削除予定。
