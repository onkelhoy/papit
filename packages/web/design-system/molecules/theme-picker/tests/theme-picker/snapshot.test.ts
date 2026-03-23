import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/theme-picker/');
});

test.describe("@papit/theme-picker visual regression", () => {
  test('default snapshot', async ({ page }) => {
    await expect(page).toHaveScreenshot();
  });
})
