import { test } from './memory.fixtures';
import { chromium } from '@playwright/test';

const PROJECT_ROUTES = [
  'change',
  'risk', 
  'subcontract',
  'progress',
  'procurement',
  'schedule',
  'dashboard',
];

for (const module of PROJECT_ROUTES) {
  test(`${module} module loads without crashing`, async ({ appPage }) => {
    await appPage.goto(`/project/demo-project/${module}`);
    await appPage.waitForTimeout(2000);
    // If error boundary triggered it shows "Something went wrong"
    const errorBoundary = appPage.getByText('Something went wrong');
    const errorCount = await errorBoundary.count();
    if (errorCount > 0) {
      const errorText = await appPage.locator('pre, code, [class*="error"]').textContent().catch(() => 'unknown error');
      throw new Error(`Error boundary triggered on /${module}: ${errorText}`);
    }
  });
}
