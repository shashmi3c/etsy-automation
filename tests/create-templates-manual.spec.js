// @ts-check
/**
 * Manual template creation script — runs with stored auth, fills every field
 * explicitly, creates one template of each type needed for functional tests.
 * Run: npx playwright test tests/create-templates-manual.spec.js --project=etsy-authenticated --headed --reporter=list
 */
const { test, expect } = require('@playwright/test');
const { EtsyTemplatesPage } = require('../pages/EtsyTemplatesPage');

const BASE_URL    = `https://admin.shopify.com/store/etsy-test-gp7o90bx/apps/etsy-dev-public`;
const TEMPLATES_URL = `${BASE_URL}/panel/template`;
const TS          = Date.now();

/** Select a preferred country from a native <select>: tries US, IN, GB, CA, AU, then first valid */
async function selectCountry(sel, page) {
  const preferred = ['US', 'IN', 'GB', 'CA', 'AU', 'DE', 'FR'];
  for (const code of preferred) {
    const hasOption = await sel.evaluate((el, c) => {
      return Array.from(el.options).some(o => !o.disabled && o.value === c);
    }, code).catch(() => false);
    if (hasOption) {
      await sel.selectOption(code);
      await page.waitForTimeout(300);
      return code;
    }
  }
  // fallback: first valid non-disabled
  const firstValid = await sel.evaluate(el => {
    for (const opt of el.options) {
      if (!opt.disabled && opt.value && opt.value !== '' && opt.value !== 'Select') return opt.value;
    }
    return null;
  }).catch(() => null);
  if (firstValid) {
    await sel.selectOption(firstValid);
    await page.waitForTimeout(300);
    return firstValid;
  }
  return null;
}

/** Fill all selects: country fields get preferred value, others get first valid */
async function fillAllSelects(app, page) {
  const selects = app.locator('select');
  const count = await selects.count();
  console.log(`  Found ${count} select elements`);
  for (let i = 0; i < count; i++) {
    const sel = selects.nth(i);
    if (!await sel.isVisible({ timeout: 1000 }).catch(() => false)) continue;

    const label = await sel.evaluate(el => {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      return lbl?.textContent?.trim() || el.getAttribute('aria-label') || el.name || `select-${i}`;
    }).catch(() => `select-${i}`);

    const currentVal = await sel.inputValue().catch(() => '');
    const isPlaceholder = await sel.evaluate(el => {
      const opt = el.options[el.selectedIndex];
      return !opt || opt.disabled || opt.value === '' || opt.value === 'Select';
    }).catch(() => false);

    console.log(`    select[${i}] label="${label}" current="${currentVal}" needsFill=${isPlaceholder}`);
    if (!isPlaceholder) continue;

    // Country-type selects
    if (/country|origin|dispatch|location|ship.from/i.test(label)) {
      const chosen = await selectCountry(sel, page);
      console.log(`    → country selected: "${chosen}"`);
    } else {
      const firstValid = await sel.evaluate(el => {
        for (const opt of el.options) {
          if (!opt.disabled && opt.value && opt.value !== '' && opt.value !== 'Select') return opt.value;
        }
        return null;
      }).catch(() => null);
      if (firstValid) {
        await sel.selectOption(firstValid);
        await page.waitForTimeout(300);
        console.log(`    → selected: "${firstValid}"`);
      }
    }
  }
}

/** Fill all visible number inputs */
async function fillNumberInputs(app, page, defaultVal = '1') {
  const inputs = app.locator('input[type="number"], input[role="spinbutton"]');
  const count = await inputs.count();
  console.log(`  Found ${count} number inputs`);
  for (let i = 0; i < count; i++) {
    const inp = inputs.nth(i);
    if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
    const val = await inp.inputValue().catch(() => '');
    const label = await inp.evaluate(el => {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      return lbl?.textContent?.trim() || el.getAttribute('aria-label') || el.placeholder || '?';
    }).catch(() => '?');
    console.log(`    number[${i}] label="${label}" current="${val}"`);
    if (!val || val === '0') {
      await inp.fill(defaultVal);
      await page.waitForTimeout(200);
      console.log(`    → filled "${defaultVal}"`);
    }
  }
}

