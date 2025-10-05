# Model + Rules Evolution Plan (MVP → Phase 1)

本ドキュメントは「カード/スコア/UI」を段階的に進化させるための作業計画です。
各タスクは“挙動不変（または影響極小）”で進め、最終段で切り替えを行います。
完了後に本ファイルは削除予定。

## 背景 / 目的
- 仕様拡張（例: 人間の年齢・基礎魅力・専用スキル・フレーバー等）に耐えるデータ/ロジック基盤を作る。
- スコアリングを「人/装飾/行動」に正しく紐付けられる設計へ漸進的に移行する。
- 将来的なUIレンダラ（Canvas/WebGL 等）切替の前段として、モデル/集計/ルールを安定化する。

---

## ビジョン（現時点のイメージ共有）
- 画面は「飲み会テーブル」。オジ席が中央にあり、召喚した港区女子が横へ着席していく。
- 装飾は基本的にオジからのプレゼント（化粧直しで装備変更する演出を将来追加）。
- 勝敗は最終ターン後、場にいる女子のうち魅力が最大の1人をオジが選び、その陣営が勝利（同点時の裁定は現行ルール踏襲）。
- 複数体の女子は“ヘルパー”として支援役も想定（スキル/装飾/座席での補助）。

---

## 進め方（ルール）
- 1タスクずつPR粒度で実施。各タスクは受け入れ条件を満たすこと。
- “切り替えフラグ”の導入で、段階1〜3は挙動不変を維持しつつ備える。
- すべてのタスクはブラウザのみで成立（Node導入は別スコープで検討）。

---

## タスク一覧（チェックリスト）

- [x] [M0] カードスキーマの合意（ドキュメントのみ・挙動不変）
  - 目的: 仕様が未確定でも先に“器”を固定し、言葉/必須項目/表現ルールを整える。
  - 合意内容（抜粋）: `docs/cards-schema.md`, `public/cards.example.json`
    - 共通: `id/name/type` のみ必須（`id` 形式推奨: `^[a-z0-9_-]{1,32}$`）。
    - human（必須）: `age`（仮: 20–35 TODO調整）, `rarity`（UR/SR/R/N）, `baseCharm`, `imageUrl`。
      - `skills[]`: 保持のみ。`triggers`（onTurnStart/End/Summon）, `effects`（op:add）。`text` は“理由”を含む世界観文を必須。
    - decoration（必須）: `rarity`, `text`（理由必須）, `imageUrl`, `charmBonus`（増分名）。互換のため `charm` も当面併記可。`slotsUsed`=1（予約）。
    - action（必須）: `rarity`, `text`（理由必須）, `imageUrl`, `effect[]`。
    - 表示ガイド: rarity→色パレット（UR:金/SR:紫/R:青/N:灰）。画像パス規約 `/assets/cards/<type>/<id>.webp`。
  - サンプル: `cards.example.json` を 5/10/5 で整備（世界観テキスト含む）。
  - 影響: 実装は未変更（挙動不変）。

- [x] [M1] カード拡張の“保持のみ”実装（挙動不変）
  - 目的: M0合意のフィールドをランタイムの state に「保持」できるようにする（UI/計算未使用）。
  - 変更: `public/app.js:loadCards()` が以下を保持。
    - human: `age/rarity/baseCharm/baseOji/imageUrl/skills`（旧 `charm/oji` は互換で維持）
    - decoration: `rarity/text/imageUrl/charmBonus/slotsUsed`（`charm` も互換で維持）
    - action: `rarity/text/imageUrl/effect[]`
  - 受け入れ: 既存 `cards.json` でも動作。表示/通信/ログ/スコアの順序・文言は完全一致。
  - 影響: `public/app.js:loadCards`（commit: 9e0ce5b）

- [x] [M2] 場の人間に基礎魅力を保持（保存のみ）
  - 目的: 召喚時に human 情報を場へ正しく投影できるように。
  - 変更: host側 `summon` で `field.humans.push({ id, name, baseCharm, decorations: [] })` に拡張（保存のみ）。
  - 受け入れ: スコア加算は従来どおり（+1固定）。表示・ログは不変。
  - 影響: `public/js/game/host.js`（commit: 90b0048）

- [x] [M3] スコア集計器の追加（裏取りのみ）
  - 目的: 「人/装飾/行動（現行分）」から合計スコアを純関数＋累積デルタで再計算し、整合性を確認。
  - 変更: `public/js/utils/score.js` に `buildCardIndex/scoreField` を追加。host 側に `_actionDeltasById` を導入し、`play` の基礎+効果を累積（逐次 clamp）。毎ターン、`fieldScore + actionDeltas` と実スコアを比較し `console.warn` で通知。
  - 受け入れ: UI/通信/表示ログは不変。コンソールにのみ検証結果を出力。不一致は `warn` のみ。
  - 影響: `public/js/utils/score.js`（新規）, `public/js/game/host.js`（集計呼び出し; commit: bfe7ca1）

