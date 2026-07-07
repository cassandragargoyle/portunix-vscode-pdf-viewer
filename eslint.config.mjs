// ESLint flat config for the extension sources
// Replaces the legacy .eslintrc.json (eslint 6) after the eslint 9 upgrade
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  prettierRecommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          endOfLine: 'auto',
          trailingComma: 'es5',
        },
      ],
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    ignores: ['out/**', 'node_modules/**', '.vscode-test/**', 'lib/**'],
  }
);
