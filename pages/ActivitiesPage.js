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

  // ─── Delete Actions ───────────────────────────────────────────────────

  /** First delete button on the Activities page */
  getFirstDeleteButton() {
    return this.app.getByRole('button', { name: /delete activity/i }).first();
  }

  /** All delete buttons on the Activities page */
  getAllDeleteButtons() {
    return this.app.getByRole('button', { name: /delete activity/i });
  }

  /**
   * Delete the first activity item and return true if the button was clicked.
   */
  async deleteFirstActivity() {
    const deleteBtn = this.getFirstDeleteButton();
    if (await deleteBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await deleteBtn.click({ force: true });
      return true;
    }
    return false;
  }

  /**
   * Delete all visible activities one by one.
   * Returns how many were deleted.
   */
  async deleteAllActivities() {
    let deleted = 0;
    for (let i = 0; i < 50; i++) {
      const btn = this.getFirstDeleteButton();
      const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (!visible) break;
      await btn.click({ force: true });
      await this.page.waitForTimeout(1500);
      deleted++;
    }
    return deleted;
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

  // ─── Navigation ───────────────────────────────────────────────────────

  /** Build the Activities page URL from a base app URL */
  static buildActivityUrl(baseUrl) {
    return baseUrl.replace(/panel\/.*$/, 'panel/activity');
  }
}

module.exports = { ActivitiesPage };
