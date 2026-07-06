import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.test');
  }

  await page.goto('/');

  // Landing page — click Sign In
  await page.getByRole('button', { name: /sign in/i }).click();

  // Fill credentials
  await page.getByPlaceholder('colleague@company.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Wait for authenticated state — sidebar or enterprise selector appears
  await expect(page.locator('nav, [data-testid="sidebar"], .sidebar')).toBeVisible({ timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
