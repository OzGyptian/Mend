import { test as base, expect } from '@playwright/test';

export { expect };

// On the memory adapter the auth adapter auto-signs-in as dev@memory.local (verified),
// so the app boots straight into the authenticated shell with the seeded
// `demo-enterprise` / `demo-project` fixtures — no login step required.
export const test = base.extend<{ appPage: typeof base.prototype.page }>({
  appPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Authenticated shell: the sidebar nav renders once we're signed in.
    await page.locator('nav').first().waitFor({ timeout: 30000 });
    await use(page);
  },
});
