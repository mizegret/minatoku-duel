# 推奨ラベル

カテゴリー

- `type:feature`
- `type:bug`
- `type:docs`
- `type:task`
- `area:api`
- `area:net`
- `area:3d`
- `area:ui`
- `priority:p1`
- `priority:p2`
- `priority:p3`

ガード用

- `phase:switch` — Phase 1 でもコード変更を許可
- `allow:code-change` — 一時的にコード変更を許可
- `allow:large-pr` — サイズ検査を一時的に免除

サイズ（自動付与）

- `size/XS`（≤ 50）
- `size/S`（≤ 150）
- `size/M`（≤ 300）
- `size/L`（≤ 600）
- `size/XL`（> 600）

作成コマンド例（GitHub CLI）

```bash
gh label create "type:feature" -c '#1F883D' || true
gh label create "type:bug" -c '#D1242F' || true
gh label create "type:docs" -c '#0969DA' || true
gh label create "type:task" -c '#A371F7' || true
gh label create "area:api" -c '#0E8A16' || true
gh label create "area:net" -c '#0E8A16' || true
gh label create "area:3d" -c '#0E8A16' || true
gh label create "area:ui" -c '#0E8A16' || true
gh label create "priority:p1" -c '#E11D21' || true
gh label create "priority:p2" -c '#FBCA04' || true
gh label create "priority:p3" -c '#0E8A16' || true
gh label create "phase:switch" -c '#8250DF' || true
gh label create "allow:code-change" -c '#8250DF' || true
gh label create "allow:large-pr" -c '#69788C' || true
gh label create "size/XS" -c '#0E8A16' || true
gh label create "size/S" -c '#1F883D' || true
gh label create "size/M" -c '#FBCA04' || true
gh label create "size/L" -c '#D93F0B' || true
gh label create "size/XL" -c '#CF222E' || true
```
