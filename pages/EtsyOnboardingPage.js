// @ts-check

/**
 * Page Object for Etsy Onboarding flow.
 *
 * Covers: first-time onboarding (payment + account connection + config),
 * adding a second account, connect/create Etsy store buttons.
 *
 * Based on TC_01–TC_10 (Multi-account test cases).
 */
class EtsyOnboardingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.app = page;
  }

  // ─── Frame Resolution ──────────────────────────────────────────────────

  async resolveAppContext() {
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const frames = this.page.frames();
    const appFrame = frames.find(f => f.url().includes('cifapps.com'));
    if (appFrame) {
      this.app = appFrame;
      await appFrame.waitForSelector(
        '.Polaris-Page, .Polaris-Button, [class*="Polaris"]',
        { timeout: 30000 }
      ).catch(() => {});
      await appFrame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    } else {
      this.app = this.page;
    }
    return this.app;
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.resolveAppContext();
  }

  // ─── Onboarding Steps ─────────────────────────────────────────────────

  /** Check if the payment/billing step is shown during first onboarding */
  async isPaymentStepVisible() {
    return (
      (await this.app.getByText(/payment|billing|subscribe|plan/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.page.getByText(/payment|billing|subscribe|plan/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  /** Check if the account connection step is shown */
  async isAccountConnectionStepVisible() {
    return (
      (await this.app.getByText(/connect.*etsy|etsy.*connect|connect.*store/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.page.getByText(/connect.*etsy|etsy.*connect/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  /** Check if the configuration step is visible */
  async isConfigStepVisible() {
    return (
      (await this.app.getByText(/config|configuration|settings|setup/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.page.getByText(/config|configuration/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  /** Get the "Connect Etsy Store" button */
  getConnectEtsyStoreButton() {
    return this.app.getByRole('button', { name: /connect.*etsy.*store|connect etsy/i }).first();
  }

  /** Get "Create Store" / "Create a store on Etsy" link */
  getCreateStoreLink() {
    return this.app.getByRole('link', { name: /create.*store|create.*shop/i }).first()
      .or(this.app.getByText(/create.*store|create.*shop/i).first());
  }

  /** Get "Add Account" button (visible in header/nav throughout app) */
  getAddAccountButton() {
    return this.app.getByRole('button', { name: /add account|add.*shop/i }).first();
  }

  /** Check if Add Account button is visible in the current section */
  async isAddAccountButtonVisible() {
    return this.app.getByRole('button', { name: /add account|add.*shop/i }).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Config Options ────────────────────────────────────────────────────

  /** Verify config section (title, description, price, inventory) checkboxes/toggles are present */
  async isConfigSyncOptionsVisible() {
    return (
      (await this.app.getByText(/title|description|price|inventory/i).first().isVisible({ timeout: 10000 }).catch(() => false))
    );
  }

  /** Check if the app dashboard section is visible (post-onboarding) */
  async isDashboardVisible() {
    return (
      (await this.app.getByText(/overview|dashboard/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/order analysis|product analysis/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Multi-Account Specific ────────────────────────────────────────────

  /** Check that second-account onboarding has NO pricing/payment step */
  async isOnboardingWithoutPricingStep() {
    const hasPayment = await this.isPaymentStepVisible();
    return !hasPayment;
  }

  /** Check account switcher is visible */
  async isAccountSwitcherVisible() {
    return (
      (await this.app.getByRole('button', { name: /switch.*account|account.*switcher/i }).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.locator('[data-testid*="account-switcher"], [aria-label*="account"], [class*="account-switch"]').first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }
}

module.exports = { EtsyOnboardingPage };