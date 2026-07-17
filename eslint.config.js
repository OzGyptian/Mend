import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

const FIREBASE_BOUNDARY_MESSAGE =
  'Firebase must only be imported inside src/platform/. Use a repo hook (useCostRepo, useAuthRepo, etc.) instead.';

export default [
  // All TS/TSX files: TypeScript parser + plugins
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      // React hooks correctness — catches auth-timing bugs at lint time
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript quality ratchet — warn not error to avoid blocking existing code
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Firebase boundary: block direct firebase imports outside src/platform/
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/platform/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'firebase', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/app', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/auth', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/firestore', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/storage', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/functions', message: FIREBASE_BOUNDARY_MESSAGE },
          ],
          patterns: [
            {
              group: ['firebase/*'],
              message: FIREBASE_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
    },
  },
];
