// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig([
  // Ignore generated JavaScript files
  globalIgnores(['extension/**/*.js']),
  {
    files: ['typescript-src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      // Disable rules which conflict with Prettier
      eslintConfigPrettier,
    ],
  },
])
