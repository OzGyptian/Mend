import { test, expect } from '../fixtures';

test.describe('Project Navigation', () => {
  test('project list is visible in the sidebar', async ({ authPage: page }) => {
    // The authenticated home view should show projects or an enterprise overview
    await expect(page.locator('nav').first()).toBeVisible();
    // Look for any link that looks like a project (sidebar links)
    const sidebarLinks = page.locator('nav a, nav button');
    await expect(sidebarLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to a project from the sidebar', async ({ authPage: page }) => {
    // Find the first clickable project-like link in the sidebar
    const projectLink = page.locator('nav a').first();
    const exists = await projectLink.count();
    if (exists === 0) {
      test.skip(); // No projects configured yet
      return;
    }
    const href = await projectLink.getAttribute('href');
    if (href) {
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('project route renders without crashing', async ({ authPage: page }) => {
    // If there are any project IDs visible we can navigate to them
    const links = await page.locator('a[href*="/project/"]').all();
    if (links.length === 0) {
      test.skip(); // No projects to test against
      return;
    }
    const href = await links[0].getAttribute('href');
    if (href) {
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');
      // App should not crash — nav still present
      await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
    }
  });
});
