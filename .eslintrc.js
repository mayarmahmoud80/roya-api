/* eslint-disable -- build-time config, not part of app source */

module.exports = {
    root: true,
  
    env: {
      node: true,
      jest: true,
      es2021: true,
    },
  
    parser: '@typescript-eslint/parser',
  
    parserOptions: {
      project: './tsconfig.eslint.json',
      tsconfigRootDir: __dirname,
      sourceType: 'script',
    },
  
    plugins: ['@typescript-eslint', 'prettier'],
  
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'plugin:prettier/recommended',
    ],
  
    ignorePatterns: [
      '.eslintrc.js',
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
    ],
  
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
  
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
    },
  };
