import { test, expect } from '../fixtures';

test.describe('Enterprise Dashboard', () => {
  test('shows enterprise sidebar after login', async ({ authPage: page }) => {
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('enterprise admin page is accessible', async ({ authPage: page }) => {
    await page.goto('/enterprise-admin');
    await page.waitForLoadState('domcontentloaded');
    // Should not bounce back to landing — Sign In button absent means we're still authenticated
    await expect(page.getByRole('button', { name: 'Sign In' })).toHaveCount(0);
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
  });

  test('profile page loads User Profile heading', async ({ authPage: page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('User Profile')).toBeVisible({ timeout: 10000 });
  });

  test('unknown routes stay in the app (SPA fallback)', async ({ authPage: page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('domcontentloaded');
    // SPA: React Router catches it; landing page or redirect, not a browser 404
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });
});
