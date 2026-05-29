// @ts-check

import eslint from '@eslint/js'
import ts_eslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import wdio_eslint from 'eslint-plugin-wdio'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig([
  eslint.configs.recommended,
  ts_eslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Enable linting with type information
        projectService: {
          // Handle files not part of `tsconfig.json`
          allowDefaultProject: ['eslint.config.mjs'],
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  {
    rules: {
      // Allow usage of namespaces in test code
      '@typescript-eslint/no-namespace': 'off',
    },
  },
  wdio_eslint.configs['flat/recommended'],
  // Disable rules which conflict with Prettier
  eslintConfigPrettier,
])
