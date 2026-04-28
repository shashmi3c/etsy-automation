import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageState = path.join(__dirname, '..', 'playwright', '.auth', 'shopify.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context  = await browser.newContext({ storageState });
  const page     = await context.newPage();

  await page.goto(
    'https://admin.shopify.com/store/etsy-test-gp7o90bx/apps/etsy-dev-public/panel/overview',
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const appFrame = page.frames().find(f => f.url().includes('cifapps.com'));
  if (!appFrame) { console.log('No cifapps frame'); await browser.close(); return; }

  // Find the smallest element whose text is exactly/closest to "Product Analysis" heading
  const productHTML = await appFrame.evaluate(() => {
    // Walk all elements, find one whose direct text starts with "Product Analysis"
    const all = Array.from(document.querySelectorAll('div, section, article'));
    const card = all.find(el => {
      const h = el.querySelector('h2,h3,h4,h5,span,p');
      return h && /product analysis/i.test(h.innerText) && el.innerText.includes('Total Products');
    });
    return card ? card.outerHTML.substring(0, 4000) : 'Not found';
  });
  console.log('\n=== PRODUCT ANALYSIS CARD HTML ===\n', productHTML);

  // Find Etsy Shop Status card
  const shopHTML = await appFrame.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div, section, article'));
    const card = all.find(el => {
      return /etsy shop status/i.test(el.innerText) && el.innerText.length < 2000;
    });
    return card ? card.outerHTML.substring(0, 3000) : 'Not found';
  });
  console.log('\n=== ETSY SHOP STATUS CARD HTML ===\n', shopHTML);

  await browser.close();
})();
