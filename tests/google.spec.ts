import { test, expect } from '@playwright/test';

test('opens Google and verifies the title', async ({ page }) => {
  await page.goto('https://www.google.com/');

  await expect(page).toHaveTitle(/Google/);
});
