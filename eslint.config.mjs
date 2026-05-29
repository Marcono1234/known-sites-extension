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
    files: ['eslint.config.mjs', 'typescript-src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ts_eslint.configs.recommendedTypeChecked,
      {
        languageOptions: {
          parserOptions: {
            // Enable linting with type information
            projectService: {
              allowDefaultProject: [
                'eslint.config.mjs',
                // Handle common-src specially because it has no enclosing project but is just included by the others
                // Otherwise typescript-eslint reports "common.ts was not found by the project service"
                'typescript-src/common-src/common.ts',
              ],
            },
          },
        },
        linterOptions: {
          reportUnusedDisableDirectives: 'error',
          reportUnusedInlineConfigs: 'error',
        },
      },
      // Disable rules which conflict with Prettier
      eslintConfigPrettier,
    ],
  },
])
