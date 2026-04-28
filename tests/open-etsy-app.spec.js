// @ts-check
const { test, expect } = require('@playwright/test');
const { EtsyDashboardPage } = require('../pages/EtsyDashboardPage');
const { ShopifyLoginPage } = require('../pages/ShopifyLoginPage');
const path = require('path');

const APP_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE || 'etsy-test-gp7o90bx'}/apps/etsy-dev-public`;

// Resolved at runtime (after dotenv loads) so the path is always correct
const SESSION_PATH = process.env.SHOPIFY_SESSION_PATH
  ? path.resolve(__dirname, '..', process.env.SHOPIFY_SESSION_PATH)
  : path.resolve(__dirname, '..', 'playwright/.auth/shopify.json');

test.describe('Open Etsy App in Shopify Embedded App', () => {
  test('should open Etsy app and load the dashboard', async ({ page, context }) => {
    test.setTimeout(120000);

    const loginPage = new ShopifyLoginPage(page);
    const dashboard = new EtsyDashboardPage(page);

    // Navigate to the Etsy embedded app using the saved session
    await dashboard.goto(APP_URL);

    // If session is expired, auto-login with .env credentials and refresh cookies
    if (await loginPage.isLoginFormVisible()) {
      const email = process.env.SHOPIFY_EMAIL;
      const password = process.env.SHOPIFY_PASSWORD;

      if (!email || !password) {
        test.skip(
          true,
          'Session expired. Set SHOPIFY_EMAIL and SHOPIFY_PASSWORD in .env to enable auto-login.'
        );
        return;
      }

      console.log('Session expired — logging in automatically with .env credentials...');
      await loginPage.login(email, password);

      // Persist the refreshed session back to the session file
      await context.storageState({ path: SESSION_PATH });
      console.log('Session refreshed and saved to:', SESSION_PATH);

      // Navigate back to the app after login
      await dashboard.goto(APP_URL);
    }

    // Dismiss any overlays (tour, modals, backdrops)
    await dashboard.dismissOverlays();

    // Verify the Etsy dashboard is visible inside the Shopify embedded app
    const isVisible = await dashboard.isDashboardVisible();
    expect(isVisible, 'Etsy dashboard should be visible in the Shopify embedded app').toBe(true);
  });
});
