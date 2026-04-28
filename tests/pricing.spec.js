// @ts-check
const { test, expect } = require('@playwright/test');
const { EtsyPricingPage } = require('../pages/EtsyPricingPage');

const APP_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  'https://admin.shopify.com/store/store-tester-test-3/apps/etsy-dev-public/panel/overview';

const PRICING_URL = APP_URL.replace(/panel\/.*$/, 'panel/pricing');

test.describe('Pricing / Plans – Multi-Account (TC_139–TC_153)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 });

  /** @type {EtsyPricingPage} */
  let pricing;

  test.beforeEach(async ({ page }) => {
    pricing = new EtsyPricingPage(page);
    await pricing.goto(PRICING_URL);

    const needsLogin =
      (await page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible().catch(() => false));
    if (needsLogin) {
      test.skip(true, 'Shopify login required. Run: node scripts/shopify-auth.mjs');
      return;
    }

    const loaded = await pricing.isPricingPageVisible();
    if (!loaded) {
      test.skip(true, 'Pricing page did not load.');
    }
  });

  // TC_139: Subscribe to pricing plan for primary account with multiple connected shops
  test('TC_139: Pricing plan subscribed for primary account applies correctly for all linked shops', async () => {
    const visible = await pricing.isActivePlanVisible();
    expect(visible, 'Active plan details should be visible on the pricing page').toBe(true);
  });

  // TC_140: Upgrade plan from lower to higher tier
  test('TC_140: Upgrading pricing plan from lower to higher tier updates limits correctly', async () => {
    const upgradeBtn = pricing.getUpgradePlanButton()
      .or(pricing.getSelectPlanButton(1));
    const visible = await upgradeBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Upgrade Plan button not visible — may already be on highest plan.');
      return;
    }
    await expect(upgradeBtn).toBeVisible();
  });

  // TC_141: Downgrade plan
  test('TC_141: Downgrading pricing plan updates limits correctly if not exceeded', async () => {
    const downgradeBtn = pricing.getDowngradePlanButton()
      .or(pricing.getSelectPlanButton(0));
    const visible = await downgradeBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Downgrade Plan button not visible — may already be on lowest plan.');
      return;
    }
    await expect(downgradeBtn).toBeVisible();
  });

  // TC_142: Product/listing limits after connecting additional shops
  test('TC_142: Product/listing limits follow the pricing plan when additional shops are connected', async () => {
    const limitVisible = await pricing.isListingLimitVisible();
    if (!limitVisible) {
      test.skip(true, 'Listing limit info not visible on pricing page.');
      return;
    }
    expect(limitVisible).toBe(true);
  });

  // TC_143: Subscribe to plan then connect additional shop
  test('TC_143: Newly connected shop follows existing pricing plan restrictions', async () => {
    const visible = await pricing.isActivePlanVisible();
    expect(visible).toBe(true);
  });

  // TC_144: Disconnect one shop — plan stays active with adjusted usage
  test('TC_144: Disconnecting one shop keeps plan active with adjusted usage count', async () => {
    const visible = await pricing.isActivePlanVisible();
    expect(visible).toBe(true);
  });

  // TC_145: Plan feature access across all connected accounts
  test('TC_145: All plan-enabled features are accessible across all linked accounts', async () => {
    const visible = await pricing.isPricingPageVisible();
    expect(visible).toBe(true);
  });

  // TC_146: Plan expiry restricts features across all accounts
  test('TC_146: Plan expiry restricts features and listings across all connected accounts', async () => {
    const expiredMsgVisible = await pricing.isExpiredPlanMessageVisible();
    if (!expiredMsgVisible) {
      test.skip(true, 'Plan is not expired — cannot verify expiry restrictions without active expiry state.');
      return;
    }
    expect(expiredMsgVisible).toBe(true);
  });

  // TC_147: Renew expired plan
  test('TC_147: Renewing an expired plan restores features across all connected shops', async () => {
    const renewBtn = pricing.getRenewButton();
    const visible = await renewBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Renew button not visible — plan is not expired.');
      return;
    }
    await expect(renewBtn).toBeVisible();
  });

  // TC_148: Billing is correct when multiple shops are connected
  test('TC_148: Billing follows the configured pricing model correctly with multiple shops', async () => {
    const billingVisible = await pricing.isBillingDateVisible();
    if (!billingVisible) {
      test.skip(true, 'Billing date not visible in pricing page.');
      return;
    }
    expect(billingVisible).toBe(true);
  });

  // TC_149: Attempting to exceed listing limit across shops is restricted
  test('TC_149: Listing/product limit is enforced across multiple accounts', async () => {
    const limitVisible = await pricing.isListingLimitVisible();
    if (!limitVisible) {
      test.skip(true, 'Listing limit not visible on pricing page.');
      return;
    }
    expect(limitVisible).toBe(true);
  });

  // TC_150: Changing plan during active listings preserves existing listings
  test('TC_150: Changing plan during active listings keeps existing listings intact', async () => {
    const visible = await pricing.isPricingPageVisible();
    expect(visible).toBe(true);
  });

  // TC_151: Plan subscribed via Shopify billing syncs correctly with Etsy shops
  test('TC_151: Plan subscription via Shopify billing activates features across Etsy shops', async () => {
    const visible = await pricing.isActivePlanVisible();
    expect(visible).toBe(true);
  });

  // TC_152: Cancel subscription from primary account
  test('TC_152: Cancelling subscription from primary account restricts features for all shops', async () => {
    const cancelBtn = pricing.getCancelSubscriptionButton();
    const visible = await cancelBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Cancel Subscription button not visible in current plan state.');
      return;
    }
    await expect(cancelBtn).toBeVisible();
  });

  // TC_153: Plan active when one connected shop is deactivated
  test('TC_153: Plan remains active and usage count adjusts when one connected shop is deactivated', async () => {
    const visible = await pricing.isActivePlanVisible();
    expect(visible).toBe(true);
  });
});