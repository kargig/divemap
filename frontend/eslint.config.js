const js = require('@eslint/js');
const path = require('path');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const importPlugin = require('eslint-plugin-import');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        browser: true,
        node: true,
        window: true,
        document: true,
        console: true,
        setTimeout: true,
        clearTimeout: true,
        fetch: true,
        URLSearchParams: true,
        navigator: true,
        process: true,
        atob: true,
        localStorage: true,
        FormData: true,
        alert: true,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      prettier,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // React specific rules
      'react/prop-types': 'warn',
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/jsx-uses-react': 'off', // Not needed in React 17+
      'react/jsx-uses-vars': 'error',
      'react/no-unused-state': 'error',
      'react/no-array-index-key': 'warn',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-unescaped-entities': 'warn',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import rules
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // General JavaScript rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'warn', // Changed from error to warn
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-imports': 'error',
      'no-empty': 'warn',
      'no-extra-semi': 'error',
      'no-irregular-whitespace': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'no-trailing-spaces': 'error',
      'no-unreachable': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-useless-escape': 'error',
      'no-useless-return': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'valid-typeof': 'error',

      // Code quality
      'complexity': ['warn', 20],
      'max-depth': ['warn', 5],
      'max-len': [
        'warn',
        {
          code: 100,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      'max-lines': ['warn', 900],
      'max-lines-per-function': ['warn', 600],
      'max-params': ['warn', 4],

      // Accessibility rules - convert some to warnings
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
    },
    settings: {
      'import/core-modules': ['virtual:pwa-register'],
      react: {
        version: 'detect',
      },
      'import/resolver': {
        vite: {
          viteConfig: path.resolve(__dirname, 'vite.config.js'),
        },
        node: {
          extensions: ['.js', '.jsx'],
        },
        exports: {},
      },
    },
  },
  {
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx'],
    languageOptions: {
      globals: {
        jest: true,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  prettierConfig,
];
