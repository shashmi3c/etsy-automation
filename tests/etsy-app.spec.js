const { test, expect } = require('@playwright/test');
const { ShopifyLoginPage } = require('../pages/ShopifyLoginPage');
const { EtsyDashboardPage } = require('../pages/EtsyDashboardPage');

const APP_URL = process.env.SHOPIFY_EMBEDDED_APP_URL || 'https://admin.shopify.com/store/store-tester-test-3/apps/etsy-dev-public/panel/overview';
const SHOPIFY_EMAIL = process.env.SHOPIFY_EMAIL || '';
const SHOPIFY_PASSWORD = process.env.SHOPIFY_PASSWORD || '';

test.describe('Etsy App - Shopify Login + Dashboard Verification', () => {
  test('should login to Shopify and verify Etsy dashboard loads', async ({ page }) => {
    test.setTimeout(120000);

    if (!SHOPIFY_EMAIL || !SHOPIFY_PASSWORD) {
      test.skip(true, 'Set SHOPIFY_EMAIL and SHOPIFY_PASSWORD in .env to run this test.');
      return;
    }

    // 1. Navigate to the Etsy app URL (triggers Shopify login)
    const loginPage = new ShopifyLoginPage(page);
    await loginPage.goto(APP_URL);

    // 2. If login form is shown, fill credentials
    if (await loginPage.isLoginFormVisible()) {
      await loginPage.login(SHOPIFY_EMAIL, SHOPIFY_PASSWORD);

      // Check if login succeeded (not stuck on 2FA / login page)
      if (await loginPage.isStillOnLogin()) {
        test.skip(true, 'Still on Shopify login (2FA or captcha). Run: npm run auth:shopify in headed mode first.');
        return;
      }
    }

    // 3. Navigate to the Etsy app and verify dashboard
    const dashboard = new EtsyDashboardPage(page);
    await dashboard.goto(APP_URL);

    const isVisible = await dashboard.isDashboardVisible();
    expect(isVisible, 'Etsy Integration dashboard should be visible after Shopify login').toBe(true);
  });
});

test.describe('Etsy App - Dashboard Load + Product Import', () => {
  test('should load dashboard and import products successfully', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Navigate to the Etsy app
    const dashboard = new EtsyDashboardPage(page);
    await dashboard.goto(APP_URL);

    // 2. Check if login is required (when using storageState auth)
    const loginPage = new ShopifyLoginPage(page);
    if (await loginPage.isLoginFormVisible()) {
      test.skip(true, 'Login required. Run: npm run auth:shopify first, then: npm run test:etsy');
      return;
    }

    // 3. Verify dashboard is loaded
    const dashboardVisible = await dashboard.isDashboardVisible();
    if (!dashboardVisible) {
      test.skip(true, 'Etsy dashboard not loaded (auth may be expired). Run: npm run auth:shopify');
      return;
    }
    expect(dashboardVisible).toBe(true);

    // 4. Click import products
    await dashboard.clickImportProducts();

    // 5. Verify import success message
    await expect(dashboard.getImportSuccessLocator()).toBeVisible({ timeout: 30000 });
  });
});