# フロントエンド構成ガイド（React + R3F 前提、準備段階）

目的

- シンプルで保守しやすい分割を標準化。意味があるなら積極的に小分割。

推奨フォルダ

- `src/app/` 起動・ルーティング・依存注入（DI）
- `src/ui/` UI 共通（HUD/パネル/ボタン/フォーム）
- `src/styles/` UnoCSS 設定とデザイン・トークン（プリセット/ショートカット/テーマ）
- `src/3d/` R3F/Three（Canvas, scene, loaders, materials, systems）
- `src/features/` 機能単位（`room`, `multiplayer`, `replay` など）
- `src/entities/` ドメイン（`player`, `card`, `match`）
- `src/state/` Zustand ストア（slice/selector。副作用はここで吸収）
- `src/lib/` 共通 util（`ably`, `schema`, `log`, `id`, `time`, `rand`）
- `src/assets/` 参照用静的（GLTF/VRM/画像など。CDN 化想定）

設計原則

- 1責務=1ファイル（概ね 200 行以内）
- `lib/*` は副作用なし・純粋関数優先
- `features/*` は UI/状態/ネットの薄い接着のみ
- 3D と HTML UI をレイヤ分離（`<Canvas>` と DOM は交差しない）
- プロバイダ境界: `AppProviders` に Zustand/Router/Theme を集約
- スタイル: UnoCSS を基盤とし、デザイン・トークンとショートカットで表現（BEM等の命名は不要）

アダプタ指針（Cloudflare⇔AWS 可搬性）

- `src/lib/platform/Platform.ts`（インタフェース）
  - `getEnv(key)`, `fetch(url, opts)`, `logger`, `now()`
- `src/lib/platform/cloudflare.ts` / `aws.ts`（実装）
- `src/lib/token/TokenService.ts`（Ably トークン発行の抽象）
  - 実装: `cloudflare-token.ts`（Pages Functions）/ `aws-token.ts`（Lambda）
