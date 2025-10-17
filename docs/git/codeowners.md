# CODEOWNERS 運用

目的

- PRを自動でレビュアーにアサインし、見落しを防ぐ。

設定

- `.github/CODEOWNERS` でデフォルトを `@mizegret` に設定（全ファイル）。
- GitHub のブランチ保護で「コードオーナーのレビューを必須」にすることを推奨（手動設定）。

CI補助

- `Require Owner Approval` ワークフローが `@mizegret` の承認を必須化（ブランチ保護の代替/補助）。

自動化の補足

- ローカルで現在のGitHubユーザー名を取得: `node scripts/get-gh-user.mjs`
- 将来、チーム拡張時は CODEOWNERS をパス単位で細分化。
