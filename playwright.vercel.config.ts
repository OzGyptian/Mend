import { defineConfig, devices } from '@playwright/test';

const PREVIEW_URL =
  process.env.VERCEL_URL ??
  'https://mend-bfgsfczg1-bernardwleung-3292s-projects.vercel.app';

export default defineConfig({
  testDir: './tests/e2e/live',
  timeout: 60000,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: PREVIEW_URL,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — we're hitting Vercel directly
});
