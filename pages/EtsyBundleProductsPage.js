// @ts-check

/**
 * Page Object for Etsy Bundle Products section.
 *
 * Covers: Single/batch import, product grid, bundle details,
 * order creation, inventory handling, pricing, sync updates,
 * cart & checkout, returns & refunds, order management, UI validation.
 *
 * Based on BP-001–BP-059 (Bundle Products test cases).
 */
class EtsyBundleProductsPage {
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

  async isBundlePageVisible() {
    return (
      (await this.app.getByRole('heading', { name: /bundle/i }).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/bundle product|bundle.*listing/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  // ─── Import Actions ───────────────────────────────────────────────────

  getSingleImportButton() {
    return this.app.getByRole('button', { name: /single.*import|import.*single/i }).first();
  }

  getBatchImportButton() {
    return this.app.getByRole('button', { name: /batch.*import|bulk.*import/i }).first();
  }

  getCsvImportButton() {
    return this.app.getByRole('button', { name: /import.*csv|csv.*import/i }).first();
  }

  // ─── Bundle Grid ──────────────────────────────────────────────────────

  getBundleRows() {
    return this.app.locator('table tbody tr, [class*="IndexTable"] tr[class*="Row"], [class*="bundle-row"]');
  }

  async getBundleRowCount() {
    return this.getBundleRows().count().catch(() => 0);
  }

  getSearchInput() {
    return this.app.getByPlaceholder(/search.*bundle|search.*product/i).first()
      .or(this.app.getByRole('searchbox').first());
  }

  async searchBundle(query) {
    const input = this.getSearchInput();
    await input.fill(query);
    await this.page.waitForTimeout(2000);
  }

  // ─── Bundle Details ───────────────────────────────────────────────────

  /** Click bundle row to view details */
  async clickBundleRow(index) {
    const row = this.getBundleRows().nth(index);
    await row.click({ force: true });
    await this.page.waitForTimeout(2000);
    await this.resolveAppContext();
  }

  async isBundleDetailsVisible() {
    return (
      (await this.app.getByText(/bundle.*component|child.*product|component.*sku/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  // ─── Filters ─────────────────────────────────────────────────────────

  getStatusFilter() {
    return this.app.getByRole('button', { name: /filter|status/i }).first();
  }

  getPriceSortButton() {
    return this.app.getByRole('button', { name: /sort.*price|price.*sort/i }).first();
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  getDeleteButton(index = 0) {
    return this.app.getByRole('button', { name: /delete/i }).nth(index);
  }

  // ─── Confirmation Popups ──────────────────────────────────────────────

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

  // ─── Success / Error Toasts ───────────────────────────────────────────

  async isSuccessToastVisible() {
    return (
      (await this.app.getByText(/success|imported|created/i).first().isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await this.page.getByText(/success|imported|created/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  async isErrorToastVisible() {
    return (
      (await this.app.getByText(/error|failed|invalid/i).first().isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await this.page.getByText(/error|failed|invalid/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }
}

module.exports = { EtsyBundleProductsPage };