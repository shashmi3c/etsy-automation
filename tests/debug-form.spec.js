const { test } = require('@playwright/test');
const { EtsyTemplatesPage } = require('../pages/EtsyTemplatesPage');

const TEMPLATES_URL = `https://admin.shopify.com/store/etsy-test-gp7o90bx/apps/etsy-dev-public/panel/template`;

test('DEBUG: Create Shipping Template form structure', async ({ page }) => {
  const t = new EtsyTemplatesPage(page);
  await t.goto(TEMPLATES_URL);
  await t.dismissOverlays();

  const createBtn = t.app.locator('button[aria-label*="Create Shipping"]').first();
  await createBtn.click({ force: true });
  await page.waitForTimeout(3000);

  const info = await t.app.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input,select,textarea')).map(el => ({
      type: el.type || el.tagName, name: el.name, placeholder: el.placeholder,
      ariaLabel: el.getAttribute('aria-label'), id: el.id
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: (b.innerText||'').trim().substring(0,50), aria: b.getAttribute('aria-label')
    })).filter(b=>b.text||b.aria);
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h=>(h.innerText||'').trim());
    const labels = Array.from(document.querySelectorAll('label')).map(l=>(l.innerText||'').trim());
    return { inputs, buttons: buttons.slice(0,30), headings, labels: labels.slice(0,20) };
  });

  console.log('=== INPUTS ===', JSON.stringify(info.inputs, null, 2));
  console.log('=== BUTTONS ===', JSON.stringify(info.buttons, null, 2));
  console.log('=== HEADINGS ===', JSON.stringify(info.headings));
  console.log('=== LABELS ===', JSON.stringify(info.labels));
});
