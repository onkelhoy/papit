import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/codeblock/');
});

test.describe.skip("@papit/codeblock visual regression", () => {
    test('default snapshot', async ({ page }) => {
        await expect(page).toHaveScreenshot();
    });
})
