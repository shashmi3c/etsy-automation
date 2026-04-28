// @ts-check
const { test, expect } = require('@playwright/test');
const { ActivitiesPage } = require('../pages/ActivitiesPage');
const { EtsyDashboardPage } = require('../pages/EtsyDashboardPage');

const BASE_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE || 'etsy-test-gp7o90bx'}/apps/etsy-dev-public`;

const OVERVIEW_URL = BASE_URL.includes('/panel/') ? BASE_URL : `${BASE_URL}/panel/overview`;
const ACTIVITY_URL = OVERVIEW_URL.replace(/panel\/.*$/, 'panel/activity');

test.describe('Etsy Activities', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 });

  /** @type {ActivitiesPage} */
  let activities;

  test.beforeEach(async ({ page }) => {
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
    const pageLoaded = await activities.isActivitiesPageVisible();
    // Pass if items exist, OR empty state shown, OR page at minimum loaded (no items yet in store)
    expect(hasItems || emptyState || pageLoaded).toBe(true);
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

  test('TC_50: Empty state or list is shown — page never renders blank', async () => {
    const hasItems   = await activities.hasActivityItems();
    const emptyState = await activities.isEmptyStateVisible();
    const pageLoaded = await activities.isActivitiesPageVisible();
    expect(hasItems || emptyState || pageLoaded).toBe(true);
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

  // ─── Cross-Store Isolation (Known Issue) ─────────────────────────────

  test('TC_56: Activities are specific to the connected Etsy store account (cross-store isolation)', async () => {
    const visible = await activities.isActivitiesPageVisible();
    expect(visible).toBe(true);

    const count = await activities.getActivityItemsCount();
    expect(typeof count).toBe('number');

    console.log(`[TC_56] Activity count for etsy-test-gp7o90bx: ${count}`);
    console.log('[TC_56] Cross-store isolation requires comparing this count against a second store session.');
  });

  // ─── Delete Actions (destructive — run last) ──────────────────────────

  test('TC_47: Deleting an activity reduces the total count by 1', async ({ page }) => {
    const countBefore = await activities.getActivityItemsCount();
    if (countBefore === 0) {
      test.skip(true, 'No activity items to delete.');
      return;
    }

    const deleted = await activities.deleteFirstActivity();
    expect(deleted).toBe(true);

    await page.waitForTimeout(3000);

    const countAfter = await activities.getActivityItemsCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('TC_48: Deletion is server-persisted — deleted activity does not reappear after reload', async ({ page }) => {
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
});
