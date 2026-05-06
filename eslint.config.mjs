// @ts-check

import eslint from '@eslint/js'
import ts_eslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig([
  // Ignore generated JavaScript files
  globalIgnores(['extension/**/*.js']),
  {
    // Only cover extension TypeScript source; integration-tests have dedicated ESLint config
    files: ['typescript-src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ts_eslint.configs.recommended,
      // Disable rules which conflict with Prettier
      eslintConfigPrettier,
    ],
  },
])
