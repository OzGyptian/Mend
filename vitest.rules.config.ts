import { defineConfig } from 'vitest/config';

// Separate config for tests/security/** — these need a live Firestore emulator
// (see `npm run test:rules`, which wraps this in `firebase emulators:exec`).
// Kept out of vitest.config.ts so the plain unit suite (`npm run test`) never
// tries to run them without the emulator present.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/security/**/*.test.ts'],
  },
});
