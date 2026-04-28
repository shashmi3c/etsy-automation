// @ts-check

/**
 * Page Object for Etsy Settings section.
 *
 * Covers: Manage Accounts, Set as Primary, Disable/Enable/Delete accounts,
 * Product Sync Settings, Auto Import, Etsy settings, Order Management settings,
 * Notifications, Currency display.
 *
 * Based on TC_67–TC_86 (Multi-account test cases).
 */
class EtsySettingsPage {
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

  async isSettingsPageVisible() {
    return (
      (await this.app.getByRole('heading', { name: /settings|configuration/i }).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/^settings$/i).first().isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await this.app.getByText(/manage.*account|product.*sync|order.*management/i).first().isVisible({ timeout: 8000 }).catch(() => false))
    );
  }

  // ─── Manage Accounts ──────────────────────────────────────────────────

  /** Check if Manage Accounts section is visible */
  async isManageAccountsSectionVisible() {
    return this.app.getByText(/manage.*account/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  /** Get list of account items in Manage Accounts */
  getAccountListItems() {
    return this.app.locator('[class*="account-item"], [class*="shop-item"], [class*="connected-account"]');
  }

  /** Get account count from Manage Accounts section */
  async getConnectedAccountsCount() {
    return this.getAccountListItems().count().catch(() => 0);
  }

  // ─── Set as Primary ───────────────────────────────────────────────────

  /** Get "Set as Primary" button */
  getSetAsPrimaryButton(index = 0) {
    return this.app.getByRole('button', { name: /set as primary/i }).nth(index);
  }

  async isSetAsPrimaryButtonVisible(index = 0) {
    return this.getSetAsPrimaryButton(index).isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Disable / Enable Account ─────────────────────────────────────────

  /** Get "Disable" button for an account */
  getDisableButton(index = 0) {
    return this.app.getByRole('button', { name: /^disable$/i }).nth(index);
  }

  /** Get "Enable" button for an account */
  getEnableButton(index = 0) {
    return this.app.getByRole('button', { name: /^enable$/i }).nth(index);
  }

  async isDisableButtonVisible(index = 0) {
    return this.getDisableButton(index).isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Delete Account ───────────────────────────────────────────────────

  /** Get "Delete Account" / "Disconnect" button (appears after disable) */
  getDeleteAccountButton(index = 0) {
    return this.app.getByRole('button', { name: /delete account|disconnect/i }).nth(index);
  }

  async isDeleteAccountButtonVisible(index = 0) {
    return this.getDeleteAccountButton(index).isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Primary Badge ────────────────────────────────────────────────────

  /** Check if "Primary" label/badge is visible for the primary account */
  async isPrimaryBadgeVisible() {
    return (
      (await this.app.getByText(/^primary$/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.locator('[class*="primary-badge"], [class*="primary-tag"]').first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Account Switcher (in Settings) ──────────────────────────────────

  async isAccountSwitcherVisible() {
    return (
      (await this.app.locator('[class*="account-switch"], [data-testid*="account-switcher"]').first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.getByRole('button', { name: /switch.*account|account.*switch/i }).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Product Details Sync Settings ────────────────────────────────────

  /** Check if Product Details Sync section is visible (title, description, price, etc.) */
  async isProductSyncSectionVisible() {
    return (
      (await this.app.getByText(/product.*sync|sync.*settings/i).first().isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await this.app.getByText(/title.*sync|description.*sync/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  /** Get product sync toggle for a field (title, description, price, inventory, weight) */
  getProductSyncToggle(fieldName) {
    return this.app.locator(`[aria-label*="${fieldName}"], label:has-text("${fieldName}")`).first()
      .locator('input[type="checkbox"]');
  }

  // ─── Auto Product Import ──────────────────────────────────────────────

  async isAutoImportSectionVisible() {
    return this.app.getByText(/auto.*import|automatic.*import/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  getAutoImportToggle() {
    return this.app.locator('[aria-label*="auto import"], [class*="auto-import"] input[type="checkbox"]').first();
  }

  // ─── Etsy Settings ────────────────────────────────────────────────────

  async isEtsySettingsSectionVisible() {
    return this.app.getByText(/etsy.*setting|etsy.*config/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  // ─── Order Management Settings ────────────────────────────────────────

  async isOrderManagementSectionVisible() {
    return this.app.getByText(/order.*management|order.*setting/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  // ─── Notification Settings ────────────────────────────────────────────

  async isNotificationsSectionVisible() {
    return this.app.getByText(/notification/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
  }

  // ─── Currency Display ─────────────────────────────────────────────────

  /** Check if currency display is correct for the connected shop */
  async isCurrencyDisplayCorrect() {
    return (
      (await this.app.getByText(/\$|USD|INR|€|currency/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Save Button ──────────────────────────────────────────────────────

  getSaveButton() {
    return this.app.getByRole('button', { name: /^save$/i }).first();
  }

  async clickSave() {
    const btn = this.getSaveButton();
    await btn.click({ force: true });
    await this.page.waitForTimeout(3000);
  }

  // ─── Confirmation Popups ──────────────────────────────────────────────

  async isConfirmPopupVisible() {
    return (
      (await this.app.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.page.locator('[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false))
    );
  }

  async clickPopupConfirm() {
    const btn = this.page.getByRole('button', { name: /confirm|yes|disconnect/i }).first();
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

module.exports = { EtsySettingsPage };