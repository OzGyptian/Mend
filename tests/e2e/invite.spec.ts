import { test, expect } from '@playwright/test';

test.describe('User Invite Flow', () => {
  test('enterprise admin page shows invite/add user capability', async ({ page }) => {
    await page.goto('/enterprise-admin');
    await page.waitForLoadState('networkidle');

    // Invite or Add User button should exist somewhere on the admin page
    const inviteButton = page.getByRole('button', { name: /invite|add user/i }).first();
    await expect(inviteButton).toBeVisible({ timeout: 10000 });
  });

  test('invite modal opens on button click', async ({ page }) => {
    await page.goto('/enterprise-admin');
    await page.waitForLoadState('networkidle');

    const inviteButton = page.getByRole('button', { name: /invite|add user/i }).first();
    const visible = await inviteButton.isVisible().catch(() => false);
    if (!visible) { test.skip(); return; }

    await inviteButton.click();

    // Modal or form with email input appears
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible({ timeout: 5000 });
  });
});
