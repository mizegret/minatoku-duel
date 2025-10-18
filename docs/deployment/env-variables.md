# 環境変数とSecrets（Phase 1）

方針

- シークレットは Functions/Lambda 側のみ。フロントに埋め込まない。
- ローカルは `env.local.json`（追跡外）で代用し、`dist/` へは混入させない（既存ビルドは除外済）。

主要キー（予約）

- `ABLY_API_KEY` — Ably の API Key（サーバ側・必須）
- `ABLY_KEY_NAME` — キー識別名（任意）
- `ALLOWED_ORIGINS` — CORS 許可リスト（CSV/スペース区切り、将来）

Cloudflare Pages

- Dashboard → Pages → Project → Settings → Environment Variables
- `wrangler pages secret put ABLY_API_KEY`

AWS（Lambda）

- Console: Lambda の環境変数に設定 or SSM Parameter Store / Secrets Manager を利用

関連

- `docs/deployment/cloudflare-pages.md`
- `docs/deployment/token-service.md`
