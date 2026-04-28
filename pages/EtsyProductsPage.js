// @ts-check

/**
 * Page Object for Etsy Products / Listings section.
 *
 * Covers: product grid, switcher, import (single/batch), publish, delete,
 * profile assignment, bulk actions, filters, search, sync from Etsy,
 * CSV export/import, link/unlink, and account switcher.
 *
 * Based on TC_18–TC_40 (multi-account) and TC_001–TC_021 (Dashboard CSV products).
 */
class EtsyProductsPage {
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

  async isProductsPageVisible() {
    return (
      (await this.app.getByText(/^listings$|^products$/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByRole('heading', { name: /listings|products/i }).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Account Switcher ─────────────────────────────────────────────────

  async isAccountSwitcherVisible() {
    return (
      (await this.app.getByRole('button', { name: /switch.*account|account.*switcher/i }).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.locator('[data-testid*="account-switcher"], [class*="account-switch"]').first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  /** Get account switcher dropdown */
  getAccountSwitcher() {
    return this.app.locator('[data-testid*="account-switcher"], [class*="account-switch"], [aria-label*="account"]').first();
  }

  // ─── Product Grid ─────────────────────────────────────────────────────

  getProductRows() {
    return this.app.locator('table tbody tr, [class*="IndexTable"] tr[class*="Row"], [class*="product-row"]');
  }

  async getProductRowCount() {
    return this.getProductRows().count().catch(() => 0);
  }

  /** Get the product grid search input */
  getSearchInput() {
    return this.app.getByPlaceholder(/search.*product|search.*listing/i).first()
      .or(this.app.getByRole('searchbox').first());
  }

  async searchProduct(query) {
    const input = this.getSearchInput();
    await input.fill(query);
    await this.page.waitForTimeout(2000);
  }

  /** Get checkbox for product at index (for bulk selection) */
  getProductCheckbox(index) {
    return this.app.locator('input[type="checkbox"]').nth(index);
  }

  // ─── Import Actions ───────────────────────────────────────────────────

  /** Single product import button */
  getSingleImportButton() {
    return this.app.getByRole('button', { name: /single.*import|import.*product/i }).first();
  }

  /** Batch import button */
  getBatchImportButton() {
    return this.app.getByRole('button', { name: /batch.*import|bulk.*import/i }).first();
  }

  /** Import via CSV */
  getCsvImportButton() {
    return this.app.getByRole('button', { name: /import.*csv|csv.*import/i }).first();
  }

  // ─── Publish / Update Actions ─────────────────────────────────────────

  /** Get publish button for a product row by index */
  getPublishButton(index) {
    return this.app.getByRole('button', { name: /publish/i }).nth(index);
  }

  /** Bulk publish button */
  getBulkPublishButton() {
    return this.app.getByRole('button', { name: /publish.*selected|bulk.*publish/i }).first();
  }

  // ─── Assign Profile ───────────────────────────────────────────────────

  getAssignProfileButton(index) {
    return this.app.getByRole('button', { name: /assign.*profile/i }).nth(index);
  }

  // ─── Delete / Unlink ──────────────────────────────────────────────────

  getDeleteButton(index) {
    return this.app.getByRole('button', { name: /delete/i }).nth(index);
  }

  getUnlinkButton(index) {
    return this.app.getByRole('button', { name: /unlink/i }).nth(index);
  }

  // ─── Sync from Etsy ───────────────────────────────────────────────────

  getSyncFromEtsyButton() {
    return this.app.getByRole('button', { name: /sync.*etsy|sync.*from.*etsy/i }).first();
  }

  // ─── CSV Export ───────────────────────────────────────────────────────

  getCsvExportButton() {
    return this.app.getByRole('button', { name: /export.*csv|download.*csv/i }).first();
  }

  // ─── Filters ─────────────────────────────────────────────────────────

  /** Status filter (Active, Not Published, Not Profiled, Others) */
  getStatusFilter() {
    return this.app.getByRole('button', { name: /filter|status/i }).first();
  }

  async filterByStatus(status) {
    const filterBtn = this.getStatusFilter();
    if (await filterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterBtn.click({ force: true });
      await this.page.waitForTimeout(1000);
      await this.app.getByText(new RegExp(status, 'i')).first().click({ force: true });
      await this.page.waitForTimeout(2000);
    }
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────

  /** Get the "Delete from Shopify" tab */
  getDeleteFromShopifyTab() {
    return this.app.getByText(/delete.*from.*shopify/i).first();
  }

  /** Get "All Products" tab */
  getAllProductsTab() {
    return this.app.getByText(/all products|all listings/i).first();
  }

  // ─── Bulk Actions ─────────────────────────────────────────────────────

  async selectAllProducts() {
    const selectAll = this.app.locator('input[type="checkbox"]').first();
    if (await selectAll.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectAll.click({ force: true });
      await this.page.waitForTimeout(1000);
    }
  }

  getBulkActionsMenu() {
    return this.app.getByRole('button', { name: /bulk.*action|more.*actions|actions/i }).first();
  }

  // ─── Create Profile from Grid ─────────────────────────────────────────

  getCreateProfileFromGridButton() {
    return this.app.getByRole('button', { name: /create.*profile/i }).first();
  }

  // ─── Confirmation Popups ──────────────────────────────────────────────

  async isConfirmPopupVisible() {
    return (
      (await this.app.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.page.locator('[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false))
    );
  }

  async clickPopupConfirm() {
    const mainConfirm = this.page.getByRole('button', { name: /^confirm$/i }).first();
    if (await mainConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mainConfirm.click({ force: true });
      await this.page.waitForTimeout(2000);
      return;
    }
    const mainPrimary = this.page.locator('[class*="Modal"] button[class*="primary"]').first();
    if (await mainPrimary.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mainPrimary.click({ force: true });
      await this.page.waitForTimeout(2000);
    }
  }

  async clickPopupCancel() {
    const cancelBtn = this.page.getByRole('button', { name: /^cancel$/i }).first();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click({ force: true });
      await this.page.waitForTimeout(1000);
      return;
    }
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(1000);
  }
}

module.exports = { EtsyProductsPage };