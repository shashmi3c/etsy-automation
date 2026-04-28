// @ts-check

/**
 * Page Object for Etsy Profiling section.
 * Based on actual app UI: grid with Name, Created On, Status, Products, Profile Type, Actions columns.
 * Actions: Edit (pencil), Clone (gear), Delete (red trash).
 * Toggle switch on left of each profile row.
 */
class EtsyProfilingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.app = page;
  }

  async resolveAppContext() {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});

    let appFrame = null;

    // Poll up to 30s for any iframe frame that has meaningful body content.
    // Playwright CDP access bypasses cross-origin restrictions, so evaluate() works on any frame.
    for (let attempt = 0; attempt < 30; attempt++) {
      const frames = this.page.frames();
      for (const frame of frames) {
        if (frame === this.page.mainFrame()) continue;
        if (frame.isDetached()) continue;
        try {
          const bodyLen = await frame.evaluate(
            () => (document.body ? document.body.innerHTML.length : 0)
          ).catch(() => 0);
          if (bodyLen > 500) {
            appFrame = frame;
            break;
          }
        } catch {}
      }
      if (appFrame) break;
      await this.page.waitForTimeout(1000).catch(() => {});
    }

    if (appFrame && !appFrame.isDetached()) {
      this.app = appFrame;
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

  async goto(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        break;
      } catch (e) {
        if (attempt < 2 && /ERR_CONNECTION/i.test(e.message)) {
          await this.page.waitForTimeout(3000).catch(() => {});
          continue;
        }
        throw e;
      }
    }
    await this.page.locator('[role="progressbar"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.resolveAppContext();

    // Shopify embedded SPAs may not respond to direct URL navigation and land on Overview.
    // Strategy: remove aria-disabled from sidebar links then dispatch a click event,
    // which triggers Shopify App Bridge's client-side routing to the correct section.
    const onOverview = await this.app.getByRole('heading', { name: /^overview$/i }).first()
      .isVisible({ timeout: 5000 }).catch(() => false);

    if (onOverview) {
      const sectionMatch = String(url).match(/panel\/([a-z]+)/i);
      const sectionName = sectionMatch ? sectionMatch[1] : '';
      if (sectionName && sectionName !== 'overview') {
        // Remove aria-disabled so click propagates through Shopify's React event handlers
        await this.page.evaluate((section) => {
          const links = document.querySelectorAll(`a[href*="panel/${section}"]`);
          links.forEach(l => {
            l.removeAttribute('aria-disabled');
            l.parentElement?.removeAttribute('aria-disabled');
          });
        }, sectionName).catch(() => {});

        const sidebarLink = this.page.locator(`a[href*="panel/${sectionName}"]`).first();
        if (await sidebarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sidebarLink.click();
          await this.page.waitForTimeout(4000).catch(() => {});
          await this.resolveAppContext();
        }
      }
    }

    // Wait for app content to be ready
    await this.app.locator(
      '[aria-label*="Edit Profile"], [aria-label*="Delete Profile"], button, [role="grid"]'
    ).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await this.app.evaluate(() => {
      document.body.classList.remove('driver-active', 'driver-fade');
      document.body.style.pointerEvents = 'auto';
      document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
    }).catch(() => {});
  }

  async dismissOverlays() {
    const page = this.page;

    // Dismiss Shopify modal
    try {
      const closeBtn = page.locator('#PolarisPortalsContainer button[aria-label="Close"], button[aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(800);
      }
    } catch {}

    // Escape backdrop
    try {
      if (await page.locator('[class*="Backdrop"]').first().isVisible({ timeout: 1500 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
      }
    } catch {}

    // Dismiss "Profile Creation" guide dialog (has a "Done" button)
    try {
      const doneBtn = this.app.getByRole('button', { name: /^done$/i }).first();
      if (await doneBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await doneBtn.click({ force: true });
        await page.waitForTimeout(800);
      }
    } catch {}

    // Remove driver.js tour overlays
    await this.app.evaluate(() => {
      document.querySelectorAll('.driver-overlay, .driver-popover, .driver-active-element').forEach(el => el.remove());
      document.body.classList.remove('driver-active', 'driver-fade');
      document.body.style.pointerEvents = 'auto';
    }).catch(() => {});
  }

  // ─── Grid Page ────────────────────────────────────────────────────────

  /** Check if profiling heading is visible */
  async isProfilingPageVisible() {
    return (
      (await this.app.getByRole('heading', { name: /profiling/i }).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      (await this.app.getByRole('button', { name: /create new profile/i }).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await this.app.getByText(/profiling/i).first().isVisible({ timeout: 5000 }).catch(() => false))
    );
  }

  /** Get "Create new profile" button */
  getCreateButton() {
    return this.app.getByRole('button', { name: /create new profile/i }).first();
  }

  /** Click "Create new profile" */
  async clickCreateNewProfile() {
    const frame = await this.getFrame();
    if (frame) {
      await frame.evaluate(() => {
        document.body.classList.remove('driver-active', 'driver-fade');
        document.body.style.pointerEvents = 'auto';
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      }).catch(() => {});
      await frame.getByRole('button', { name: /create new profile/i }).first().click({ timeout: 10000 });
    } else {
      await this.app.getByRole('button', { name: /create new profile/i }).first().click({ force: true, timeout: 10000 });
    }
    await this.page.waitForTimeout(5000);
    await this.resolveAppContext();
  }

  /** Get the info banner ("Struggling to List on Etsy?") */
  async isBannerVisible() {
    return this.app.getByText(/struggling to list/i).first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  /** Dismiss banner via X button */
  async dismissBanner() {
    const x = this.app.getByText(/struggling to list/i).first().locator('..').locator('..').locator('button').last();
    await x.click({ force: true }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /** Get "Know More!" link in the banner */
  getKnowMoreLink() {
    return this.app.getByText(/know more/i).first();
  }

  /** Get the search input */
  getSearchInput() {
    return this.app.getByPlaceholder(/search for a profile name/i).first();
  }

  /** Get grid column headers — tries multiple selector strategies */
  async getGridColumns() {
    const cols = ['Name', 'Created On', 'Status', 'Products', 'Profile Type', 'Actions'];
    let found = 0;
    for (const col of cols) {
      const byRole = await this.app.getByRole('columnheader', { name: col }).first()
        .isVisible({ timeout: 5000 }).catch(() => false);
      if (byRole) { found++; continue; }
      const byTh = await this.app.locator('th').filter({ hasText: col }).first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      if (byTh) { found++; continue; }
      // Fallback: column text anywhere on page (some grids use divs)
      const byText = await this.app.getByText(new RegExp(`^${col}$`)).first()
        .isVisible({ timeout: 2000 }).catch(() => false);
      if (byText) found++;
    }
    return found;
  }

  /** Get all profile rows */
  getProfileRows() {
    return this.app.locator('table tbody tr, [class*="IndexTable"] tr[class*="Row"]');
  }

  /** Get profile name text from a row by index.
   *  Profile name is the text of the "View Profile" button inside each row. */
  async getProfileNameAt(index) {
    const row = this.getProfileRows().nth(index);
    const viewBtn = row.getByRole('button', { name: /view profile/i }).first();
    const txt = await viewBtn.textContent().catch(() => '');
    return (txt || '').replace(/view profile/i, '').trim() ||
      (await row.locator('td').first().textContent().catch(() => '') || '').trim();
  }

  // ─── Toggle (Enable/Disable) ──────────────────────────────────────────

  /** Get the toggle checkbox for a profile row by index.
   *  Actual aria-label is "Disable Profile <id>" (enabled) or "Enable Profile <id>" (disabled). */
  getToggle(index) {
    return this.app.locator('input[type="checkbox"][aria-label*="Profile"]').nth(index);
  }

  /** Check if a profile toggle is enabled (aria-label starts with "Disable" means it IS enabled) */
  async isToggleEnabled(index) {
    const toggle = this.getToggle(index);
    // If checked, it's enabled; aria-label "Disable Profile" confirms it's currently on
    const checked = await toggle.isChecked().catch(() => false);
    if (checked !== undefined) return checked;
    // Fallback: read aria-label
    const label = await toggle.getAttribute('aria-label').catch(() => '');
    return /disable/i.test(label || '');
  }

  /** Click toggle to enable/disable a profile */
  async clickToggle(index) {
    const toggle = this.getToggle(index);
    // Force-click the checkbox (it may be visually hidden behind a custom switch)
    await toggle.click({ force: true });
    await this.page.waitForTimeout(2000);
  }

  /** Check if any confirmation popup/modal is visible */
  async isPopupVisible() {
    const app = this.app;
    const page = this.page;
    return (
      (await app.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await page.locator('[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false)) ||
      (await app.getByText(/confirm/i).first().isVisible({ timeout: 2000 }).catch(() => false))
    );
  }

  /** Click Confirm/Delete in popup (Shopify App Bridge modal renders on main page) */
  async clickPopupConfirm() {
    const page = this.page;
    // Shopify App Bridge modals render buttons on the main page, not in the iframe
    const mainConfirm = page.getByRole('button', { name: /^confirm$/i }).first();
    if (await mainConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mainConfirm.click({ force: true });
      await page.waitForTimeout(2000);
      return;
    }
    // Try "Delete" button (for delete modal)
    const mainDelete = page.getByRole('button', { name: /^delete$/i }).first();
    if (await mainDelete.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mainDelete.click({ force: true });
      await page.waitForTimeout(2000);
      return;
    }
    // Fallback: try inside iframe
    const iframeConfirm = this.app.getByRole('button', { name: /confirm|delete/i }).first();
    if (await iframeConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await iframeConfirm.click({ force: true });
      await page.waitForTimeout(2000);
      return;
    }
    // Last resort: click any primary/critical button in the modal
    const anyBtn = page.locator('[class*="Modal"] button[class*="primary"], [class*="Modal"] button[class*="critical"]').first();
    if (await anyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await anyBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  /** Click Cancel in popup or press Escape (Shopify modal on main page) */
  async closePopup() {
    const page = this.page;
    // Shopify modal Cancel button on main page
    const mainCancel = page.getByRole('button', { name: /^cancel$/i }).first();
    if (await mainCancel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mainCancel.click({ force: true });
      await page.waitForTimeout(1000);
      return;
    }
    // Try inside iframe
    const iframeCancel = this.app.getByRole('button', { name: /cancel/i }).first();
    if (await iframeCancel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await iframeCancel.click({ force: true });
      await page.waitForTimeout(1000);
      return;
    }
    // Close button
    const closeBtn = page.locator('button[aria-label="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true });
      await page.waitForTimeout(1000);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // ─── Actions: Edit, Clone, Delete ─────────────────────────────────────

  /** Get the edit (pencil) button for a profile row by index */
  getEditButton(index) {
    return this.app.getByRole('button', { name: /edit profile/i }).nth(index);
  }

  /** Get the clone button for a profile row by index */
  getCloneButton(index) {
    return this.app.getByRole('button', { name: /clone/i }).nth(index);
  }

  /** Get the delete (red trash) button for a profile row by index */
  getDeleteButton(index) {
    return this.app.getByRole('button', { name: /delete profile/i }).nth(index);
  }

  /** Click edit on a profile row */
  async clickEdit(index) {
    await this.getEditButton(index).click({ force: true });
    await this.page.waitForTimeout(5000);
    await this.resolveAppContext();
  }

  /** Click delete on a profile row */
  async clickDelete(index) {
    await this.getDeleteButton(index).click({ force: true });
    await this.page.waitForTimeout(2000);
  }

  /** Click clone on a profile row */
  async clickClone(index) {
    await this.getCloneButton(index).click({ force: true });
    await this.page.waitForTimeout(2000);
  }

  // ─── Create/Edit Profile Form ─────────────────────────────────────────

  /** Get the app frame (same as this.app if iframe was resolved) */
  async getFrame() {
    if (this.app !== this.page) return this.app;
    // Fallback: scan frames for any with meaningful content
    const frames = this.page.frames();
    for (const frame of frames) {
      if (frame === this.page.mainFrame()) continue;
      if (frame.isDetached()) continue;
      const bodyLen = await frame.evaluate(
        () => (document.body ? document.body.innerHTML.length : 0)
      ).catch(() => 0);
      if (bodyLen > 500) return frame;
    }
    return null;
  }

  /** Fill profile name */
  async fillProfileName(name) {
    const input = this.app.locator('#profile_code').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click();
    await input.fill(name);
  }

  /** Search and select Etsy category */
  async selectCategory(searchTerm) {
    const input = this.app.getByPlaceholder(/search/i).first();
    await input.click();
    await input.fill(searchTerm);
    await this.page.waitForTimeout(3000);
    await this.app.getByText(new RegExp(searchTerm, 'i')).first().click({ timeout: 10000 });
    await this.page.waitForTimeout(3000);
  }

  /** Set product condition: property, operator, value */
  async setProductCondition(property, operator, valueTerm) {
    const frame = await this.getFrame();
    const ctx = frame || this.app;

    // Scroll to conditions
    if (frame) await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForTimeout(2000);

    // Select property (e.g. 'product_type')
    await ctx.locator('#property_0').selectOption(property);
    await this.page.waitForTimeout(2000);

    // Select operator (e.g. 'IN({operator})')
    await ctx.locator('#operator_0').selectOption(operator);
    await this.page.waitForTimeout(3000);

    // Select value from multi-select combobox
    const combobox = ctx.locator('input[role="combobox"]').last();
    await combobox.click();
    await this.page.waitForTimeout(1000);
    await combobox.fill(valueTerm);
    await this.page.waitForTimeout(3000);

    const option = ctx.getByRole('option', { name: new RegExp(valueTerm, 'i') }).first();
    if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
      await option.click();
    } else {
      // Select first available option
      const firstOpt = ctx.getByRole('option').first();
      if (await firstOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOpt.click();
      }
    }
    await this.page.waitForTimeout(1000);
  }

  /** Click Save button */
  async clickSave() {
    const btn = this.app.getByRole('button', { name: /^save$/i }).first();
    await btn.click({ force: true, timeout: 10000 });
    await this.page.waitForTimeout(3000);
  }

  // ─── Search & Filter ──────────────────────────────────────────────────

  async searchProfile(name) {
    const input = this.getSearchInput();
    await input.fill(name);
    await this.page.waitForTimeout(2000);
  }

  async clearSearch() {
    const input = this.getSearchInput();
    await input.clear();
    await this.page.waitForTimeout(1000);
  }

  /** Get filter/funnel icon buttons */
  getFilterButton() {
    return this.app.locator('[aria-label*="Filter"], [aria-label*="filter"], button:has(svg)').first();
  }

  /** Get "Showing X of Y results" text */
  async getResultsCount() {
    const text = await this.app.getByText(/showing.*of.*results/i).first().textContent().catch(() => '');
    return text.trim();
  }
}

module.exports = { EtsyProfilingPage };
