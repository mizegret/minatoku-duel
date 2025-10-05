# Git 運用メモ（Minatoku Duel）

このプロジェクトでは、Bot/人間いずれも「勝手に commit しない」ことを原則とします。変更は提案→確認→承認→commit の順で進めます。

## コミットメッセージ規約

- 形式: `type(scope): subject`
- 主な `type`:
  - `feat` 新機能
  - `fix` バグ修正
  - `refactor` 構造変更（挙動不変）
  - `ui` UI 関連（見た目/操作の変更）
  - `docs` ドキュメント
  - `rule` ルール/仕様変更
  - `chore` 雑務・CI 等
- `scope` の指針:
  - フェーズ/領域を短く明示（例: `step3/host`, `step4/ui`, `net/ably`, `cards`）
- `subject`:
  - 50 文字以内の要約。必要ならセミコロン以降に補足（日本語/英語混在可）。

### 例

- `refactor(step2): extract deck/cards utils; switch to imports`
- `ui(copy): rename Skip to 'このターンは様子見'`
- `rule(decorations): charm-only; no oji on equip`

## 粒度の原則

- 1 つの論理変更 = 1 コミット。
- 移動/リネームは関連ロジックと同じコミットで OK（差分の追跡性重視）。

## Bot 運用ポリシー

- 事前に「やること＋予定メッセージ」を提示し、承認後に commit 実行。
- メッセージは既存履歴の書式に合わせ、`type(scope)` の整合を取る。

## メッセージ修正フロー（履歴整形）

- 直近を修正: `git commit --amend -m "..."`
- それ以前を修正: `git rebase -i HEAD~N` で対象行を `reword` にし、エディタで書き換え。
  - 共同作業ブランチの履歴書き換え（rebase/force-push）は要承認。

## よく使うコマンド

```bash
# 直近のメッセージだけ修正
git commit --amend -m "refactor(step4/ui): ..."

# 2 件分のメッセージを書き換え（reword）
git rebase -i HEAD~2  # 1行目=古い方、2行目=新しい方

# 変更をまとめて確認
git --no-pager log --decorate --graph --oneline -n 20
```

