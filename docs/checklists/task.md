# タスク前後チェックリスト（運用）

開始前（Preflight）

- [ ] 親/子Issue 作成、目的・受け入れ条件を明記
- [ ] ブランチ作成（小粒）
- [ ] `npm i` / Node 22 / Husky 有効
- [ ] 影響範囲確認（package.json, workflows, schema 変更時は docs も更新）
- [ ] 事前チェック: `npm run lint && npm run format:check && npm test`

終了前（Before PR）

- [ ] `git add -p` で意味単位に分割
- [ ] `npm run lint:md && npm run lint:md:links && npm run lint:mermaid`
- [ ] `npm run checklist:post` で最終確認
- [ ] PR本文 日本語 / `Closes #<親Issue>` / スクショ or 計測

CI/自動ガード

- Guardrails: Issueリンク必須 / Phase 1 コード変更禁止（ラベルで例外）
- PR Size: 大型PRは失敗（`allow:large-pr`が無ければ）
- CI: Lint/Format/Test/MD/Links/Mermaid/Secretlint/Shell
