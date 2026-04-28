// @ts-check

/**
 * Page Object for Etsy Pricing / Plans section.
 *
 * Covers: Plan display, Upgrade/Downgrade, product/listing limits,
 * billing, plan expiry, plan renewal, feature access.
 *
 * Based on TC_139–TC_153 (Multi-account test cases).
 */
class EtsyPricingPage {
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

  // ─── Page Visibility ──────────────────────────────────────────────────

  async isPricingPageVisible() {
    return (
      (await this.app.getByRole('heading', { name: /pricing|plan/i }).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/active plan|current plan|pricing plan|upgrade plan/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  // ─── Plan Information ─────────────────────────────────────────────────

  /** Check if active plan details are displayed */
  async isActivePlanVisible() {
    return (
      (await this.app.getByText(/active plan|current plan/i).first().isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await this.app.getByText(/plan.*amount|plan.*status|billing.*date/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  async isPlanAmountVisible() {
    return this.app.getByText(/\$|plan.*amount|monthly.*fee/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isPlanStatusVisible() {
    return this.app.getByText(/plan.*status|active|expired|trial/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isBillingDateVisible() {
    return this.app.getByText(/billing.*date|next.*billing|renewal.*date/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isOrderLimitVisible() {
    return this.app.getByText(/order.*limit|monthly.*order/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isListingLimitVisible() {
    return this.app.getByText(/listing.*limit|product.*limit|manage.*listing/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Plan Tiers / Grid ────────────────────────────────────────────────

  getPlanCards() {
    return this.app.locator('[class*="plan-card"], [class*="pricing-card"], [class*="plan-tier"]');
  }

  async getPlanCount() {
    return this.getPlanCards().count().catch(() => 0);
  }

  // ─── Upgrade / Downgrade ─────────────────────────────────────────────

  getUpgradePlanButton() {
    return this.app.getByRole('button', { name: /upgrade.*plan|upgrade/i }).first();
  }

  getDowngradePlanButton() {
    return this.app.getByRole('button', { name: /downgrade.*plan|downgrade/i }).first();
  }

  getSelectPlanButton(index = 0) {
    return this.app.getByRole('button', { name: /select plan|subscribe|get started|choose/i }).nth(index);
  }

  // ─── Cancel Subscription ──────────────────────────────────────────────

  getCancelSubscriptionButton() {
    return this.app.getByRole('button', { name: /cancel.*subscription|cancel.*plan/i }).first();
  }

  async isCancelButtonVisible() {
    return this.getCancelSubscriptionButton().isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Plan Expiry ──────────────────────────────────────────────────────

  async isExpiredPlanMessageVisible() {
    return (
      (await this.app.getByText(/plan.*expired|expired.*plan|subscription.*expired/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  getRenewButton() {
    return this.app.getByRole('button', { name: /renew|reactivate|re-subscribe/i }).first();
  }

  // ─── Confirmation ─────────────────────────────────────────────────────

  async isConfirmPopupVisible() {
    return (
      (await this.app.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.page.locator('[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false))
    );
  }

  async clickPopupConfirm() {
    const btn = this.page.getByRole('button', { name: /confirm|yes|proceed/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(2000);
    }
  }

  async clickPopupCancel() {
    const btn = this.page.getByRole('button', { name: /^cancel$/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(1000);
      return;
    }
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(1000);
  }
}

module.exports = { EtsyPricingPage };