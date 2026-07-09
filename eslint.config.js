import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const FIREBASE_BOUNDARY_MESSAGE =
  'Firebase must only be imported inside src/platform/. Use a repo hook (useCostRepo, useAuthRepo, etc.) instead.';

export default [
  // All TS/TSX files get the TypeScript parser
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tseslint },
  },

  // Enforce firebase boundary on everything OUTSIDE src/platform/
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/platform/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // Exact package names
          paths: [
            { name: 'firebase', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/app', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/auth', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/firestore', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/storage', message: FIREBASE_BOUNDARY_MESSAGE },
            { name: 'firebase/functions', message: FIREBASE_BOUNDARY_MESSAGE },
          ],
          // Catch any other firebase/* subpath not listed above
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
