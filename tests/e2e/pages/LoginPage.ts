import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async clickSignIn() {
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async fillCredentials(email: string, password: string) {
    await this.page.getByPlaceholder('colleague@company.com').fill(email);
    await this.page.getByPlaceholder('••••••••').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: /^sign in$/i }).click();
  }

  async signIn(email: string, password: string) {
    await this.goto();
    await this.clickSignIn();
    await this.fillCredentials(email, password);
    await this.submit();
  }

  get errorMessage() {
    return this.page.locator('.bg-amber-50');
  }
}
