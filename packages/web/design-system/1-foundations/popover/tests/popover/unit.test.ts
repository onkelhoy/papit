import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigate to your test page
  await page.goto('tests/popover/');
});

declare global {
  interface Window {
    EVENT_EMITTED: any;
  }
}

test.describe("@papit/popover unit tests", () => {
  test('available in DOM', async ({ page }) => {
    // Interact with your component and make assertions
    const component = await page.$('pap-popover');
    expect(component).not.toBeNull();
  });

  test("Escape hides the open popover", async ({ page }) => {
    const popover = page.getByTestId("escape-popover");
    await page.getByTestId("escape-trigger").click();
    await expect(popover).toBeVisible();

    await page.getByTestId("escape-inner").focus();
    await page.keyboard.press("Escape");

    await expect(popover).toBeHidden();
    expect(await popover.evaluate((el: any) => el.open)).toBe(false);
  });

  test("removes mouseleave listeners from trigger and popover on disconnect", async ({ page }) => {
    const leaked = await page.evaluate(() => {
      const trigger = document.createElement("button");
      trigger.setAttribute("popovertarget", "cleanup-popover");
      trigger.setAttribute("popovertargetaction", "hover");
      const popover = document.createElement("pap-popover");
      popover.id = "cleanup-popover";

      const active = new Map<EventTarget, Set<EventListenerOrEventListenerObject>>([
        [trigger, new Set()],
        [popover, new Set()],
      ]);
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type: string, listener: any, options?: any) {
        if (type === "mouseleave") active.get(this)?.add(listener);
        return add.call(this, type, listener, options);
      };
      EventTarget.prototype.removeEventListener = function (type: string, listener: any, options?: any) {
        if (type === "mouseleave") active.get(this)?.delete(listener);
        return remove.call(this, type, listener, options);
      };

      document.body.append(trigger, popover);
      popover.remove();

      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
      trigger.remove();

      return { trigger: active.get(trigger)!.size, popover: active.get(popover)!.size };
    });

    expect(leaked).toEqual({ trigger: 0, popover: 0 });
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