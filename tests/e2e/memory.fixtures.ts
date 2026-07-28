import { test as base, expect } from '@playwright/test';

export { expect };

// On the memory adapter the auth adapter auto-signs-in as dev@memory.local (verified),
// so the app boots straight into the authenticated shell with the seeded
// `demo-enterprise` / `demo-project` fixtures — no login step required.
// FAILURE LEGIBILITY (RCA 2026-07-28, remediation #2): when the app fails to boot, the
// old fixture waited 30s for <nav> and reported only "Timeout ... waiting for locator".
// The real cause (a page-level exception -- `supabaseUrl is required`) was visible only
// inside a downloadable trace artifact, so a hard, deterministic failure looked like
// flakiness and went unfixed for 10 days while it blocked every merge.
//
// Now page errors and console errors are captured, and if the shell never appears the
// assertion carries the actual exception. Diagnosis moves from "download the trace" to
// "read the CI log".
export const test = base.extend<{ appPage: typeof base.prototype.page }>({
  appPage: async ({ page }, use) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Authenticated shell: the sidebar nav renders once we're signed in.
    try {
      await page.locator('nav').first().waitFor({ timeout: 30000 });
    } catch (timeout) {
      const rootLength = await page
        .locator('#root')
        .innerHTML()
        .then((h) => String(h.length))
        .catch(() => 'unreadable');

      const detail = [
        'The app shell (<nav>) never rendered -- the app failed to boot.',
        pageErrors.length
          ? `PAGE ERRORS (almost certainly the cause):\n  - ${pageErrors.join('\n  - ')}`
          : 'No page errors captured.',
        consoleErrors.length
          ? `CONSOLE ERRORS:\n  - ${consoleErrors.slice(0, 5).join('\n  - ')}`
          : '',
        `#root innerHTML length: ${rootLength} (0 means React never mounted)`,
      ]
        .filter(Boolean)
        .join('\n');

      throw new Error(`${detail}\n\nOriginal: ${(timeout as Error).message}`);
    }

    await use(page);
  },
});
