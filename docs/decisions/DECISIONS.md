# Decision Log (Living)

更新日: 2025-10-17

確定

- パッケージマネージャ: npm / Node 22
- 将来フレームワーク: Vite + React + TS + R3F（ADR-0001）
- 通信: Ably / `room:<id>` / `join|start|move|state` / Envelope必須
- デプロイ: Cloudflare Pages/Functions（切替先 AWS: S3+CloudFront, Lambda）
- アセット: VRM/VRMA 対応、遅延ロード、CDN 長期キャッシュ
- UI: 3カラム（左:情報／中央:3D／右:ログ）、CanvasとDOMの責務分離

運用

- 1論点=1PR、親/子Issue、PRはIssue紐付け必須
- Conventional Commits 形式、ブランチ命名規約遵守

Phase 1 ルール

- デフォルトは“ドキュメントのみ”。コード変更が必要なPRは `phase:switch` か `allow:code-change` ラベルを付与
