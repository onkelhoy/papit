import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/sat/');
});

declare global {
    interface Window {
        EVENT_EMITTED: any;
    }
}

test.describe.skip("@papit/game-intersection unit tests", () => {
    test('available in DOM', async ({ page }) => {
        // honestly dont know what to test 
    });
});