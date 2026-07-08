import { defineConfig, devices } from '@playwright/test';

// Default E2E runs against a LOCAL memory-adapter build (deterministic, no creds).
// Live specs that require real Firebase credentials live under tests/e2e/live/
// and are ignored by the default run (opt in with PLAYWRIGHT_INCLUDE_LIVE=1).
const PORT = 5178;
const includeLive = process.env.PLAYWRIGHT_INCLUDE_LIVE === '1';

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
    baseURL: `http://localhost:${PORT}`,
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

  webServer: {
    command: 'npm run dev:memory',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
