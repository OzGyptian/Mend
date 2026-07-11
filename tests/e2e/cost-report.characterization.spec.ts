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
});

// Phase 13.B1.4 (SYSTEM_REVIEW.md v2 / PLAN.md): freezes the CURRENT stored-value money
// columns before CostCodes.tsx is migrated to compute-on-read (13.B1.5). AG Grid virtualizes
// off-screen columns — they don't exist in the DOM at all until scrolled into view, and some
// columns render with non-semantic auto-generated col-ids, which makes scroll-and-read-text
// assertions unreliable. Instead this reads exact values via the AG Grid API, exposed on
// window.__costCodesGridApi only when VITE_ADAPTER=memory (see CostCodes.tsx onGridReady) —
// never present in a real build.
//
// These numbers are the seeded stored values (src/platform/memory/MemoryAdapters.ts
// seedMemory), captured here by actually reading the live grid, not assumed. Once 13.B1.5
// flips CostCodes.tsx to useCostCodeRollups, this same test must still pass unchanged — the
// domain math in src/domain/rollups.ts was cross-checked to produce identical values against
// this exact seed data (see src/domain/rollups.test.ts).
test('cost codes show correct money values (frozen before compute-on-read migration)', async ({ appPage }) => {
  await appPage.goto('/project/demo-project/cost');
  await expect(appPage.getByText(/Substructure/i).first()).toBeVisible({ timeout: 20000 });

  const readRow = (rowId: string) => appPage.evaluate((id) => {
    const api = (window as unknown as { __costCodesGridApi?: any }).__costCodesGridApi;
    const rowNode = api?.getRowNode(id);
    if (!rowNode) return null;
    const get = (colKey: string) => api.getCellValue({ rowNode, colKey });
    return {
      baselineBudget: get('baselineBudget'),
      approvedBudget: get('approvedBudget'),
      actualCostToDate: get('actualCostToDate'),
      estimateAtCompletion: get('estimateAtCompletion'),
    };
  }, rowId);

  const substructure = await readRow('cc-100');
  expect(substructure).toEqual({
    baselineBudget: 500_000,
    approvedBudget: 550_000, // baseline 500k + 50k approved change
    actualCostToDate: 200_000,
    estimateAtCompletion: 500_000, // eacMethod: Manual — stored value passes through
  });
  expect(substructure!.approvedBudget - substructure!.estimateAtCompletion).toBe(50_000); // variance

  const superstructure = await readRow('cc-200');
  expect(superstructure).toEqual({
    baselineBudget: 400_000,
    approvedBudget: 400_000, // no approved changes
    actualCostToDate: 100_000,
    estimateAtCompletion: 350_000, // eacMethod: Manual
  });
  expect(superstructure!.approvedBudget - superstructure!.estimateAtCompletion).toBe(50_000); // variance
});
