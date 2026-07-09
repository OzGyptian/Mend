import { test, expect } from './memory.fixtures';

// Phase 11.0 characterization tests — run against the memory adapter (deterministic, no login).
// These tests pin the current observable behaviour so regressions surface immediately.
// Money assertions are marked with their Phase 11.2 expectation: compute-on-read must produce
// the same values as the seeded stored fields (550,000 / 500,000 / 50,000).

test('app boots on memory adapter without login', async ({ appPage }) => {
  await expect(appPage.locator('nav').first()).toBeVisible();
});

test('Demo Enterprise is present in enterprise selector', async ({ appPage }) => {
  await expect(appPage.getByText(/Demo Enterprise/i).first()).toBeVisible();
});

test('Demo Tower project opens', async ({ appPage }) => {
  await appPage.goto('/project/demo-project');
  await expect(appPage.getByText(/Demo Tower/i).first()).toBeVisible({ timeout: 20000 });
});

test('cost module loads and renders seeded cost codes', async ({ appPage }) => {
  // Route: /project/:projectId/cost  → defaults to CostCodes tab
  await appPage.goto('/project/demo-project/cost');

  // Both seeded cost codes are visible in the grid
  await expect(appPage.getByText(/Substructure/i).first()).toBeVisible({ timeout: 20000 });
  await expect(appPage.getByText(/Superstructure/i).first()).toBeVisible();

  // Phase 11.2 TODO: assert money columns (approvedBudget=550,000 / EAC=500,000 / variance=50,000).
  // AG Grid virtualizes off-screen columns so these need horizontal scroll + re-assertion
  // after compute-on-read lands.
});
