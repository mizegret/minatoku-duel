# Cards Schema (M0 Draft Freeze)

目的: 人間/装飾/行動カードを拡張しやすい共通スキーマで表現する。既存の `public/cards.json` を包含し、後方互換を維持する。M0 は「ドキュメントのみ」の凍結であり、実装挙動は変更しない。

非目標（M0）
- UI/通信/スコアリングの挙動変更は行わない（将来 M1 以降で“保持”、SWITCH で適用）。
- バリデーションの実装は追加しない（M5 で検討）。

ID 規約（共通）
- `id: string` 必須。リポジトリ内でユニーク。
- 形式推奨: `^[a-z0-9_-]{1,32}$`（英小文字/数字/アンダースコア/ハイフン、1〜32 文字）。
- 名前衝突は不可。将来の多言語対応を見越し、`name` は表示用、`id` は参照用とする。

## 共通フィールド（全カード）
- `id: string` 必須。ユニーク。
- `name: string` 必須。表示名。
- `type: 'human' | 'decoration' | 'action'` 必須。

備考（M0）
- `rarity/tags/flavor` は「共通には置かない」。必要な型で個別に定義する（human のみ必須 rarity）。

デフォルトの扱い（M0 時点の指針）
- 数値フィールド未指定は 0 として扱う（human の `baseCharm/baseOji` など）。
- 配列未指定は空配列として扱う。
- 将来の軽バリデーション（M5）では、未指定の合理的補完と `console.warn` のみを想定（アプリは継続動作）。

## 人間（human）
- 必須: 
  - `age: number`（仮の範囲: 20–35 を推奨。TODO: 決定後に確定）
  - `rarity: 'UR' | 'SR' | 'R' | 'N'`（大文字固定、Enum）
  - `baseCharm: number`（基礎の魅力度）
- 任意（保持のみ・M0/M1で挙動不変）:
  - `skills?: Skill[]` 人物固有の受動/誘発効果（場にいる間のみ有効）
  - `baseOji?: number` 将来用（未指定=0）
  - M2 で場に `baseCharm` を保持（スコア加算は現行+1のまま）。

### Skill（human 専用・保持のみ）
```
type Trigger = 'onTurnStart' | 'onTurnEnd' | 'onSummon';
type Skill = {
  id: string;       // カード内ユニーク
  name: string;     // 表示名
  text: string;     // 説明（必須: なぜ魅力 or オジ好感度が変化するのか“理由”を1行で）
  triggers: Trigger[]; // 発火タイミング（所有者基準）
  effects: Effect[];   // Action と同型（op/stat/target/value）
}
```

運用ガイド（M0）
- 効果は“場に出ている間のみ”有効。手札/山札では発動しない。
- 1人あたりスキルは 0〜1 を推奨（将来複数可）。同名スキルが複数体いれば重ねがけ可。
- `text` は世界観テキスト＋ゲーム的理由を含める（例:「飲むペースを常に合わせる気配りで、オジは心地よさを感じ好感度+1」）。

（注）年齢の下限はテーマ/表現上の配慮として 20 を仮置き。飲酒表現が登場するため。上限は 35 を仮置き。いずれも TODO として後日調整。

## 装飾（decoration）
- `charm?: number` 魅力補正（デフォルト 1）。
- `oji?: number` 好感度補正（デフォルト 0）。
- `slotsUsed?: number` 将来拡張（1以上、デフォルト1）。
  - M0/M1 は保持のみ。加点は現行ルール（`charm += card.charm || 1`, `oji += 0`）。

## 行動（action）
- `effect?: Effect[]` 効果一覧。既存の形式を踏襲。

### Effect（現行踏襲 + 予約）
```
type Stat = 'charm' | 'oji';
type Target = 'self' | 'opponent' | 'ally' | 'enemy' | 'field' /*予約*/;
type Op = 'add' | 'mul' /*予約*/ | 'disable' /*予約*/ | 'moveSeat' /*予約*/;

type Effect = {
  op: Op;           // 例: 'add'
  stat: Stat;       // 例: 'charm'
  target: Target;   // 例: 'self' | 'opponent'
  value: number;    // 例: +1, -1
  duration?: number // 予約: ターン数
}
```

制約（M0 運用）
- 正式運用は `op: 'add'` のみ。`mul/disable/moveSeat` は予約（データにあっても未使用）。
- `value` は整数（負の数可）。現行実装では合計値は 0 未満に落とさない（`Math.max(0, ...)`）。
- `target: 'ally'|'enemy'|'field'` は予約（現行は `self`/`opponent` のみ）。

## 後方互換
- 既存cards.jsonのフィールド: `id/name/type` はそのまま。有れば `charm/oji/effect` を解釈。
- 新規フィールドは未使用でも安全に保持。M1でローダーが拡張フィールドを保持し、M2以降で活用。

互換指針（詳細）
- `decoration.charm` のみを持つ既存データはそのまま有効（`oji` 未指定=0）。
- `action.effect[].value` の負値（例: 相手 `oji:-1`）は許容。合計は 0 未満にならない実装準拠。
- 未知のキーは破棄せず保持（将来の互換性を優先）。

テスト用サンプル
- `public/cards.example.json` を参考に、human/decoration/action の最小例と拡張例を併記。

今後（M1 以降）
- M1: human 拡張キーの“保持”を `loadCards()` に実装（挙動不変）。
- M2: summon 時に `baseCharm` を場へ保持（加点は現行+1固定）。
- M3: 別集計器（純関数）を追加し、一致検証のみ実施。
- M4: `SCORE_RULES` 追加（初期テーブルは現行結果と一致）。
