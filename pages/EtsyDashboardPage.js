// @ts-check

/**
 * Page Object for Etsy Dashboard (Overview page).
 *
 * Based on actual app source code (Dashboard.tsx, PieAnalysisCard.tsx,
 * RecentActivities.tsx, Helper.tsx, Activities.tsx) and UI screenshot.
 *
 * Sections:
 * - Top Bar: New to the app? banner, Refresh Data, Language, Account switcher
 * - Order Analysis: Total Orders, pie chart, status badges, View All Orders
 * - Revenue: Total Revenue, date filter, line chart
 * - Product Analysis: Total Products, pie chart, status badges, View All Products
 * - Top Performing Products
 * - More Tips (video guides)
 * - Etsy Shop Status: shop link, status badge, metrics, Refresh
 * - Plan Overview: limits, billing date, View Plan Details
 * - Feedback: Good / Bad
 * - Reverse Sync banner
 * - Recent Activities: activity list, All Activities, Delete Activity
 */
class EtsyDashboardPage {
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

    // Retry finding the cifapps iframe up to 3 times with short delays
    let appFrame = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      appFrame = this.page.frames().find(f => f.url().includes('cifapps.com'));
      if (appFrame) break;
      await this.page.waitForTimeout(2000);
    }

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

  /** Navigate to activities page */
  async gotoActivities(baseUrl) {
    const activityUrl = baseUrl.replace(/panel\/.*$/, 'panel/activity');
    await this.page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.resolveAppContext();
  }

  /** Dismiss overlays: Shopify modals, driver.js tour, backdrops */
  async dismissOverlays() {
    const page = this.page;

    // Close any Polaris modals (e.g. "Need to Connect more than one Etsy Shop?")
    for (let i = 0; i < 5; i++) {
      try {
        const closeBtn = page.locator('#PolarisPortalsContainer button[aria-label="Close"], button[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeBtn.click({ force: true });
          await page.waitForTimeout(800);
        } else break;
      } catch { break; }
    }

    // Click "Skip" on every guide popup step until none remain (main page)
    for (let i = 0; i < 10; i++) {
      try {
        const skipBtn = page.getByRole('button', { name: 'Skip' }).first();
        if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipBtn.click({ force: true });
          await page.waitForTimeout(800);
        } else break;
      } catch { break; }
    }

    // Escape backdrop
    try {
      if (await page.locator('[class*="Backdrop"]').first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
      }
    } catch {}

    // Click "Skip" on every guide popup step inside the app iframe
    const frames = page.frames();
    const appFrame = frames.find(f => f.url().includes('cifapps.com'));
    if (appFrame) {
      try {
        for (let i = 0; i < 10; i++) {
          const skipBtn = appFrame.getByRole('button', { name: 'Skip' }).first();
          if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await skipBtn.click({ force: true });
            await page.waitForTimeout(800);
          } else break;
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

  /** Check if dashboard loaded */
  async isDashboardVisible() {
    return (
      (await this.app.getByText(/overview/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/order analysis/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.getByText(/product analysis/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  // ─── Top Bar ──────────────────────────────────────────────────────────

  /** "New to the app?" banner */
  async isNewAppBannerVisible() {
    return this.app.getByText(/new to the app/i).first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  /** Watch Guide button — data-testid: dashboard.banner-card[guide].watch */
  getWatchGuideButton() {
    return this.app.getByTestId('dashboard.banner-card[guide].watch')
      .or(this.app.getByRole('button', { name: /watch guide/i })).first();
  }

  /** Refresh Data button — data-testid: dashboard.refresh */
  getRefreshDataButton() {
    return this.app.getByTestId('dashboard.refresh')
      .or(this.app.getByRole('button', { name: /refresh data/i })).first();
  }

  /** Close guide banner — data-testid: dashboard.banner-card[guide].close */
  getGuideBannerClose() {
    return this.app.getByTestId('dashboard.banner-card[guide].close')
      .or(this.app.getByRole('button', { name: /close.*guide|dismiss.*guide/i })).first();
  }

  /** Migration banner CTA — data-testid: dashboard.banner-card[migration].action */
  getMigrationBannerCta() {
    return this.app.getByTestId('dashboard.banner-card[migration].action')
      .or(this.app.getByRole('button', { name: /migrate|start migration/i })).first();
  }

  /** Migration banner dismiss — data-testid: dashboard.banner-card[migration].dismiss */
  getMigrationBannerDismiss() {
    return this.app.getByTestId('dashboard.banner-card[migration].dismiss')
      .or(this.app.getByRole('button', { name: /dismiss.*migration|close.*migration/i })).first();
  }

  /** Etsy shop store link — data-testid: dashboard.etsy-shop.store-link */
  getEtsyShopStoreLink() {
    return this.app.getByTestId('dashboard.etsy-shop.store-link')
      .or(this.app.getByRole('link', { name: /visit.*shop|etsy shop/i })).first();
  }

  /** Onboarding checklist toggle — data-testid: dashboard.onboarding.toggle */
  getOnboardingToggle() {
    return this.app.getByTestId('dashboard.onboarding.toggle')
      .or(this.app.getByRole('button', { name: /onboarding|getting started/i })).first();
  }

  /**
   * Onboarding step action button — data-testid: dashboard.onboarding.step[${key}].action
   * @param {string} key — step key, e.g. 'connect-etsy', 'create-profile'
   */
  getOnboardingStepAction(key) {
    return this.app.getByTestId(`dashboard.onboarding.step[${key}].action`)
      .or(this.app.getByRole('button', { name: new RegExp(key.replace(/-/g, ' '), 'i') })).first();
  }

  // ─── Order Analysis ───────────────────────────────────────────────────

  async isOrderAnalysisVisible() {
    return this.app.getByText(/order analysis/i).first().isVisible({ timeout: 10000 }).catch(() => false);
  }

  /** Count visible order status badges: Paid, Failed, Completed, Others */
  async getOrderStatusBadges() {
    const statuses = ['paid', 'failed', 'completed', 'others'];
    let found = 0;
    for (const s of statuses) {
      if (await this.app.getByText(new RegExp(`^${s}$`, 'i')).first().isVisible({ timeout: 3000 }).catch(() => false)) found++;
    }
    return found;
  }

  /** Order pie chart canvas */
  async isOrderPieChartVisible() {
    return this.app.locator('.dashboard_custom_chart canvas, canvas').first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  /** "View All Orders" button — data-testid: dashboard.orders.view-all */
  getViewAllOrdersButton() {
    return this.app.getByTestId('dashboard.orders.view-all')
      .or(this.app.getByRole('button', { name: /view all orders/i })).first();
  }

  /**
   * Click an order status badge by name — redirects to /panel/orders.
   * Tries data-testid (dashboard.order-analysis.badge[label]) first, then
   * falls back to class-based selector.
   */
  async clickOrderStatusBadge(name) {
    try {
      // Step 1: try data-testid badge — label matches the badge text exactly (case-sensitive in testid)
      const tidBadge = this.app.locator(`[data-testid*="dashboard.order-analysis.badge"]`).filter({ hasText: new RegExp(name, 'i') }).first();
      if (await tidBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tidBadge.click({ force: true });
        return true;
      }
      // Step 2: verify badge is present using Playwright locator
      const badge = this.app.locator('[class*="status_badge"]').filter({ hasText: new RegExp(name, 'i') }).first();
      const visible = await badge.isVisible({ timeout: 5000 }).catch(() => false);
      if (!visible) return false;

      // Step 2: click the sibling count button via evaluate (broader selector, ancestor walk)
      const evalOk = await this.app.evaluate((label) => {
        const all = Array.from(document.querySelectorAll('[class*="status_badge"]'));
        for (const b of all) {
          const text = (b.innerText || b.textContent || '').trim();
          if (new RegExp(label, 'i').test(text)) {
            let el = b;
            for (let i = 0; i < 5; i++) {
              const btn = el.querySelector('button');
              if (btn) { btn.click(); return true; }
              if (!el.parentElement) break;
              el = el.parentElement;
            }
            b.click();
            return true;
          }
        }
        return false;
      }, name).catch(() => false);

      if (evalOk) return true;

      // Step 3: fallback — click the badge element directly
      await badge.click({ force: true });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Revenue ──────────────────────────────────────────────────────────

  async isRevenueVisible() {
    return this.app.getByText(/total revenue/i).first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  /** Date range filter toggle — data-testid: dashboard.date-range.toggle */
  getRevenueDateFilter() {
    return this.app.getByTestId('dashboard.date-range.toggle')
      .or(this.app.getByRole('button', { name: /select date range|last 7 days|last 30 days|this month/i })).first();
  }

  // ─── Product Analysis ─────────────────────────────────────────────────

  async isProductAnalysisVisible() {
    return this.app.getByText(/product analysis/i).first().isVisible({ timeout: 10000 }).catch(() => false);
  }

  /** Count visible product status badges: Active, Not Published, Not Profiled, Others */
  async getProductStatusBadges() {
    const statuses = ['active', 'not[\\s\\u00a0]+published', 'not[\\s\\u00a0]+profiled', 'others'];
    let found = 0;
    for (const s of statuses) {
      if (await this.app.getByText(new RegExp(s, 'i')).first().isVisible({ timeout: 3000 }).catch(() => false)) found++;
    }
    return found;
  }

  /** "View All Products" button — data-testid: dashboard.products.view-all */
  getViewAllProductsButton() {
    return this.app.getByTestId('dashboard.products.view-all')
      .or(this.app.getByRole('button', { name: /view all products/i })).first();
  }

  /**
   * Click a product status badge by name — redirects to /panel/listings.
   * Tries data-testid (dashboard.product-analysis.badge[label]) first, then
   * falls back to class-based selector. Handles non-breaking spaces.
   */
  async clickProductStatusBadge(name) {
    try {
      // Try data-testid badge first
      const tidBadge = this.app.locator(`[data-testid*="dashboard.product-analysis.badge"]`).filter({ hasText: new RegExp(name, 'i') }).first();
      if (await tidBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tidBadge.click({ force: true });
        return true;
      }
      // Build regex that matches both regular and non-breaking spaces between words
      const flexPattern = new RegExp(name.split(/\s+/).join('[\\s\\u00a0]+'), 'i');

      // Step 1: verify badge is present — try flexible whitespace match via evaluate
      const visible = await this.app.evaluate((pattern) => {
        const all = Array.from(document.querySelectorAll('[class*="status_badge"]'));
        return all.some(b => new RegExp(pattern, 'i').test((b.innerText || b.textContent || '').trim()));
      }, flexPattern.source).catch(() => false);

      if (!visible) return false;

      // Step 2: click the sibling count button via evaluate (ancestor walk)
      const evalOk = await this.app.evaluate((pattern) => {
        const re = new RegExp(pattern, 'i');
        const all = Array.from(document.querySelectorAll('[class*="status_badge"]'));
        for (const b of all) {
          const text = (b.innerText || b.textContent || '').trim();
          if (re.test(text)) {
            let el = b;
            for (let i = 0; i < 5; i++) {
              const btn = el.querySelector('button');
              if (btn) { btn.click(); return true; }
              if (!el.parentElement) break;
              el = el.parentElement;
            }
            b.click();
            return true;
          }
        }
        return false;
      }, flexPattern.source).catch(() => false);

      return evalOk;
    } catch {
      return false;
    }
  }

  // ─── Top Performing Products ──────────────────────────────────────────

  async isTopSellingVisible() {
    return this.app.getByText(/top (selling|performing) products/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getTopSellingCount() {
    return this.app.getByText(/listing id/i).count().catch(() => 0);
  }

  // ─── Video Tips ───────────────────────────────────────────────────────

  async isVideoTipsVisible() {
    return this.app.getByText(/more tips on getting started/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Etsy Shop Status ─────────────────────────────────────────────────

  async isEtsyShopStatusVisible() {
    return this.app.getByText(/etsy shop status/i).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
  }

  /** Refresh button in Etsy Shop Status — data-testid: dashboard.etsy-shop.refresh */
  getShopRefreshButton() {
    return this.app.getByTestId('dashboard.etsy-shop.refresh')
      .or(this.app.locator('button[aria-label="Refresh Etsy Shop"]')).first();
  }

  async getShopMetricsCount() {
    let found = 0;
    if (await this.app.getByText(/accepts customizable orders/i).first().isVisible({ timeout: 5000 }).catch(() => false)) found++;
    if (await this.app.getByText(/languages/i).first().isVisible({ timeout: 5000 }).catch(() => false)) found++;
    return found;
  }

  // ─── Recent Activities ────────────────────────────────────────────────

  async isRecentActivitiesVisible() {
    return this.app.getByText(/recent activit/i).first()
      .isVisible({ timeout: 20000 }).catch(() => false);
  }

  /**
   * "All Activities" button — data-testid: dashboard.recent-activities.view-all
   * Navigates to /panel/activity
   */
  getAllActivitiesLink() {
    return this.app.getByTestId('dashboard.recent-activities.view-all')
      .or(this.app.getByRole('button', { name: /view all activities|all activities/i })).first();
  }

  /** Count activity items on the dashboard recent activities panel */
  async getActivityItemsCount() {
    return this.app.locator('.notification-item').count().catch(() => 0);
  }

  /**
   * Delete the first activity item on the dashboard Recent Activities panel.
   * Delete button has accessibilityLabel="Delete Activity"
   */
  async deleteFirstActivity() {
    const deleteBtn = this.app.getByRole('button', { name: /delete activity/i }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.click({ force: true });
      return true;
    }
    return false;
  }

  // ─── Activities Page ──────────────────────────────────────────────────

  async isActivitiesPageVisible() {
    return (
      (await this.app.getByText(/^activity$/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByText(/notifications/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  async getActivitiesPageDeleteButton() {
    return this.app.getByRole('button', { name: /delete activity/i }).first();
  }

  /** Count notification items on the full Activities page */
  async getActivitiesCount() {
    return this.app.locator('.notification-item').count().catch(() => 0);
  }

  // ─── Plan Overview ────────────────────────────────────────────────────

  async isPlanOverviewVisible() {
    return this.app.getByText(/plan overview/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getPlanDetailsCount() {
    let found = 0;
    if (await this.app.getByText(/product limit/i).first().isVisible({ timeout: 3000 }).catch(() => false)) found++;
    if (await this.app.getByText(/order limit/i).first().isVisible({ timeout: 3000 }).catch(() => false)) found++;
    if (await this.app.getByText(/next billing/i).first().isVisible({ timeout: 3000 }).catch(() => false)) found++;
    return found;
  }

  /** View Plan Details link — data-testid: dashboard.plan-overview.view-details */
  getViewPlanDetailsLink() {
    return this.app.getByTestId('dashboard.plan-overview.view-details')
      .or(this.app.getByText(/view plan details/i)).first();
  }

  // ─── Feedback ─────────────────────────────────────────────────────────

  async isFeedbackVisible() {
    return this.app.getByText(/feedback helps us grow|how was your experience/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  /** Good feedback button — data-testid: dashboard.app-experience.good */
  getGoodButton() {
    return this.app.getByTestId('dashboard.app-experience.good')
      .or(this.app.getByRole('button', { name: /good/i })).first();
  }

  /** Bad feedback button — data-testid: dashboard.app-experience.bad */
  getBadButton() {
    return this.app.getByTestId('dashboard.app-experience.bad')
      .or(this.app.getByRole('button', { name: /bad/i })).first();
  }

  // ─── Reverse Sync Banner ──────────────────────────────────────────────

  async isReverseSyncBannerVisible() {
    return this.app.getByText(/reverse sync/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }
}

module.exports = { EtsyDashboardPage };
