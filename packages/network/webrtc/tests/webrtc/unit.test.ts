import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/webrtc/');
});

declare global {
  interface Window {
    EVENT_EMITTED: any;
  }
}

test.describe("@papit/webrtc unit tests", () => {
  test('available in DOM', async ({ page }) => {
    // Interact with your component and make assertions
    const component = await page.$('pap-webrtc');
    expect(component).not.toBeNull();
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