- [x] [M4] スコアルール外出し
  - 目的: どのタイミングで何点加算/減算するかを表形式にして切替可能に。
  - 変更: `public/js/constants.js` に `SCORE_RULES` を追加。`host.js` の加点処理をテーブル参照化（現挙動と同値）。
    - 初期テーブル: `summon: charm+1`, `decorate: charm += card.charm || 1, oji += 0`, `play: charm+1, oji+1` + effects(op:'add')。
  - 受け入れ: 現状ルールと完全一致（スコア/ログ/順序は不変）。
  - 影響: `public/js/constants.js`（SCORE_RULES; commit: 432d690）, `public/js/game/host.js`（参照; commit: 432d690）

- [x] [M5] カードデータのライトバリデーション
  - 目的: 早期にデータ不整合を検知。
  - 変更: `loadCards()` に必須キー/型チェック（不足は警告＋妥当なデフォルト補完）。
    - human: baseCharm 未指定→0、rarity→UR/SR/R/Nへ正規化、age 未指定は警告のみ
    - decoration: rarity 正規化、charmBonus 未指定→(charm||1)、slotsUsed 未指定→1、text 未指定は警告
    - action: rarity 正規化、effect 未指定→[]、text 未指定は警告
    - 共通: id 重複を警告
  - 受け入れ: 既存cards.jsonは通過。誤データ時はconsole.warnのみ（動作は継続）。
  - 影響: `public/app.js:loadCards`（commit: 32f4a63）

- [x] [M6] ランダムseedの保存（任意）
  - 目的: リプレイ/検証しやすくするため、配布時にseedをstateへ保存。
  - 変更: `ensureStarted()` で `state.hostGame.seed` を保持（将来shuffle再現に使用）。
  - 受け入れ: 現挙動不変（seed未使用）。
  - 影響: `public/js/game/host.js`（commit: 32f4a63）

- [x] [SWITCH] スコア計算の切替（仕様変更タイミング）
  - 条件: M1〜M4が安定し、集計器の結果が十分に信用できること。
  - 変更: `summon/decorate/play` の加点を「場/カード起点の計算（+累積アクション）」へ切替。毎手後に `score(field) + deltas` を真値として `scoresById` を再構成。
  - 受け入れ: 体感挙動は不変（結果は従来と一致）。UI/通信/ログ順序も不変。
  - 影響: `public/js/game/host.js`（commit: 5fb39a0）

---

## 作業順序（推奨）
1. [M1] → 2. [M2] → 3. [M3] → 4. [M4] → 5. [M5] → 6. [M6] → 7. [SWITCH]

---

## ロールバック方針
- 各タスクは小粒で独立。問題発生時は該当コミットをrevertして復旧。
- SWITCH前は挙動不変のため、UI/通信への影響は限定的。

---

## メモ
- UIレンダラ選定（Pixi/React等）は SWITCH 直前/直後に別トラックで実施予定。
- Node導入（Vite/Vitest等）は別計画。純関数のテスト需要が高まった段階で再検討。

---

## オープンクエスチョン（確認事項）
1. humanの年齢レンジの最終確定（仮: 20–35）。飲酒表現とトーンに合わせ最終決定。
2. rarity→色パレットの最終色コード（現行はガイド）。
3. skills.conditions の最小セット（allyPresent/alliesPresent の他に必要な条件）。
4. decoration の `charm` → `charmBonus` への完全移行タイミング（互換維持期間の方針）。
5. 画像アセットの実配置/最適化ルール（変換・圧縮・命名規則）。

---

## 決定事項（2025-10-05）
- 勝敗の同点裁定: 引き分けとする。
- 座席数（上限）: 当面は3席（定数 `MAX_SEATS = 3` として扱い、将来可変）。
- オジ preferences: いまは導入しない（器の先取りも保留）。
- SCORE_RULES: 導入する（A）。初期設定は現行の結果と完全一致（= baseCharm は当面未使用）。実装タイミングは M4 で行うが、M3 完了後できるだけ早めに適用。
 - M0 スキーマ合意: human/decoration/action の必須項目、skills/text(理由)/imageUrl、charmBonus 名称、rarityパレット、アセット配置規約。
 - M1 実装合意: `loadCards()` で拡張フィールドを保持（UI/通信/スコアは未使用のまま）。
