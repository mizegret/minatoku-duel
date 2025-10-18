# Token Service 設計（Cloudflare ⇔ AWS 可搬・Phase 1）

目的

- Ably のトークン発行をベンダ非依存で扱うための抽象設計を先に固定する。
- Phase 1 は“設計と契約のみ”。実装・挙動変更は行わない。

抽象インタフェース（参考）

```ts
export interface TokenService {
  getAblyToken(clientId: string): Promise<{ token: string; expiresAt: number }>; // ms epoch
}
```

HTTP エンドポイント契約（準備）

- Path: `/api/ably-token`
- Method: `POST`
- Request: `{"clientId":"<string>"}`（Content-Type: application/json）
- Response (OK, stub想定):
  - `{ ok: true, stub: true, message: string }`（Phase 1 はダミー応答）
- Response (Missing secret):
  - `{ ok: false, stub: true, message: 'Missing ABLY_API_KEY' }`

Cloudflare 実装（将来）

- Pages Functions 内で `env.ABLY_API_KEY` を参照し、Ably の Token Request を作成して返却。
- 変数: `ABLY_API_KEY`, `ABLY_KEY_NAME`（任意）

AWS 実装（将来）

- Lambda (API Gateway) で `process.env.ABLY_API_KEY` を参照。
- 同一インタフェースで応答。

セキュリティ

- CORS: 既知 Origin のみ許可。
- Rate limit: `clientId` 単位（将来）。
- ログにシークレットを出さない。

関連

- `docs/deployment/cloudflare-pages.md`
- `docs/deployment/portability-aws.md`
