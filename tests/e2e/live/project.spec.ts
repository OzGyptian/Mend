import { test, expect } from '../fixtures';

test.describe('Project Navigation', () => {
  test('project list is visible in the sidebar', async ({ authPage: page }) => {
    // The authenticated home view should show projects or an enterprise overview
    await expect(page.locator('nav').first()).toBeVisible();
    // Look for any link that looks like a project (sidebar links)
    const sidebarLinks = page.locator('nav a, nav button');
    await expect(sidebarLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to a project from the dashboard grid', async ({ authPage: page }) => {
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 10000 });
    // Projects are AG Grid rows, not links: the pinned "Project ID" cell is a
    // clickable span that navigates via window.location.href -> /project/:id.
    // Exclude the pinned TOTAL summary row.
    const projectCell = page.getByTestId('project-code-link').filter({ hasNotText: 'TOTAL' }).first();
    if (await projectCell.count() === 0) {
      test.skip(); // enterprise has no projects
      return;
    }
    await projectCell.click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/, { timeout: 10000 });
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
  });

  test('project route renders without crashing', async ({ authPage: page }) => {
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 10000 });
    const projectCell = page.getByTestId('project-code-link').filter({ hasNotText: 'TOTAL' }).first();
    if (await projectCell.count() === 0) {
      test.skip(); // enterprise has no projects
      return;
    }
    await projectCell.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 10000 });
    // App should not have hit an error boundary
    await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
  });
});
