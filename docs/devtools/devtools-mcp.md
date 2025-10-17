# DevTools（MCP）利用ガイド

目的

- X サーバなしの WSL でも DevTools を操作できるようにする。

設定

- 追加済み MCP: `chrome-devtools`
- コマンド: `npx -y chrome-devtools-mcp@latest --headless --port 9222`
- 確認: `codex mcp list`

使い方

- ブラウザをヘッドレス/リモートで起動し、ネットワーク/コンソール/パフォーマンス情報を取得。
- 必要な取得項目を issue/タスクに記載して依頼（例: 「/room/abcd の WS フレームをダンプ」）。

注意

- プロダクションの認証トークンやPIIをダンプしない。
