import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageState = path.join(__dirname, '..', 'playwright', '.auth', 'shopify.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('https://admin.shopify.com/store/etsy-test-gp7o90bx/apps/etsy-dev-public/panel/overview', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  let appFrame = null;
  for (let i = 0; i < 10; i++) {
    appFrame = page.frames().find(f => f.url().includes('cifapps.com'));
    if (appFrame) break;
    await page.waitForTimeout(2000);
  }
  if (!appFrame) { console.log('No frame'); await browser.close(); return; }
  await appFrame.waitForSelector('[class*="Polaris"]', { timeout: 15000 }).catch(() => {});
  // wait for recent activities
  await appFrame.waitForFunction(() => /recent activit/i.test(document.body.innerText || ''), { timeout: 20000 }).catch(() => {});

  const dump = await appFrame.evaluate(() => {
    // notification items
    const items = Array.from(document.querySelectorAll('.notification-item'));
    // all activities button
    const allActBtn = Array.from(document.querySelectorAll('a,button')).find(el =>
      /all activities/i.test(el.innerText || el.getAttribute('aria-label') || '')
    );
    // delete buttons inside notification items
    const deleteBtns = items.flatMap(item =>
      Array.from(item.querySelectorAll('button')).map(b => ({
        label: b.getAttribute('aria-label'),
        text: b.innerText?.trim(),
        cls: b.className.substring(0,80)
      }))
    );
    // also check for any delete-labelled buttons on page
    const pageDeleteBtns = Array.from(document.querySelectorAll('button'))
      .filter(b => /delete|remove|dismiss/i.test(b.getAttribute('aria-label') || ''))
      .map(b => ({ label: b.getAttribute('aria-label'), text: b.innerText?.trim(), cls: b.className.substring(0,80) }));

    return {
      itemsCount: items.length,
      firstItemHTML: items[0] ? items[0].outerHTML.substring(0, 1200) : '',
      allActBtn: allActBtn ? { tag: allActBtn.tagName, text: allActBtn.innerText?.trim(), label: allActBtn.getAttribute('aria-label'), cls: allActBtn.className.substring(0,80) } : null,
      deleteBtnsInItems: deleteBtns,
      pageDeleteBtns
    };
  });

  console.log('Items found:', dump.itemsCount);
  console.log('\n=== FIRST ITEM HTML ===\n', dump.firstItemHTML);
  console.log('\n=== ALL ACTIVITIES BUTTON ===\n', JSON.stringify(dump.allActBtn, null, 2));
  console.log('\n=== DELETE BUTTONS IN ITEMS ===\n', JSON.stringify(dump.deleteBtnsInItems, null, 2));
  console.log('\n=== PAGE DELETE BUTTONS ===\n', JSON.stringify(dump.pageDeleteBtns, null, 2));
  await browser.close();
})();
