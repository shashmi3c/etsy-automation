import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SESSION_FILE = path.join(__dirname, '..', 'playwright', '.auth', 'shopify.json');
const ADMIN_URL    = 'https://admin.shopify.com/store/etsy-test-gp7o90bx/apps/etsy-dev-public';
const EMAIL        = 'shashmi@threecolts.com';
const PASSWORD     = 'sameera@123*';

(async () => {
  // Check if existing session has any valid cookies
  let seedState = undefined;
  if (existsSync(SESSION_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
      const now = Math.floor(Date.now() / 1000);
      const hasValid = (raw.cookies || []).some(c => c.expires < 0 || c.expires > now);
      if (hasValid) seedState = SESSION_FILE;
    } catch {}
  }

  // Try silent refresh first (headless)
  console.log('Attempting silent session refresh...');
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext(seedState ? { storageState: seedState } : {});
  const page    = await ctx.newPage();

  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000).catch(() => {});

  const url = page.url();
  if (url.includes('admin.shopify.com')) {
    await mkdir(path.dirname(SESSION_FILE), { recursive: true });
    await ctx.storageState({ path: SESSION_FILE });
    console.log('✓ Session refreshed and saved to:', SESSION_FILE);
    await browser.close();
    return;
  }

  await browser.close();
  console.log('Silent refresh failed — session expired. Opening login browser...');

  // Headed login with auto-fill
  const browser2 = await chromium.launch({ headless: false });
  const ctx2     = await browser2.newContext();
  const page2    = await ctx2.newPage();

  await page2.goto('https://accounts.shopify.com/store-login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page2.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 }).catch(() => {});
  await page2.fill('input[type="email"], input[name="email"]', EMAIL).catch(() => {});
  const btn = page2.locator('button:has-text("Continue"), button:has-text("Next"), [data-trekkie-id="submit_login_form"]');
  await btn.first().click().catch(() => {});
  await page2.waitForTimeout(2000).catch(() => {});
  const pwd = page2.locator('input[type="password"]');
  if (await pwd.count().catch(() => 0) > 0) {
    await pwd.fill(PASSWORD).catch(() => {});
    await page2.locator('button[type="submit"]').first().click().catch(() => {});
  }

  await page2.evaluate(() => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff6b35;color:#fff;font:bold 14px sans-serif;padding:12px 16px;text-align:center';
    b.textContent = '⚠️ Check shashmi@threecolts.com — copy the verification link and paste it in THIS address bar';
    document.body.prepend(b);
  }).catch(() => {});

  console.log('Waiting for you to complete email verification (up to 10 min)...');
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try { if (page2.url().includes('admin.shopify.com')) break; } catch {}
  }

  if (!page2.url().includes('admin.shopify.com')) {
    await browser2.close();
    throw new Error('Did not reach admin.shopify.com within 10 minutes.');
  }

  await mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await ctx2.storageState({ path: SESSION_FILE });
  console.log('✓ Session refreshed and saved to:', SESSION_FILE);
  await browser2.close();
})();
