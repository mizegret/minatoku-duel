/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => /^merge\b/i.test(message) || /^Merge\b/.test(message)],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'ui', 'docs', 'rule', 'chore']],
    // 日本語サブジェクト許容（大文字/小文字の概念がないため無効化）
    'subject-case': [0],
    'scope-empty': [0],
  },
};
