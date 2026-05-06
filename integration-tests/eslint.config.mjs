// @ts-check

import eslint from '@eslint/js'
import ts_eslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import wdio_eslint from 'eslint-plugin-wdio'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig([
  eslint.configs.recommended,
  ts_eslint.configs.recommended,
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