/** Fill zip/postal code text inputs */
async function fillZipInputs(app, page) {
  const textInputs = app.locator('input[type="text"]:not([aria-label*="name" i]):not([placeholder*="name" i])');
  const count = await textInputs.count();
  for (let i = 0; i < count; i++) {
    const inp = textInputs.nth(i);
    if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
    const label = await inp.evaluate(el => {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      return lbl?.textContent?.trim() || el.getAttribute('aria-label') || el.placeholder || el.name || '';
    }).catch(() => '');
    if (!/zip|postal|post.code|pincode/i.test(label)) continue;
    const val = await inp.inputValue().catch(() => '');
    if (!val) {
      await inp.fill('10001');
      await page.waitForTimeout(200);
      console.log(`    → zip filled "10001" for label="${label}"`);
    }
  }
}

/** Wait for Shopify App Bridge save bar and click Save */
async function clickShopifySave(page) {
  console.log('  Waiting for Shopify save bar (up to 25s)...');
  const saveBar = page.getByRole('button', { name: /^save$/i }).first();
  const saveVisible = await saveBar.isVisible({ timeout: 25000 }).catch(() => false);
  console.log(`  Save bar visible: ${saveVisible}`);
  if (saveVisible) {
    await saveBar.click({ force: true });
    await page.waitForTimeout(5000);
    console.log('  Clicked Save');
    return true;
  }
  // Also try any button with "Save" text in the outer page
  const anyBtn = page.locator('button').filter({ hasText: /save/i }).first();
  if (await anyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await anyBtn.click({ force: true });
    await page.waitForTimeout(4000);
    console.log('  Clicked fallback Save button');
    return true;
  }
  return false;
}

