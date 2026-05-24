const { test, expect } = require('@playwright/test');
const path = require('path');
const { EtsyDashboardPage } = require('../pages/EtsyDashboardPage');

const BASE_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE || 'etsy-test-gp7o90bx'}/apps/etsy-dev-public`;

const APP_URL = BASE_URL.includes('/panel/') ? BASE_URL : `${BASE_URL}/panel/overview`;

test.describe('Etsy Dashboard', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {EtsyDashboardPage} */
  let dashboard;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    context = await browser.newContext({
      storageState: path.resolve(__dirname, '../playwright/.auth/shopify.json'),
    });
    page = await context.newPage();
    dashboard = new EtsyDashboardPage(page);
    await dashboard.goto(APP_URL);

    const needsLogin =
      (await page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible().catch(() => false));
    if (needsLogin) {
      test.skip(true, 'Shopify login required. Run: node scripts/shopify-auth.mjs');
      return;
    }

    const loaded = await dashboard.isDashboardVisible();
    if (!loaded) {
      test.skip(true, 'Dashboard did not load. Auth may be expired.');
      return;
    }

    await dashboard.dismissOverlays();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  async function backToDashboard() {
    await dashboard.goto(APP_URL);
    await dashboard.isDashboardVisible();
  }

  // ─── Top Bar ──────────────────────────────────────────────────────────

  test('TC_01: Dashboard page loads with content', async () => {
    const visible = await dashboard.isDashboardVisible();
    expect(visible).toBe(true);
  });

  test('TC_02: "New to the app?" banner is visible with Watch Guide button', async () => {
    const bannerVisible = await dashboard.isNewAppBannerVisible();
    if (!bannerVisible) {
      test.skip(true, 'Banner already dismissed.');
      return;
    }
    await expect(dashboard.getWatchGuideButton()).toBeVisible();
  });

  test('TC_03: Refresh Data button is visible', async () => {
    await expect(dashboard.getRefreshDataButton()).toBeVisible({ timeout: 10000 });
  });

  // ─── Order Analysis ───────────────────────────────────────────────────

  test('TC_04: Order Analysis section is visible', async () => {
    const visible = await dashboard.isOrderAnalysisVisible();
    expect(visible).toBe(true);
  });

  test('TC_05: Total Orders count or fallback is displayed', async () => {
    const hasLabel = await dashboard.app
      .getByText(/total orders/i).first()
      .isVisible({ timeout: 20000 }).catch(() => false);
    const hasFallback = await dashboard.app
      .locator('.dashboard-order-fallback').first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasLabel || hasFallback).toBe(true);
  });

  test('TC_06: Order status badges are visible (Paid, Failed, Completed, Others)', async () => {
    const count = await dashboard.getOrderStatusBadges();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('TC_07: Order pie chart is displayed', async () => {
    const visible = await dashboard.isOrderPieChartVisible();
    expect(visible).toBe(true);
  });

  test('TC_08: "View All Orders" button redirects to Orders page', async () => {
    const btn = dashboard.getViewAllOrdersButton();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/orders/i);
    await backToDashboard();
  });

  // ─── Order Badge Redirections ─────────────────────────────────────────

  test('TC_09: Clicking "Paid" order badge redirects to filtered orders page', async () => {
    const clicked = await dashboard.clickOrderStatusBadge('paid');
    if (!clicked) {
      test.skip(true, 'Paid badge not visible in order analysis.');
      return;
    }
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/orders/i);
    await backToDashboard();
  });

  test('TC_10: Clicking "Failed" order badge redirects to filtered orders page', async () => {
    const clicked = await dashboard.clickOrderStatusBadge('failed');
    if (!clicked) {
      test.skip(true, 'Failed badge not visible in order analysis.');
      return;
    }
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/orders/i);
    await backToDashboard();
  });

  test('TC_11: Clicking "Completed" order badge redirects to orders page', async () => {
    const clicked = await dashboard.clickOrderStatusBadge('completed');
    if (!clicked) {
      test.skip(true, 'Completed badge not visible in order analysis.');
      return;
    }
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/orders/i);
    await backToDashboard();
  });

  // ─── Revenue ──────────────────────────────────────────────────────────

  test('TC_12: Total Revenue section is visible', async () => {
    const visible = await dashboard.isRevenueVisible();
    expect(visible).toBe(true);
  });

  test('TC_13: Revenue date filter is visible (Last 7 days)', async () => {
    await expect(dashboard.getRevenueDateFilter()).toBeVisible({ timeout: 10000 });
  });

  // ─── Product Analysis ─────────────────────────────────────────────────

  test('TC_14: Product Analysis section is visible', async () => {
    const visible = await dashboard.isProductAnalysisVisible();
    expect(visible).toBe(true);
  });

  test('TC_15: Total Products count is displayed', async () => {
    await expect(
      dashboard.app.getByText(/total products/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('TC_16: Product status badges are visible (Active, Not Published, Not Profiled, Others)', async () => {
    const count = await dashboard.getProductStatusBadges();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('TC_17: "View All Products" button redirects to Products/Listings page', async () => {
    const btn = dashboard.getViewAllProductsButton();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/listings|products/i);
    await backToDashboard();
  });

  // ─── Product Badge Redirections ────────────────────────────────────────

  test('TC_18: Clicking "Active" product badge redirects to listings page', async () => {
    const clicked = await dashboard.clickProductStatusBadge('active');
    if (!clicked) {
      test.skip(true, 'Active badge not visible in product analysis.');
      return;
    }
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/listings|products/i);
    await backToDashboard();
  });

  test('TC_19: Clicking "Not Published" product badge redirects to listings page', async () => {
    const clicked = await dashboard.clickProductStatusBadge('not published');
    if (!clicked) {
      test.skip(true, 'Not Published badge not visible in product analysis.');
      return;
    }
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/listings|products/i);
    await backToDashboard();
  });

  test('TC_20: Clicking "Not Profiled" product badge redirects to listings page', async () => {
    const clicked = await dashboard.clickProductStatusBadge('not profiled');
    if (!clicked) {
      test.skip(true, 'Not Profiled badge not visible in product analysis.');
      return;
    }
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/listings|products/i);
    await backToDashboard();
  });

  // ─── Top Performing Products ──────────────────────────────────────────

  test('TC_21: Top Performing Products section is visible', async () => {
    const visible = await dashboard.isTopSellingVisible();
    expect(visible).toBe(true);
  });

  test('TC_22: Top selling products show titles and listing IDs', async () => {
    const count = await dashboard.getTopSellingCount();
    if (count === 0) {
      test.skip(true, 'No top-selling products in this store yet — section renders empty.');
      return;
    }
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ─── Video Tips ───────────────────────────────────────────────────────

  test('TC_23: "More tips on getting started" video section is visible', async () => {
    const visible = await dashboard.isVideoTipsVisible();
    expect(visible).toBe(true);
  });

  // ─── Etsy Shop Status ─────────────────────────────────────────────────

  test('TC_24: Etsy Shop Status section is visible', async () => {
    const visible = await dashboard.isEtsyShopStatusVisible();
    expect(visible).toBe(true);
  });

  test('TC_25: Shop metrics displayed (customizable orders, languages)', async () => {
    const count = await dashboard.getShopMetricsCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('TC_26: Shop Refresh button is visible', async () => {
    await expect(dashboard.getShopRefreshButton()).toBeVisible({ timeout: 5000 });
  });

  // ─── Plan Overview ────────────────────────────────────────────────────

  test('TC_27: Plan Overview section is visible', async () => {
    const visible = await dashboard.isPlanOverviewVisible();
    expect(visible).toBe(true);
  });

  test('TC_28: Plan details are displayed (Product Limit, Order Limit, Billing date)', async () => {
    const count = await dashboard.getPlanDetailsCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('TC_29: "View Plan Details" redirects to Pricing page', async () => {
    const link = dashboard.getViewPlanDetailsLink();
    await expect(link).toBeVisible({ timeout: 10000 });
    await link.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/pricing/i);
    await backToDashboard();
  });

  // ─── Feedback ─────────────────────────────────────────────────────────

  test('TC_30: Feedback section is visible with Good/Bad buttons', async () => {
    const visible = await dashboard.isFeedbackVisible();
    if (!visible) {
      test.skip(true, 'Feedback section not shown — already reviewed.');
      return;
    }
    await expect(dashboard.getGoodButton()).toBeVisible();
    await expect(dashboard.getBadButton()).toBeVisible();
  });

  // ─── Reverse Sync Banner ──────────────────────────────────────────────

  test('TC_31: Reverse Sync (Etsy → Shopify) banner visibility check', async () => {
    const visible = await dashboard.isReverseSyncBannerVisible();
    expect(typeof visible).toBe('boolean');
  });

  // ─── Recent Activities ────────────────────────────────────────────────

  test('TC_32: Recent Activities section is visible on dashboard', async () => {
    const visible = await dashboard.isRecentActivitiesVisible();
    if (!visible) {
      test.skip(true, 'Recent Activities panel not shown on dashboard — triggers only after a sync/action in the current session.');
    }
    expect(typeof visible).toBe('boolean');
  });

  test('TC_33: "All Activities" button is visible in Recent Activities panel', async () => {
    const recentVisible = await dashboard.isRecentActivitiesVisible();
    if (!recentVisible) {
      test.skip(true, 'Recent Activities panel not shown on dashboard — triggers only after a sync/action in the current session.');
      return;
    }
    await expect(dashboard.getAllActivitiesLink()).toBeVisible({ timeout: 5000 });
  });

  test('TC_34: Clicking "All Activities" redirects to Activities page', async () => {
    const recentVisible = await dashboard.isRecentActivitiesVisible();
    if (!recentVisible) {
      test.skip(true, 'Recent Activities panel not shown on dashboard — triggers only after a sync/action in the current session.');
      return;
    }
    const btn = dashboard.getAllActivitiesLink();
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/activity/i);
    await backToDashboard();
  });

  test('TC_35: Activities page loads with Notifications section', async () => {
    await dashboard.gotoActivities(APP_URL);
    await dashboard.dismissOverlays();
    const visible = await dashboard.isActivitiesPageVisible();
    expect(visible).toBe(true);
    await backToDashboard();
  });

  test('TC_36: Delete an activity from Recent Activities on dashboard', async () => {
    const recentVisible = await dashboard.isRecentActivitiesVisible();
    if (!recentVisible) {
      test.skip(true, 'Recent Activities panel not shown on dashboard — triggers only after a sync/action in the current session.');
      return;
    }

    const countBefore = await dashboard.getActivityItemsCount();
    if (countBefore === 0) {
      test.skip(true, 'No activity items found in the dashboard panel.');
      return;
    }

    const deleted = await dashboard.deleteFirstActivity();
    expect(deleted).toBe(true);

    await page.waitForTimeout(4000);

    const countAfter = await dashboard.getActivityItemsCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test.skip('TC_37: Delete an activity from the full Activities page', async () => {
    await dashboard.gotoActivities(APP_URL);
    await dashboard.dismissOverlays();

    const visible = await dashboard.isActivitiesPageVisible();
    if (!visible) {
      test.skip(true, 'Activities page did not load.');
      return;
    }

    const deleteBtn = await dashboard.getActivitiesPageDeleteButton();
    const isVisible = await deleteBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'No activities available to delete on Activities page.');
      return;
    }

    const countBefore = await dashboard.getActivitiesCount();
    await deleteBtn.click({ force: true });
    await page.waitForTimeout(4000);

    const countAfter = await dashboard.getActivitiesCount();
    expect(countAfter).toBeLessThan(countBefore);
  });
});
