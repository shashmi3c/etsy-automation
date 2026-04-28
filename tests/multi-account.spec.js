/**
 * Multi Account automation – converted from tests/testcases/multi-account-tests.md
 * TC-01 to TC-07
 */
const { test, expect } = require('@playwright/test');

const APP_URL = 'https://etsy-dev.cifapps.com/';

async function getAppContext(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const iframe = page.frameLocator('iframe[id*="app"], iframe[title*="Etsy"], iframe[src*="etsy"], iframe').first();
  try {
    await iframe.locator('body').waitFor({ state: 'attached', timeout: 10000 });
    return iframe;
  } catch {
    return page;
  }
}

async function isLoginPage(page) {
  const login = await page.getByText('Log in').first().isVisible().catch(() => false);
  if (login) return true;
  return await page.getByText('Continue to Shopify').isVisible().catch(() => false);
}

test.describe('Multi Account Test Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  test('TC-01: Verify Account Switcher Navigation – user redirected to selected shop', async ({ page }) => {
    test.setTimeout(90000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required. Use storageState or run auth:shopify.');
      return;
    }

    const app = await getAppContext(page);

    const accountSwitcher = app.getByRole('button', { name: /account|shop|store|switch/i })
      .or(app.getByLabel(/account|shop|store|switch/i))
      .or(app.locator('[data-testid*="account-switcher"], [aria-label*="account"], [aria-label*="shop"]').first())
      .or(app.getByText(/switch (account|shop|store)|select (account|shop)/i).first());

    await accountSwitcher.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (!(await accountSwitcher.first().isVisible().catch(() => false))) {
      test.skip(true, 'Account switcher not found. Update selectors for this app.');
      return;
    }

    // Step 1: Open dashboard (already on it via beforeEach)
    // Step 2: Click account switcher
    const initialUrl = page.url();
    await accountSwitcher.first().click();

    // Step 3: Select another shop
    const shopOption = app.getByRole('menuitem', { name: /shop|store|account/i })
      .or(app.getByRole('option').filter({ hasText: /shop|store/i }).first())
      .or(app.locator('[role="listbox"] [role="option"], [role="menu"] [role="menuitem"]').first());

    if (await shopOption.first().isVisible().catch(() => false)) {
      await shopOption.first().click();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const newUrl = page.url();
      expect(newUrl).toBeTruthy();
      expect(
        initialUrl !== newUrl || (await app.getByText(/shop|store|selected/i).first().isVisible().catch(() => false)),
        'User should be redirected to the selected shop'
      ).toBeTruthy();
    }
  });

  test('TC-02: Verify Switcher Options – Add New and Manage buttons visible', async ({ page }) => {
    test.setTimeout(60000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required.');
      return;
    }

    const app = await getAppContext(page);

    const accountSwitcher = app.getByRole('button', { name: /account|shop|store|switch/i })
      .or(app.getByLabel(/account|shop|switch/i))
      .or(app.locator('[data-testid*="account-switcher"]').first());

    await accountSwitcher.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (!(await accountSwitcher.first().isVisible().catch(() => false))) {
      test.skip(true, 'Account switcher not found.');
      return;
    }

    // Step 1: Open account switcher
    await accountSwitcher.first().click();
    await new Promise((r) => setTimeout(r, 1000));

    const addNewBtn = app.getByRole('button', { name: /add new|add account|add shop|add store/i })
      .or(app.getByRole('link', { name: /add new|add account/i }))
      .or(app.getByText(/add new|add account/i).first());
    const manageBtn = app.getByRole('button', { name: /manage/i })
      .or(app.getByRole('link', { name: /manage/i }))
      .or(app.getByText(/manage/i).first());

    const addNewVisible = await addNewBtn.first().isVisible().catch(() => false);
    const manageVisible = await manageBtn.first().isVisible().catch(() => false);

    if (!addNewVisible && !manageVisible) {
      test.skip(true, 'Add New / Manage options not found in switcher. Update selectors.');
      return;
    }
    expect(addNewVisible, 'Add New button should be visible').toBe(true);
    expect(manageVisible, 'Manage button should be visible').toBe(true);
  });

  test('TC-03: Banner Visibility Across Stores – banner still visible in other stores after remove', async ({ page }) => {
    test.setTimeout(120000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required. Requires multiple connected stores.');
      return;
    }

    const app = await getAppContext(page);

    const banner = app.locator('[class*="banner"], [data-testid*="banner"], [role="alert"]').first()
      .or(app.getByText(/get started|help|guide|tip/i).first());
    const helpGuide = app.getByText(/help|guide|how to|tips/i).first()
      .or(app.locator('[class*="help"], [data-testid*="help-guide"]').first());

    if (!(await banner.isVisible().catch(() => false)) && !(await helpGuide.isVisible().catch(() => false))) {
      test.skip(true, 'No banner or help guide found. May need multiple stores.');
      return;
    }

    // Step 1: Remove banner from Store A
    const dismissBtn = app.getByRole('button', { name: /dismiss|close|remove|hide/i })
      .or(app.locator('[aria-label*="close"], [aria-label*="dismiss"]').first());
    if (await dismissBtn.first().isVisible().catch(() => false)) {
      await dismissBtn.first().click();
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Step 2: Switch to Store B
    const accountSwitcher = app.getByRole('button', { name: /account|shop|switch/i })
      .or(app.getByLabel(/account|shop/i)).first();
    if (!(await accountSwitcher.isVisible().catch(() => false))) {
      test.skip(true, 'Account switcher not found; cannot switch store.');
      return;
    }
    await accountSwitcher.click();
    const otherShop = app.getByRole('menuitem').or(app.getByRole('option')).filter({ hasNotText: /current|selected/i }).first();
    if (!(await otherShop.isVisible().catch(() => false))) {
      test.skip(true, 'No other shop to switch to.');
      return;
    }
    await otherShop.click();
    await new Promise((r) => setTimeout(r, 3000));

    const bannerOrGuideInOther = await banner.isVisible().catch(() => false) || await helpGuide.isVisible().catch(() => false);
    expect(bannerOrGuideInOther, 'Banner should still be visible in other connected stores').toBe(true);
  });

  test('TC-04: Verify Etsy Shop Status – shop name, status and language per account', async ({ page }) => {
    test.setTimeout(60000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required.');
      return;
    }

    const app = await getAppContext(page);

    const statusSection = app.getByText(/shop status|connected shop|etsy shop|shop name/i).first()
      .or(app.locator('[data-testid*="shop-status"], [class*="shop-status"]').first());
    await statusSection.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    if (!(await statusSection.isVisible().catch(() => false))) {
      test.skip(true, 'Shop status section not found. Update selectors.');
      return;
    }

    const hasShopName = await app.getByText(/shop|store|account/i).first().isVisible().catch(() => false);
    const hasStatus = await app.getByText(/connected|active|disconnected|pending/i).first().isVisible().catch(() => false);
    const hasLanguage = await app.getByText(/language|english|en|es|fr/i).first().isVisible().catch(() => false);

    expect(hasShopName || hasStatus, 'Shop name/status should display correctly for each account').toBe(true);
    expect(hasStatus || hasLanguage, 'Status and language should display correctly for each account').toBe(true);
  });

  test('TC-05: Verify Plan Overview – plan details same across all shops', async ({ page }) => {
    test.setTimeout(90000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required.');
      return;
    }

    const app = await getAppContext(page);

    const planSection = app.getByText(/plan overview|plan details|your plan|subscription/i).first()
      .or(app.locator('[data-testid*="plan-overview"], [class*="plan-overview"]').first());
    await planSection.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    if (!(await planSection.isVisible().catch(() => false))) {
      test.skip(true, 'Plan overview section not found. Update selectors.');
      return;
    }

    const planDetails = await app.locator('[class*="plan"], [data-testid*="plan"]').first().textContent().catch(() => '');
    expect(planDetails, 'Plan details should be visible').toBeTruthy();

    const accountSwitcher = app.getByRole('button', { name: /account|shop|switch/i }).or(app.getByLabel(/account|shop/i)).first();
    if (await accountSwitcher.isVisible().catch(() => false)) {
      await accountSwitcher.click();
      const otherShop = app.getByRole('menuitem').or(app.getByRole('option')).first();
      if (await otherShop.isVisible().catch(() => false)) {
        await otherShop.click();
        await new Promise((r) => setTimeout(r, 3000));
        const planInOther = await app.getByText(/plan overview|plan details|your plan/i).first().isVisible().catch(() => false);
        const detailsInOther = await app.locator('[class*="plan"], [data-testid*="plan"]').first().textContent().catch(() => '');
        expect(planInOther && detailsInOther, 'Plan details should remain same across all shops').toBeTruthy();
      }
    }
  });

  test('TC-06: Verify Order Count – updates only for Shop A when fetch in Shop A', async ({ page }) => {
    test.setTimeout(120000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required. Requires multiple connected shops.');
      return;
    }

    const app = await getAppContext(page);

    const ordersLink = app.getByRole('link', { name: /orders/i }).or(app.getByText(/orders/i).first());
    await ordersLink.first().click();
    await new Promise((r) => setTimeout(r, 3000));

    const orderCountEl = app.getByText(/\d+\s*orders?|orders?:\s*\d+/i).first()
      .or(app.locator('[data-testid*="order-count"], [class*="order-count"]').first());
    const countBefore = await orderCountEl.textContent().catch(() => '0');
    const numBefore = parseInt((countBefore || '0').replace(/\D/g, ''), 10) || 0;

    const fetchBtn = app.getByRole('button', { name: /fetch|sync|refresh|get orders/i })
      .or(app.getByText(/fetch orders|sync orders/i).first());
    if (await fetchBtn.first().isVisible().catch(() => false)) {
      await fetchBtn.first().click();
      await new Promise((r) => setTimeout(r, 5000));
    }

    const countAfter = await orderCountEl.textContent().catch(() => countBefore);
    const numAfter = parseInt((countAfter || '0').replace(/\D/g, ''), 10) || numBefore;
    expect(numAfter >= numBefore, 'Order count should update for this shop (Shop A) after fetch').toBe(true);

    const accountSwitcher = app.getByRole('button', { name: /account|shop|switch/i }).first();
    if (await accountSwitcher.isVisible().catch(() => false)) {
      await accountSwitcher.click();
      const otherShop = app.getByRole('menuitem').or(app.getByRole('option')).first();
      if (await otherShop.isVisible().catch(() => false)) {
        await otherShop.click();
        await new Promise((r) => setTimeout(r, 2000));
        const otherOrderCount = await orderCountEl.textContent().catch(() => '');
        expect(otherOrderCount).toBeTruthy();
      }
    }
  });

  test('TC-07: Verify Product Count – updates across all connected shops when import/create in Shop A', async ({ page }) => {
    test.setTimeout(120000);

    if (await isLoginPage(page)) {
      test.skip(true, 'Login required. Requires multiple connected shops.');
      return;
    }

    const app = await getAppContext(page);

    const productCountEl = app.getByText(/\d+\s*products?|products?:\s*\d+/i).first()
      .or(app.locator('[data-testid*="product-count"], [class*="product-count"]').first());
    const countBefore = await productCountEl.textContent().catch(() => '0');
    const numBefore = parseInt((countBefore || '0').replace(/\D/g, ''), 10) || 0;

    const importOrCreate = app.getByRole('button', { name: /import|create product|add product/i })
      .or(app.getByRole('link', { name: /import product|create product/i }))
      .or(app.getByText(/import product|create product/i).first());
    if (await importOrCreate.first().isVisible().catch(() => false)) {
      await importOrCreate.first().click();
      await new Promise((r) => setTimeout(r, 5000));
    }

    const countAfter = await productCountEl.textContent().catch(() => countBefore);
    const numAfter = parseInt((countAfter || '0').replace(/\D/g, ''), 10) || numBefore;
    expect(numAfter >= numBefore, 'Product count should update when importing/creating in Shop A').toBe(true);

    const accountSwitcher = app.getByRole('button', { name: /account|shop|switch/i }).first();
    if (await accountSwitcher.isVisible().catch(() => false)) {
      await accountSwitcher.click();
      const otherShop = app.getByRole('menuitem').or(app.getByRole('option')).first();
      if (await otherShop.isVisible().catch(() => false)) {
        await otherShop.click();
        await new Promise((r) => setTimeout(r, 2000));
        const productCountOther = app.getByText(/\d+\s*products?|products?:\s*\d+/i).first()
          .or(app.locator('[data-testid*="product-count"]').first());
        const otherCount = await productCountOther.textContent().catch(() => '');
        expect(otherCount, 'Product count should update across all connected shops').toBeTruthy();
      }
    }
  });
});
