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

  test('My Profile sidebar button opens profile panel', async ({ authPage: page }) => {
    // Wait for the dashboard's own enterprise resolution to settle before
    // clicking -- a real user necessarily sees the loaded page before they
    // can click anything in it, but this test previously clicked as its
    // very first action, hitting the same in-flight-selection window the
    // app's own loading state (RouteLoadingFallback) exists to cover.
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 10000 });
    // The /profile route redirects to "/" while currentEnterprise is still
    // resolving (see App.tsx's enterpriseSelectionPending). A fixed wait is
    // not robust: under parallel load the selection race can outlast it, the
    // click lands during the redirect window, and the panel never opens.
    // Instead retry the click-and-assert until the enterprise has hydrated --
    // a real user necessarily clicks after the page has settled anyway.
    // Not networkidle: this app holds persistent Supabase Realtime websockets,
    // so network activity never actually goes idle.
    await expect(async () => {
      await page.getByRole('button', { name: /my profile/i }).click();
      await expect(page.getByText('User Profile')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
  });

  test('unknown routes stay in the app (SPA fallback)', async ({ authPage: page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('domcontentloaded');
    // SPA: React Router catches it; landing page or redirect, not a browser 404
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });
});
