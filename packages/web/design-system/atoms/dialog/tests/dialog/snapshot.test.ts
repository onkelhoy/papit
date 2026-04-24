import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/dialog/');
});

test.describe("@papit/dialog visual regression", () => {
  test('default snapshot', async ({ page }) => {
    await expect(page).toHaveScreenshot();
  });
})
