import { test, expect } from '../fixtures';

test.describe('System Admin', () => {
  test('loads without crashing for a platform admin', async ({ authPage: page }) => {
    await page.goto('/system-admin');
    await page.waitForLoadState('domcontentloaded');
    // Regression: subscribeAll() colliding on a fixed realtime channel name
    // threw uncaught whenever App.tsx and SystemAdmin.tsx both subscribed
    // concurrently, which the error boundary caught as a full-page crash.
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await expect(page.getByText('System Administration')).toBeVisible({ timeout: 10000 });
  });

  test('enterprise list is not empty', async ({ authPage: page }) => {
    await page.goto('/system-admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('System Administration')).toBeVisible({ timeout: 10000 });
    // Total: N summary in the page header -- fails closed if the list ever
    // renders empty (silently swallowed fetch error, RLS regression, etc.)
    // rather than passing on a false-empty state. Uses expect.poll instead
    // of a one-shot read: the header shows "Total: 0" on first paint before
    // the async fetch resolves, so reading it once (even after "System
    // Administration" is visible) can catch that transient initial value
    // rather than the real, settled count.
    await expect.poll(async () => {
      const totalText = await page.getByText(/Total:\s*\d+/).textContent();
      return Number(totalText?.match(/\d+/)?.[0] ?? 0);
    }, { timeout: 10000 }).toBeGreaterThan(0);
  });

  test('switching enterprise persists across a reload', async ({ authPage: page }) => {
    // Regression: systemOwnerEnterpriseId's useState lazy initializer read
    // `user ? localStorage.getItem(...) : null`, but user is a separate
    // piece of state that's always still null at that exact first render --
    // so it always read null, never the real persisted value, regardless of
    // what was actually in localStorage. Switching enterprise via System
    // Admin worked and stuck immediately, but reloading the page silently
    // reverted to whichever enterprise happened to load first.
    await page.goto('/system-admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('System Administration')).toBeVisible({ timeout: 10000 });

    const targetRow = page.getByRole('row', { name: /Switch To/ }).first();
    const enterpriseName = await targetRow.getByRole('cell').nth(1).textContent();
    await targetRow.getByRole('button', { name: 'Switch To' }).click();

    await page.goto('/');
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 10000 });

    await page.goto('/system-admin');
    await expect(page.getByText('System Administration')).toBeVisible({ timeout: 10000 });
    const activeRow = page.getByRole('row', { name: /Active/ });
    await expect(activeRow).toContainText(enterpriseName ?? '');
  });
});
