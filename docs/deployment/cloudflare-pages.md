# デプロイ: Cloudflare Pages（準備ドキュメント）

概要

- 静的アプリは Pages で配信、API は Pages Functions（`/functions`）で提供。
- Secrets/環境変数は Cloudflare 側で管理。フロントに埋め込まない。

前提

- Cloudflare アカウント作成、`wrangler` CLI インストール。
- リポジトリは `plan/requirements-reset-YYYY-MM-DD` ブランチから再構築予定。

基本フロー（将来）

- 開発: `npm run dev`（Vite） + `wrangler pages dev dist`（Functions を併走）。
- ビルド: `npm run build` → `dist/` 出力。
- デプロイ: `wrangler pages deploy dist` または Git 連携（main/pr で自動）。

Pages 設定（想定）

- ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`
- Functions ルート: `/functions`

環境変数（例）

- `ABLY_API_KEY`（Pages Functions のサーバ側のみ・Secretsで管理）
- `ABLY_KEY_NAME`（任意。キーの識別名）

ローカル開発（任意）

- ルートに `env.local.json` を作成して ABLY_API_KEY を設定してください（Git追跡外）。
- サンプル: `env.local.json.example`

Functions（例）

- `functions/api/ably-token.ts` — Ably 用のトークンリクエストを発行（本番のみ）。
- `functions/api/health.ts` — ヘルスチェック 200 を返す。

関連

- `docs/deployment/token-service.md`
- `docs/deployment/env-variables.md`

## ABLY_API_KEY を設定する（かんたん手順）

ダッシュボードから（GUI）

1. Cloudflare Dashboard → Pages → 対象プロジェクト
2. Settings → Environment Variables
3. 「Add Variable」
   - Name: `ABLY_API_KEY`
   - Value: AblyのAPIキー（例: `xxxx:yyyy...`）
   - Environment: Production（必要に応じて Preview にも）
4. Save

CLIから（wrangler）

```bash
wrangler pages secret put ABLY_API_KEY
# プロンプトにキーを貼り付けて Enter
```

確認（/api/ably-token にアクセス）

```bash
curl -s https://<あなたのPagesドメイン>/api/ably-token | jq
```

期待される返事（Phase準備のダミー返事）

- Secrets未設定: `{ ok: false, stub: true, message: 'Missing ABLY_API_KEY ...' }`
- Secrets設定済: `{ ok: true, stub: true, message: 'Token issuing is not implemented ...' }`

注意

- いまは“ダミー返事（stub）”のみ。実運用の発行ロジックは後で置き換えます。
- Secretsはフロントに露出しません（Pages Functionsのサーバ側のみ）。

セキュリティ

- CORS: 既知の Origin のみ許可。
- Rate limit: `clientId` 単位での簡易制限を導入（将来）。

キャッシュ方針

- HTML: 短期キャッシュ（no-store/短TTL）。
- 静的アセット: ハッシュ名で長期キャッシュ（immutable）。

ローカル `env.local.json`

- 追跡対象外。テスト用のダミー値のみを保持。ビルド/デプロイには同梱しない。
