import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend<{ authPage: typeof base.prototype.page }>({
  authPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Sign In' }).first().click({ timeout: 10000 });
    await page.getByPlaceholder('colleague@company.com').fill(process.env.TEST_EMAIL ?? '');
    await page.getByPlaceholder('••••••••').fill(process.env.TEST_PASSWORD ?? '');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Wait until the sidebar nav is visible (authenticated app shell)
    await page.locator('nav').first().waitFor({ timeout: 20000 });

    await use(page);
  },
});
