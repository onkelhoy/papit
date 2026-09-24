import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/theme-picker/');
});

declare global {
  interface Window {
    EVENT_EMITTED: any;
  }
}

test.describe("@papit/theme-picker unit tests", () => {
  test('available in DOM', async ({ page }) => {
    // Interact with your component and make assertions
    const component = await page.$('pap-theme-picker');
    expect(component).not.toBeNull();
  });

  test('icon button has an accessible name', async ({ page }) => {
    const button = page.getByTestId("base-target").getByRole("button", { name: /theme picker/i });
    await expect(button).toHaveCount(1);
  });

  test('tooltip opens when the button is focused and closes on blur', async ({ page }) => {
    const button = page.getByTestId("base-target").getByRole("button", { name: /theme picker/i });
    const tooltip = page.getByTestId("base-target").locator("pap-tooltip");

    await button.focus();
    await expect.poll(() => tooltip.evaluate((el: any) => el.open), { timeout: 3000 }).toBe(true);

    await button.blur();
    await expect.poll(() => tooltip.evaluate((el: any) => el.open)).toBe(false);
  });
});

test.describe.skip("helpers", () => {
  test("wait for event : enter press", async ({ page }) => {
    const target = page.getByTestId("base-target");
    await page.evaluate(() => {
      window.EVENT_EMITTED = null;
      const target = document.querySelector<HTMLElement>("*[data-testid='base-target']");
      if (!target) return;

      target.addEventListener("event-name", () => {
        window.EVENT_EMITTED = true;
      });

      target.focus();
      target.dispatchEvent(new KeyboardEvent("up", { key: "Enter" }));
      // enter is tricky to capture so we make sure to dispatch inside evalute
    });

    await target.focus();
    await target.press("Enter");

    expect(await page.evaluate(() => window.EVENT_EMITTED)).toBeTruthy();
  });

  test("should submit a form", async ({ page }) => {
    // NOTE this requires in main.js you have form.onsubmit = (e) => { e.preventDefault() }
    // setting this in evaluate did not work.. (maybe with page.evalute)

    await page.getByTestId("a").fill("hello");
    await page.getByTestId("submit").click();

    const results = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) return null;

      const formdata = new FormData(form);
      return {
        a: formdata.get("a"),
        b: formdata.get("b"),
      }
    });

    expect(results).not.toBe(null);
    expect(results).toMatchObject({
      a: "hello",
      b: "value",
    });
  });
});