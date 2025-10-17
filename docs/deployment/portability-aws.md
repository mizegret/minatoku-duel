# 可搬性: Cloudflare ⇔ AWS 切替ガイド（設計）

方針

- ベンダ非依存の抽象を `src/lib/platform/*` と `src/lib/token/*` に定義。
- フロントは `Platform` / `TokenService` のみを参照。環境ごとに実装を差し替え。

マッピング

- 静的配信: Cloudflare Pages → AWS S3 + CloudFront / Amplify Hosting
- Functions: Pages Functions → AWS Lambda（API Gateway or Lambda@Edge）
- Secrets: CF Vars → AWS SSM Parameter Store or Secrets Manager
- 分析: CF Analytics → CloudWatch / OpenSearch（将来）

インタフェース（例）

```ts
interface TokenService {
  getAblyToken(clientId: string): Promise<{ token: string; expiresAt: number }>;
}
```

実装

- Cloudflare: `functions/api/ably-token.ts` → `cloudflare-token.ts`
- AWS: `lambda/ably-token.ts` → `aws-token.ts`

切替手順（概略）

1. 環境変数を移行（`ABLY_API_KEY` 等）
2. `TokenService` を AWS 実装に差し替え
3. デプロイ先（S3/CloudFront or Amplify）にビルド成果物をアップロード

セキュリティ

- CORS/Origin は環境ごとに最小許可。
- ログに秘匿情報を残さない。
