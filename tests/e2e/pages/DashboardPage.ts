import type { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  get enterpriseSelector() {
    return this.page.locator('[class*="enterprise"], [data-testid="enterprise-selector"]').first();
  }

  get projectList() {
    return this.page.locator('[class*="project"], [data-testid="project-list"]');
  }

  get sidebar() {
    return this.page.locator('nav, aside').first();
  }

  async navigateToEnterpriseAdmin() {
    await this.page.goto('/enterprise-admin');
  }
}
