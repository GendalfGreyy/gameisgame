// Shared ESLint flat config. Apps and packages re-export this.
// Real rule loading (typescript-eslint, plugin imports) happens inside each
// app when their package.json declares the dev-deps — that way the root
// config is dependency-light and CI installs only what each leaf needs.

import js from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/coverage/**',
      '**/prisma/migrations/**',
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/studio/e2e/**',
      'apps/studio/playwright.config.ts',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-implicit-coercion': 'error',
    },
  },
];
