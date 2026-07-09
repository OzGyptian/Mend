import { test, expect } from './memory.fixtures';

// Functional E2E tests that verify meaningful computed values and access control,
// not just "module loads without crashing". All run against the memory adapter
// (deterministic, no credentials).

// ── Test 1: Risk module shows empty grid without errors ────────────────────────
// The memory adapter does NOT seed any risk records, so this test verifies that
// an empty risk register renders correctly (grid container visible, no error boundary).
test('risk module: empty risk register renders without errors', async ({ appPage }) => {
  await appPage.goto('/project/demo-project/risk');
  await appPage.waitForTimeout(2000);

  // No error boundary
  const errorBoundary = appPage.getByText('Something went wrong');
  const errorCount = await errorBoundary.count();
  if (errorCount > 0) {
    throw new Error('Error boundary triggered on /risk');
  }

  // AG Grid root element is present (the risk grid loaded)
  const grid = appPage.locator('.ag-root-wrapper').first();
  await expect(grid).toBeVisible({ timeout: 15000 });
});

// ── Test 2: System Admin nav item is NOT visible to the memory user ─────────────
// The memory user (dev@memory.local) has platformRole=null (no platform_admin role).
// The Sidebar only shows the "System Admin" nav item when isPlatformAdmin is true.
// This test asserts access control: the item must be absent for a non-admin user.
test('admin gate: System Admin nav item hidden from non-platform-admin user', async ({ appPage }) => {
  // App loads at root; the demo enterprise is auto-selected
  await appPage.waitForSelector('nav', { timeout: 15000 });

  // Give the sidebar time to fully render with roles resolved
  await appPage.waitForTimeout(2000);

  // "System Admin" should NOT be visible — memory-user has platformRole=null
  const systemAdminLink = appPage.getByText('System Admin', { exact: true });
  await expect(systemAdminLink).toHaveCount(0);
});

// ── Test 3: Cost report grid shows seeded approved budget values ────────────────
// The demo data seeds:
//   cc-100 Substructure:  approvedBudget = 550,000
//   cc-200 Superstructure: approvedBudget = 400,000
// This test confirms the grid renders those values formatted as USD currency.
// AG Grid virtualizes off-screen columns, so we scroll horizontally first.
test('cost report: seeded approved budget values visible in grid', async ({ appPage }) => {
  await appPage.goto('/project/demo-project/cost');
  await appPage.waitForTimeout(3000);

  // Wait for cost codes to appear (Substructure is seeded)
  await expect(appPage.getByText(/Substructure/i).first()).toBeVisible({ timeout: 20000 });

  // Scroll the horizontal scroll viewport to reveal budget columns (~500px in)
  await appPage.locator('.ag-body-horizontal-scroll-viewport').first().evaluate(el => {
    el.scrollLeft = 500;
  });
  await appPage.waitForTimeout(500);

  // cc-100 approvedBudget = $550,000.00 — formatted as USD by the CostCodes grid
  const budgetCell = appPage.locator('.ag-cell').filter({ hasText: '$550,000.00' }).first();
  await expect(budgetCell).toBeVisible({ timeout: 10000 });
});
