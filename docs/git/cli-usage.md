# GitHub CLI / Sub-Issue チートシート

前提

- `gh` インストール済み、拡張 `yahsan2/gh-sub-issue` 追加済み。

親Issue

```bash
gh issue create \
  -t "[Epic] React + R3F bootstrap" \
  -b "目的/背景/受け入れ条件..." \
  -l "type:feature,area:ui" \
  -p <owner>/<repo>
```

子Issue

```bash
gh sub-issue create <parent-number> \
  -t "Add envelope schema draft" \
  -b "詳細..." \
  -l "type:docs,area:api"
```

PR の作成（Issue 紐付け）

```bash
git switch -c docs/events-envelope-v1
# 変更...
git add -A && git commit -m "docs(api): envelope v1 draft"
gh pr create -t "docs(api): envelope v1 draft" -b "Closes #<parent>" -B main -H docs/events-envelope-v1
```
