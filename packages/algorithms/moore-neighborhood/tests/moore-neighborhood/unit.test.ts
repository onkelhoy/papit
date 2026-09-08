import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/moore-neighborhood/');
});

test.describe("@papit/moore-neighborhood unit tests", () => {
    test('available in DOM', async ({ page }) => {
        // Interact with your component and make assertions
        const component = await page.$('pap-moore-neighborhood');
        expect(component).not.toBeNull();
    });
});
