import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Enterprise Dashboard', () => {
  test('authenticated user lands on dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // Should not be redirected to login
    await expect(page).not.toHaveURL(/login/);
    await expect(dashboard.sidebar).toBeVisible({ timeout: 15000 });
  });

  test('dashboard shows enterprise content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Something meaningful is rendered (not just a blank page or spinner)
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(100);
  });

  test('enterprise admin page is accessible', async ({ page }) => {
    await page.goto('/enterprise-admin');
    await page.waitForLoadState('networkidle');

    // Should render — not a 404 or error
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(50);
  });

  test('unknown routes redirect to home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL('/');
  });
});
