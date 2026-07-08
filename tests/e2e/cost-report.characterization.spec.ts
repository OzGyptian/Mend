import { test, expect } from './memory.fixtures';

// Characterization tests: pin the CURRENT observable behaviour of the core
// value chain against the deterministic memory fixtures (see seedMemory()).
// These must stay green through the Phase 11.2 cost/EAC refactor.

test('app boots into the authenticated shell without a login step', async ({ appPage }) => {
  await expect(appPage.locator('nav').first()).toBeVisible();
});

test('seeded demo enterprise is present', async ({ appPage }) => {
  await expect(appPage.getByText(/Demo Enterprise/i).first()).toBeVisible();
});

test('opening the demo project shows its name', async ({ appPage }) => {
  await appPage.goto('/project/demo-project');
  await expect(appPage.getByText(/Demo Tower/i).first()).toBeVisible({ timeout: 20000 });
});

// TODO(next session): confirm the correct cost-codes module route/id (ProjectDashboard
// currentModule value) — `/project/:id/cost-codes` did not render the grid. Once the
// route is confirmed, un-fixme this and add the money-value assertions (approvedBudget
// 550,000 / EAC 500,000 / variance 50,000 for Substructure) to pin the cost numbers
// ahead of the Phase 11.2 compute-on-read refactor.
test.fixme('cost codes module lists the seeded cost codes', async ({ appPage }) => {
  await appPage.goto('/project/demo-project/cost-codes');
  await expect(appPage.getByText(/Substructure/i).first()).toBeVisible({ timeout: 20000 });
  await expect(appPage.getByText(/Superstructure/i).first()).toBeVisible();
});