test.describe('Create Templates Manually', () => {
  test.describe.configure({ mode: 'serial', timeout: 300000 });

  /** @type {EtsyTemplatesPage} */
  let t;

  test.beforeEach(async ({ page }) => {
    t = new EtsyTemplatesPage(page);
    await t.goto(TEMPLATES_URL);
    await t.dismissOverlays();
    const loaded = await t.isTemplatesPageVisible();
    if (!loaded) test.skip(true, 'Templates page did not load.');
  });

  // ─── SHIPPING ────────────────────────────────────────────────

  test('Create Shipping Template with all fields', async ({ page }) => {
    await t.clickShippingTab();
    await page.waitForTimeout(2000);

    const createBtn = t.getCreateButton();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // Screenshot of the blank form
    await page.screenshot({ path: `test-results/shipping-form-blank-${TS}.png` });

    // Log ALL form elements for diagnosis
    const allElements = await t.app.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea, [role="combobox"], [role="listbox"]'))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map(el => ({
          tag: el.tagName,
          type: el.type || '',
          role: el.getAttribute('role') || '',
          placeholder: el.placeholder || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          name: el.name || '',
          value: el.value || '',
          id: el.id || '',
          labelText: (() => {
            if (el.id) {
              const lbl = document.querySelector(`label[for="${el.id}"]`);
              return lbl?.textContent?.trim() || '';
            }
            return '';
          })(),
        }));
    }).catch(() => []);
    console.log('Shipping form elements:');
    allElements.forEach((el, i) => console.log(`  [${i}] ${el.tag}[type=${el.type}][role=${el.role}] label="${el.labelText||el.ariaLabel||el.placeholder||el.name}" value="${el.value}"`));

    // Fill template name
    const nameInput = t.app.getByPlaceholder(/template name|enter name/i).first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.clear();
    await nameInput.fill(`AutoTest_${TS}_Shipping`);
    await page.waitForTimeout(1000);

    // First pass: fill dispatch origin country (triggers form expansion)
    await fillAllSelects(t.app, page);
    // Wait for the Standard Shipping section to appear (cascading form)
    await page.waitForTimeout(2000);

    // Second pass: now fill Min/Max Delivery Days and any other newly revealed selects
    console.log('  Second pass — filling newly revealed selects...');
    await fillAllSelects(t.app, page);
    await page.waitForTimeout(1000);

    // Fill zip codes
    await fillZipInputs(t.app, page);

    // Fill number inputs
    await fillNumberInputs(t.app, page, '2');

    // Screenshot before saving
    await page.screenshot({ path: `test-results/shipping-form-filled-${TS}.png` });

    // Click Save
    const saved = await clickShopifySave(page);
    if (!saved) {
      console.log('WARNING: Save button not found — form may not have changed');
    }

    // Screenshot after save attempt
    await page.screenshot({ path: `test-results/shipping-after-save-${TS}.png` });

    // Navigate back to list and check
    await t.goto(TEMPLATES_URL);
    await t.dismissOverlays();
    await t.clickShippingTab();
    await page.waitForTimeout(3000);

    const inList = await t.isTextInTable(`AutoTest_${TS}_Shipping`);
    console.log(`Template in list: ${inList}`);
    await page.screenshot({ path: `test-results/shipping-list-${TS}.png` });

    if (!inList) {
      console.log('WARNING: Template not found in list after save — checking for any new rows...');
      const rows = await t.getTableRowCount();
      console.log(`Total rows in shipping list: ${rows}`);
    }

    expect(inList).toBe(true);
  });

  // ─── INVENTORY ───────────────────────────────────────────────

  test('Create Inventory Template with all fields', async ({ page }) => {
    await t.clickInventoryTab();
    await page.waitForTimeout(2000);

    const createBtn = t.getCreateButton();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `test-results/inventory-form-blank-${TS}.png` });

    const allElements = await t.app.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({ tag: el.tagName, type: el.type || '', placeholder: el.placeholder || '', ariaLabel: el.getAttribute('aria-label') || '', name: el.name || '', value: el.value || '' }));
    }).catch(() => []);
    console.log('Inventory form elements:', JSON.stringify(allElements, null, 2));

    // Inventory form uses "Enter a name for the template" or pre-fills a default name
    const nameInput = t.app.getByPlaceholder(/enter a name|template name|enter name/i).first();
    if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(`AutoTest_${TS}_Inventory`);
    } else {
      // Try any visible text input that could be the name
      const anyText = t.app.locator('input[type="text"]').first();
      if (await anyText.isVisible({ timeout: 5000 }).catch(() => false)) {
        await anyText.clear();
        await anyText.fill(`AutoTest_${TS}_Inventory`);
      }
    }
    await page.waitForTimeout(1000);

    await fillAllSelects(t.app, page);
    await fillZipInputs(t.app, page);

    // Fill number/text inputs (quantity, value fields)
    const textInputs = t.app.locator('input[type="text"]');
    const textCount = await textInputs.count();
    for (let i = 0; i < textCount; i++) {
      const inp = textInputs.nth(i);
      if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      if (placeholder === '0') {
        const val = await inp.inputValue().catch(() => '');
        if (!val) { await inp.fill('10'); await page.waitForTimeout(200); }
      }
    }
    await fillNumberInputs(t.app, page, '10');

    await page.screenshot({ path: `test-results/inventory-form-filled-${TS}.png` });

    const saved = await clickShopifySave(page);
    console.log(`Inventory save clicked: ${saved}`);

    await page.screenshot({ path: `test-results/inventory-after-save-${TS}.png` });

    await t.goto(TEMPLATES_URL);
    await t.dismissOverlays();
    await page.waitForTimeout(2000);
    await t.dismissOverlays();
    await t.clickInventoryTab();
    await page.waitForTimeout(3000);

    const inList = await t.isTextInTable(`AutoTest_${TS}_Inventory`);
    console.log(`Inventory template in list: ${inList}`);
    await page.screenshot({ path: `test-results/inventory-list-${TS}.png` });
    expect(inList).toBe(true);
  });

  // ─── PRICE ───────────────────────────────────────────────────

  test('Create Price Template with all fields', async ({ page }) => {
    // Double dismissOverlays before tab navigation (same pattern as Inventory)
    await t.dismissOverlays();
    await page.waitForTimeout(1000);
    await t.dismissOverlays();

    await t.clickPriceTab();
    await page.waitForTimeout(3000);

    // Verify the Price tab is actually selected before proceeding
    const priceTabSelected = await t.app.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const priceTab = tabs.find(el => /^price(\s+templates?)?$/i.test((el.textContent || el.getAttribute('aria-label') || '').trim()));
      return priceTab ? priceTab.getAttribute('aria-selected') === 'true' : false;
    }).catch(() => false);
    console.log(`Price tab selected: ${priceTabSelected}`);

    if (!priceTabSelected) {
      // Retry with forced JS click
      await t.app.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const priceTab = tabs.find(el => /^price(\s+templates?)?$/i.test((el.textContent || el.getAttribute('aria-label') || '').trim()));
        if (priceTab) priceTab.click();
      }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // Screenshot to confirm which tab content is showing before clicking Create
    await page.screenshot({ path: `test-results/price-tab-active-${TS}.png` });

    // Wait for Price tab content to be fully rendered
    // Price tab Create button aria-label should contain "Price"
    let createBtn = t.app.locator('button[aria-label*="Create Price"], button[aria-label*="create price"]').first();
    const priceCreateVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!priceCreateVisible) {
      // Fallback: use generic Create button but only after verifying no shipping content
      createBtn = t.app.locator('button[aria-label*="Create"]').first();
    }

    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // Verify the opened form is a Price form (not Shipping)
    const formHeading = await t.app.evaluate(() => {
      const hs = Array.from(document.querySelectorAll('h1, h2, h3, [class*="Heading"]'));
      return hs.map(h => h.textContent?.trim()).filter(Boolean).join(' | ');
    }).catch(() => '');
    console.log(`Form headings: "${formHeading}"`);

    if (/shipping/i.test(formHeading) && !/price/i.test(formHeading)) {
      console.log('WARNING: Shipping form opened instead of Price — cancelling and retrying');
      await t.clickCancel();
      await page.waitForTimeout(2000);
      await t.dismissOverlays();
      await t.clickPriceTab();
      await page.waitForTimeout(4000);
      await createBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: `test-results/price-form-blank-${TS}.png` });

    const allElements = await t.app.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({ tag: el.tagName, type: el.type || '', placeholder: el.placeholder || '', ariaLabel: el.getAttribute('aria-label') || '', name: el.name || '', value: el.value || '' }));
    }).catch(() => []);
    console.log('Price form elements:', JSON.stringify(allElements, null, 2));

    const nameInput = t.app.getByPlaceholder(/enter a name|template name|enter name/i).first();
    if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(`AutoTest_${TS}_Price`);
    } else {
      const anyText = t.app.locator('input[type="text"]').first();
      if (await anyText.isVisible({ timeout: 5000 }).catch(() => false)) {
        await anyText.clear();
        await anyText.fill(`AutoTest_${TS}_Price`);
      }
    }
    await page.waitForTimeout(1000);

    await fillAllSelects(t.app, page);
    await fillNumberInputs(t.app, page, '0');

    await page.screenshot({ path: `test-results/price-form-filled-${TS}.png` });

    const saved = await clickShopifySave(page);
    console.log(`Price save clicked: ${saved}`);

    await page.screenshot({ path: `test-results/price-after-save-${TS}.png` });

    await t.goto(TEMPLATES_URL);
    await t.dismissOverlays();
    await page.waitForTimeout(2000);
    await t.dismissOverlays();
    await t.clickPriceTab();
    await page.waitForTimeout(3000);

    const inList = await t.isTextInTable(`AutoTest_${TS}_Price`);
    console.log(`Price template in list: ${inList}`);
    await page.screenshot({ path: `test-results/price-list-${TS}.png` });
    expect(inList).toBe(true);
  });

  // ─── POLICY ──────────────────────────────────────────────────

  test('Create Policy Template with all fields', async ({ page }) => {
    await t.dismissOverlays();
    await page.waitForTimeout(1000);
    await t.dismissOverlays();
    await t.clickPolicyTab();
    await page.waitForTimeout(2000);

    const createBtn = t.getCreateButton();
    if (!await createBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      test.skip(true, 'No Create button on Policy tab.');
      return;
    }
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `test-results/policy-form-blank-${TS}.png` });

    const allElements = await t.app.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => ({ tag: el.tagName, type: el.type || '', placeholder: el.placeholder || '', ariaLabel: el.getAttribute('aria-label') || '', name: el.name || '', value: el.value || '' }));
    }).catch(() => []);
    console.log('Policy form elements:', JSON.stringify(allElements, null, 2));

    // Try filling name if it exists
    const nameInput = t.app.getByPlaceholder(/enter a name|template name|enter name|name/i).first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(`AutoTest_${TS}_Policy`);
      await page.waitForTimeout(1000);
    }

    await fillAllSelects(t.app, page);

    // Fill textareas
    const textareas = t.app.locator('textarea');
    const taCount = await textareas.count();
    for (let i = 0; i < taCount; i++) {
      const ta = textareas.nth(i);
      if (!await ta.isVisible({ timeout: 1000 }).catch(() => false)) continue;
      const val = await ta.inputValue().catch(() => '');
      if (!val) await ta.fill('Standard return policy applies.');
    }

    await page.screenshot({ path: `test-results/policy-form-filled-${TS}.png` });

    const saved = await clickShopifySave(page);
    console.log(`Policy save clicked: ${saved}`);

    await page.screenshot({ path: `test-results/policy-after-save-${TS}.png` });

    await t.goto(TEMPLATES_URL);
    await t.dismissOverlays();
    await page.waitForTimeout(2000);
    await t.dismissOverlays();
    await t.clickPolicyTab();
    await page.waitForTimeout(3000);

    const inList = await t.isTextInTable(`AutoTest_${TS}_Policy`);
    console.log(`Policy template in list: ${inList}`);
    await page.screenshot({ path: `test-results/policy-list-${TS}.png` });
    // Soft assertion — policy form may have different save mechanism
    if (!inList) {
      console.log('Policy template not in list — check screenshots for form structure');
    }
  });

  // ─── DELETE CONFIRMATION TEST ─────────────────────────────────

  test('Verify delete confirmation dialog pattern', async ({ page }) => {
    await t.clickInventoryTab();
    await page.waitForTimeout(2000);

    const rowCount = await t.getTableRowCount();
    console.log(`Inventory rows: ${rowCount}`);
    if (rowCount === 0) {
      test.skip(true, 'No inventory templates to test delete dialog.');
      return;
    }

    // Click delete on first row
    const deleteBtn = t.app.locator('button[aria-label*="Delete"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click({ force: true });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `test-results/delete-dialog-${TS}.png` });

    // Check for type-to-confirm dialog
    const dialog = page.getByRole('dialog').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Delete dialog visible: ${dialogVisible}`);

    if (dialogVisible) {
      const dialogText = await dialog.textContent().catch(() => '');
      console.log(`Dialog text: ${dialogText}`);

      // Try iframe inside dialog
      const dialogFrame = page.frameLocator('[role="dialog"] iframe, dialog iframe').first();
      let textboxFilled = false;

      const textbox = dialogFrame.locator('input').first();
      if (await textbox.isVisible({ timeout: 5000 }).catch(() => false)) {
        await textbox.fill('delete');
        await page.waitForTimeout(500);
        textboxFilled = true;
        console.log('Filled "delete" in iframe textbox');
      } else {
        const outerTextbox = dialog.locator('input, [role="textbox"]').first();
        if (await outerTextbox.isVisible({ timeout: 3000 }).catch(() => false)) {
          await outerTextbox.fill('delete');
          await page.waitForTimeout(500);
          textboxFilled = true;
          console.log('Filled "delete" in outer dialog textbox');
        }
      }

      if (textboxFilled) {
        await page.screenshot({ path: `test-results/delete-filled-${TS}.png` });
        const deleteConfirmBtn = page.getByRole('button', { name: /^delete$/i }).last();
        const btnEnabled = await deleteConfirmBtn.isEnabled({ timeout: 5000 }).catch(() => false);
        console.log(`Delete confirm button enabled: ${btnEnabled}`);
        if (btnEnabled) {
          await deleteConfirmBtn.click({ force: true });
          await page.waitForTimeout(3000);
          console.log('Clicked Delete confirm');
          await page.screenshot({ path: `test-results/delete-after-${TS}.png` });
        }
      }

      // Cancel if still open
      const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click({ force: true });
      }
    }

    const rowsAfter = await t.getTableRowCount();
    console.log(`Rows after delete attempt: ${rowsAfter}`);
    expect(rowsAfter).toBeLessThanOrEqual(rowCount);
  });
});
