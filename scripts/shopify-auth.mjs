import { chromium } from 'playwright';
import { mkdir, copyFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envContent = readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const EMAIL    = process.env.SHOPIFY_EMAIL;
const PASSWORD = process.env.SHOPIFY_PASSWORD;
const APP_URL  = process.env.SHOPIFY_AUTH_START_URL;

const SESSION_FILE = path.join(__dirname, '..', process.env.SHOPIFY_SESSION_PATH);
const MIRROR_FILE  = path.join(__dirname, '..', 'playwright', '.auth', 'shopify.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  console.log('Opening Shopify login page...');
  await page.goto('https://accounts.shopify.com/store-login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

  console.log('');
  console.log('==========================================================');
  console.log('  MANUAL LOGIN REQUIRED in the Playwright browser window.');
  console.log('');
  console.log('  If Shopify sends a verification email:');
  console.log('  - RIGHT-CLICK the link in the email → Copy Link Address');
  console.log('  - Paste it in the ADDRESS BAR of the Playwright browser');
  console.log('  - Do NOT click it in your regular browser');
  console.log('');
  console.log('  Session saves automatically once admin.shopify.com loads.');
  console.log('==========================================================');
  console.log('');

  // Inject a visible instruction banner onto the page
  await page.evaluate(() => {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff6b35;color:#fff;font:bold 14px sans-serif;padding:10px 16px;text-align:center';
    banner.innerHTML = '⚠️ If you get a verification email — copy the link and paste it in THIS browser\'s address bar (not your regular browser)';
    document.body.prepend(banner);
  }).catch(() => {});

  // Poll until we land on admin.shopify.com (up to 10 minutes)
  const deadline = Date.now() + 600000;
  let lastUrl = '';
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    let url = '';
    try { url = page.url(); } catch {}
    if (url.includes('admin.shopify.com')) break;
    if (url !== lastUrl) { console.log('Current URL:', url.substring(0, 100)); lastUrl = url; }
  }
  let finalUrl = '';
  try { finalUrl = page.url(); } catch {}
  if (!finalUrl.includes('admin.shopify.com')) throw new Error('Did not reach admin.shopify.com within 10 minutes.');
  console.log('Reached Shopify Admin:', finalUrl);

  // Save session to both locations
  await mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await mkdir(path.dirname(MIRROR_FILE),  { recursive: true });
  await context.storageState({ path: SESSION_FILE });
  await copyFile(SESSION_FILE, MIRROR_FILE);
  console.log('Session saved to:', SESSION_FILE);

  await browser.close();
})();
