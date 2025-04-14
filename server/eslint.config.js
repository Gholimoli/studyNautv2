// @ts-check

import eslint from '@eslint/js';
import tseslintParser from '@typescript-eslint/parser';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals'; // Import globals package
// import eslintPluginImport from 'eslint-plugin-import'; // Keep commented for now

export default [
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // Base TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslintParser,
      globals: {
        ...globals.node, // Add all Node.js globals
        ...globals.es2021,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      // Base recommended rules from @typescript-eslint/eslint-plugin
      ...tseslintPlugin.configs['recommended-type-checked'].rules, // Or 'recommended'
      // Rule Overrides
      'no-undef': 'off', // Turn off base no-undef as TypeScript handles this
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '_', varsIgnorePattern: '_', caughtErrorsIgnorePattern: '_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // --- Temporarily Disable Noisy Type-Aware Rules ---
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Also disable misused promises for now due to passport issues
      '@typescript-eslint/no-misused-promises': 'off',
      // --- End Temporary Disable ---
    },
  },

  // Global ignores configuration
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.env',
      '*.config.js', // Ignores eslint.config.js, drizzle.config.ts etc.
      'drizzle.config.ts', // Explicitly ignore drizzle config
      'drizzle/',
      'src/types/**/*.d.ts', // Declaration files usually don't need linting
    ],
  }
]; 