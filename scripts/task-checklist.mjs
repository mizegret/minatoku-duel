#!/usr/bin/env node
// タスク前後のチェックリストを表示（CI安全）。
const mode = process.argv[2] || 'pre';

const pre = `
【タスク開始前チェック】
1) 目的/受け入れ条件をIssueに明記（親/子Issue）
2) ブランチ作成：type/scope-topic（小粒）
3) 'npm i' 済 / Node 22 確認 / husky 有効化
4) 影響範囲確認：docs/api/events.md / actions / package.json 変更時はドキュメント更新
5) 事前CI: npm run lint && npm run format:check && npm test
`;

const post = `
【タスク終了前チェック（コミット/PR前）】
1) 'git add -p' で意味単位に分割
2) 'npm run lint:md && npm run lint:md:links' 済
3) 画像/VRM/VRMA サイズ/配置 ルール遵守
4) 自己レビュー実施（pre-commitで 'yes' 入力）
5) PR本文 日本語 / Closes #<親Issue> / スクショ or 計測
`;

console.log(mode === 'pre' ? pre : post);
