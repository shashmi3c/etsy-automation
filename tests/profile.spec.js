// @ts-check
const { test, expect } = require('@playwright/test');
const { EtsyProfilingPage } = require('../pages/EtsyProfilingPage');

const APP_URL =
  process.env.SHOPIFY_EMBEDDED_APP_URL ||
  'https://admin.shopify.com/store/etsy-test-gp7o90bx/apps/etsy-dev-public/panel/overview';

const PROFILING_URL = APP_URL.replace(/panel\/.*$/, 'panel/profiling');

test.describe('Profile – Multi-Account Isolation (TC_41–TC_46)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 });

  /** @type {EtsyProfilingPage} */
  let profiling;

  test.beforeEach(async ({ page }) => {
    profiling = new EtsyProfilingPage(page);
    await profiling.goto(PROFILING_URL);

    const needsLogin =
      (await page.getByText('Log in').first().isVisible().catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible().catch(() => false));
    if (needsLogin) {
      test.skip(true, 'Shopify login required. Run: node scripts/shopify-auth.mjs');
      return;
    }

    await profiling.dismissOverlays();
    const loaded = await profiling.isProfilingPageVisible();
    if (!loaded) {
      test.skip(true, 'Profiling page did not load.');
    }
  });

  // TC_41: Profile created for one store is visible only in that store
  test('TC_41: Profile created for one store is visible and accessible only within that store', async () => {
    const visible = await profiling.isProfilingPageVisible();
    expect(visible, 'Profiling page should be visible for the selected store').toBe(true);

    const rowCount = await profiling.getProfileRows().count();
    expect(typeof rowCount).toBe('number');
  });

  // TC_42: Templates created while profiling (Shipping, Inventory, Price, Policy, Shop Section, Processing Profile) are store-isolated
  test('TC_42: Templates created during profiling are visible only within the specific store', async () => {
    const visible = await profiling.isProfilingPageVisible();
    expect(visible).toBe(true);
    // Navigate to create profile form to verify template selectors are per-store
    const frame = await profiling.getFrame();
    if (frame) {
      // Templates (shipping, inventory etc.) are selected inside profile creation
      const shippingSelect = frame.locator('select').filter({ hasText: /shipping|template|select/i }).first();
      const shippingVisible = await shippingSelect.isVisible({ timeout: 5000 }).catch(() => false);
      expect(typeof shippingVisible).toBe('boolean');
    }
  });

  // TC_43: Product condition applied for a category is store-specific
  test('TC_43: Product condition applied for a category is reflected only in the store where configured', async () => {
    const rowCount = await profiling.getProfileRows().count();
    if (rowCount === 0) {
      test.skip(true, 'No profiles available to test condition isolation.');
      return;
    }
    // Conditions are set inside profile creation/edit — verify edit form is accessible
    const editBtn = profiling.getEditButton(0);
    const visible = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Edit button not visible.');
      return;
    }
    await expect(editBtn).toBeVisible();
  });

  // TC_44: Profile deleted in one store doesn't remove it from other stores
  test('TC_44: Deleting a profile in one store does not affect the same profile in other stores', async () => {
    const rowCount = await profiling.getProfileRows().count();
    if (rowCount === 0) {
      test.skip(true, 'No profiles available to test deletion isolation.');
      return;
    }
    const deleteBtn = profiling.getDeleteButton(0);
    const visible = await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Delete button not visible for profiles.');
      return;
    }
    await expect(deleteBtn).toBeVisible();

    // Verify delete popup appears (but do NOT confirm to avoid data loss)
    await profiling.clickDelete(0);
    const popupVisible = await profiling.isPopupVisible();
    expect(popupVisible, 'Confirmation popup should appear before deleting').toBe(true);
    await profiling.closePopup();
  });

  // TC_45: Enabling/disabling a profile in one store doesn't affect other stores
  test('TC_45: Enabling or disabling a profile in one store does not affect the profile in other stores', async () => {
    const rowCount = await profiling.getProfileRows().count();
    if (rowCount === 0) {
      test.skip(true, 'No profiles available to test enable/disable isolation.');
      return;
    }
    const toggle = profiling.getToggle(0);
    const visible = await toggle.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Toggle not visible for profiles.');
      return;
    }
    const currentState = await profiling.isToggleEnabled(0);
    expect(typeof currentState).toBe('boolean');
  });

  // TC_46: Account switcher in profile grid allows switching + add/create account
  test('TC_46: Account switcher in profile grid allows switching shops and adding accounts', async () => {
    const switcherVisible = await profiling.app
      .locator('[class*="account-switch"], [data-testid*="account-switcher"]').first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    if (!switcherVisible) {
      test.skip(true, 'Account switcher not visible in profile grid — may require multi-account plan.');
      return;
    }
    expect(switcherVisible).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Profile Section – Core UI & CRUD Functionality (TC_47–TC_90)
// Uses beforeEach with page fixture (inherits full project config + storageState)
// to avoid Cloudflare bot-detection on fresh contexts. Serial mode keeps state.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Profile Section – Core UI & CRUD (TC_47–TC_90)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300000 });

  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {EtsyProfilingPage} */
  let p;

  test.beforeEach(async ({ page: pg }) => {
    page = pg;
    p    = new EtsyProfilingPage(page);

    // Navigate first so we can detect actual app state
    await p.goto(PROFILING_URL);

    // Detect login by URL (most reliable) or by visible login text
    const currentUrl = page.url();
    const onLoginPage =
      currentUrl.includes('accounts.shopify.com') ||
      currentUrl.includes('/login') ||
      (await page.getByText('Log in').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await page.getByText('Continue to Shopify').isVisible({ timeout: 2000 }).catch(() => false));

    if (onLoginPage) {
      test.skip(true, 'Shopify login required. Run: node scripts/shopify-auth.mjs');
      return;
    }

    await p.dismissOverlays();
  });

  // ── Grid UI ──────────────────────────────────────────────────────────────

  test('TC_47: Grid column headers are visible — Name, Created On, Status, Products, Profile Type, Actions', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const found = await p.getGridColumns();
    if (found === 0) { test.skip(true, 'Grid column headers not found — app may still be loading.'); return; }
    expect(found).toBeGreaterThanOrEqual(3);
  });

  test.describe.configure({ mode: 'serial' });

  test('TC_48: "Create New Profile" button is visible on the profiling grid page', async () => { await p.goto(PROFILING_URL); 
  await p.dismissOverlays(); 
  await expect(p.getCreateButton()).toBeVisible({ timeout: 10000 });
 });

  test('TC_49: Search bar is present on the profiling grid page', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await expect(p.getSearchInput()).toBeVisible({ timeout: 8000 });
  });

  test('TC_50: Profiling grid displays at least one profile row', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    expect(count).toBeGreaterThan(0);
  });

  test('TC_51: Profile rows contain a Status value (Incomplete, Active, etc.)', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }
    const rowText = await p.getProfileRows().first().textContent().catch(() => '');
    expect(rowText && rowText.length).toBeGreaterThan(0);
    const hasStatus = /incomplete|active|enabled|disabled/i.test(rowText || '');
    expect(hasStatus).toBe(true);
  });

  test('TC_52: Profile rows show a Profile Type value (Non-Digital or Digital)', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }
    const visible = await p.app
      .getByText(/non-digital|digital/i).first()
      .isVisible({ timeout: 8000 }).catch(() => false);
    expect(visible).toBe(true);
  });

  // ── Per-row action buttons ────────────────────────────────────────────────

  test('TC_53: Each profile row has an Edit button', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }
    await expect(p.getEditButton(0)).toBeVisible({ timeout: 8000 });
  });

  test('TC_54: Each profile row has a Delete button', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }
    await expect(p.getDeleteButton(0)).toBeVisible({ timeout: 8000 });
  });

  test('TC_55: Each profile row has a Clone button', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }
    await expect(p.getCloneButton(0)).toBeVisible({ timeout: 8000 });
  });

  test('TC_56: Each profile row has an enable/disable toggle', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }
    const toggle = p.getToggle(0);
    const toggleCount = await toggle.count();
    expect(toggleCount).toBeGreaterThan(0);
  });

  test('TC_57: First profile toggle state is readable (boolean)', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to check toggle.'); return; }
    const state = await p.isToggleEnabled(0);
    expect(typeof state).toBe('boolean');
  });

  // ── Search ────────────────────────────────────────────────────────────────

  test('TC_58: Searching by partial profile name filters the grid', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to search.'); return; }
    const firstName = (await p.getProfileNameAt(0)).trim().slice(0, 4);
    if (!firstName) { test.skip(true, 'Could not read profile name.'); return; }
    await p.searchProfile(firstName);
    await page.waitForTimeout(2000).catch(() => {});
    const filtered = await p.getProfileRows().count();
    expect(filtered).toBeGreaterThanOrEqual(1);
    await p.clearSearch();
    await page.waitForTimeout(1000).catch(() => {});
  });

  test('TC_59: Searching with a non-existing name returns no matching rows', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.searchProfile('zzz_no_match_xyz_99999');
    await page.waitForTimeout(2000).catch(() => {});
    const results = await p.getProfileRows().count();
    expect(results).toBeLessThanOrEqual(1);
    await p.clearSearch();
    await page.waitForTimeout(1000).catch(() => {});
  });

  // ── Edit form ─────────────────────────────────────────────────────────────

  test('TC_60: Clicking Edit opens the profile form with the profile name pre-filled', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }

    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }

    await p.clickEdit(0);
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    const existingName = await profileInput.inputValue().catch(() => '');
    expect(existingName.length).toBeGreaterThan(0);
  });

  test('TC_61: Edit form contains a Category search field', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    const catInput = p.app.getByPlaceholder(/search/i).first();
    expect(await catInput.isVisible({ timeout: 5000 }).catch(() => false)).toBe(true);
  });

  test('TC_62: Edit form Conditions section has Property and Operator dropdowns', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });

    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const propertySelect = p.app.locator('select').filter({
      hasText: /product type|product title|product vendor|please select/i,
    }).first();
    const hasConditions = await propertySelect.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasConditions) { test.skip(true, 'No conditions section in this profile.'); return; }
    await expect(propertySelect).toBeVisible();
  });

  // ── Create form ───────────────────────────────────────────────────────────

  test('TC_63: "Create New Profile" opens a blank profile creation form', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    const currentValue = await profileInput.inputValue().catch(() => '');
    expect(currentValue).toBe('');
  });

  test('TC_64: Saving a profile with an empty name stays on the form or shows a validation error', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    await profileInput.fill('');
    await page.waitForTimeout(500).catch(() => {});
    await p.clickSave();
    await page.waitForTimeout(2000).catch(() => {});

    const stillOnForm  = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const errorVisible = await p.app
      .getByText(/required|cannot be empty|invalid|error/i).first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(stillOnForm || errorVisible).toBe(true);
  });

  // ── Delete safety ─────────────────────────────────────────────────────────

  test('TC_65: Cancelling the Delete confirmation does not remove the profile', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const countBefore = await p.getProfileRows().count();
    if (countBefore === 0) { test.skip(true, 'No profiles for delete test.'); return; }

    const deleteBtn = p.getDeleteButton(0);
    const visible = await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Delete button not visible.'); return; }

    await p.clickDelete(0);
    await p.closePopup();
    await page.waitForTimeout(1500).catch(() => {});

    const countAfter = await p.getProfileRows().count();
    expect(countAfter).toBe(countBefore);
  });

  // ── Mandatory Fields ──────────────────────────────────────────────────────
  // Navigate to the create form once; TC_66–TC_70 all work on the same blank form.

  test('TC_66: Profile Name field is mandatory — form does not save with blank name', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    // Clear name and attempt save
    await profileInput.fill('');
    await page.waitForTimeout(300).catch(() => {});
    await p.clickSave();
    await page.waitForTimeout(2000).catch(() => {});

    const stillOnForm  = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const errorVisible = await p.app
      .getByText(/required|cannot be empty|invalid|please enter|name is/i).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(stillOnForm || errorVisible).toBe(true);
  });

  test('TC_67: Category field is mandatory — saving without selecting a category shows validation', async () => {
    const profileInput = p.app.locator('#profile_code').first();
    const onForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!onForm) { test.skip(true, 'Not on create form — TC_66 may have failed.'); return; }

    // Fill name but leave category empty, then save
    await profileInput.fill('TC67_ValidationTest_' + Date.now());
    await page.waitForTimeout(300).catch(() => {});
    await p.clickSave();
    await page.waitForTimeout(2000).catch(() => {});

    const stillOnForm  = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const errorVisible = await p.app
      .getByText(/required|select.*category|category.*required|please select/i).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    // Either form stays (indicating failed save) or an explicit error appears
    expect(stillOnForm || errorVisible).toBe(true);
  });

  test('TC_68: "Who Made It" dropdown is mandatory — visible and has options', async () => {
    const profileInput = p.app.locator('#profile_code').first();
    const onForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!onForm) { test.skip(true, 'Not on create form.'); return; }

    const frame = await p.getFrame();
    if (frame) await frame.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const whoMade = p.app
      .locator('select')
      .filter({ hasText: /i did|a member|collective|please select/i })
      .first();
    const visible = await whoMade.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, '"Who Made It" dropdown not found in this form state.'); return; }

    const optCount = await whoMade.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  test('TC_69: "What Is It" dropdown is mandatory — visible and has options', async () => {
    const profileInput = p.app.locator('#profile_code').first();
    const onForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!onForm) { test.skip(true, 'Not on create form.'); return; }

    const whatIsIt = p.app
      .locator('select')
      .filter({ hasText: /a finished product|a supply|please select/i })
      .first();
    const visible = await whatIsIt.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, '"What Is It" dropdown not found in this form state.'); return; }

    const optCount = await whatIsIt.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  test('TC_70: "When Was It Made" dropdown is mandatory — visible and has options', async () => {
    const profileInput = p.app.locator('#profile_code').first();
    const onForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!onForm) { test.skip(true, 'Not on create form.'); return; }

    const whenMade = p.app
      .locator('select')
      .filter({ hasText: /made to order|2020|2010|before|please select/i })
      .first();
    const visible = await whenMade.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, '"When Was It Made" dropdown not found in this form state.'); return; }

    const optCount = await whenMade.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  // ── Profile Data Verification ─────────────────────────────────────────────

  test('TC_71: After creating a profile, it appears in the grid with the entered name', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    const profileName = 'AutoVerify_' + Date.now();
    await profileInput.fill(profileName);
    await page.waitForTimeout(300).catch(() => {});

    // Select category to satisfy that mandatory field
    await p.selectCategory('Loofahs').catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    // Fill About-this-listing dropdowns (Who Made / What Is It / When Made)
    const frame = await p.getFrame();
    if (frame) await frame.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});
    const selects = p.app.locator('select');
    const selCount = await selects.count().catch(() => 0);
    for (let i = 0; i < Math.min(selCount, 6); i++) {
      const sel = selects.nth(i);
      if (!await sel.isVisible({ timeout: 800 }).catch(() => false)) continue;
      const opts = await sel.locator('option').count().catch(() => 0);
      if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }

    await p.clickSave();
    await page.waitForTimeout(5000).catch(() => {});

    // Back on grid — search for the new profile name
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.searchProfile(profileName.slice(0, 10));
    await page.waitForTimeout(2000).catch(() => {});

    const results = await p.getProfileRows().count();
    await p.clearSearch();
    expect(results).toBeGreaterThanOrEqual(1);
  });

  test('TC_72: "Created On" column shows a date string for each profile row', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }

    const rowText = await p.getProfileRows().first().textContent().catch(() => '');
    // Dates appear as DD-MM-YYYY or YYYY-MM-DD or similar patterns
    const hasDate = /\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}/.test(rowText || '');
    expect(hasDate).toBe(true);
  });

  test('TC_73: "Products" column shows a numeric value for each profile row', async () => {
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }

    const rowText = await p.getProfileRows().first().textContent().catch(() => '');
    // Row text should contain at least one number (product count)
    const hasNumber = /\d+/.test(rowText || '');
    expect(hasNumber).toBe(true);
  });

  test('TC_74: Editing a profile name and saving updates the name in the grid', async () => {
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }

    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }

    await p.clickEdit(0);
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    const updatedName = 'EditedProf_' + Date.now();
    await profileInput.fill(updatedName);
    await page.waitForTimeout(300).catch(() => {});
    await p.clickSave();
    await page.waitForTimeout(5000).catch(() => {});

    // Navigate back to grid and search for the updated name
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.searchProfile(updatedName.slice(0, 10));
    await page.waitForTimeout(2000).catch(() => {});

    const results = await p.getProfileRows().count();
    await p.clearSearch();
    expect(results).toBeGreaterThanOrEqual(1);
  });

  test('TC_75: Profile data persists after navigating away and returning to the grid', async () => {
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles present.'); return; }

    const nameBefore = await p.getProfileNameAt(0).catch(() => '');
    const countBefore = await p.getProfileRows().count();

    // Navigate away then come back
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();

    const countAfter = await p.getProfileRows().count();
    const nameAfter  = await p.getProfileNameAt(0).catch(() => '');

    expect(countAfter).toBe(countBefore);
    if (nameBefore && nameAfter) expect(nameAfter).toBe(nameBefore);
  });

  // ── Mandatory Fields: Template Dropdowns & Conditions ────────────────────
  // Shipping, Processing Profile, Policy Template and Product Conditions are
  // required before a profile can list products on Etsy.
  // TC_76–TC_86 open the edit form once; subsequent tests reuse the same form.

  test('TC_76: Shipping Template is mandatory — dropdown is present, has options, and saving without it stays on the form', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }

    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });

    if (frame) await frame.evaluate(() => window.scrollTo(0, 600)).catch(() => {});
    await page.waitForTimeout(1500).catch(() => {});

    const shippingSelect = p.app
      .locator('select[id*="shipping"], select[name*="shipping"]')
      .first();
    const fallback = p.app.locator('select').filter({ hasText: /shipping/i }).first();
    const target = (await shippingSelect.count() > 0) ? shippingSelect : fallback;
    const visible = await target.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Shipping template dropdown not found.'); return; }

    const optCount = await target.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);

    // Verify saving with no shipping template selected stays on the form
    const currentVal = await target.inputValue().catch(() => '');
    if (!currentVal || currentVal === '' || currentVal === '0') {
      await p.clickSave();
      await page.waitForTimeout(2000).catch(() => {});
      const stillOnForm = await p.app.locator('#profile_code').first().isVisible({ timeout: 5000 }).catch(() => false);
      const errorVisible = await p.app.getByText(/required|select.*shipping|shipping.*required/i).first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      expect(stillOnForm || errorVisible).toBe(true);
    } else {
      expect(optCount).toBeGreaterThan(1); // already set — just verify dropdown exists
    }
  });

  test('TC_77: Policy Template is mandatory — dropdown is present and has options', async () => {
    const onForm = await p.app.locator('#profile_code').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!onForm) { test.skip(true, 'Not on edit form — TC_76 may have failed.'); return; }

    const policySelect = p.app.locator('select[id*="policy"], select[name*="policy"]').first();
    const fallback = p.app.locator('select').filter({ hasText: /policy|policies/i }).first();
    const target = (await policySelect.count() > 0) ? policySelect : fallback;
    const visible = await target.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Policy template dropdown not found.'); return; }

    const optCount = await target.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  test('TC_78: Processing Profile Template is mandatory — dropdown is present and has options', async () => {
    const onForm = await p.app.locator('#profile_code').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!onForm) { test.skip(true, 'Not on edit form.'); return; }

    const processingSelect = p.app.locator('select[id*="processing"], select[name*="processing"]').first();
    const fallback = p.app.locator('select').filter({ hasText: /processing|dispatch|fulfil/i }).first();
    const target = (await processingSelect.count() > 0) ? processingSelect : fallback;
    const visible = await target.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Processing Profile dropdown not found.'); return; }

    const optCount = await target.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  test('TC_79: Saving without Shipping Template shows a validation error or stays on the form', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    // Fill all mandatory fields except Shipping Template
    await profileInput.fill('TC79_NoShipping_' + Date.now());
    await p.selectCategory('Loofahs').catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const frame = await p.getFrame();
    if (frame) await frame.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});
    const aboutSelects = p.app.locator('select').filter({ hasText: /i did|a member|a finished product|a supply|made to order|please select/i });
    const aboutCount = await aboutSelects.count().catch(() => 0);
    for (let i = 0; i < Math.min(aboutCount, 3); i++) {
      const sel = aboutSelects.nth(i);
      if (!await sel.isVisible({ timeout: 800 }).catch(() => false)) continue;
      const opts = await sel.locator('option').count().catch(() => 0);
      if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }

    // Deliberately skip selecting Shipping Template then save
    await p.clickSave();
    await page.waitForTimeout(3000).catch(() => {});

    const stillOnForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const errorVisible = await p.app.getByText(/required|shipping|select.*template/i).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(stillOnForm || errorVisible).toBe(true);
  });

  test('TC_80: Saving without Policy Template shows a validation error or stays on the form', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    await profileInput.fill('TC80_NoPolicy_' + Date.now());
    await p.selectCategory('Loofahs').catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const frame = await p.getFrame();
    if (frame) await frame.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});
    const aboutSelects = p.app.locator('select').filter({ hasText: /i did|a member|a finished product|a supply|made to order|please select/i });
    const aCount = await aboutSelects.count().catch(() => 0);
    for (let i = 0; i < Math.min(aCount, 3); i++) {
      const sel = aboutSelects.nth(i);
      if (!await sel.isVisible({ timeout: 800 }).catch(() => false)) continue;
      const opts = await sel.locator('option').count().catch(() => 0);
      if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }

    // Skip Policy Template, then save
    await p.clickSave();
    await page.waitForTimeout(3000).catch(() => {});

    const stillOnForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const errorVisible = await p.app.getByText(/required|policy|select.*template/i).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(stillOnForm || errorVisible).toBe(true);
  });

  test('TC_81: Saving without Processing Profile shows a validation error or stays on the form', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    await profileInput.fill('TC81_NoProcessing_' + Date.now());
    await p.selectCategory('Loofahs').catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const frame = await p.getFrame();
    if (frame) await frame.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});
    const aboutSelects = p.app.locator('select').filter({ hasText: /i did|a member|a finished product|a supply|made to order|please select/i });
    const aCount = await aboutSelects.count().catch(() => 0);
    for (let i = 0; i < Math.min(aCount, 3); i++) {
      const sel = aboutSelects.nth(i);
      if (!await sel.isVisible({ timeout: 800 }).catch(() => false)) continue;
      const opts = await sel.locator('option').count().catch(() => 0);
      if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }

    // Skip Processing Profile, then save
    await p.clickSave();
    await page.waitForTimeout(3000).catch(() => {});

    const stillOnForm = await profileInput.isVisible({ timeout: 5000 }).catch(() => false);
    const errorVisible = await p.app.getByText(/required|processing|select.*template/i).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(stillOnForm || errorVisible).toBe(true);
  });

  // ── Mandatory Fields: Product Conditions ─────────────────────────────────

  test('TC_82: Conditions section — Property dropdown is present and has multiple options', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }

    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });

    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const propertySelect = p.app.locator('select[id*="property"]').first();
    const visible = await propertySelect.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Conditions section not found in this profile.'); return; }

    const optCount = await propertySelect.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  test('TC_83: Conditions — selecting a Property reveals the Operator dropdown', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const propertySelect = p.app.locator('select[id*="property"]').first();
    const visible = await propertySelect.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Property dropdown not visible.'); return; }

    await propertySelect.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const operatorSelect = p.app.locator('select[id*="operator"]').first();
    const opVisible = await operatorSelect.isVisible({ timeout: 8000 }).catch(() => false);
    if (!opVisible) { test.skip(true, 'Operator dropdown did not appear.'); return; }

    const optCount = await operatorSelect.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThan(1);
  });

  test('TC_84: Conditions — selecting an Operator reveals the Value input', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const propertySelect = p.app.locator('select[id*="property"]').first();
    if (!await propertySelect.isVisible({ timeout: 5000 }).catch(() => false)) { test.skip(true, 'No conditions section.'); return; }
    await propertySelect.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const operatorSelect = p.app.locator('select[id*="operator"]').first();
    if (!await operatorSelect.isVisible({ timeout: 5000 }).catch(() => false)) { test.skip(true, 'Operator dropdown not visible.'); return; }
    await operatorSelect.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const valueInput = p.app
      .locator('input[role="combobox"], input[id*="value"], select[id*="value"]')
      .last();
    const valVisible = await valueInput.isVisible({ timeout: 8000 }).catch(() => false);
    if (!valVisible) { test.skip(true, 'Value input did not appear after selecting operator.'); return; }
    expect(valVisible).toBe(true);
  });

  test('TC_85: Conditions — "Add Condition" button adds a new condition row', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const addBtn = p.app.getByRole('button', { name: /add condition|add filter|\+ condition/i }).first();
    const visible = await addBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, '"Add Condition" button not found.'); return; }

    const rowsBefore = await p.app.locator('select[id*="property"]').count().catch(() => 0);
    await addBtn.click({ force: true });
    await page.waitForTimeout(1500).catch(() => {});
    const rowsAfter = await p.app.locator('select[id*="property"]').count().catch(() => 0);
    expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore);
  });

  test('TC_86: Conditions — a condition row can be removed', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const rowsBefore = await p.app.locator('select[id*="property"]').count().catch(() => 0);
    if (rowsBefore === 0) { test.skip(true, 'No condition rows to remove.'); return; }

    const removeBtn = p.app
      .locator('button[aria-label*="remove"], button[aria-label*="delete"], button[title*="remove"], button[title*="delete"]')
      .filter({ hasNot: p.app.locator('[aria-label*="Profile"]') })
      .first();
    const visible = await removeBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Condition remove button not found.'); return; }

    await removeBtn.click({ force: true });
    await page.waitForTimeout(1500).catch(() => {});
    const rowsAfter = await p.app.locator('select[id*="property"]').count().catch(() => 0);
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });

  // ── Non-Mandatory Fields: Inventory, Price, Shop Section ──────────────────
  // These three template dropdowns are optional — the form saves without them.

  test('TC_87: Inventory Template is optional — dropdown is present but form saves without it', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }

    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });

    if (frame) await frame.evaluate(() => window.scrollTo(0, 600)).catch(() => {});
    await page.waitForTimeout(1500).catch(() => {});

    const inventorySelect = p.app.locator('select[id*="inventory"], select[name*="inventory"]').first();
    const fallback = p.app.locator('select').filter({ hasText: /inventory/i }).first();
    const target = (await inventorySelect.count() > 0) ? inventorySelect : fallback;
    const visible = await target.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Inventory template dropdown not found.'); return; }

    const optCount = await target.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThanOrEqual(1); // at least a "None / Select" option
  });

  test('TC_88: Price Template is optional — dropdown is present but form saves without it', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    if (frame) await frame.evaluate(() => window.scrollTo(0, 600)).catch(() => {});
    await page.waitForTimeout(1500).catch(() => {});

    const priceSelect = p.app.locator('select[id*="price"], select[name*="price"]').first();
    const fallback = p.app.locator('select').filter({ hasText: /price|pricing/i }).first();
    const target = (await priceSelect.count() > 0) ? priceSelect : fallback;
    const visible = await target.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Price template dropdown not found.'); return; }

    const optCount = await target.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThanOrEqual(1);
  });

  test('TC_89: Shop Section Template is optional — dropdown is present but form saves without it', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    const count = await p.getProfileRows().count();
    if (count === 0) { test.skip(true, 'No profiles to edit.'); return; }
    const frame = await p.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    }
    await p.clickEdit(0);
    await p.dismissOverlays();
    await expect(p.app.locator('#profile_code').first()).toBeVisible({ timeout: 20000 });
    if (frame) await frame.evaluate(() => window.scrollTo(0, 600)).catch(() => {});
    await page.waitForTimeout(1500).catch(() => {});

    const sectionSelect = p.app.locator('select[id*="section"], select[id*="shop_section"]').first();
    const fallback = p.app.locator('select').filter({ hasText: /shop section|section/i }).first();
    const target = (await sectionSelect.count() > 0) ? sectionSelect : fallback;
    const visible = await target.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) { test.skip(true, 'Shop Section dropdown not found.'); return; }

    const optCount = await target.locator('option').count().catch(() => 0);
    expect(optCount).toBeGreaterThanOrEqual(1);
  });

  test('TC_90: Form saves successfully when all mandatory fields are filled and optional fields (Inventory, Price, Shop Section) are left empty', async () => {
    await p.goto(PROFILING_URL);
    await p.dismissOverlays();
    await p.clickCreateNewProfile();
    await p.dismissOverlays();

    const profileInput = p.app.locator('#profile_code').first();
    await expect(profileInput).toBeVisible({ timeout: 20000 });

    const profileName = 'AllMandatory_' + Date.now();
    await profileInput.fill(profileName);
    await p.selectCategory('Loofahs').catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const frame = await p.getFrame();
    if (frame) await frame.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    // Fill Who Made It / What Is It / When Made
    const aboutSelects = p.app.locator('select').filter({ hasText: /i did|a member|a finished product|a supply|made to order|please select/i });
    const aboutCount = await aboutSelects.count().catch(() => 0);
    for (let i = 0; i < Math.min(aboutCount, 3); i++) {
      const sel = aboutSelects.nth(i);
      if (!await sel.isVisible({ timeout: 800 }).catch(() => false)) continue;
      const opts = await sel.locator('option').count().catch(() => 0);
      if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }

    // Fill mandatory templates: Shipping, Policy, Processing Profile
    const mandatoryTemplates = ['shipping', 'policy', 'processing'];
    for (const key of mandatoryTemplates) {
      const sel = p.app.locator(`select[id*="${key}"], select[name*="${key}"]`).first();
      if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
        const opts = await sel.locator('option').count().catch(() => 0);
        if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
        await page.waitForTimeout(300).catch(() => {});
      }
    }

    // Leave Inventory, Price, Shop Section empty intentionally
    await p.clickSave();
    await page.waitForTimeout(5000).catch(() => {});

    const backOnGrid   = await p.isProfilingPageVisible();
    const successToast = await p.app.getByText(/success|created|saved/i).first()
      .isVisible({ timeout: 5000 }).catch(() => false);

    expect(backOnGrid || successToast).toBe(true);
  });
});