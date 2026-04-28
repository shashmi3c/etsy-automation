import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();

const APP_URL = process.env.SHOPIFY_AUTH_START_URL || 'https://admin.shopify.com/store/etsy-new-tester/apps/etsy-dev-public/panel/overview';
const email = process.env.SHOPIFY_EMAIL || '';
const password = process.env.SHOPIFY_PASSWORD || '';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  console.log('1. Navigating to:', APP_URL);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);

  // Screenshot current state
  await page.screenshot({ path: 'debug-step1-initial.png', fullPage: true });
  console.log('Screenshot saved: debug-step1-initial.png');
  console.log('Current URL:', page.url());

  // Log all visible buttons
  const buttons = await page.getByRole('button').all();
  console.log('\nVisible buttons:');
  for (const btn of buttons) {
    const text = await btn.textContent().catch(() => '');
    const visible = await btn.isVisible().catch(() => false);
    if (visible) console.log('  -', text.trim());
  }

  // Log all visible input fields
  const inputs = await page.locator('input').all();
  console.log('\nVisible inputs:');
  for (const inp of inputs) {
    const type = await inp.getAttribute('type').catch(() => '');
    const name = await inp.getAttribute('name').catch(() => '');
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const visible = await inp.isVisible().catch(() => false);
    if (visible) console.log(`  - type="${type}" name="${name}" placeholder="${placeholder}"`);
  }

  // Try filling email
  console.log('\n2. Trying to fill email...');
  const emailInput = page.locator('input[type="email"], input[name="account[email]"], input[autocomplete="email"], #account_email').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(email);
    console.log('Email filled!');
    await page.screenshot({ path: 'debug-step2-email-filled.png', fullPage: true });

    // Find and click the submit/next button
    const allBtns = await page.getByRole('button').all();
    for (const btn of allBtns) {
      const visible = await btn.isVisible().catch(() => false);
      const text = (await btn.textContent().catch(() => '')).trim().toLowerCase();
      if (visible && (text.includes('continue') || text.includes('next') || text.includes('log in') || text.includes('sign in'))) {
        console.log('Clicking button:', text);
        await btn.click();
        break;
      }
    }

    await sleep(5000);
    await page.screenshot({ path: 'debug-step3-after-email-submit.png', fullPage: true });
    console.log('Screenshot saved: debug-step3-after-email-submit.png');
    console.log('Current URL:', page.url());

    // Check for password field
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible().catch(() => false)) {
      console.log('\n3. Password field visible! Filling...');
      await passwordInput.fill(password);

      const submitBtns = await page.getByRole('button').all();
      for (const btn of submitBtns) {
        const visible = await btn.isVisible().catch(() => false);
        const text = (await btn.textContent().catch(() => '')).trim().toLowerCase();
        if (visible && (text.includes('log in') || text.includes('sign in') || text.includes('submit') || text.includes('continue'))) {
          console.log('Clicking login button:', text);
          await btn.click();
          break;
        }
      }

      await sleep(8000);
      await page.screenshot({ path: 'debug-step4-after-login.png', fullPage: true });
      console.log('Screenshot saved: debug-step4-after-login.png');
      console.log('Current URL:', page.url());
    } else {
      console.log('No password field found after email submit');
      // Log all visible elements for debugging
      const newButtons = await page.getByRole('button').all();
      console.log('\nButtons after email submit:');
      for (const btn of newButtons) {
        const text = await btn.textContent().catch(() => '');
        const visible = await btn.isVisible().catch(() => false);
        if (visible) console.log('  -', text.trim());
      }
    }
  } else {
    console.log('Email input not found with standard selectors');
  }

  // Save auth state regardless
  const AUTH_FILE = path.join(__dirname, '..', 'playwright', '.auth', 'shopify.json');
  await context.storageState({ path: AUTH_FILE });
  console.log('\nSession saved to:', AUTH_FILE);

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });