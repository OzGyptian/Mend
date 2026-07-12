import { defineConfig } from 'vitest/config';

// Separate config for tests/postgres/** — these run against a live Supabase
// project (the mend-migration-scratch project, not local — there's no Docker
// available for the local Supabase stack) via SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Kept out of vitest.config.ts so the plain unit
// suite (`npm run test`) never tries to run them without those set, and run
// sequentially (no fileParallelism) since tests share fixture enterprises/
// projects and clean up after themselves.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/postgres/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
