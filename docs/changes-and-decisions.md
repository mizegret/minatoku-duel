# Minatoku Duel — Changes & Decisions (Phase 1)

最終更新: 2025-10-05

## 1. モデル/ルール
- スキーマ v2 をデフォルト採用（public/cards.json）。
  - human: age/rarity/baseCharm/imageUrl/skills
  - decoration: rarity/text/imageUrl/charmBonus/slotsUsed
  - action: rarity/text/imageUrl/effect[]
- SCORE_RULES 導入（現挙動と同値）+ SWITCH 済み。
  - スコアは「場の集計＋アクション/スキルの累積デルタ」で真値化。
  - summon: baseCharm>0 を使用（未指定は 1）
  - decoration: charmBonus を使用
- スキル（self add のみ有効化）
  - onSummon: 行動行へ合算
  - onDecorate: 行動行へ合算
  - onTurnStart: 専用行（開始時）
  - onTurnEnd: 専用行（終了時）

## 2. 通信/権威
- ホスト権威。move を受信→検証→state 配信。
- Ably 接続は createConnection() に統一（旧 API 削除）。

## 3. UI/ログ/通知
- ログは「権威スナップショットのみ」を表示（重複防止キー付き）。
  - 順序: ターン → 開始時スキル → 行動 → 終了時スキル
  - 送受信/state/同期などの技術ログは非表示。
- 通知（Notice）は 1 本化（main 直下）。
  - 自分ターン: 「あなたのターン（ラウンド N）」
  - 相手ターン: 「相手のターンです…」
  - 結果発表: 勝ち/負け/引き分け（X − Y）

## 4. デプロイ
- Cloudflare Pages 用 SPA ルーティング: public/_redirects（/* → /index.html 200）
- env は /env（Pages Functions） or /env.local.json（ローカル）

## 5. 既知/保留
- Ably Token Auth（将来トークン化）
- 画像プレースホルダ配置（404回避）
- 観戦モードの明示（3人目以降）

---

変更履歴の詳細は git ログ参照。小さく・安全に・挙動不変を基本方針とする。
