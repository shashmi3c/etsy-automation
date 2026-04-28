const { test, expect } = require('@playwright/test');

const APP_URL =
  'https://admin.shopify.com/store/etsytestingstore-3/apps/etsy-dev-public/panel/overview';

test.describe('Shopify Etsy app dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  test('panel overview loads or login is shown', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    const loginVisible =
      (await page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible().catch(() => false));

    if (loginVisible) {
      test.skip(true, 'Shopify login required. Run npm run auth:shopify or use project etsy-authenticated.');
      return;
    }

    let app = page;
    const iframe = page
      .frameLocator('iframe[id*="app"], iframe[title*="Etsy"], iframe[src*="etsy"], iframe')
      .first();
    try {
      await iframe.locator('body').waitFor({ state: 'attached', timeout: 12000 });
      app = iframe;
    } catch {
      // main page
    }

    const hasContent =
      (await app.getByRole('heading', { name: /etsy|dashboard|cedcommerce|integration|overview/i }).isVisible().catch(() => false)) ||
      (await app.getByText(/etsy|dashboard|cedcommerce|integration|overview/i).first().isVisible().catch(() => false)) ||
      (await app.getByRole('button', { name: /import product/i }).isVisible().catch(() => false));

    expect(hasContent, 'Etsy app dashboard content should be visible on panel/overview').toBe(true);
  });
});
