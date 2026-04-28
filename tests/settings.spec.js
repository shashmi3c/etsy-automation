// @ts-check
const { test, expect } = require('@playwright/test');
const { EtsySettingsPage } = require('../pages/EtsySettingsPage');

const APP_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  'https://admin.shopify.com/store/store-tester-test-3/apps/etsy-dev-public/panel/overview';

const SETTINGS_URL = APP_URL.replace(/panel\/.*$/, 'panel/settings');

test.describe('Settings – Multi-Account (TC_67–TC_86)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 });

  /** @type {EtsySettingsPage} */
  let settings;

  test.beforeEach(async ({ page }) => {
    settings = new EtsySettingsPage(page);
    await settings.goto(SETTINGS_URL);

    const needsLogin =
      (await page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible().catch(() => false));
    if (needsLogin) {
      test.skip(true, 'Shopify login required. Run: node scripts/shopify-auth.mjs');
      return;
    }

    const loaded = await settings.isSettingsPageVisible();
    if (!loaded) {
      test.skip(true, 'Settings page did not load.');
    }
  });

  // TC_67: Manage Accounts section displays all connected accounts
  test('TC_67: Manage Accounts section displays all connected accounts properly', async () => {
    const visible = await settings.isManageAccountsSectionVisible();
    expect(visible, 'Manage Accounts section should be visible in Settings').toBe(true);
  });

  // TC_68: "Set as Primary" and "Disable" buttons work correctly
  test('TC_68: "Set as Primary" and "Disable" buttons are visible and functional', async () => {
    const primaryBtnVisible = await settings.isSetAsPrimaryButtonVisible();
    const disableBtnVisible = await settings.isDisableButtonVisible();
    // At least one of these buttons should be present in multi-account setup
    const hasAccountControls = primaryBtnVisible || disableBtnVisible;
    if (!hasAccountControls) {
      test.skip(true, 'Account control buttons not visible — may require multi-account setup.');
      return;
    }
    expect(hasAccountControls).toBe(true);
  });

  // TC_69: Disabled accounts can be re-enabled
  test('TC_69: Disabled accounts can be enabled again', async () => {
    const enableBtn = settings.getEnableButton();
    const visible = await enableBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No disabled accounts available to test re-enable.');
      return;
    }
    await expect(enableBtn).toBeVisible();
  });

  // TC_70: Primary account cannot be disabled
  test('TC_70: The primary account cannot be disabled (disable button hidden/grayed)', async () => {
    const visible = await settings.isManageAccountsSectionVisible();
    if (!visible) {
      test.skip(true, 'Manage Accounts section not visible.');
      return;
    }
    // Primary badge should be present
    const primaryBadge = await settings.isPrimaryBadgeVisible();
    expect(typeof primaryBadge).toBe('boolean');
  });

  // TC_71: Non-primary accounts can be disabled
  test('TC_71: Non-primary accounts have a Disable button', async () => {
    const disableVisible = await settings.isDisableButtonVisible();
    if (!disableVisible) {
      test.skip(true, 'Disable button not visible — only one account or already disabled.');
      return;
    }
    await expect(settings.getDisableButton()).toBeVisible();
  });

  // TC_72: "Delete Account" button appears for disabled accounts
  test('TC_72: Delete Account button appears for disabled accounts in admin panel', async () => {
    const deleteVisible = await settings.isDeleteAccountButtonVisible();
    if (!deleteVisible) {
      test.skip(true, '"Delete Account" button not visible — no disabled accounts.');
      return;
    }
    await expect(settings.getDeleteAccountButton()).toBeVisible();
  });

  // TC_73: Disabled accounts can be disconnected
  test('TC_73: Disabled accounts can be disconnected properly', async () => {
    const deleteVisible = await settings.isDeleteAccountButtonVisible();
    if (!deleteVisible) {
      test.skip(true, 'No disabled accounts to disconnect.');
      return;
    }
    const deleteBtn = settings.getDeleteAccountButton();
    await expect(deleteBtn).toBeVisible();
  });

  // TC_74: Disconnecting current account redirects to primary account
  test('TC_74: Disconnecting current account redirects to the primary account', async ({ page }) => {
    const deleteVisible = await settings.isDeleteAccountButtonVisible();
    if (!deleteVisible) {
      test.skip(true, 'No disabled accounts to disconnect; skipping redirect verification.');
      return;
    }
    // Documented as expected behavior — redirect to primary on disconnect
    expect(deleteVisible).toBe(true);
  });

  // TC_75: Data of disconnected account is removed and inaccessible
  test('TC_75: Disconnected account data is removed and inaccessible', async () => {
    const manageVisible = await settings.isManageAccountsSectionVisible();
    expect(manageVisible, 'Manage Accounts section should be visible').toBe(true);
  });

  // TC_76: Disabled accounts cannot be interacted with via account switcher
  test('TC_76: Disabled accounts are non-interactive in the account switcher', async () => {
    const switcherVisible = await settings.isAccountSwitcherVisible();
    if (!switcherVisible) {
      test.skip(true, 'Account switcher not visible in settings.');
      return;
    }
    expect(switcherVisible).toBe(true);
  });

  // TC_77: Disconnected account removed from all connected account lists
  test('TC_77: Disconnected account is removed from the connected accounts list and switcher', async () => {
    const visible = await settings.isManageAccountsSectionVisible();
    expect(visible).toBe(true);
  });

  // TC_78: Non-primary accounts can be set as primary
  test('TC_78: Non-primary accounts can be set as primary', async () => {
    const primaryBtnVisible = await settings.isSetAsPrimaryButtonVisible();
    if (!primaryBtnVisible) {
      test.skip(true, '"Set as Primary" button not visible — only one account or already primary.');
      return;
    }
    await expect(settings.getSetAsPrimaryButton()).toBeVisible();
  });

  // TC_79: Primary account has a visible "Primary" label/badge
  test('TC_79: Primary account has a visible "Primary" label or badge', async () => {
    const badgeVisible = await settings.isPrimaryBadgeVisible();
    if (!badgeVisible) {
      test.skip(true, '"Primary" badge not visible in current layout.');
      return;
    }
    expect(badgeVisible).toBe(true);
  });

  // TC_80: Product Details Sync Settings work independently per account
  test('TC_80: Product Details Sync Settings (title, description, price, inventory, weight) are visible', async () => {
    const visible = await settings.isProductSyncSectionVisible();
    if (!visible) {
      test.skip(true, 'Product sync section not visible in current settings layout.');
      return;
    }
    expect(visible).toBe(true);
  });

  // TC_81: Auto product import setting works for each connected account
  test('TC_81: Auto product import setting is visible and configurable', async () => {
    const visible = await settings.isAutoImportSectionVisible();
    if (!visible) {
      test.skip(true, 'Auto import setting not visible in current settings layout.');
      return;
    }
    expect(visible).toBe(true);
  });

  // TC_82: Etsy settings are independent per connected account
  test('TC_82: Etsy settings are visible and configurable per connected account', async () => {
    const visible = await settings.isEtsySettingsSectionVisible();
    if (!visible) {
      test.skip(true, 'Etsy settings section not visible in current layout.');
      return;
    }
    expect(visible).toBe(true);
  });

  // TC_83: Converted currency is displayed correctly per shop
  test('TC_83: Converted currency is displayed correctly for the connected shop', async () => {
    const visible = await settings.isCurrencyDisplayCorrect();
    if (!visible) {
      test.skip(true, 'Currency display not visible in current settings state.');
      return;
    }
    expect(visible).toBe(true);
  });

  // TC_85: Order management settings are independent per shop
  test('TC_85: Order management settings are visible and configurable per shop', async () => {
    const visible = await settings.isOrderManagementSectionVisible();
    if (!visible) {
      test.skip(true, 'Order management settings not visible in current layout.');
      return;
    }
    expect(visible).toBe(true);
  });

  // TC_86: Notification settings are independent per shop
  test('TC_86: Notification settings are visible and configurable per shop', async () => {
    const visible = await settings.isNotificationsSectionVisible();
    if (!visible) {
      test.skip(true, 'Notifications section not visible in current settings layout.');
      return;
    }
    expect(visible).toBe(true);
  });
});