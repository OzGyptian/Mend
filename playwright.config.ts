import { defineConfig, devices } from '@playwright/test';

// Default E2E runs against a LOCAL memory-adapter build (deterministic, no creds).
// Live specs under tests/e2e/live/ hit a real deployed URL (Postgres/Supabase
// backend, real auth) and are ignored by the default run -- opt in with
// PLAYWRIGHT_INCLUDE_LIVE=1 and LIVE_BASE_URL set to the target deployment.
// Needs TEST_EMAIL / TEST_PASSWORD for a dedicated, non-destructive test
// account (smoke-test@mend-test.invalid) -- never a real user's credentials.
const PORT = 5178;
const includeLive = process.env.PLAYWRIGHT_INCLUDE_LIVE === '1';
const liveBaseURL = process.env.LIVE_BASE_URL;

if (includeLive && !liveBaseURL) {
  throw new Error('PLAYWRIGHT_INCLUDE_LIVE=1 requires LIVE_BASE_URL to be set to the deployment under test.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: includeLive ? [] : ['**/live/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  reporter: [['html'], ['list']],
  use: {
    baseURL: includeLive ? liveBaseURL : `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Live runs hit a real remote deployment -- don't spin up (or wait for) a
  // local memory-adapter server that the live specs never talk to.
  webServer: includeLive ? undefined : {
    command: 'npm run dev:memory',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
