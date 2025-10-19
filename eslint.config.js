// ESLint flat config (Node 22 / ESM)
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      // _プレフィックスの引数/変数/catchは未使用許容（意図を明示）
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-implicit-globals': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['tests/**/*.test.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'public/env.local.json',
      // Phase 1: 型付け移行中のため web の TS/TSX は lint 対象外にする
      'apps/web/src/**/*.ts',
      'apps/web/src/**/*.tsx',
    ],
  },
];
