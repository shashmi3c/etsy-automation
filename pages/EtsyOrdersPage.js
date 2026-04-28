// @ts-check

/**
 * Page Object for Etsy Orders section.
 *
 * Covers: All orders grid, columns (Order Value, Status, SKU, Created At),
 * multi-select checkboxes, search/filter, Bulk Fetch, Single Fetch,
 * Create Order, CSV Export, Carrier Mapping, Order Add-on.
 *
 * Based on TC_87–TC_138 (Multi-account test cases).
 */
class EtsyOrdersPage {
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

  async isOrdersPageVisible() {
    return (
      (await this.app.getByRole('heading', { name: /orders/i }).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/^orders$/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  // ─── Order Grid Columns ───────────────────────────────────────────────

  async isOrderValueColumnVisible() {
    return this.app.getByText(/order value|order amount/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  async isStatusColumnVisible() {
    return this.app.getByText(/^status$/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  async isOrderSkuColumnVisible() {
    return this.app.getByText(/order sku|sku/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  async isCreatedAtColumnVisible() {
    return this.app.getByText(/created at|created on/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  getOrderRows() {
    return this.app.locator('table tbody tr, [class*="IndexTable"] tr[class*="Row"], [class*="order-row"]');
  }

  async getOrderRowCount() {
    return this.getOrderRows().count().catch(() => 0);
  }

  // ─── Checkboxes ───────────────────────────────────────────────────────

  getOrderCheckbox(index) {
    return this.app.locator('input[type="checkbox"]').nth(index);
  }

  async selectAllOrders() {
    const selectAll = this.app.locator('input[type="checkbox"]').first();
    if (await selectAll.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectAll.click({ force: true });
      await this.page.waitForTimeout(1000);
    }
  }

  // ─── Search ───────────────────────────────────────────────────────────

  /** Search input — by Etsy receipt ID, Shopify Order ID, order name, or customer */
  getSearchInput() {
    return this.app.getByPlaceholder(/search.*order|receipt.*id|order.*id/i).first()
      .or(this.app.getByRole('searchbox').first());
  }

  async searchByReceiptId(receiptId) {
    const input = this.getSearchInput();
    await input.fill(receiptId);
    await this.page.waitForTimeout(2000);
  }

  async searchByShopifyOrderId(orderId) {
    const input = this.getSearchInput();
    await input.fill(orderId);
    await this.page.waitForTimeout(2000);
  }

  // ─── Filters ─────────────────────────────────────────────────────────

  getStatusFilter() {
    return this.app.getByRole('button', { name: /filter.*status|order.*status|status/i }).first();
  }

  async filterByOrderStatus(status) {
    const filterBtn = this.getStatusFilter();
    if (await filterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterBtn.click({ force: true });
      await this.page.waitForTimeout(1000);
      await this.app.getByText(new RegExp(status, 'i')).first().click({ force: true });
      await this.page.waitForTimeout(2000);
    }
  }

  getDateFilter() {
    return this.app.getByRole('button', { name: /date|created at|calendar/i }).first();
  }

  getCustomerFilter() {
    return this.app.getByPlaceholder(/customer.*name|search.*customer/i).first();
  }

  // ─── Bulk Fetch ───────────────────────────────────────────────────────

  getBulkFetchButton() {
    return this.app.getByRole('button', { name: /bulk.*fetch|fetch.*orders.*bulk|fetch in bulk/i }).first();
  }

  async isBulkFetchButtonVisible() {
    return this.getBulkFetchButton().isVisible({ timeout: 8000 }).catch(() => false);
  }

  // ─── Single Fetch ─────────────────────────────────────────────────────

  getSingleFetchButton() {
    return this.app.getByRole('button', { name: /single.*fetch|fetch.*order|fetch.*receipt/i }).first();
  }

  async isSingleFetchButtonVisible() {
    return this.getSingleFetchButton().isVisible({ timeout: 8000 }).catch(() => false);
  }

  /** Get the single fetch input (receipt ID) */
  getSingleFetchInput() {
    return this.app.getByPlaceholder(/receipt.*id|enter.*receipt/i).first();
  }

  async isSingleFetchPopupVisible() {
    return (
      (await this.app.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.page.locator('[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false))
    );
  }

  // ─── Calendar ─────────────────────────────────────────────────────────

  async isCalendarVisible() {
    return (
      (await this.app.locator('[class*="calendar"], [class*="datepicker"]').first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.getByRole('dialog', { name: /date|calendar/i }).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Create Order ─────────────────────────────────────────────────────

  getCreateOrderButton() {
    return this.app.getByRole('button', { name: /create.*order|create.*shopify.*order/i }).first();
  }

  // ─── CSV Export ───────────────────────────────────────────────────────

  getCsvExportButton() {
    return this.app.getByRole('button', { name: /export.*csv|download.*csv/i }).first();
  }

  async isCsvExportButtonVisible() {
    return this.getCsvExportButton().isVisible({ timeout: 8000 }).catch(() => false);
  }

  // ─── Carrier Mapping ──────────────────────────────────────────────────

  async isCarrierMappingVisible() {
    return (
      (await this.app.getByText(/carrier.*mapping|carrier.*map/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  getAddCarrierMappingButton() {
    return this.app.getByRole('button', { name: /add.*carrier|add.*mapping/i }).first();
  }

  // ─── Order Add-on ─────────────────────────────────────────────────────

  async isOrderAddonVisible() {
    return (
      (await this.app.getByText(/order.*add.?on/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  getOrderAddonToggle() {
    return this.app.locator('[aria-label*="order add-on"], [class*="order-addon"] input[type="checkbox"]').first();
  }

  // ─── Popups ───────────────────────────────────────────────────────────

  async clickPopupConfirm() {
    const btn = this.page.getByRole('button', { name: /confirm|yes|submit/i }).first();
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

module.exports = { EtsyOrdersPage };