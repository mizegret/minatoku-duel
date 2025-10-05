# Cards Schema (Draft)

目的: 人間/装飾/行動カードを拡張しやすい共通スキーマで表現する。既存のcards.jsonを包含し、後方互換を維持する。

## 共通フィールド（全カード）
- `id: string` 必須。ユニーク。
- `name: string` 必須。表示名。
- `type: 'human' | 'decoration' | 'action'` 必須。
- `rarity?: string` 例: common/rare/epic 等（任意）。
- `tags?: string[]` 検索/フィルタ用（任意）。
- `flavor?: string | string[]` 表示テキスト（任意）。

## 人間（human）
- `age?: number` 年齢（任意）。
- `baseCharm?: number` 基礎魅力（任意、未指定は0として扱う）。
- `baseOji?: number` 基礎オジ好感度（任意、未指定は0）。
- `skills?: Skill[]` 専用スキル（任意）。

### Skill（案）
```
type Skill = {
  id: string;
  name: string;
  text?: string;            // 説明
  triggers?: Trigger[];     // 発火タイミング（例: 'onSummon', 'onDecorate', 'onTurnStart'）
  effects?: Effect[];       // 下記 Effect と同形式
}
type Trigger = 'onSummon' | 'onDecorate' | 'onTurnStart' | 'onTurnEnd' | 'passive';
```

## 装飾（decoration）
- `charm?: number` 魅力補正（デフォルト1）。
- `oji?: number` 好感度補正（デフォルト0）。
- `slotsUsed?: number` 将来拡張（1以上、デフォルト1）。

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

## 後方互換
- 既存cards.jsonのフィールド: `id/name/type` はそのまま。有れば `charm/oji/effect` を解釈。
- 新規フィールドは未使用でも安全に保持。M1でローダーが拡張フィールドを保持し、M2以降で活用。

