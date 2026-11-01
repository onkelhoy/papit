import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/2d-spritesheet/');
});

declare global {
  interface Window {
    EVENT_EMITTED: any;
  }
}

test.describe.skip("@papit/2d-spritesheet unit tests", () => {
  test('available in DOM', async ({ page }) => {
    // honestly dont know what to test 
  });
});