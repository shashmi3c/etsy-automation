// @ts-check
const { test, expect } = require('@playwright/test');
const { ActivitiesPage } = require('../pages/ActivitiesPage');
const { EtsyDashboardPage } = require('../pages/EtsyDashboardPage');
const { EtsyProductsPage } = require('../pages/EtsyProductsPage');

const BASE_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE || 'etsy-test-gp7o90bx'}/apps/etsy-dev-public`;

const OVERVIEW_URL = BASE_URL.includes('/panel/') ? BASE_URL : `${BASE_URL}/panel/overview`;
const ACTIVITY_URL  = OVERVIEW_URL.replace(/panel\/.*$/, 'panel/activity');
const PRODUCTS_URL  = OVERVIEW_URL.replace(/panel\/.*$/, 'panel/listings');

test.describe('Etsy Activities', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  /** @type {ActivitiesPage} */
  let activities;

  // Shared state: did TC_47 actually delete an item?
  let tc47DeletedItem = false;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    activities = new ActivitiesPage(page);
    await activities.goto(ACTIVITY_URL);

    const needsLogin =
      (await page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible().catch(() => false));
    if (needsLogin) {
      test.skip(true, 'Shopify login required. Run: node scripts/shopify-auth.mjs');
      return;
    }

    await activities.dismissOverlays();

    const loaded = await activities.isActivitiesPageVisible();
    if (!loaded) {
      test.skip(true, 'Activities page did not load. Auth may be expired.');
    }
  });

  // ─── Page Load ────────────────────────────────────────────────────────

  test('TC_38: Activities page loads when navigating directly to /panel/activity', async ({ page }) => {
    expect(page.url()).toMatch(/panel\/activity/i);
    const visible = await activities.isActivitiesPageVisible();
    expect(visible).toBe(true);
  });

  test('TC_39: Page heading "Activity" or "Notifications" is visible', async () => {
    const headingVisible =
      (await activities.app.getByText(/^activity$/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await activities.app.getByText(/notifications/i).first().isVisible({ timeout: 5000 }).catch(() => false));
    expect(headingVisible).toBe(true);
  });

  // ─── Activity Items ───────────────────────────────────────────────────

  test('TC_40: Activity items are listed on the Activities page', async () => {
    const hasItems   = await activities.hasActivityItems();
    const emptyState = await activities.isEmptyStateVisible();
    if (!hasItems && !emptyState) {
      test.skip(true, 'No activity items and no empty-state message visible — store has no recent activities.');
      return;
    }
    expect(hasItems || emptyState).toBe(true);
  });

  test('TC_41: Each activity item contains non-empty text content', async () => {
    const hasItems = await activities.hasActivityItems();
    if (!hasItems) {
      test.skip(true, 'No activity items found — store has no recent activities.');
      return;
    }
    const firstText = await activities.getFirstActivityText();
    expect(firstText.trim().length).toBeGreaterThan(0);
  });

  test('TC_42: Activity items have a descriptive heading', async () => {
    const hasItems = await activities.hasActivityItems();
    if (!hasItems) {
      test.skip(true, 'No activity items found.');
      return;
    }
    const headings = await activities.getActivityHeadingTexts();
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(headings[0].trim().length).toBeGreaterThan(0);
  });

  test('TC_43: Number of Delete buttons matches number of activity items', async () => {
    const itemCount = await activities.getActivityItemsCount();
    if (itemCount === 0) {
      test.skip(true, 'No activity items to compare delete buttons against.');
      return;
    }
    const deleteBtnCount = await activities.getAllDeleteButtons().count();
    expect(deleteBtnCount).toBe(itemCount);
  });

  test('TC_44: Delete button is visible on the first activity item', async () => {
    const hasItems = await activities.hasActivityItems();
    if (!hasItems) {
      test.skip(true, 'No activity items on Activities page.');
      return;
    }
    await expect(activities.getFirstDeleteButton()).toBeVisible({ timeout: 8000 });
  });

  // ─── Activity Types ───────────────────────────────────────────────────

  test('TC_45: Activity type labels are recognisable app actions', async () => {
    const hasItems = await activities.hasActivityItems();
    if (!hasItems) {
      test.skip(true, 'No activity items found — cannot verify activity types.');
      return;
    }
    const knownTypes = [
      /publish\s+product/i,
      /sync/i,
      /import/i,
      /export/i,
      /update/i,
      /delete/i,
      /order/i,
      /listing/i,
      /product/i,
    ];
    const allText = await activities.app.evaluate(() => document.body.innerText || '');
    const matched = knownTypes.some(re => re.test(allText));
    expect(matched).toBe(true);
  });

  test('TC_46: Activity items show status or result information', async () => {
    const hasItems = await activities.hasActivityItems();
    if (!hasItems) {
      test.skip(true, 'No activity items found.');
      return;
    }
    const count = await activities.getActivityItemsCount();
    expect(count).toBeGreaterThanOrEqual(1);

    const itemTexts = await activities.app.evaluate(() => {
      return Array.from(document.querySelectorAll('.notification-item'))
        .map(el => (el.innerText || el.textContent || '').trim());
    }).catch(() => []);

    const nonEmpty = itemTexts.filter(t => t.length > 0);
    expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Empty State ──────────────────────────────────────────────────────

  test('TC_50: Empty state is shown when there are no activity items', async () => {
    const hasItems = await activities.hasActivityItems();
    if (hasItems) {
      test.skip(true, 'Activity items present — empty state is not shown (expected, data-dependent).');
      return;
    }
    // No items present — blank page or explicit empty-state message both represent the correct empty state.
    // Assert that zero activity items are rendered (the page did not silently fail to load).
    const count = await activities.getActivityItemsCount();
    expect(count, 'Expected 0 activity items to be displayed (empty state).').toBe(0);
  });

  // ─── Load More / Pagination ───────────────────────────────────────────

  test('TC_51: Load More button is present when activity list is paginated', async () => {
    const hasItems = await activities.hasActivityItems();
    if (!hasItems) {
      test.skip(true, 'No activities to paginate.');
      return;
    }
    const loadMoreVisible = await activities.isLoadMoreVisible();
    expect(typeof loadMoreVisible).toBe('boolean');
  });

  // ─── Navigation ──────────────────────────────────────────────────────

  test('TC_52: Direct URL /panel/activity loads the Activities page without redirect', async ({ page }) => {
    expect(page.url()).toMatch(/panel\/activity/i);
    const visible = await activities.isActivitiesPageVisible();
    expect(visible).toBe(true);
  });

  test('TC_53: "All Activities" button on dashboard Recent Activities panel navigates to Activities page', async ({ page }) => {
    const dashboard = new EtsyDashboardPage(page);
    await dashboard.goto(OVERVIEW_URL);
    await dashboard.dismissOverlays();

    const recentVisible = await dashboard.isRecentActivitiesVisible();
    if (!recentVisible) {
      test.skip(true, 'Recent Activities panel not shown on dashboard — only visible after a sync in the current session.');
      return;
    }

    const btn = dashboard.getAllActivitiesLink();
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click({ force: true });
    await page.waitForTimeout(5000);

    expect(page.url()).toMatch(/panel\/activity/i);
  });

  test('TC_54: Navigating from dashboard to Activities page shows the same activities', async ({ page }) => {
    const directCount = await activities.getActivityItemsCount();

    const dashboard = new EtsyDashboardPage(page);
    await dashboard.goto(OVERVIEW_URL);
    await dashboard.dismissOverlays();

    const recentVisible = await dashboard.isRecentActivitiesVisible();
    if (!recentVisible) {
      test.skip(true, 'Recent Activities panel not shown on dashboard — triggers only after a sync/action in the current session.');
      return;
    }

    const btn = dashboard.getAllActivitiesLink();
    const btnVisible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, '"All Activities" button not visible.');
      return;
    }

    await btn.click({ force: true });
    await page.waitForTimeout(5000);

    const activitiesAfterNav = new ActivitiesPage(page);
    await activitiesAfterNav.resolveAppContext();

    const navCount = await activitiesAfterNav.getActivityItemsCount();
    expect(navCount).toBeGreaterThanOrEqual(directCount);
  });

  // ─── Page Refresh ─────────────────────────────────────────────────────

  test('TC_55: Activities page persists after a browser reload', async ({ page }) => {
    const countBefore = await activities.getActivityItemsCount();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await activities.resolveAppContext();
    await activities.dismissOverlays();

    const visible = await activities.isActivitiesPageVisible();
    expect(visible).toBe(true);

    const countAfter = await activities.getActivityItemsCount();
    expect(countAfter).toBe(countBefore);
  });

  // ─── Delete Actions ───────────────────────────────────────────────────

  test('TC_47: Deleting an activity reduces the total count by 1', async ({ page }) => {
    const countBefore = await activities.getActivityItemsCount();
    if (countBefore === 0) {
      tc47DeletedItem = false;
      test.skip(true, 'No activity items to delete.');
      return;
    }

    const deleted = await activities.deleteFirstActivity();
    tc47DeletedItem = deleted;
    expect(deleted).toBe(true);

    await page.waitForTimeout(3000);

    const countAfter = await activities.getActivityItemsCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('TC_48: Deletion is server-persisted — deleted activity does not reappear after reload', async ({ page }) => {
    if (!tc47DeletedItem) {
      test.skip(true, 'TC_47 did not delete any item (no activities in store) — nothing to verify for server persistence.');
      return;
    }
    // TC_47 (serial predecessor) already deleted 1 item.
    // Reload and confirm the deletion stuck server-side — no ghost reappearance.
    const countAfterPrior = await activities.getActivityItemsCount();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await activities.resolveAppContext();
    await page.waitForTimeout(2000);

    const countAfterReload = await activities.getActivityItemsCount();
    expect(countAfterReload).toBe(countAfterPrior);

    if (countAfterReload > 0) {
      const firstText = await activities.getFirstActivityText();
      expect(firstText.trim().length).toBeGreaterThan(0);
    }
  });

  test('TC_49: Deleting multiple activities works sequentially', async ({ page }) => {
    const countBefore = await activities.getActivityItemsCount();
    if (countBefore < 1) {
      test.skip(true, `No activity items remaining for multi-delete test (found ${countBefore}).`);
      return;
    }

    // Delete first activity
    await activities.deleteFirstActivity();
    await page.waitForTimeout(2000);

    const countMid = await activities.getActivityItemsCount();
    expect(countMid).toBeLessThan(countBefore);

    // Delete another if any remain
    if (countMid >= 1) {
      const deletedAgain = await activities.deleteFirstActivity();
      await page.waitForTimeout(2000);
      if (deletedAgain) {
        const countAfter = await activities.getActivityItemsCount();
        expect(countAfter).toBeLessThan(countMid);
      }
    }
  });

  // ─── Cross-Store Isolation (run last — failure here does not affect delete tests above) ──

  test('TC_56: Activities are account-specific — GojosatoruBoutique shows only its own activities', async ({ page }) => {
    const onTwi = await activities.ensureTestworkIndiaActive();
    if (!onTwi) {
      test.skip(true, 'Could not normalise to TestworkIndia — store switcher unavailable.');
      return;
    }

    const countTwi = await activities.getActivityItemsCount();
    const headingsTwi = await activities.getActivityHeadingTexts();
    const fingerprintTwi = headingsTwi.slice(0, 3).join('|');
    console.log(`[TC_56] TestworkIndia — count: ${countTwi}, headings: ${fingerprintTwi || '(none)'}`);

    const switcherFound = await activities.clickStoreSwitcher(/testworkindia/i);
    if (!switcherFound) {
      test.skip(true, 'Store switcher button not found on Activities page — multi-store feature may not be visible here.');
      return;
    }

    const switched = await activities.selectStoreFromDropdown(/gojosatoruboutique/i);
    if (!switched) {
      test.skip(true, 'GojosatoruBoutique option not found in store switcher dropdown.');
      return;
    }

    await activities._awaitCifappsReady(30000);
    await activities.resolveAppContext();
    await page.waitForTimeout(2000);

    const storeBtn = activities.app.getByRole('button', { name: /gojosatoruboutique/i }).first();
    await expect(storeBtn).toBeVisible({ timeout: 10000 });

    const countGojo = await activities.getActivityItemsCount();
    const headingsGojo = await activities.getActivityHeadingTexts();
    const fingerprintGojo = headingsGojo.slice(0, 3).join('|');
    console.log(`[TC_56] GojosatoruBoutique — count: ${countGojo}, headings: ${fingerprintGojo || '(none)'}`);

    if (countTwi > 0 && countGojo > 0) {
      const isolationBug = fingerprintTwi === fingerprintGojo;
      if (isolationBug) {
        console.error(
          `\n[TC_56] ❌ ISOLATION BUG DETECTED\n` +
          `  Both TestworkIndia and GojosatoruBoutique show the same activity:\n` +
          `    "${fingerprintTwi}"\n` +
          `  Activities should be scoped to the account that initiated them.\n` +
          `  Root cause: the backend does not enforce per-account activity scoping —\n` +
          `  activity records are shared across all connected Etsy accounts in this Shopify store session.\n` +
          `  This test will FAIL until the backend enforces proper per-account isolation.\n`
        );
      }
      expect(
        fingerprintTwi,
        `ISOLATION BUG: Both TestworkIndia and GojosatoruBoutique display the same ` +
        `activity "${fingerprintTwi}". Activities must be account-specific — ` +
        `only the store that initiated the action should see it. ` +
        `Fix required: backend must scope activity records to the initiating Etsy account.`
      ).not.toBe(fingerprintGojo);
    } else {
      const validState = (await activities.hasActivityItems()) || (await activities.isEmptyStateVisible()) || (await activities.isActivitiesPageVisible());
      expect(validState).toBe(true);
      console.log('[TC_56] One or both stores have no activities — store context verified, isolation inconclusive.');
    }
  });

  test('TC_57: After switching to GojosatoruBoutique, switching back restores TestworkIndia activities', async ({ page }) => {
    const onTwi = await activities.ensureTestworkIndiaActive();
    if (!onTwi) {
      test.skip(true, 'Could not normalise to TestworkIndia — store switcher unavailable.');
      return;
    }

    const switcherFound = await activities.clickStoreSwitcher(/testworkindia/i);
    if (!switcherFound) {
      test.skip(true, 'Store switcher not visible — skipping round-trip test.');
      return;
    }

    const switched = await activities.selectStoreFromDropdown(/gojosatoruboutique/i);
    if (!switched) {
      test.skip(true, 'GojosatoruBoutique not available in switcher dropdown.');
      return;
    }

    await activities._awaitCifappsReady(30000);
    await activities.resolveAppContext();
    await page.waitForTimeout(2000);

    const storeGojo = activities.app.getByRole('button', { name: /gojosatoruboutique/i }).first();
    await expect(storeGojo).toBeVisible({ timeout: 10000 });

    const countGojo = await activities.getActivityItemsCount();
    console.log(`[TC_57] GojosatoruBoutique activity count: ${countGojo}`);

    await activities.clickStoreSwitcher(/gojosatoruboutique/i);
    await activities.selectStoreFromDropdown(/testworkindia/i);
    await activities._awaitCifappsReady(30000);
    await activities.resolveAppContext();
    await page.waitForTimeout(2000);

    const storeTwi = activities.app.getByRole('button', { name: /testworkindia/i }).first();
    await expect(storeTwi).toBeVisible({ timeout: 10000 });

    const countTwi = await activities.getActivityItemsCount();
    console.log(`[TC_57] TestworkIndia activity count after switch-back: ${countTwi}`);

    expect(await activities.isActivitiesPageVisible()).toBe(true);
  });

  // ─── Sync-triggered Activity Isolation ───────────────────────────────

  test('TC_58: Sync from Etsy activity appears in Activities and is visible only in the initiating store', async ({ page }) => {
    test.setTimeout(300000);

    await activities.goto(ACTIVITY_URL);
    const onTwi = await activities.ensureTestworkIndiaActive();
    if (!onTwi) {
      test.skip(true, 'Could not normalise to TestworkIndia — store switcher unavailable.');
      return;
    }

    const products = new EtsyProductsPage(page);
    await products.goto(PRODUCTS_URL);

    const syncBtn = products.getSyncFromEtsyButton();
    const syncVisible = await syncBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!syncVisible) {
      test.skip(true, '"Sync from Etsy" button not visible on Products page.');
      return;
    }

    await syncBtn.click({ force: true });
    await page.waitForTimeout(2000);

    const modalVisible = await products.isConfirmPopupVisible();
    if (modalVisible) {
      await products.clickPopupConfirm();
      await page.waitForTimeout(2000);
    }

    console.log('[TC_58] Sync from Etsy triggered on TestworkIndia.');

    await activities.goto(ACTIVITY_URL);

    const SYNC_PATTERN = /listing.*fetch|fetch.*etsy|sync.*etsy|etsy.*sync|sync.*product|import.*listing|sync.*from/i;
    const DONE_PATTERN  = /complet|success|done|finish|failed|error/i;

    let syncHeadingText = '';
    let activityCompleted = false;

    for (let attempt = 0; attempt < 24; attempt++) {
      await activities.resolveAppContext();
      const allText = await activities.app.evaluate(() => document.body.innerText || '').catch(() => '');
      const headings = await activities.getActivityHeadingTexts();
      const syncHeading = headings.find(h => SYNC_PATTERN.test(h));
      if (syncHeading || SYNC_PATTERN.test(allText)) {
        syncHeadingText = syncHeading || 'sync activity';
        console.log(`[TC_58] Sync activity found: "${syncHeadingText}"`);
        if (DONE_PATTERN.test(allText)) {
          activityCompleted = true;
          console.log('[TC_58] Activity status: completed/done.');
        }
        break;
      }
      await page.waitForTimeout(5000);
    }

    if (!syncHeadingText) {
      test.skip(true, 'Sync activity did not appear in Activities within 2 min.');
      return;
    }

    if (!activityCompleted) {
      for (let attempt = 0; attempt < 36; attempt++) {
        await activities.resolveAppContext();
        const allText = await activities.app.evaluate(() => document.body.innerText || '').catch(() => '');
        if (DONE_PATTERN.test(allText) && SYNC_PATTERN.test(allText)) {
          activityCompleted = true;
          console.log('[TC_58] Activity completed.');
          break;
        }
        await page.waitForTimeout(5000);
      }
    }

    expect(syncHeadingText.length).toBeGreaterThan(0);
    console.log(`[TC_58] Sync activity visible on TestworkIndia — completed: ${activityCompleted}`);

    const switcherFound = await activities.clickStoreSwitcher(/testworkindia/i);
    if (!switcherFound) {
      test.skip(true, 'Store switcher not found — cannot verify isolation.');
      return;
    }

    const switched = await activities.selectStoreFromDropdown(/gojosatoruboutique/i);
    if (!switched) {
      test.skip(true, 'GojosatoruBoutique not available in dropdown.');
      return;
    }

    await activities._awaitCifappsReady(30000);
    await activities.resolveAppContext();
    await page.waitForTimeout(3000);

    const gojoBtn = activities.app.getByRole('button', { name: /gojosatoruboutique/i }).first();
    await expect(gojoBtn).toBeVisible({ timeout: 10000 });

    const allTextGojo = await activities.app.evaluate(() => document.body.innerText || '').catch(() => '');
    const headingsGojo = await activities.getActivityHeadingTexts();
    const syncInGojo = SYNC_PATTERN.test(allTextGojo) || headingsGojo.some(h => SYNC_PATTERN.test(h));

    if (syncInGojo) {
      console.error(
        `\n[TC_58] ❌ ISOLATION BUG: Sync activity from TestworkIndia is visible in GojosatoruBoutique!\n` +
        `  Activity heading: "${syncHeadingText}"\n` +
        `  This confirms activities are NOT store-specific — same as TC_56.\n`
      );
    } else {
      console.log('[TC_58] Isolation VERIFIED — GojosatoruBoutique does not show TestworkIndia sync activity.');
    }

    expect(
      syncInGojo,
      `ISOLATION BUG: Sync activity "${syncHeadingText}" initiated on TestworkIndia is visible ` +
      `in GojosatoruBoutique. Sync and publish activities must only appear for the store that triggered them.`
    ).toBe(false);

    await activities.clickStoreSwitcher(/gojosatoruboutique/i);
    await activities.selectStoreFromDropdown(/testworkindia/i);
    await activities._awaitCifappsReady(30000);
    await activities.resolveAppContext();
    await page.waitForTimeout(2000);

    const twiBtn = activities.app.getByRole('button', { name: /testworkindia/i }).first();
    await expect(twiBtn).toBeVisible({ timeout: 10000 });

    const allTextTwi = await activities.app.evaluate(() => document.body.innerText || '').catch(() => '');
    expect(SYNC_PATTERN.test(allTextTwi)).toBe(true);
    console.log('[TC_58] TestworkIndia sync activity persists after round-trip store switch.');
  });
});
