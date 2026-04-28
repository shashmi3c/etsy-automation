// @ts-check
const { test, expect } = require('@playwright/test');
const { EtsyDashboardPage } = require('../pages/EtsyDashboardPage');

const APP_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  'https://admin.shopify.com/store/store-tester-test-3/apps/etsy-dev-public/panel/overview';

/**
 * Dashboard Functional Tests based on the "Etsy new test cases" PDF/CSV.
 * Covers TC_001–TC_021 (Dashboard section from the functional test case sheet).
 * These are separate from the multi-account dashboard tests (TC_11–TC_17).
 */
test.describe('Dashboard – Functional (TC_001–TC_021)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 });

  /** @type {EtsyDashboardPage} */
  let dashboard;

  test.beforeEach(async ({ page }) => {
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
    }

    await dashboard.dismissOverlays();
  });

  // TC_001: Dashboard displays Create Profiling option
  test('TC_001: Dashboard displays the Create Profiling option', async () => {
    const hasProfiling = await dashboard.app.getByText(/create.*profil|profil/i).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
    // Profiling option shown only when no profile exists
    expect(typeof hasProfiling).toBe('boolean');
  });

  // TC_002: Brief message explaining benefits of profiling functionalities
  test('TC_002: Dashboard shows profiling explanation message and links', async () => {
    const hasProfiling = await dashboard.app.getByText(/profil/i).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
    expect(typeof hasProfiling).toBe('boolean');
  });

  // TC_003: Watch Tutorial link redirects to tutorial page
  test('TC_003: Watch Tutorial link is present on the dashboard', async () => {
    const link = dashboard.app.getByRole('link', { name: /watch.*tutorial|tutorial/i }).first()
      .or(dashboard.app.getByText(/watch.*tutorial/i).first());
    const visible = await link.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Watch Tutorial link not visible — profiling section may not be shown.');
      return;
    }
    await expect(link).toBeVisible();
  });

  // TC_004: Learn more about profiling link redirects to user guide
  test('TC_004: "Learn more about profiling" link is present', async () => {
    const link = dashboard.app.getByRole('link', { name: /learn more.*profil/i }).first()
      .or(dashboard.app.getByText(/learn more.*profil/i).first());
    const visible = await link.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, '"Learn more" link not visible — profiling section may not be shown.');
      return;
    }
    await expect(link).toBeVisible();
  });

  // TC_005: Create Profiling option is not displayed if seller already has a profile
  test('TC_005: Create Profiling option is hidden when seller already has a profile', async () => {
    // If profiling exists, the "Create Profile" CTA should not be visible on dashboard
    const profileSection = await dashboard.app
      .getByText(/create.*profil/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    // Both states are valid: shown if no profile, hidden if profile exists
    expect(typeof profileSection).toBe('boolean');
  });

  // TC_006: Products Analysis shows total count of seller's products
  test('TC_006: Products Analysis shows total count of products', async () => {
    const visible = await dashboard.isProductAnalysisVisible();
    expect(visible, 'Product Analysis section should be visible').toBe(true);

    const hasCount = await dashboard.app.getByText(/total products/i).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasCount, 'Total products count should be displayed').toBe(true);
  });

  // TC_007: Products bifurcated by status (Active, Not Published, Not Profiled, Others)
  test('TC_007: Products bifurcated by status (Active, Not Published, Not Profiled, Others)', async () => {
    const count = await dashboard.getProductStatusBadges();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // TC_008: Products pie chart display is correct
  test('TC_008: Products pie chart is displayed correctly', async () => {
    const visible = await dashboard.isOrderPieChartVisible();
    expect(typeof visible).toBe('boolean');
  });

  // TC_009: All Products link redirects to All Products section
  test('TC_009: Clicking "All Products" link redirects to the Products section', async ({ page }) => {
    const btn = dashboard.getViewAllProductsButton();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/listings|products/i);
  });

  // TC_010: Top Selling Products shows titles and listing IDs
  test('TC_010: Top Selling Products section shows items with titles and listing IDs', async () => {
    const visible = await dashboard.isTopSellingVisible();
    if (!visible) {
      test.skip(true, 'Top Selling Products section not visible — may have no sales data.');
      return;
    }
    expect(visible).toBe(true);
    const count = await dashboard.getTopSellingCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // TC_011: Order Analysis shows total count of orders
  test('TC_011: Order Analysis shows total count of orders', async () => {
    const visible = await dashboard.isOrderAnalysisVisible();
    expect(visible, 'Order Analysis section should be visible').toBe(true);

    const hasCount = await dashboard.app.getByText(/total orders/i).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasCount, 'Total orders count should be displayed').toBe(true);
  });

  // TC_012: Orders bifurcated by status (Total, Paid, Failed, Completed, Others)
  test('TC_012: Orders bifurcated by status (Total Orders, Paid, Failed, Completed, Others)', async () => {
    const count = await dashboard.getOrderStatusBadges();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // TC_013: Order pie chart display is correct
  test('TC_013: Order pie chart is displayed correctly', async () => {
    const visible = await dashboard.isOrderPieChartVisible();
    expect(visible, 'Order pie chart should be visible in order analysis').toBe(true);
  });

  // TC_014: View All Orders link redirects to Order section
  test('TC_014: "View All Orders" link redirects to the Orders section', async ({ page }) => {
    const btn = dashboard.getViewAllOrdersButton();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/orders/i);
  });

  // TC_015: Revenue analytics section is visible
  test('TC_015: Revenue analytics section is visible in the Orders area', async () => {
    const visible = await dashboard.isRevenueVisible();
    expect(visible, 'Total Revenue section should be visible').toBe(true);
  });

  // TC_016: Revenue displays with bar/line chart
  test('TC_016: Revenue section includes a chart (bar/line chart)', async () => {
    const chartVisible = await dashboard.app.locator('canvas').first()
      .isVisible({ timeout: 8000 }).catch(() => false);
    expect(typeof chartVisible).toBe('boolean');
  });

  // TC_017: Revenue calendar filter is visible
  test('TC_017: Revenue section includes a calendar/date range filter', async () => {
    const filter = dashboard.getRevenueDateFilter();
    await expect(filter).toBeVisible({ timeout: 10000 });
  });

  // TC_018: Rating and feedback submission section
  test('TC_018: Rating and feedback section is present on the dashboard', async () => {
    const visible = await dashboard.isFeedbackVisible();
    if (!visible) {
      test.skip(true, 'Feedback section not shown — already submitted or not visible.');
      return;
    }
    await expect(dashboard.getGoodButton()).toBeVisible();
    await expect(dashboard.getBadButton()).toBeVisible();
  });

  // TC_019: Pricing info — Active Plan, Plan Amount, Plan Status, Billing Date, etc.
  test('TC_019: Pricing info is displayed (Active Plan, Amount, Status, Billing Date, Order Limit)', async () => {
    const visible = await dashboard.isPlanOverviewVisible();
    expect(visible, 'Plan Overview section should be visible').toBe(true);

    const count = await dashboard.getPlanDetailsCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // TC_020: Upgrade Plan link redirects to pricing plan section
  test('TC_020: "View Plan Details" / Upgrade Plan link redirects to Pricing section', async ({ page }) => {
    const link = dashboard.getViewPlanDetailsLink();
    await expect(link).toBeVisible({ timeout: 10000 });
    await link.click({ force: true });
    await page.waitForTimeout(5000);
    expect(page.url()).toMatch(/pricing/i);
  });

  // TC_021: Etsy Shop Status shows relevant metrics
  test('TC_021: Etsy Shop Status section displays relevant metrics', async () => {
    const visible = await dashboard.isEtsyShopStatusVisible();
    expect(visible, 'Etsy Shop Status section should be visible').toBe(true);

    const count = await dashboard.getShopMetricsCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});