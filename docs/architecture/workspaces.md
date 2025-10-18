# Workspaces 構成（準備）

目的

- Phase 1 の範囲でワークスペースの器だけを用意し、SWITCHで段階移行しやすくする。

構成

- `apps/web` — 将来の Vite + React + TS + R3F（いまはプレースホルダ）
- `functions/` — 将来の Pages Functions / AWS Lambda（いまはプレースホルダ）

注意

- 既存のビルド/テスト/リンタはルートで実行し、挙動は変えない。
- 実装の追加は `phase:switch` または `allow:code-change` ラベル付きPRで行う。
