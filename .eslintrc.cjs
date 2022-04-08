// @ts-check
const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  root: true,
  extends: ['adjunct', 'eslint:recommended', 'plugin:node/recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021
  },
  rules: {
    eqeqeq: ['warn', 'always', { null: 'never' }],
    'no-debugger': ['error'],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-process-exit': 'off',
    'no-useless-escape': 'off',
    'no-secrets/no-secrets': 'off',
    'prefer-const': [
      'warn',
      {
        destructuring: 'all'
      }
    ],

    'node/no-missing-import': [
      'error',
      {
        allowModules: ['types', 'estree', 'testUtils', 'less', 'sass', 'stylus'],
        tryExtensions: ['.ts', '.js', '.jsx', '.tsx', '.d.ts']
      }
    ],
    'node/no-missing-require': [
      'error',
      {
        // for try-catching yarn pnp
        allowModules: ['pnpapi', 'vite'],
        tryExtensions: ['.ts', '.js', '.jsx', '.tsx', '.d.ts']
      }
    ],
    'node/no-extraneous-import': [
      'error',
      {
        allowModules: ['vite', 'less', 'sass']
      }
    ],
    'node/no-extraneous-require': [
      'error',
      {
        allowModules: ['vite']
      }
    ],
    'node/no-deprecated-api': 'off',
    'node/no-unpublished-import': 'off',
    'node/no-unpublished-require': 'off',
    'node/no-unsupported-features/es-syntax': 'off',

    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-extra-semi': 'off', // conflicts with prettier
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

    'unicorn/prefer-node-protocol': 'off',
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/no-duplicate-string': 'off'
  }
})
