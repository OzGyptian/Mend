import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // tests/security/** needs a live Firestore emulator — it has its own config
    // (vitest.rules.config.ts) and runs via `npm run test:rules`, not here.
    // tests/postgres/** needs a live Supabase project — it has its own config
    // (vitest.postgres.config.ts) and runs via `npm run test:postgres`, not here.
    exclude: ['**/node_modules/**', 'tests/security/**', 'tests/postgres/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 90,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
