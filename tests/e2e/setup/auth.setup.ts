/**
 * Smoke test: verify sign-in works end-to-end.
 * Not used for storageState — Firebase stores auth in IndexedDB which Playwright can't persist.
 * Authenticated tests sign in fresh via the authPage fixture in fixtures.ts.
 */
import { test as setup, expect } from '@playwright/test';

setup('authenticate smoke test', async ({ page }) => {
  const email = process.env.TEST_EMAIL ?? '';
  const password = process.env.TEST_PASSWORD ?? '';

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.getByRole('button', { name: 'Sign In' }).first().click({ timeout: 10000 });
  await page.getByPlaceholder('colleague@company.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page.locator('nav').first()).toBeVisible({ timeout: 20000 });
});
