// @ts-check

/**
 * Page Object for the Etsy App Activities page (/panel/activity).
 *
 * Based on confirmed HTML structure from live app inspection:
 * - Notification items: .notification-item
 * - Activity heading/type text: .activity-heading
 * - Delete button: button[aria-label="Delete Activity"]
 * - Page heading: text matching /^activity$/i or /notifications/i
 * - "All Activities" navigation button: button[aria-label="View All Activities"]
 */
class ActivitiesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.app = page;
  }

  // ─── Frame Resolution ──────────────────────────────────────────────────

  async resolveAppContext() {
    await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    let appFrame = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      appFrame = this.page.frames().find(f => f.url().includes('cifapps.com'));
      if (appFrame) break;
      await this.page.waitForTimeout(2000);
    }

    if (appFrame) {
      this.app = appFrame;
      await appFrame.waitForSelector(
        '.Polaris-Page, .Polaris-Button, [class*="Polaris"], .notification-item',
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

  /** Dismiss overlays: Shopify modals, driver.js tour, backdrops */
  async dismissOverlays() {
    const page = this.page;

    for (let i = 0; i < 3; i++) {
      try {
        const closeBtn = page.locator('#PolarisPortalsContainer button[aria-label="Close"], button[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await closeBtn.click({ force: true });
          await page.waitForTimeout(1000);
        } else break;
      } catch { break; }
    }

    try {
      if (await page.locator('[class*="Backdrop"]').first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    } catch {}

    const frames = page.frames();
    const appFrame = frames.find(f => f.url().includes('cifapps.com'));
    if (appFrame) {
      try {
        const skipBtn = appFrame.locator('.skip-btn').first();
        if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipBtn.click({ force: true });
          await page.waitForTimeout(1000);
        }
        await appFrame.evaluate(() => {
          document.body.classList.remove('driver-active', 'driver-fade');
          document.body.style.pointerEvents = 'auto';
          document.querySelectorAll('.driver-overlay, .driver-popover, .driver-active-element').forEach(el => el.remove());
        }).catch(() => {});
      } catch {}
    }

    await this.resolveAppContext();
  }

  // ─── Page Visibility ──────────────────────────────────────────────────

  /**
   * Check if the Activities page has loaded.
   * Matches the page heading "Activity" or "Notifications" section.
   */
  async isActivitiesPageVisible() {
    return (
      (await this.app.getByText(/^activity$/i).first().isVisible({ timeout: 15000 }).catch(() => false)) ||
      (await this.app.getByText(/notifications/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.locator('.notification-item').first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Activity Items ───────────────────────────────────────────────────

  /** Count all .notification-item elements on the page */
  async getActivityItemsCount() {
    return this.app.locator('.notification-item').count().catch(() => 0);
  }

  /** Check if at least one activity item is visible */
  async hasActivityItems() {
    const count = await this.getActivityItemsCount();
    return count > 0;
  }

  /** Get all activity item locators */
  getActivityItems() {
    return this.app.locator('.notification-item');
  }

  /**
   * Get the text content of all visible activity headings.
   * Returns an array of strings, each being one activity's heading text.
   */
  async getActivityHeadingTexts() {
    return this.app.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('.activity-heading'));
      return headings.map(h => (h.innerText || h.textContent || '').trim()).filter(Boolean);
    }).catch(() => []);
  }

  /**
   * Get full text content of the first activity item.
   */
  async getFirstActivityText() {
    return this.app.locator('.notification-item').first().innerText().catch(() => '');
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────

  /** General tab — data-testid: activities.tab[general] */
  getTabGeneral() {
    return this.app.getByTestId('activities.tab[general]')
      .or(this.app.getByRole('tab', { name: /^general$/i })).first();
  }

  /** Announcements tab — data-testid: activities.tab[announcements] */
  getTabAnnouncements() {
    return this.app.getByTestId('activities.tab[announcements]')
      .or(this.app.getByRole('tab', { name: /announcements/i })).first();
  }

  /** Click a named tab ('general' or 'announcements') */
  async clickTab(tabName) {
    const tab = tabName.toLowerCase() === 'announcements'
      ? this.getTabAnnouncements()
      : this.getTabGeneral();
    if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab.click({ force: true });
      await this.page.waitForTimeout(1000);
    }
  }

  // ─── Notifications Popover ────────────────────────────────────────────

  /** Bell/notifications popover open button — data-testid: notifications.popover.open */
  getNotificationsPopoverButton() {
    return this.app.getByTestId('notifications.popover.open')
      .or(this.app.getByRole('button', { name: /notification|bell/i })).first();
  }

  // ─── Clear All ────────────────────────────────────────────────────────

  /** Clear All button — data-testid: activities.clear-all */
  getClearAllButton() {
    return this.app.getByTestId('activities.clear-all')
      .or(this.app.getByRole('button', { name: /clear all/i })).first();
  }

  async clickClearAll() {
    const btn = this.getClearAllButton();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(1500);
      return true;
    }
    return false;
  }

  // ─── Per-Row Actions ──────────────────────────────────────────────────

  /**
   * Abort button for a specific activity row.
   * data-testid: activities.row[${activityId}].abort
   * Falls back to the first generic abort/delete button when activityId is unknown.
   */
  getActivityAbortButton(activityId) {
    if (activityId != null) {
      return this.app.getByTestId(`activities.row[${activityId}].abort`)
        .or(this.app.getByRole('button', { name: /abort|stop/i }).first()).first();
    }
    return this.app.locator('[data-testid*="activities.row"][data-testid$=".abort"]').first()
      .or(this.app.getByRole('button', { name: /abort|stop|delete activity/i }).first()).first();
  }

  /**
   * Dismiss button for a specific activity row.
   * data-testid: activities.row[${activityId}].dismiss
   */
  getActivityDismissButton(activityId) {
    if (activityId != null) {
      return this.app.getByTestId(`activities.row[${activityId}].dismiss`)
        .or(this.app.getByRole('button', { name: /dismiss|delete activity/i }).first()).first();
    }
    // null: find the first actual delete button inside a notification row (not a wrapper div)
    return this.app.locator('.notification-item')
      .getByRole('button', { name: /dismiss|delete activity/i }).first();
  }

  /**
   * Detail link for a specific activity row.
   * data-testid: activities.row[${activityId}].link
   */
  getActivityLink(activityId) {
    if (activityId != null) {
      return this.app.getByTestId(`activities.row[${activityId}].link`)
        .or(this.app.getByRole('link').nth(0)).first();
    }
    return this.app.locator('[data-testid*="activities.row"][data-testid$=".link"]').first();
  }

  // ─── Legacy wrappers (keep existing callers working) ─────────────────

  /** First dismiss/delete button — delegates to getActivityDismissButton */
  getFirstDeleteButton() {
    return this.getActivityDismissButton(null);
  }

  /** All dismiss buttons — one per .notification-item row */
  getAllDeleteButtons() {
    return this.app.locator('.notification-item').getByRole('button', { name: /dismiss|delete activity/i });
  }

  async deleteFirstActivity() {
    const btn = this.getFirstDeleteButton();
    if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await btn.click({ force: true });
      return true;
    }
    return false;
  }

  async deleteAllActivities() {
    let deleted = 0;
    for (let i = 0; i < 50; i++) {
      const btn = this.getFirstDeleteButton();
      if (!await btn.isVisible({ timeout: 3000 }).catch(() => false)) break;
      await btn.click({ force: true });
      await this.page.waitForTimeout(1500);
      deleted++;
    }
    return deleted;
  }

  // ─── Abort Modal ──────────────────────────────────────────────────────

  /** Abort confirmation input field — data-testid: activities.abort-modal.input */
  getAbortModalInput() {
    return this.app.getByTestId('activities.abort-modal.input')
      .or(this.app.locator('[role="dialog"] input').first()).first();
  }

  /** Abort modal confirm — data-testid: activities.abort-modal.footer.abort */
  getAbortModalConfirm() {
    return this.app.getByTestId('activities.abort-modal.footer.abort')
      .or(this.page.getByTestId('activities.abort-modal.footer.abort'))
      .or(this.page.getByRole('button', { name: /^abort$/i })).first();
  }

  /** Abort modal cancel — data-testid: activities.abort-modal.footer.cancel */
  getAbortModalCancel() {
    return this.app.getByTestId('activities.abort-modal.footer.cancel')
      .or(this.page.getByTestId('activities.abort-modal.footer.cancel'))
      .or(this.page.getByRole('button', { name: /^cancel$/i })).first();
  }

  async clickAbortModalConfirm() {
    const btn = this.getAbortModalConfirm();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(2000);
    }
  }

  async clickAbortModalCancel() {
    const btn = this.getAbortModalCancel();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(1000);
    }
  }

  // ─── Empty State ──────────────────────────────────────────────────────

  /**
   * Check if the empty state message is visible (no activities).
   * Matches common empty-state texts used in the app.
   */
  async isEmptyStateVisible() {
    return (
      (await this.app.getByText(/no activities/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.getByText(/no notifications/i).first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.app.getByText(/no recent activity/i).first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.app.getByText(/nothing here/i).first().isVisible({ timeout: 3000 }).catch(() => false))
    );
  }

  // ─── Load More / Pagination ───────────────────────────────────────────

  /** "Load more" or pagination button if the activity list is paginated */
  getLoadMoreButton() {
    return this.app.getByRole('button', { name: /load more|show more|next page/i }).first();
  }

  async isLoadMoreVisible() {
    return this.getLoadMoreButton().isVisible({ timeout: 3000 }).catch(() => false);
  }

  // ─── Activity Type Checks ──────────────────────────────────────────────

  /**
   * Check whether any activity of the given type keyword is visible.
   * @param {string|RegExp} typePattern — e.g. 'publish product', /sync/i
   */
  async isActivityTypeVisible(typePattern) {
    const re = typeof typePattern === 'string' ? new RegExp(typePattern, 'i') : typePattern;
    return this.app.getByText(re).first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Store Switcher ───────────────────────────────────────────────────

  /**
   * Poll page frames until the cifapps iframe has real content and no loading screen.
   * Sets `this.app` to the ready frame.
   * @param {number} ms - Max wait in milliseconds
   */
  async _awaitCifappsReady(ms = 30000) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const frames = this.page.frames();
      for (const frame of frames) {
        if (!frame.url().includes('cifapps.com')) continue;
        try {
          const html = await frame.content();
          if (html.length > 500 && !/Just a moment/i.test(html)) {
            this.app = frame;
            return frame;
          }
        } catch {}
      }
      await this.page.waitForTimeout(1000);
    }
    return null;
  }

  /**
   * Detect which store is currently active and return its name string.
   * Returns null if no known store button is found.
   * @returns {Promise<string|null>}
   */
  async getActiveStoreName() {
    for (const name of [/testworkindia/i, /gojosatoruboutique/i]) {
      const btn = this.app.getByRole('button', { name }).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        return (await btn.innerText().catch(() => '')).trim();
      }
    }
    return null;
  }

  /**
   * Ensure the active store is TestworkIndia. If GojosatoruBoutique is currently
   * active, switch back to TestworkIndia before proceeding.
   * @returns {Promise<boolean>} true if TestworkIndia is now active
   */
  async ensureTestworkIndiaActive() {
    const twiBtn = this.app.getByRole('button', { name: /testworkindia/i }).first();
    if (await twiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      return true; // already on TestworkIndia
    }
    // GojosatoruBoutique must be active — switch back
    const switched = await this.clickStoreSwitcher(/gojosatoruboutique/i);
    if (!switched) return false;
    const selected = await this.selectStoreFromDropdown(/testworkindia/i);
    if (!selected) return false;
    await this._awaitCifappsReady(30000);
    await this.resolveAppContext();
    await this.page.waitForTimeout(2000);
    return this.app.getByRole('button', { name: /testworkindia/i }).first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * Click the store/account switcher button in the cifapps iframe header.
   * @param {string|RegExp} currentStorePattern - Matches the active store name on the button
   * @returns {Promise<boolean>}
   */
  async clickStoreSwitcher(currentStorePattern) {
    const btn = this.app.getByRole('button', { name: currentStorePattern }).first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(1000);
      return true;
    }
    return false;
  }

  /**
   * Click a store option in the open switcher dropdown.
   * @param {string|RegExp} storeNamePattern
   * @returns {Promise<boolean>}
   */
  async selectStoreFromDropdown(storeNamePattern) {
    const option = this.app.getByText(storeNamePattern).first();
    if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
      await option.click({ force: true });
      return true;
    }
    return false;
  }

  // ─── Navigation ───────────────────────────────────────────────────────

  /** Build the Activities page URL from a base app URL */
  static buildActivityUrl(baseUrl) {
    return baseUrl.replace(/panel\/.*$/, 'panel/activity');
  }
}

module.exports = { ActivitiesPage };
