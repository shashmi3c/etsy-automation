// @ts-check

class ShopifyLoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.emailField = page.locator('input[type="email"]').first();
    this.passwordField = page.locator('input[type="password"]').first();
  }

  /** @param {string} url */
  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  }

  async isLoginFormVisible() {
    return (
      (await this.page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await this.page.getByText('Continue to Shopify').isVisible().catch(() => false)) ||
      (await this.page.locator('input[type="email"]').first().isVisible({ timeout: 3000 }).catch(() => false))
    );
  }

  /**
   * Shopify login flow (2 steps):
   *   1. Fill email → click "Continue with email"
   *   2. Fill password → click "Log in"
   *
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    // Step 1: Fill email and click "Continue with email"
    await this.emailField.waitFor({ state: 'visible', timeout: 15000 });
    await this.emailField.fill(email);

    await this.page
      .getByRole('button', { name: /continue with email/i })
      .first()
      .click();

    // Step 2: Fill password and click "Log in"
    await this.passwordField.waitFor({ state: 'visible', timeout: 15000 });
    await this.passwordField.fill(password);

    await this.page
      .getByRole('button', { name: /^log in$/i })
      .first()
      .click();

    await this.page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  }

  async isStillOnLogin() {
    return this.isLoginFormVisible();
  }
}

module.exports = { ShopifyLoginPage };
