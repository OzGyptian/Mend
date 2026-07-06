import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

// These tests run without stored auth state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Mend/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('sign in form is reachable from landing page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clickSignIn();

    await expect(page.getByPlaceholder('colleague@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clickSignIn();
    await loginPage.fillCredentials('notauser@fake.com', 'wrongpassword');
    await loginPage.submit();

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('register link toggles to create account form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /get started/i }).click();

    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });
});
