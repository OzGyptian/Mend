import { test, expect } from '@playwright/test';

test.describe('Project Navigation', () => {
  test('can navigate to a project', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find a project link in the sidebar or project list and click it
    const projectLink = page.locator('a[href*="/project/"]').first();
    const hasProjects = await projectLink.isVisible().catch(() => false);

    if (!hasProjects) {
      test.skip();
      return;
    }

    const href = await projectLink.getAttribute('href');
    await projectLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp('/project/'));
  });

  test('project view renders without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const projectLink = page.locator('a[href*="/project/"]').first();
    const hasProjects = await projectLink.isVisible().catch(() => false);

    if (!hasProjects) {
      test.skip();
      return;
    }

    await projectLink.click();
    await page.waitForLoadState('networkidle');

    // No JS error overlay
    await expect(page.locator('body')).toBeVisible();
    const errors = await page.locator('[class*="error"], [class*="Error"]').count();
    expect(errors).toBe(0);
  });
});
