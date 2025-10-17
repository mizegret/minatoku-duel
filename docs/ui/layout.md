# 画面レイアウト仕様 v0.1（イメージ反映）

目的

- 共有された画面イメージを基に、領域・用語・挙動を定義（React 実装前提の構造）。

領域

- ヘッダー（上部）: タイトル、Room表示（例 `Room: 86677bc0`）、招待リンクコピー、スコア系メトリクス。
- 左ペイン: あなた情報（山札/手札）。
- センター: シーン領域（ソファ/テーブル/背景、中央にアバター）。R3F Canvas 想定。
- 右ペイン: ログ/ターン情報（「このターンは様子見」など）。

レイアウト原則

- 3カラム固定（左右 280–320px、中央可変）。
- Canvas は親のサイズに合わせてリサイズ。UI と Canvas は責務分離。
- ダークテーマ前提（既存トーンを踏襲）。

レスポンシブ（詳細）

- Breakpoints: `sm=360`, `md=768`, `lg=1024`, `xl=1280`。
- sm: 1カラム（上から順に Header → Scene → Info → Log）。
- md: 2カラム（左=Info＋Scene、右=Log は下段へスタック）。
- lg 以上: 3カラム（左=Info | 中央=Scene | 右=Log）。

アクセシビリティ

- フォーカス可視、色コントラスト AA 以上。
- 主要操作はキーボード対応（将来）。

パフォーマンス

ワイヤ（Mermaid）

```mermaid
flowchart TB
  sm[SM] --> s1[Stack: Header -> Scene -> Info -> Log]
  md[MD] --> m1[2 Columns: Left+Center / Log below]
  lg[LG] --> l1[3 Columns: Left | Center | Right]
```

- Canvas の再マウントを避け、内部のオブジェクトのみ更新。
- UI 更新は React、3D 更新は R3F のフレームループで分離。
