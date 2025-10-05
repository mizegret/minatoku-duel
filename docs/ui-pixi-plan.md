# Pixi UI Plan (Prototype → Swap)

## 方針
- 既存の DOM レンダラ（js/ui/render.js）を温存しつつ、Pixi レンダラを並走。
- 切替は URL パラメータ `?renderer=pixi` または将来の設定で選択。
- インターフェースは DOM レンダラと同一（`renderGame/updateScores/...`）。

## 段階
- P0: スケルトン（Stage/Container/テキストだけ、状態反映）。
- P1: 手札/場のカード矩形レンダリング、クリックヒット。
- P2: 装飾スロット、スコアUI、アニメーション基礎。
- P3: 反射光/質感、トランジション、負荷計測。

## 実装メモ
- ファイル: `public/js/ui/pixi/renderer.js`
- 依存: `index.html` に Pixi CDN を読み込み（必要時）。
- init 時に `#pixi-root`（将来用）または `document.body` に Stage を配置。
- 解像度/デバイスピクセル比は AutoRenderer に任せ、リサイズ対応。

## 受け入れ
- DOM レンダラと機能同等（クリック→move の流れ）。
- 劣化がないこと（ログ/通知/通信順序は既存どおり）。
