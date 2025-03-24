// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  // Ignore generated JavaScript files
  globalIgnores(['extension/**/*.js']),
  {
    files: ['typescript-src/**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
  },
])
