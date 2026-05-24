// @ts-check

/**
 * Page Object for the Etsy App Templates section (/panel/templates).
 *
 * Tabs covered:
 *   Shipping Templates · Inventory Templates · Price Templates
 *   Policy Templates · Shop Sections · Production Partners · Processing Profiles
 *
 * Each tab has: Fetch (sync from Etsy) and/or Create button, plus a data table.
 */
class EtsyTemplatesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.app  = page;
    this._activeTabFn = null; // remembers last tab so page reloads auto-restore it
  }

  // ─── Frame Resolution ──────────────────────────────────────────────────

  async resolveAppContext() {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

    let appFrame = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const frames = this.page.frames();
      // Must be cifapps.com frame — exclude the Shopify admin outer shell frames
      appFrame = frames.find(f => f.url().includes('cifapps.com'));
      if (appFrame) break;
      await this.page.waitForTimeout(1000).catch(() => {});
    }

    if (appFrame) {
      this.app = appFrame;
      await appFrame.waitForSelector(
        '.Polaris-Page, .Polaris-Button, [class*="Polaris"]',
        { timeout: 15000 }
      ).catch(() => {});
      await appFrame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
    } else {
      this.app = this.page;
    }
    return this.app;
  }

  /**
   * Navigate to the templates page only when not already on it;
   * otherwise just ensure we're back on the list view.
   * Call the supplied clickTab function to activate the correct tab.
   */
  /** @param {string} url @param {() => Promise<void>} clickTabFn */
  async gotoTab(url, clickTabFn) {
    this._activeTabFn = clickTabFn;
    const alreadyOnPage = this.page.url().includes('panel/template') &&
      await this.app.locator('[role="tablist"]').isVisible({ timeout: 2000 }).catch(() => false);
    if (!alreadyOnPage) {
      // Navigate, but click the target tab as soon as the tablist appears
      // rather than waiting for the full page settle — avoids Shipping tab flash.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          break;
        } catch (e) {
          if (attempt < 2 && /ERR_CONNECTION_CLOSED|ERR_CONNECTION_RESET|ERR_ABORTED/i.test(e.message)) {
            await this.page.waitForTimeout(3000).catch(() => {});
            continue;
          }
          throw e;
        }
      }
      await this.page.locator('[role="progressbar"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      // Resolve iframe
      let appFrame = null;
      for (let i = 0; i < 10; i++) {
        appFrame = this.page.frames().find(f => f.url().includes('cifapps.com'));
        if (appFrame) break;
        await this.page.waitForTimeout(500).catch(() => {});
      }
      if (appFrame) {
        this.app = appFrame;
        // Click tab as soon as the tablist is visible — don't wait for full content
        await appFrame.locator('[role="tablist"]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      } else {
        this.app = this.page;
      }
      await this._ensureOnListPage().catch(() => {});
    } else {
      await this._ensureOnListPage().catch(() => {});
    }
    await clickTabFn();
  }

  async goto(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        break;
      } catch (e) {
        if (attempt < 2 && /ERR_CONNECTION_CLOSED|ERR_CONNECTION_RESET|ERR_ABORTED/i.test(e.message)) {
          await this.page.waitForTimeout(3000).catch(() => {});
          continue;
        }
        throw e;
      }
    }
    // Wait for Shopify's top loading bar to disappear before interacting with the iframe
    await this.page.locator('[role="progressbar"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.resolveAppContext();
    // If the iframe is still on a form/edit page from a previous test, navigate back to list
    await this._ensureOnListPage().catch(() => {});
  }

  /** If the app frame is showing a form page (no tabs), click the breadcrumb to go back to list */
  async _ensureOnListPage() {
    const tabsVisible = await this.app.locator('[role="tablist"]').first()
      .isVisible({ timeout: 6000 }).catch(() => false);
    if (!tabsVisible) {
      // Try breadcrumb back-button (e.g. "← Shipping Templates")
      const backBtn = this.app.locator('button').filter({ hasText: /templates?/i }).first();
      if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backBtn.click({ force: true });
        await this.page.waitForTimeout(3000).catch(() => {});
        await this.resolveAppContext();
      }
      // If still no tabs, reload the outer page to force-reset the iframe
      const tabsNow = await this.app.locator('[role="tablist"]').first()
        .isVisible({ timeout: 5000 }).catch(() => false);
      if (!tabsNow) {
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await this.resolveAppContext();
      }
    }
  }

  /** Dismiss overlays: Shopify modals, driver.js tour, backdrops */
  async dismissOverlays() {
    const page = this.page;

    // Close Shopify/Polaris modals
    for (let i = 0; i < 3; i++) {
      try {
        const closeBtn = page.locator('#PolarisPortalsContainer button[aria-label="Close"], button[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await closeBtn.click({ force: true });
          await page.waitForTimeout(1000);
        } else break;
      } catch { break; }
    }

    try {
      if (await page.locator('[class*="Backdrop"]').first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    } catch {}

    const frames = page.frames();
    const appFrame = frames.find(f => f.url().includes('cifapps.com'));
    if (appFrame) {
      try {
        // Try all known skip/close button selectors for the tour guide
        const skipSelectors = [
          '.skip-btn',
          'button[class*="skip"]',
          'button[id*="skip"]',
          '[data-action="skip"]',
          'button:has-text("Skip")',
          'button:has-text("skip")',
          'button:has-text("Skip Tour")',
          'button:has-text("Got it")',
          'button:has-text("Close")',
          '.driver-popover-close-btn',
          '[class*="driver"] button[class*="close"]',
        ];
        for (const sel of skipSelectors) {
          const btn = appFrame.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await btn.click({ force: true });
            await page.waitForTimeout(800);
            break;
          }
        }
        // Force-remove all driver.js tour artifacts via JS injection
        await appFrame.evaluate(() => {
          document.body.classList.remove('driver-active', 'driver-fade');
          document.body.style.overflow = '';
          document.body.style.pointerEvents = 'auto';
          document.querySelectorAll('.driver-overlay, .driver-popover, .driver-stage, #driver-page-overlay').forEach(el => el.remove());
          document.querySelectorAll('.driver-active-element, .driver-no-interaction, .driver-highlighted-element').forEach(el => {
            el.classList.remove('driver-active-element', 'driver-no-interaction', 'driver-highlighted-element');
            el.style.pointerEvents = '';
            el.style.zIndex = '';
          });
          // Ensure all tab elements are fully interactive
          document.querySelectorAll('[role="tab"], [role="tablist"]').forEach(el => {
            el.style.pointerEvents = 'auto';
            el.style.zIndex = '';
          });
        }).catch(() => {});
        await page.waitForTimeout(500);
      } catch {}
    }

    await this.resolveAppContext();
  }

  // ─── Page Visibility ──────────────────────────────────────────────────

  async isTemplatesPageVisible() {
    // Run all checks in parallel — first one to return true wins within 20s
    const [heading, tabs, buttons] = await Promise.all([
      this.app.getByRole('heading', { name: /templates/i }).first().isVisible({ timeout: 20000 }).catch(() => false),
      this.app.locator('.Polaris-Tabs__Title').first().isVisible({ timeout: 20000 }).catch(() => false),
      this.app.locator('button[aria-label*="Fetch"], button[aria-label*="Create"]').first().isVisible({ timeout: 20000 }).catch(() => false),
    ]);
    return heading || tabs || buttons;
  }

  // ─── Tab Navigation ───────────────────────────────────────────────────

  /**
   * Click a tab by its label text and wait for content to settle.
   * @param {RegExp} labelRe
   */
  async clickTab(labelRe) {
    // Wait for the tab bar to render
    await this.app.waitForSelector('[role="tablist"]', { timeout: 15000 }).catch(() => {});
    // 1. Role-based click — Polaris tab accessible name matches the text
    // Remove any tour overlay blocking the tab before clicking
    await this.app.evaluate(() => {
      document.querySelectorAll('.driver-overlay, .driver-popover, .driver-stage').forEach(el => el.remove());
      document.querySelectorAll('[role="tab"]').forEach(el => {
        el.style.pointerEvents = 'auto';
        el.classList.remove('driver-no-interaction');
      });
    }).catch(() => {});

    // Polaris renders a hidden "TabsMeasurer" copy of every tab — skip it, find the visible one
    const byRole = this.app.getByRole('tab', { name: labelRe });
    const roleCount = await byRole.count().catch(() => 0);
    for (let i = 0; i < roleCount; i++) {
      const candidate = byRole.nth(i);
      if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
        await candidate.click({ force: true });
        await this.page.waitForTimeout(2000).catch(() => {});
        return true;
      }
    }
    // 2. Direct button selector on Polaris tab class, skipping the hidden Measurer container
    const byClass = this.app.locator(
      'li.Polaris-Tabs__TabContainer:not(.Polaris-Tabs__TabsMeasurer *) button.Polaris-Tabs__Tab, ' +
      '.Polaris-Tabs:not(.Polaris-Tabs__TabsMeasurer) button.Polaris-Tabs__Tab'
    ).filter({ hasText: labelRe }).first();
    if (await byClass.isVisible({ timeout: 3000 }).catch(() => false)) {
      await byClass.click({ force: true });
      await this.page.waitForTimeout(2000).catch(() => {});
      return true;
    }
    // 3. Title-span click
    const byTitle = this.app.locator('.Polaris-Tabs__Title').filter({ hasText: labelRe }).first();
    if (await byTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await byTitle.click({ force: true });
      await this.page.waitForTimeout(2000).catch(() => {});
      return true;
    }
    // 3. Some tabs overflow into a "More views" dropdown — open it and click there
    const moreBtn = this.app.locator('button').filter({ hasText: /more views/i }).first();
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click({ force: true });
      await this.page.waitForTimeout(1500).catch(() => {});
      // Use DOM evaluation to find and click visible overflow items
      const clicked = await this.app.evaluate((pattern) => {
        const re = new RegExp(pattern, 'i');
        const candidates = Array.from(
          document.querySelectorAll('button, li, [role="option"], [role="menuitem"], [class*="ActionList"] *')
        );
        for (const el of candidates) {
          const text = (el.textContent || '').trim();
          const rect = el.getBoundingClientRect();
          if (re.test(text) && rect.width > 0 && rect.height > 0 && rect.top >= 0) {
            el.click();
            return true;
          }
        }
        return false;
      }, labelRe.source).catch(() => false);
      if (clicked) {
        await this.page.waitForTimeout(2000).catch(() => {});
        return true;
      }
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    return false;
  }

  async isTabVisible(labelRe) {
    // Wait for the tab bar to exist in DOM
    await this.app.waitForSelector('[role="tablist"]', { timeout: 15000 }).catch(() => {});
    // 1. Role-based check — Polaris tab accessible name matches the text
    if (await this.app.getByRole('tab', { name: labelRe }).first().isVisible({ timeout: 5000 }).catch(() => false)) return true;
    // 2. Title-span check (Polaris stores text in .Polaris-Tabs__Title)
    if (await this.app.locator('.Polaris-Tabs__Title').filter({ hasText: labelRe }).first().isVisible({ timeout: 3000 }).catch(() => false)) return true;
    // 3. Count-based: tab may be in overflow/measurer (hidden but present in DOM)
    const count = await this.app.evaluate((pattern) => {
      const re = new RegExp(pattern, 'i');
      return Array.from(document.querySelectorAll('[role="tab"]'))
        .filter(t => re.test(t.textContent || '') || re.test(t.getAttribute('aria-label') || ''))
        .length;
    }, labelRe.source).catch(() => 0);
    return count > 0;
  }

  /** Wait until a tab with matching label has aria-selected="true" */
  async waitForTabActive(labelRe, timeout = 8000) {
    return this.app.waitForFunction((pattern) => {
      const re = new RegExp(pattern, 'i');
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const tab = tabs.find(el => re.test((el.textContent || el.getAttribute('aria-label') || '').trim()));
      return tab ? tab.getAttribute('aria-selected') === 'true' : false;
    }, labelRe.source, { timeout }).catch(() => false);
  }

  /**
   * Click a tab by its data-testid (templates-grid.tab[tabId]) if present,
   * falling back to the role/class-based clickTab().
   */
  async _clickTabByTestId(tabId, labelRe) {
    const tidTab = this.app.getByTestId(`templates-grid.tab[${tabId}]`);
    if (await tidTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tidTab.click({ force: true });
      await this.page.waitForTimeout(2000).catch(() => {});
      return true;
    }
    return this.clickTab(labelRe);
  }

  // Convenience methods per tab
  async clickShippingTab() {
    const result = await this._clickTabByTestId('shipping', /^shipping(\s+templates?)?$/i);
    await this.waitForTabActive(/^shipping(\s+templates?)?$/i, 8000).catch(() => {});
    await this.resolveAppContext();
    return result;
  }

  async clickInventoryTab() {
    const result = await this._clickTabByTestId('inventory', /^inventory(\s+templates?)?$/i);
    await this.waitForTabActive(/^inventory(\s+templates?)?$/i, 8000).catch(() => {});
    await this.resolveAppContext();
    return result;
  }

  async clickPriceTab() {
    const result = await this._clickTabByTestId('price', /^price(\s+templates?)?$/i);
    await this.waitForTabActive(/^price(\s+templates?)?$/i, 8000).catch(() => {});
    const isActive = await this.app.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const t = tabs.find(el => /^price(\s+templates?)?$/i.test((el.textContent || el.getAttribute('aria-label') || '').trim()));
      if (t && t.getAttribute('aria-selected') !== 'true') { t.click(); return false; }
      return t ? t.getAttribute('aria-selected') === 'true' : false;
    }).catch(() => false);
    if (!isActive) await this.page.waitForTimeout(2000).catch(() => {});
    await this.resolveAppContext();
    return result;
  }

  async clickPolicyTab() {
    const result = await this._clickTabByTestId('policy', /^policy|return policy/i);
    await this.waitForTabActive(/policy|return policy/i, 8000).catch(() => {});
    return result;
  }

  async clickShopSectionTab() {
    const result = await this._clickTabByTestId('shop-section', /shop\s+section/i);
    await this.page.waitForTimeout(1500).catch(() => {});
    await this.dismissOverlays();
    await this.page.waitForTimeout(1000).catch(() => {});
    const isActive = await this.app.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const t = tabs.find(el => /shop\s*section/i.test((el.textContent || '').trim()));
      return t ? t.getAttribute('aria-selected') === 'true' : false;
    }).catch(() => false);
    if (!isActive) {
      await this._clickTabByTestId('shop-section', /shop\s+section/i);
      await this.page.waitForTimeout(2000).catch(() => {});
    }
    await this.resolveAppContext();
    return result;
  }
  async clickProductionPartnerTab() {
    return this._clickTabByTestId('production-partners', /production\s+partner/i);
  }

  /**
   * Switch to a connected Etsy account by name fragment (case-insensitive).
   * Opens the account dropdown and JS-clicks the matching item.
   * @param {string|RegExp} accountNameRe
   */
  async switchAccount(accountNameRe) {
    const re = accountNameRe instanceof RegExp ? accountNameRe : new RegExp(accountNameRe, 'i');

    // Dismiss any driver.js tour overlays that would block clicks
    await this.dismissOverlays();
    await this.page.waitForTimeout(800).catch(() => {});

    // Find and click the account dropdown trigger (shows current account name)
    const trigger = this.app.locator('button').filter({ hasText: /testworkindia|gojosatoru|connected\s*account/i }).first();
    const triggerVisible = await trigger.isVisible({ timeout: 5000 }).catch(() => false);
    if (!triggerVisible) {
      console.log('Account switcher button not found');
      return false;
    }
    await trigger.click({ force: true });
    await this.page.waitForTimeout(2000).catch(() => {});

    // JS-click the account list item by matching text — search ALL elements
    const clicked = await this.app.evaluate((pattern) => {
      const re = new RegExp(pattern, 'i');
      // Walk all elements looking for the tightest match (smallest element containing only the account name)
      const allEls = Array.from(document.querySelectorAll('*'));
      const candidates = allEls.filter(el => {
        const text = (el.innerText || el.textContent || '').trim();
        return re.test(text) && text.length < 150;
      });
      // Prefer the element with the shortest text (closest match)
      candidates.sort((a, b) => {
        const ta = (a.innerText || a.textContent || '').trim().length;
        const tb = (b.innerText || b.textContent || '').trim().length;
        return ta - tb;
      });
      const match = candidates[0];
      if (match) {
        match.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return (match.innerText || match.textContent || '').trim().substring(0, 60);
      }
      return null;
    }, re.source).catch(() => null);

    if (!clicked) {
      console.log('Account item not found in dropdown, pressing Escape');
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }
    console.log('Clicked account item:', clicked);

    // Wait for account switch to complete (UI reload)
    await this.page.waitForTimeout(4000).catch(() => {});
    await this.resolveAppContext();
    console.log('Switched account to:', re.source);
    return true;
  }

  async clickProcessingProfileTab() {
    const result = await this._clickTabByTestId('processing-profiles', /processing\s+profile/i);
    await this.waitForTabActive(/processing\s+profile/i, 8000).catch(() => {});
    return result;
  }

  // ─── Fetch / Sync Button ──────────────────────────────────────────────

  /**
   * The Fetch button for the active tab.
   * Tries per-tab testids (templates-grid.page.fetch-shipping, etc.) then aria-label fallback.
   * @param {string} [tabId] optional: 'shipping'|'policy'|'shop-section'|'processing-profiles'
   */
  getFetchButton(tabId) {
    const tabFetchIds = {
      shipping: 'templates-grid.page.fetch-shipping',
      policy: 'templates-grid.page.fetch-policy',
      'shop-section': 'templates-grid.page.fetch-shop-section',
      'processing-profiles': 'templates-grid.page.fetch-processing-profiles',
    };
    const tid = tabId && tabFetchIds[tabId];
    if (tid) {
      return this.app.getByTestId(tid)
        .or(this.app.locator('button[aria-label*="Fetch"]')).first();
    }
    // Any visible fetch button across all tab testids or aria-label
    const anyTid = Object.values(tabFetchIds)
      .map(id => `[data-testid="${id}"]`)
      .join(', ');
    return this.app.locator(anyTid)
      .or(this.app.locator('button[aria-label*="Fetch"]')).first();
  }

  async isFetchButtonVisible() {
    return this.getFetchButton().isVisible({ timeout: 8000 }).catch(() => false);
  }

  async clickFetch(tabId) {
    const btn = this.getFetchButton(tabId);
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(3000).catch(() => {});
      return true;
    }
    return false;
  }

  // ─── Create Button ────────────────────────────────────────────────────

  /**
   * The primary Create button for the active tab.
   * Tries per-tab testids (templates-grid.page.create-shipping, etc.) then role fallback.
   * @param {string} [tabId] optional: 'shipping'|'inventory'|'price'|'policy'|'shop-section'|'production-partners'|'processing-profiles'
   */
  getCreateButton(tabId) {
    const tabCreateIds = {
      shipping: 'templates-grid.page.create-shipping',
      inventory: 'templates-grid.page.create-inventory',
      price: 'templates-grid.page.create-price',
      policy: 'templates-grid.page.create-policy',
      'shop-section': 'templates-grid.page.create-shop-section',
      'production-partners': 'templates-grid.page.create-production-partners',
      'processing-profiles': 'templates-grid.page.create-processing-profiles',
    };
    const tid = tabId && tabCreateIds[tabId];
    if (tid) {
      return this.app.getByTestId(tid)
        .or(this.app.getByRole('button', { name: /^create/i })).first();
    }
    const anyTid = Object.values(tabCreateIds)
      .map(id => `[data-testid="${id}"]`)
      .join(', ');
    return this.app.locator(anyTid)
      .or(this.app.getByRole('button', { name: /^create/i })).first();
  }

  async isCreateButtonVisible() {
    return this.getCreateButton().isVisible({ timeout: 8000 }).catch(() => false);
  }

  // ─── Template Table / List ────────────────────────────────────────────

  /** Rows in the template data table */
  getTemplateRows() {
    return this.app.locator(
      'table tbody tr, [class*="IndexTable"] [class*="Row"], [class*="template-row"], [class*="templateRow"]'
    );
  }

  async getTableRowCount() {
    // Wait up to 15s for table rows to appear (API load can be slow)
    await this.app.waitForSelector(
      'table tbody tr, [class*="IndexTable"] [class*="Row"]',
      { timeout: 15000 }
    ).catch(() => {});
    let count = await this.getTemplateRows().count().catch(() => 0);
    if (count === 0) {
      // Re-resolve frame and try again with another 10s
      await this.resolveAppContext().catch(() => {});
      await this.page.waitForTimeout(3000).catch(() => {});
      await this.app.waitForSelector(
        'table tbody tr, [class*="IndexTable"] [class*="Row"]',
        { timeout: 10000 }
      ).catch(() => {});
      count = await this.getTemplateRows().count().catch(() => 0);
    }
    return count;
  }

  async getTemplateRowCount() {
    return this.getTableRowCount();
  }

  /** Check whether a data table or template list is rendered */
  async isTemplateListVisible() {
    return (
      (await this.app.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.locator('[class*="IndexTable"]').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.app.locator('[class*="DataTable"]').first().isVisible({ timeout: 3000 }).catch(() => false))
    );
  }

  /** Check whether an empty state is visible for the active tab */
  async isEmptyStateVisible() {
    return (
      (await this.app.getByText(/no templates|no shipping|no inventory|no price|no policy|no shop section|no production|no processing/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.getByText(/no data|nothing here|no records/i).first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await this.app.locator('[class*="EmptyState"], [class*="empty-state"]').first().isVisible({ timeout: 3000 }).catch(() => false))
    );
  }

  // ─── Edit / Delete on existing templates ──────────────────────────────

  /**
   * Edit button for the nth row — data-testid pattern: templates-grid.row[${id}].edit
   * Falls back to aria-label selector.
   */
  getFirstEditButton(index = 0) {
    return this.app.locator('[data-testid*="templates-grid.row"][data-testid$=".edit"]')
      .or(this.app.locator('button[aria-label*="Edit"]')).nth(index);
  }

  /**
   * Delete button for the nth row — data-testid pattern: templates-grid.row[${id}].delete
   * Falls back to aria-label selector.
   */
  getFirstDeleteButton(index = 0) {
    return this.app.locator('[data-testid*="templates-grid.row"][data-testid$=".delete"]')
      .or(this.app.locator('button[aria-label*="Delete"]')).nth(index);
  }

  async isEditButtonVisible() {
    return this.getFirstEditButton().isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isDeleteButtonVisible() {
    return this.getFirstDeleteButton().isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ─── Template Name Input (create/edit form) ───────────────────────────

  getTemplateNameInput() {
    // testids are on wrapper divs — scope to the input inside each
    const byTestId = this.app.locator([
      '[data-testid="price-template.name"] input',
      '[data-testid="inventory-template.name"] input',
      '[data-testid="shipping-template.title"] input',
    ].join(', ')).first();
    return byTestId.or(this.app.locator([
      'input[placeholder*="name" i]',
      'input[placeholder*="title" i]',
      'input[placeholder*="template" i]',
      'input[name*="name" i]',
      'input[name*="title" i]',
    ].join(', ')).first());
  }

  async fillTemplateName(name) {
    const input = this.getTemplateNameInput();
    const visible = await input.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) return false;
    // Triple-click to select all, then type — triggers React's onChange reliably
    await input.click({ clickCount: 3 });
    await this.page.waitForTimeout(300).catch(() => {});
    await input.pressSequentially(name, { delay: 30 });
    // Verify the value was set
    const val = await input.inputValue().catch(() => '');
    if (!val.includes(name.slice(-10))) {
      // Fallback: clear + fill
      await input.fill('');
      await input.fill(name);
    }
    return true;
  }

  // ─── Save / Cancel ────────────────────────────────────────────────────

  getSaveButton() {
    // Polaris Page action descriptors use id= (not data-testid) on the underlying button
    const pageActionIds = [
      'price-template.page.save',
      'inventory-template.page.save',
      'shipping-template.page.save',
      'policy-template.page.save',
      'processing-profile.page.save',
    ];
    const byPageId = this.app.locator(pageActionIds.map(id => `[id="${id}"]`).join(', ')).first();
    return byPageId.or(this.app.getByRole('button', { name: /^save$|save.*(template|changes|profile|section)/i }).first());
  }

  getCancelButton() {
    return this.app.getByRole('button', { name: /^cancel$/i }).first();
  }

  async clickSave() {
    // Try save button inside the app iframe first
    const appBtn = this.getSaveButton();
    if (await appBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appBtn.click({ force: true });
      // Wait for a success/saved toast to confirm the save API call completed,
      // or fall back to a 6s wait if no toast appears.
      await Promise.race([
        this.app.getByText(/saved|success|created|updated|template saved/i).first()
          .waitFor({ state: 'visible', timeout: 8000 }),
        this.page.waitForTimeout(6000),
      ]).catch(() => {});
      await this.page.waitForTimeout(1000).catch(() => {});
      return true;
    }
    // Shopify "Unsaved changes" bar — the Save button is in the outer page chrome.
    // After filling form fields, it may take up to 30s for React to propagate and
    // trigger the App Bridge save bar.
    const outerSave = this.page.getByRole('button', { name: /^save$/i }).first();
    if (await outerSave.isVisible({ timeout: 30000 }).catch(() => false)) {
      await outerSave.click({ force: true });
      // Outer save bar triggers a full page reload — wait for DOM ready (not networkidle,
      // because Shopify's background polling keeps the network busy indefinitely).
      await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(3000).catch(() => {});
      await this.resolveAppContext();
      // Page reload resets to Shipping tab — immediately restore the last active tab
      if (this._activeTabFn) await this._activeTabFn().catch(() => {});
      return true;
    }
    // Last resort: try any visible button with "save" anywhere in the text
    const anyBtn = this.page.locator('button').filter({ hasText: /save/i }).first();
    if (await anyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await anyBtn.click({ force: true });
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await this.page.waitForTimeout(2000).catch(() => {});
      return true;
    }
    return false;
  }

  async clickCancel() {
    // Try explicit "Cancel" button first
    const btn = this.getCancelButton();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(1500).catch(() => {});
      await this.resolveAppContext();
      return;
    }
    // Polaris forms use a breadcrumb <button> OR <a> link to navigate back to the list
    const breadcrumb = this.app.locator('button, a').filter({ hasText: /template$|templates?$/i }).first();
    if (await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await breadcrumb.click({ force: true });
      await this.page.waitForTimeout(2000).catch(() => {});
      await this.resolveAppContext();
      return;
    }
    // Try browser history back within the app frame
    const navigated = await this.app.evaluate(() => {
      if (window.history.length > 1) { window.history.back(); return true; }
      return false;
    }).catch(() => false);
    if (navigated) {
      await this.page.waitForTimeout(2000).catch(() => {});
      await this.resolveAppContext();
      return;
    }
    // Last resort: Escape key
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForTimeout(500).catch(() => {});
  }

  // ─── Create Flow ──────────────────────────────────────────────────────

  /**
   * Create a policy template by selecting a specific return-window days value.
   * Policy forms have no name field — templates are identified by their days setting.
   */
  async createPolicyTemplate(/** @type {string|number} */ days) {
    const createBtn = this.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) return false;
    await createBtn.click({ force: true });
    await this.page.waitForTimeout(2000).catch(() => {});
    await this.resolveAppContext();
    await this.page.waitForTimeout(1000).catch(() => {});

    const daysSelect = this.app.locator('select').first();
    if (await daysSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await daysSelect.selectOption(String(days));
      await this.page.waitForTimeout(500).catch(() => {});
    }

    await this.app.locator('body').click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
    await this.page.waitForTimeout(1000).catch(() => {});

    await this.clickSave().catch(() => {});
    await this.page.waitForTimeout(1500).catch(() => {});

    // If a duplicate-condition error appears, uncheck Exchanges and retry save
    const duplicateError = this.app.getByText(/existing policy.*same condition|same condition.*policy|already.*policy|duplicate.*policy/i).first();
    if (await duplicateError.isVisible({ timeout: 3000 }).catch(() => false)) {
      const exchangeCheckbox = this.app.locator('input[type="checkbox"]').filter({ hasText: /exchange/i })
        .or(this.app.locator('label').filter({ hasText: /exchange/i }).locator('input[type="checkbox"]'))
        .or(this.app.locator('label:has-text("Exchange") input, label:has-text("Exchanges") input'))
        .first();
      // Use the label as the click target since Polaris checkboxes are visually hidden
      const exchangeLabel = this.app.locator('label').filter({ hasText: /^Exchanges?$/i }).first();
      if (await exchangeLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
        await exchangeLabel.click({ force: true });
        await this.page.waitForTimeout(800).catch(() => {});
      } else if (await exchangeCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await exchangeCheckbox.uncheck({ force: true });
        await this.page.waitForTimeout(800).catch(() => {});
      }
      await this.app.locator('body').click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
      await this.page.waitForTimeout(500).catch(() => {});
      await this.clickSave().catch(() => {});
      await this.page.waitForTimeout(1500).catch(() => {});
    }

    return true;
  }

  /** Select a new days value on an open Policy edit form (call clickSave after). */
  /**
   * Create a shop section template via the App Bridge modal that opens on "Create Shop section".
   * The modal renders in a separate iframe named frame://.../modal/...
   * Name is limited to 24 characters by Etsy.
   */
  async createShopSectionTemplate(/** @type {string} */ name) {
    const createBtn = this.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) return false;

    // Capture existing frame URLs+names before click to detect the new modal frame
    const frameKeysBefore = new Set(this.page.frames().map(f => f.url() + '|' + f.name()));
    const appFrameUrl = this.app && typeof this.app.url === 'function' ? this.app.url() : '';

    await createBtn.click({ force: true });

    // frameattached fires when the modal iframe is created (URL may be empty at that point).
    // Wait 3s for the frame to navigate to its actual content, then search all frames.
    await this.page.waitForTimeout(3000).catch(() => {});
    const allFramesAfter = this.page.frames();

    // Look for any frame that was not present before and has a non-empty URL
    let modalFrame = allFramesAfter.find(f => {
      const key = f.url() + '|' + f.name();
      return !frameKeysBefore.has(key) && !!f.url() && f.url() !== appFrameUrl && f.url() !== this.page.url();
    }) || null;

    // Also try pattern matching (url/name contains 'modal' or 'shop')
    if (!modalFrame) {
      modalFrame = allFramesAfter.find(f =>
        f.name().toLowerCase().includes('modal') ||
        f.url().toLowerCase().includes('modal') ||
        f.url().toLowerCase().includes('shop')
      ) || null;
      if (modalFrame && (modalFrame.url() === appFrameUrl || !modalFrame.url())) modalFrame = null;
    }

    if (!modalFrame) {
      // Fallback: modal may be a Polaris dialog WITHIN the app iframe
      const dialog = this.app.locator('[role="dialog"]');
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Use generic input selector — Polaris inputs may omit type="text"
        const titleInput = dialog.locator('input').first();
        if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await titleInput.click({ clickCount: 3 });
          await titleInput.fill('');
          await titleInput.pressSequentially(name.substring(0, 24), { delay: 30 });
          await this.page.waitForTimeout(500).catch(() => {});
          const saveBtn = dialog.getByRole('button', { name: /save|create|add/i }).first();
          if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveBtn.click({ force: true });
            await this.page.waitForTimeout(2000).catch(() => {});
            // If "Shop name cannot be empty" error appears, retry with fallback name "newShop"
            const emptyErr = dialog.getByText(/shop name cannot be empty|name.*cannot be empty|title.*required/i).first();
            if (await emptyErr.isVisible({ timeout: 2000 }).catch(() => false)) {
              await titleInput.click({ clickCount: 3 });
              await titleInput.fill('');
              await titleInput.pressSequentially('newShop', { delay: 30 });
              await this.page.waitForTimeout(500).catch(() => {});
              await saveBtn.click({ force: true });
              await this.page.waitForTimeout(2000).catch(() => {});
            }
            return true;
          }
        }
        // Could not fill — close the dialog so it doesn't block subsequent tests
        const cancelBtn = dialog.getByRole('button', { name: /cancel|close/i }).first();
        await cancelBtn.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500).catch(() => {});
      }
      return false;
    }

    // Wait for the modal frame to load
    await modalFrame.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    return this._fillAndSubmitShopSectionModal(modalFrame, name.substring(0, 24));
  }

  /** Fill title and submit the shop section modal frame (used by create and edit). */
  async _fillAndSubmitShopSectionModal(/** @type {import('@playwright/test').Frame} */ modalFrame, /** @type {string} */ name) {
    // Wait for the modal React app to render its content
    await modalFrame.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(2000).catch(() => {});

    // Fill the title input inside the modal iframe — testid: templates.create-shop-section-modal.section-title
    const titleInput = modalFrame.getByTestId('templates.create-shop-section-modal.section-title')
      .or(modalFrame.locator('input')).first();
    if (await titleInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await titleInput.click({ clickCount: 3 });
      await titleInput.pressSequentially(name, { delay: 50 });
    }
    await this.page.waitForTimeout(800).catch(() => {});

    // In Shopify App Bridge, Save/Cancel buttons are rendered in the Shopify admin page.
    // Try modal footer save testid first, then text-content filter fallback.
    const pageSaveBtn = this.page.getByTestId('templates.create-shop-section-modal.footer.save')
      .or(this.page.locator('button').filter({ hasText: /^\s*Save\s*$/ })).first();
    if (await pageSaveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const frameDetachedPromise = this.page.waitForEvent('framedetached', { timeout: 10000 }).catch(() => null);
      await pageSaveBtn.click({ force: true });
      await this.page.waitForTimeout(1500).catch(() => {});
      // If "Shop name cannot be empty" error appears, retry with fallback name "newShop"
      const emptyErr = modalFrame.locator('*').filter({ hasText: /shop name cannot be empty|name.*cannot be empty|title.*required/i }).first();
      if (await emptyErr.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.click({ clickCount: 3 });
        await titleInput.fill('');
        await titleInput.pressSequentially('newShop', { delay: 30 });
        await this.page.waitForTimeout(500).catch(() => {});
        await pageSaveBtn.click({ force: true });
        await this.page.waitForTimeout(1500).catch(() => {});
      }
      await frameDetachedPromise;
      await this.page.waitForTimeout(2000).catch(() => {});
      return true;
    }

    // Fallback: any non-cancel button inside the modal frame itself
    const buttons = modalFrame.locator('button');
    const count = await buttons.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = (await btn.textContent().catch(() => '')) || '';
      if (!/cancel|discard|close/i.test(text) && await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await this.page.waitForTimeout(2000).catch(() => {});
        return true;
      }
    }
    return false;
  }

  /**
   * Edit a shop section name via the App Bridge modal that opens on "Edit" button.
   * Call this after clickEditOnRow() opens the modal.
   */
  async editShopSectionInModal(/** @type {string} */ newName) {
    const appFrameUrl = this.app && typeof this.app.url === 'function' ? this.app.url() : '';
    let modalFrame = null;
    for (let i = 0; i < 12; i++) {
      await this.page.waitForTimeout(500).catch(() => {});
      modalFrame = this.page.frames().find(f =>
        f.name().toLowerCase().includes('modal') ||
        f.url().toLowerCase().includes('modal') ||
        f.url().toLowerCase().includes('shop-section') ||
        f.url().toLowerCase().includes('shop_section')
      ) || null;
      if (modalFrame && modalFrame.url() !== appFrameUrl) break;
      modalFrame = null;
    }
    if (modalFrame) return this._fillAndSubmitShopSectionModal(modalFrame, newName.substring(0, 24));

    // Fallback: Polaris dialog inside the app iframe
    const dialog = this.app.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const titleInput = dialog.locator('input').first();
      if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await titleInput.click({ clickCount: 3 });
        await titleInput.fill('');
        await titleInput.pressSequentially(newName.substring(0, 24), { delay: 30 });
        await this.page.waitForTimeout(500).catch(() => {});
        const saveBtn = dialog.getByRole('button', { name: /save|create|add/i }).first();
        if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveBtn.click({ force: true });
          await this.page.waitForTimeout(2000).catch(() => {});
          return true;
        }
      }
      const cancelBtn = dialog.getByRole('button', { name: /cancel|close/i }).first();
      await cancelBtn.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500).catch(() => {});
    }
    return false;
  }

  async editPolicyDays(/** @type {string|number} */ days) {
    const daysSelect = this.app.locator('select').first();
    if (await daysSelect.isVisible({ timeout: 8000 }).catch(() => false)) {
      await daysSelect.selectOption(String(days));
      await daysSelect.evaluate(el => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }).catch(() => {});
      await this.page.waitForTimeout(800).catch(() => {});
    }
  }

  /** Click Create, wait for form, fill name, fill required fields, save. Returns true on success. */
  async createTemplate(name) {
    const createBtn = this.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) return false;
    await createBtn.click({ force: true });
    await this.page.waitForTimeout(2000).catch(() => {});
    // Re-resolve frame after form page navigation
    await this.resolveAppContext();
    await this.page.waitForTimeout(2000).catch(() => {});

    // Fill name field — inventory/price use "Enter a name for the template"
    const nameInput = this.getTemplateNameInput();
    if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(name);
      await nameInput.press('Tab'); // trigger blur/React onChange
      await nameInput.evaluate(el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(() => {});
    } else {
      const anyText = this.app.locator('input[type="text"]').first();
      if (await anyText.isVisible({ timeout: 5000 }).catch(() => false)) {
        await anyText.clear();
        await anyText.fill(name);
        await anyText.press('Tab');
        await anyText.evaluate(el => {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }).catch(() => {});
      }
    }
    await this.page.waitForTimeout(1000).catch(() => {});

    // Fill required fields (two passes for cascading forms like shipping)
    await this._fillRequiredFields().catch(() => {});

    // Extra blur trigger so React propagates all field changes before save bar check
    await this.app.locator('body').click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
    await this.page.keyboard.press('Tab').catch(() => {});
    await this.page.waitForTimeout(2000).catch(() => {});

    const saved = await this.clickSave().catch(() => false);
    return saved !== false;
  }

  /**
   * Create an Inventory template — fills name, threshold inventory, and max inventory values.
   */
  async createInventoryTemplate(name) {
    const createBtn = this.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) return false;
    await createBtn.click({ force: true });
    await this.page.waitForTimeout(2000).catch(() => {});
    await this.resolveAppContext();
    await this.page.waitForTimeout(2000).catch(() => {});

    // Fill name
    const nameInput = this.getTemplateNameInput();
    if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(name);
      await nameInput.press('Tab');
      await nameInput.evaluate(el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(() => {});
    }
    await this.page.waitForTimeout(1000).catch(() => {});

    // Fill Minimum Threshold Value = 5 — testid: inventory-template.min-inventory
    const thresholdInput = this.app.getByTestId('inventory-template.min-inventory').locator('input').first()
      .or(this.app.getByTestId('inventory-template.min-inventory'))
      .or(this.app.locator('input[placeholder="0"]')).first();
    if (await thresholdInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await thresholdInput.click({ clickCount: 3 });
      await thresholdInput.fill('5');
      await thresholdInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
    }

    // Fill Maximum Inventory level = 100 — testid: inventory-template.max-inventory
    const maxInput = this.app.getByTestId('inventory-template.max-inventory').locator('input').first()
      .or(this.app.getByTestId('inventory-template.max-inventory'))
      .or(this.app.locator('input[placeholder="Enter value"]')).first();
    if (await maxInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maxInput.click({ clickCount: 3 });
      await maxInput.fill('100');
      await maxInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
    }

    await this._fillRequiredFields().catch(() => {});
    await this.app.locator('body').click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
    await this.page.keyboard.press('Tab').catch(() => {});
    await this.page.waitForTimeout(2000).catch(() => {});

    const saved = await this.clickSave().catch(() => false);
    return saved !== false;
  }

  /**
   * Create a Processing Profile template.
   * Fills the name field (for row identification) and selects a specific
   * time option by index so two profiles don't get duplicate time ranges.
   * @param {string} name
   * @param {number} timeOptionIndex  0 = first valid option, 1 = second, etc.
   */
  async createProcessingProfileTemplate(name, timeOptionIndex = 0) {
    const createBtn = this.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) return false;
    await createBtn.click({ force: true });
    await this.page.waitForTimeout(2000).catch(() => {});
    await this.resolveAppContext();
    await this.page.waitForTimeout(2000).catch(() => {});

    // Fill name input if the form has one
    const nameInput = this.getTemplateNameInput();
    if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(name);
      await nameInput.press('Tab');
      await nameInput.evaluate(el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(() => {});
    }
    await this.page.waitForTimeout(1000).catch(() => {});

    // Fill all required fields with defaults first
    await this._fillRequiredFields().catch(() => {});
    await this.page.waitForTimeout(500).catch(() => {});

    // Then explicitly select the processing time option at the given index
    // so two profiles don't end up with the same time range (duplicate rejection)
    await this._selectProcessingTimeByIndex(timeOptionIndex).catch(() => {});
    await this.page.waitForTimeout(500).catch(() => {});

    await this.app.locator('body').click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
    await this.page.keyboard.press('Tab').catch(() => {});
    await this.page.waitForTimeout(2000).catch(() => {});

    const saved = await this.clickSave().catch(() => false);
    return saved !== false;
  }

  /**
   * Select the nth valid (non-placeholder) option from the Processing Time
   * dropdown on an open Processing Profile create/edit form.
   * Handles both native <select> and Polaris combobox.
   * @param {number} optionIndex
   */
  async _selectProcessingTimeByIndex(optionIndex) {
    // Try native <select> elements
    const selects = this.app.locator('select');
    const selCount = await selects.count().catch(() => 0);
    for (let si = 0; si < selCount; si++) {
      const sel = selects.nth(si);
      if (!await sel.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const validOptions = await sel.evaluate(el => {
        return Array.from(el.options)
          .filter(o => !o.disabled && o.value && o.value !== '' && o.value !== 'Select')
          .map(o => o.value);
      }).catch(() => []);
      if (validOptions.length > optionIndex) {
        await sel.selectOption(validOptions[optionIndex]).catch(() => {});
        await sel.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
        return true;
      }
    }
    // Try Polaris combobox
    const combos = this.app.locator('[role="combobox"]');
    const cbCount = await combos.count().catch(() => 0);
    for (let ci = 0; ci < cbCount; ci++) {
      const cb = combos.nth(ci);
      if (!await cb.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      await cb.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500).catch(() => {});
      const options = this.app.locator('[role="option"]');
      const optCount = await options.count().catch(() => 0);
      if (optCount > optionIndex) {
        await options.nth(optionIndex).click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(400).catch(() => {});
        return true;
      }
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    return false;
  }

  /**
   * Fill min/max processing days on an open Processing Profile create/edit form.
   * Fills the first two visible number inputs with the given values.
   * @param {number} minDays
   * @param {number} maxDays
   */
  async fillProcessingDays(minDays, maxDays) {
    const numInputs = this.app.locator('input[type="number"], input[role="spinbutton"]');
    const numCount = await numInputs.count().catch(() => 0);
    const dayValues = [minDays, maxDays];
    let filled = 0;
    for (let i = 0; i < numCount && filled < 2; i++) {
      const inp = numInputs.nth(i);
      if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      await inp.click({ clickCount: 3 }).catch(() => {});
      await inp.fill(String(dayValues[filled])).catch(() => {});
      await inp.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      filled++;
    }
  }

  /**
   * Create a Price template — same as createTemplate but also enables
   * the "Custom Price" and "Compare at Price" toggles before saving.
   */
  async createPriceTemplate(name) {
    const createBtn = this.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) return false;
    await createBtn.click({ force: true });
    await this.page.waitForTimeout(2000).catch(() => {});
    await this.resolveAppContext();
    await this.page.waitForTimeout(2000).catch(() => {});

    // Fill name
    const nameInput = this.getTemplateNameInput();
    if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(name);
      await nameInput.press('Tab');
      await nameInput.evaluate(el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(() => {});
    }
    await this.page.waitForTimeout(1000).catch(() => {});

    // Enable Compare at price (OFF by default) — testid: price-template.compare-at-price
    const compareToggle = this.app.getByTestId('price-template.compare-at-price')
      .or(this.app.locator('label').filter({ hasText: /Enable Compare at price/i })).first();
    if (await compareToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await compareToggle.click({ force: true });
      await this.page.waitForTimeout(500).catch(() => {});
    }
    // Enable Custom pricing (OFF by default) — testid: price-template.enable-custom-pricing
    const customToggle = this.app.getByTestId('price-template.enable-custom-pricing')
      .or(this.app.locator('label').filter({ hasText: /Enable Custom pricing/i })).first();
    if (await customToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await customToggle.click({ force: true });
      await this.page.waitForTimeout(1000).catch(() => {});
    }
    // Fill the revealed required Value field — testid: price-template.value
    const valueInput = this.app.getByTestId('price-template.value').locator('input').first()
      .or(this.app.getByTestId('price-template.value')).first();
    if (await valueInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await valueInput.click({ clickCount: 3 });
      await valueInput.fill('5');
      await valueInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      await this.page.waitForTimeout(300).catch(() => {});
    } else {
      // Fallback: iterate visible text inputs, skip the name field
      const allInputs = this.app.locator('input[type="text"]');
      const inputCount = await allInputs.count().catch(() => 0);
      for (let i = 1; i < inputCount; i++) {
        const inp = allInputs.nth(i);
        if (!await inp.isVisible({ timeout: 500 }).catch(() => false)) continue;
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        if (/name|template|title/i.test(ph || '')) continue;
        await inp.click({ clickCount: 3 });
        await inp.fill('5');
        await inp.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
        await this.page.waitForTimeout(300).catch(() => {});
        break;
      }
    }

    await this.app.locator('body').click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
    await this.page.keyboard.press('Tab').catch(() => {});
    await this.page.waitForTimeout(2000).catch(() => {});

    const saved = await this.clickSave().catch(() => false);
    return saved !== false;
  }

  /**
   * Find a toggle/switch/checkbox whose nearby label matches the given regex
   * and click it if it is currently OFF (aria-checked="false" or unchecked).
   */
  async _enableToggle(labelRegex) {
    // Polaris Toggle: button[role="switch"], or input[type="checkbox"] / input[role="switch"]
    const switches = this.app.locator('[role="switch"], input[type="checkbox"]');
    const count = await switches.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const sw = switches.nth(i);
      if (!await sw.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      // Get label text from parent container
      const label = await sw.evaluate(el => {
        const container = el.closest('[class*="Choice"], [class*="Toggle"], [class*="Switch"], label, li, div') || el.parentElement;
        return container?.textContent?.trim() || el.getAttribute('aria-label') || '';
      }).catch(() => '');
      if (!labelRegex.test(label)) continue;
      // Check current state
      const isOn = await sw.evaluate(el => {
        if (el.getAttribute('role') === 'switch') return el.getAttribute('aria-checked') === 'true';
        return /** @type {HTMLInputElement} */ (el).checked;
      }).catch(() => false);
      if (!isOn) {
        await sw.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500).catch(() => {});
      }
      return;
    }
  }

  /** Fill common required fields — two-pass to handle cascading form sections */
  async _fillRequiredFields() {
    await this._fillSelectsPass();
    // Wait for cascading sections (e.g. shipping standard section after country select)
    await this.page.waitForTimeout(2000).catch(() => {});
    await this._fillSelectsPass();

    // Polaris combobox / custom select dropdowns (not native <select> — Policy forms use these)
    const comboboxes = this.app.locator('[role="combobox"]');
    const cbCount = await comboboxes.count().catch(() => 0);
    for (let i = 0; i < cbCount; i++) {
      const cb = comboboxes.nth(i);
      if (!await cb.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const val = await cb.inputValue().catch(() => '');
      if (!val || val.trim() === '') {
        await cb.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(600).catch(() => {});
        const firstOption = this.app.locator('[role="option"], [role="menuitem"]').first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstOption.click({ force: true }).catch(() => {});
          await this.page.waitForTimeout(400).catch(() => {});
        } else {
          await this.page.keyboard.press('Escape').catch(() => {});
        }
      }
    }

    // Number inputs
    const numInputs = this.app.locator('input[type="number"], input[role="spinbutton"]');
    const numCount = await numInputs.count().catch(() => 0);
    for (let i = 0; i < numCount; i++) {
      const inp = numInputs.nth(i);
      if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const val = await inp.inputValue().catch(() => '');
      if (!val || val === '0') {
        await inp.fill('1').catch(() => {});
        await inp.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      }
    }

    // Zip/postal code text inputs
    const textInputs = this.app.locator('input[type="text"]');
    const textCount = await textInputs.count().catch(() => 0);
    for (let i = 0; i < textCount; i++) {
      const inp = textInputs.nth(i);
      if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const label = await inp.evaluate(el => {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        return lbl?.textContent?.trim() || el.getAttribute('aria-label') || el.placeholder || '';
      }).catch(() => '');
      if (/zip|postal|post.code|pincode/i.test(label)) {
        const val = await inp.inputValue().catch(() => '');
        if (!val) {
          await inp.fill('10001').catch(() => {});
          await inp.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
        }
      }
    }

    // Textareas — use pressSequentially so React's onChange fires reliably (plain .fill()
    // bypasses keyboard events which Polaris TextField depends on for state propagation)
    const textareas = this.app.locator('textarea');
    const taCount = await textareas.count().catch(() => 0);
    for (let i = 0; i < taCount; i++) {
      const ta = textareas.nth(i);
      if (!await ta.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const val = await ta.inputValue().catch(() => '');
      if (!val) {
        await ta.click({ clickCount: 3 }).catch(() => {});
        await ta.pressSequentially('Standard policy text.', { delay: 10 }).catch(() => {});
        await ta.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      }
    }

    await this.page.waitForTimeout(500).catch(() => {});
  }

  /** Single pass: fill all visible empty select elements with preferred values */
  async _fillSelectsPass() {
    const preferred = ['US', 'IN', 'GB', 'CA', 'AU'];
    const selects = this.app.locator('select');
    const count = await selects.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      if (!await sel.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const isPlaceholder = await sel.evaluate(el => {
        const opt = el.options[el.selectedIndex];
        return !opt || opt.disabled || opt.value === '' || opt.value === 'Select';
      }).catch(() => false);
      if (!isPlaceholder) continue;

      const label = await sel.evaluate(el => {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        return lbl?.textContent?.trim() || el.getAttribute('aria-label') || el.name || '';
      }).catch(() => '');

      // Country selects: prefer known valid shipping countries
      if (/country|origin|dispatch|location|ship.from/i.test(label)) {
        for (const code of preferred) {
          const hasOption = await sel.evaluate((el, c) =>
            Array.from(el.options).some(o => !o.disabled && o.value === c)
          , code).catch(() => false);
          if (hasOption) { await sel.selectOption(code).catch(() => {}); break; }
        }
      } else {
        const firstValid = await sel.evaluate(el => {
          for (const opt of el.options) {
            if (!opt.disabled && opt.value && opt.value !== '' && opt.value !== 'Select') return opt.value;
          }
          return null;
        }).catch(() => null);
        if (firstValid) {
          await sel.selectOption(firstValid).catch(() => {});
          await this.page.waitForTimeout(200).catch(() => {});
        }
      }
    }
  }

  // ─── Edit: change shipping-specific fields ────────────────────────────

  /**
   * After opening a shipping template edit form, change origin zip, shipping
   * costs, and attempt to toggle a delivery upgrade checkbox.
   * Returns an object describing what was actually changed (for regression assertions).
   * @returns {Promise<{zip?: string, firstNumValue?: string, toggledUpgrade?: boolean}>}
   */
  async editShippingFields() {
    const changed = {};

    // 1. Change zip/postal code
    const zipInput = this.app.locator(
      'input[placeholder*="zip" i], input[placeholder*="postal" i], input[placeholder*="pincode" i], input[name*="zip" i]'
    ).first();
    if (await zipInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await zipInput.click({ clickCount: 3 });
      await zipInput.pressSequentially('90210', { delay: 30 });
      await zipInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      changed.zip = '90210';
    }

    // 2. Change number inputs (shipping cost / processing days) — toggle between 2 and 3
    const numInputs = this.app.locator('input[type="number"], input[role="spinbutton"]');
    const numCount = await numInputs.count().catch(() => 0);
    for (let i = 0; i < Math.min(numCount, 4); i++) {
      const inp = numInputs.nth(i);
      if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const cur = await inp.inputValue().catch(() => '0');
      const next = cur === '2' ? '3' : '2';
      await inp.click({ clickCount: 3 });
      await inp.pressSequentially(next, { delay: 20 });
      await inp.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      if (!changed.firstNumValue) changed.firstNumValue = next;
    }

    // 3. Toggle first visible delivery upgrade checkbox
    const upgradeCheckbox = this.app.locator(
      'input[type="checkbox"][aria-label*="upgrade" i], input[type="checkbox"][name*="upgrade" i], ' +
      '[class*="upgrade" i] input[type="checkbox"], [class*="delivery" i] input[type="checkbox"]'
    ).first();
    if (await upgradeCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await upgradeCheckbox.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500).catch(() => {});
      changed.toggledUpgrade = true;
    }

    await this.page.waitForTimeout(800).catch(() => {});
    return changed;
  }

  // ─── Edit: change inventory-specific fields ───────────────────────────

  /**
   * After opening an inventory template edit form, change threshold inventory,
   * maximum inventory, and toggle the two available switches.
   * Returns an object describing what was actually changed (for regression assertions).
   * @returns {Promise<{threshold?: string, maxInventory?: string, toggleCount?: number}>}
   */
  async editInventoryFields() {
    const changed = {};

    // 1. Threshold inventory — testid: inventory-template.min-inventory
    const thresholdInput = this.app.getByTestId('inventory-template.min-inventory').locator('input').first()
      .or(this.app.getByTestId('inventory-template.min-inventory'))
      .or(this.app.locator('input[placeholder*="threshold" i], input[name*="threshold" i]')).first();
    if (await thresholdInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await thresholdInput.click({ clickCount: 3 });
      await thresholdInput.pressSequentially('5', { delay: 20 });
      await thresholdInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      changed.threshold = '5';
    } else {
      const first = this.app.locator('input[type="number"], input[role="spinbutton"]').nth(0);
      if (await first.isVisible({ timeout: 2000 }).catch(() => false)) {
        await first.click({ clickCount: 3 });
        await first.pressSequentially('5', { delay: 20 });
        await first.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
        changed.threshold = '5';
      }
    }

    // 2. Maximum inventory — testid: inventory-template.max-inventory
    const maxInput = this.app.getByTestId('inventory-template.max-inventory').locator('input').first()
      .or(this.app.getByTestId('inventory-template.max-inventory'))
      .or(this.app.locator('input[placeholder*="max" i], input[name*="max" i]')).first();
    if (await maxInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maxInput.click({ clickCount: 3 });
      await maxInput.pressSequentially('100', { delay: 20 });
      await maxInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
      changed.maxInventory = '100';
    } else {
      const second = this.app.locator('input[type="number"], input[role="spinbutton"]').nth(1);
      if (await second.isVisible({ timeout: 2000 }).catch(() => false)) {
        await second.click({ clickCount: 3 });
        await second.pressSequentially('100', { delay: 20 });
        await second.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
        changed.maxInventory = '100';
      }
    }

    // 3. Toggle the two visible checkbox/switch toggles
    const toggles = this.app.locator('input[type="checkbox"], [role="switch"]');
    const toggleCount = await toggles.count().catch(() => 0);
    let toggled = 0;
    for (let i = 0; i < toggleCount && toggled < 2; i++) {
      const tog = toggles.nth(i);
      if (await tog.isVisible({ timeout: 1500 }).catch(() => false)) {
        await tog.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(300).catch(() => {});
        toggled++;
      }
    }
    if (toggled > 0) changed.toggleCount = toggled;

    await this.page.waitForTimeout(800).catch(() => {});
    return changed;
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────

  /**
   * Delete all rows whose name starts with the given prefix (e.g. "Auto").
   * Used in beforeAll to wipe leftover data from previous failed runs.
   */
  async deleteAllMatchingRows(/** @type {RegExp} */ prefixRe) {
    let removed = 0;
    for (let pass = 0; pass < 60; pass++) {
      await this.page.waitForTimeout(400).catch(() => {});
      const rows = this.app.locator(
        'table tbody tr, [class*="IndexTable"] [class*="Row"]:not([class*="Loading"])'
      );
      const count = await rows.count().catch(() => 0);
      if (count === 0) break;

      let found = false;
      for (let i = 0; i < count; i++) {
        const rowText = (await rows.nth(i).textContent().catch(() => '')) ?? '';
        if (prefixRe.test(rowText)) {
          const deleteBtn = rows.nth(i).locator('[data-testid*="templates-grid.row"][data-testid$=".delete"], button[aria-label*="Delete"]').first();
          if (await deleteBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await deleteBtn.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(500).catch(() => {});
            await this._confirmDeleteDialog().catch(() => {});
            await this.page.waitForTimeout(800).catch(() => {});
            removed++;
            found = true;
            break;
          }
        }
      }
      if (!found) break;
    }
    return removed;
  }

  // ─── Edit Flow ────────────────────────────────────────────────────────

  /** Click edit on the nth row (0-based). Returns true if edit form opened. */
  async clickEditOnRow(index = 0) {
    // Prefer pencil icon button (testid .edit), then aria-label, then any SVG edit icon
    const editBtns = this.app.locator('[data-testid*="templates-grid.row"][data-testid$=".edit"]')
      .or(this.app.locator('button[aria-label="Edit"], button[title="Edit"]'))
      .or(this.app.locator('button[aria-label*="Edit"]'))
      .or(this.app.locator('button:has(svg[data-icon="pencil"]), button:has([class*="pencil"]), button:has([class*="edit-icon"])'));
    const btn = editBtns.nth(index);
    if (!await btn.isVisible({ timeout: 5000 }).catch(() => false)) return false;
    await btn.click({ force: true });
    await this.page.waitForTimeout(1000).catch(() => {});
    await this.resolveAppContext();
    // Wait for the edit form to be ready (name input or save button must appear)
    await Promise.race([
      this.getTemplateNameInput().waitFor({ state: 'visible', timeout: 10000 }),
      this.getSaveButton().waitFor({ state: 'visible', timeout: 10000 }),
      this.page.waitForTimeout(8000),
    ]).catch(() => {});
    return true;
  }

  // ─── Delete Flow ──────────────────────────────────────────────────────

  /** Click delete on the nth row, confirm dialog. Returns true on success. */
  async deleteTemplateOnRow(index = 0) {
    const deleteBtns = this.app.locator('[data-testid*="templates-grid.row"][data-testid$=".delete"]')
      .or(this.app.locator('button[aria-label*="Delete"]'));
    const btn = deleteBtns.nth(index);
    if (!await btn.isVisible({ timeout: 5000 }).catch(() => false)) return false;
    await btn.click({ force: true }).catch(() => {});
    await this.page.waitForTimeout(1500).catch(() => {});

    const confirmed = await this._confirmDeleteDialog().catch(() => false);
    // Wait for the delete API call to complete (delete = POST/DELETE request)
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(1000).catch(() => {});
    return confirmed;
  }

  async _confirmDeleteDialog() {
    await this.page.waitForTimeout(1000).catch(() => {});

    // 1. Try data-testid confirm input + footer delete button (templates.delete-modal.*)
    for (const ctx of [this.app, this.page]) {
      const tidInput = ctx.getByTestId('templates.delete-modal.confirm-input');
      if (await tidInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tidInput.fill('').catch(() => {});
        await tidInput.pressSequentially('delete', { delay: 20 }).catch(() => {});
        await this.page.waitForTimeout(500).catch(() => {});
      }
      const tidDelete = ctx.getByTestId('templates.delete-modal.footer.delete');
      if (await tidDelete.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await tidDelete.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(3000).catch(() => {});
        return true;
      }
    }

    // Helper: try to confirm using a given locator context (app iframe or outer page)
    const tryConfirm = async (/** @type {import('@playwright/test').Page | import('@playwright/test').Frame} */ ctx) => {
      const modal = ctx.locator('[role="dialog"], [class*="Modal"], [class*="modal"]').first();
      const textbox = modal.locator('input[type="text"], input:not([type]), [role="textbox"]').first();
      if (await textbox.isVisible({ timeout: 4000 }).catch(() => false)) {
        await textbox.fill('').catch(() => {});
        await textbox.pressSequentially('delete', { delay: 30 }).catch(() => {});
        await this.page.waitForTimeout(800).catch(() => {});
      }
      const confirmBtn = modal.getByRole('button', { name: /^(delete|confirm|yes)$/i }).last();
      if (await confirmBtn.isEnabled({ timeout: 4000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(3000).catch(() => {});
        return true;
      }
      return false;
    };

    // 2. Try inside the app iframe first (most dialogs render here)
    if (await tryConfirm(this.app)) return true;

    // 3. Try outer page dialog
    if (await tryConfirm(this.page)) return true;

    // 4. Try Shopify App Bridge iframe-in-dialog pattern
    const dialogFrame = this.page.frameLocator('[role="dialog"] iframe, dialog iframe').first();
    const iframeTextbox = dialogFrame.locator('input').first();
    if (await iframeTextbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await iframeTextbox.fill('delete').catch(() => {});
      await this.page.waitForTimeout(500).catch(() => {});
      const deleteBtn = this.page.getByRole('button', { name: /^delete$/i }).last();
      if (await deleteBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(3000).catch(() => {});
        return true;
      }
    }

    // 5. Cancel any open dialog to leave page in clean state
    const cancelBtn = this.page.locator('[role="dialog"]').getByRole('button', { name: /cancel/i }).first();
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click({ force: true }).catch(() => {});
    }
    return false;
  }

  // ─── Search ───────────────────────────────────────────────────────────

  /** Search input — data-testid: templates-grid.search (wraps the actual <input>) */
  getSearchBox() {
    return this.app.getByTestId('templates-grid.search').locator('input').first()
      .or(this.app.locator('input[placeholder*="Search"]').first());
  }

  async searchTemplates(query) {
    const searchBox = this.getSearchBox();
    if (!await searchBox.isVisible({ timeout: 5000 }).catch(() => false)) return false;
    await searchBox.click({ force: true });
    await searchBox.clear();
    await searchBox.fill(query);
    // Trigger React onChange — fill() alone may not fire the handler
    await searchBox.evaluate(el => {
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(() => {});
    await this.page.waitForTimeout(2000).catch(() => {});
    return true;
  }

  async clearSearch() {
    const searchBox = this.getSearchBox();
    if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBox.clear();
      await this.page.waitForTimeout(1000).catch(() => {});
    }
  }

  // ─── Row text check ───────────────────────────────────────────────────

  /** Return the visible text of the nth row (0-based). Empty string if not found. */
  async getRowText(index = 0) {
    const selectors = [
      'table tbody tr',
      '[class*="IndexTable"] [class*="Row"]',
      '[class*="ResourceItem"]',
    ];
    for (const sel of selectors) {
      const rows = this.app.locator(sel);
      const count = await rows.count().catch(() => 0);
      if (count > index) {
        const text = await rows.nth(index).evaluate(el =>
          (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ')
        ).catch(() => '');
        if (text) return text;
      }
    }
    return '';
  }

  async isTextInTable(text) {
    // Try standard table rows first, then Polaris IndexTable rows, then any list item
    const selectors = [
      `table tbody tr`,
      `[class*="IndexTable"] [class*="Row"]`,
      `[class*="ResourceItem"]`,
      `[class*="DataTable"] tr`,
    ];
    for (const sel of selectors) {
      const found = await this.app.locator(sel).filter({ hasText: text }).first()
        .isVisible({ timeout: 8000 }).catch(() => false);
      if (found) return true;
    }
    // Fallback: check raw text in the page body
    return this.app.getByText(text, { exact: false }).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
  }

  // ─── Form visibility ──────────────────────────────────────────────────

  async isFormVisible() {
    // Name input OR in-app save button — works for Shipping/Inventory/Price
    if (await this.getTemplateNameInput().isVisible({ timeout: 5000 }).catch(() => false)) return true;
    if (await this.getSaveButton().isVisible({ timeout: 3000 }).catch(() => false)) return true;
    // Policy / Shop Sections form: no name input; detect by heading inside the form page
    if (await this.app.getByRole('heading', { name: /policy template|shop return|processing profile|inventory template|price template|shipping template/i }).first()
        .isVisible({ timeout: 5000 }).catch(() => false)) return true;
    // Shopify outer Save bar appearing means a form is active
    if (await this.page.getByRole('button', { name: /^save$/i }).first()
        .isVisible({ timeout: 5000 }).catch(() => false)) return true;
    // Breadcrumb back-button to templates list (present when inside a create/edit form page)
    if (await this.app.locator('button').filter({ hasText: /templates?$/i }).first()
        .isVisible({ timeout: 3000 }).catch(() => false)) return true;
    // Any visible HTML form element
    if (await this.app.locator('form').first().isVisible({ timeout: 3000 }).catch(() => false)) return true;
    return false;
  }

  // ─── Toast / Feedback ─────────────────────────────────────────────────

  async isSuccessToastVisible() {
    return (
      (await this.app.getByText(/success|saved|created|updated|fetched|deleted/i).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.page.getByText(/success|saved|created|updated|fetched|deleted/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  async isErrorVisible() {
    return (
      (await this.app.getByText(/error|failed|invalid|required/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.locator('[class*="error"], [class*="Error"], [role="alert"]').first().isVisible({ timeout: 3000 }).catch(() => false))
    );
  }

  // ─── URL helper ───────────────────────────────────────────────────────

  static buildTemplatesUrl(baseUrl) {
    return baseUrl.replace(/panel\/.*$/, 'panel/templates');
  }

  // ─── Column Header Sort ───────────────────────────────────────────────

  /** Click a sortable column header (th or columnheader role). Returns true if found and clicked. */
  async clickColumnHeader(labelRe) {
    const hdrs = this.app.locator('th, [role="columnheader"]').filter({ hasText: labelRe });
    const hdrCount = await hdrs.count().catch(() => 0);
    if (hdrCount > 0) {
      await hdrs.first().click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(1000).catch(() => {});
      return true;
    }
    const sortBtns = this.app.locator('th button, [role="columnheader"] button').filter({ hasText: labelRe });
    const btnCount = await sortBtns.count().catch(() => 0);
    if (btnCount > 0) {
      await sortBtns.first().click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(1000).catch(() => {});
      return true;
    }
    return false;
  }
}

module.exports = { EtsyTemplatesPage };
