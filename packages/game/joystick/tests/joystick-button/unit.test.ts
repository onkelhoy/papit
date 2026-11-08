import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('tests/joystick-button/');
});

test.describe("@papit/joystick-button", () => {
  test('press and release update pressed and fire events', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).EVENTS = [];
      const button = document.querySelector('pap-joystick-button')!;
      button.addEventListener('press', () => (window as any).EVENTS.push('press'));
      button.addEventListener('release', () => (window as any).EVENTS.push('release'));
    });
    const box = (await page.getByTestId('base-target').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.mouse.down();
    expect(await page.evaluate(() => document.querySelector<any>('pap-joystick-button').pressed)).toBe(true);
    await page.mouse.up();
    expect(await page.evaluate(() => document.querySelector<any>('pap-joystick-button').pressed)).toBe(false);
    expect(await page.evaluate(() => (window as any).EVENTS)).toEqual(['press', 'release']);
  });
});
