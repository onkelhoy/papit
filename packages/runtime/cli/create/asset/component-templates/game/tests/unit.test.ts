import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/VARIABLE_NAME/');
});

declare global {
  interface Window {
    EVENT_EMITTED: any;
  }
}

test.describe.skip("VARIABLE_FULL_NAME unit tests", () => {
  test('available in DOM', async ({ page }) => {
    // honestly dont know what to test 
  });
});