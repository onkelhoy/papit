import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/button/');
    await page.waitForTimeout(500);
});

declare global {
    interface Window {
        EVENT_EMITTED: any;
    }
}

test.describe("button unit tests", () => {
    test("has role button and is focusable", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await expect(target).toHaveRole("button");
        await expect(target).toHaveAttribute("tabindex", "0");
        await target.focus();
        await expect(target).toBeFocused();
    });

    test("reflects its defaults to attributes", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await expect(target).toHaveAttribute("variant", "filled");
        await expect(target).toHaveAttribute("size", "medium");
        await expect(target).toHaveAttribute("color", "primary");
    });

    test("document.createElement returns an upgraded button with no attributes", async ({ page }) => {
        const result = await page.evaluate(() => {
            const el = document.createElement("pap-button");
            const created = {
                upgraded: el instanceof customElements.get("pap-button")!,
                attributes: Array.from(el.attributes).map(a => a.name),
            };
            el.setAttribute("data-testid", "created");
            document.body.append(el);
            return created;
        });

        expect(result.upgraded).toBe(true);
        expect(result.attributes).toEqual([]);
        const created = page.getByTestId("created");
        await expect(created).toHaveRole("button");
        await expect(created).toHaveAttribute("variant", "filled");
    });

    test("clicking should result click event", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await page.evaluate(() => {
            window.EVENT_EMITTED = null;
            const button = document.querySelector<HTMLButtonElement>("pap-button[data-testid='base-target']");
            if (!button) return;

            button.addEventListener("click", () => {
                window.EVENT_EMITTED = true;
            });
        });

        await target.click();

        const result = await page.evaluate(() => {
            return window.EVENT_EMITTED;
        });

        expect(result).toBeTruthy();
    });

    test.skip("clicking should not result in click event when disabled", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await page.evaluate(() => {
            window.EVENT_EMITTED = null;
            const button = document.querySelector<HTMLButtonElement>("pap-button[data-testid='base-target']");
            if (!button) return;

            button.setAttribute("disabled", "true");
            button.addEventListener("click", () => {
                window.EVENT_EMITTED = true;
            });
        });

        await target.click();

        const result = await page.evaluate(() => {
            return window.EVENT_EMITTED;
        });

        expect(result).toBeNull();
    });

    test.skip("enter keypress should result click event", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await page.evaluate(() => {
            window.EVENT_EMITTED = null;
            const button = document.querySelector<HTMLButtonElement>("pap-button[data-testid='base-target']");
            if (!button) return;

            button.addEventListener("click", () => {
                window.EVENT_EMITTED = true;
            });

            button.focus();
            button.dispatchEvent(new KeyboardEvent("up", { key: "Enter" }));
        });

        await target.focus();
        await target.press("Enter");

        const result = await page.evaluate(() => {
            return window.EVENT_EMITTED;
        });

        expect(result).toBeTruthy();
    });
});

test.describe("button form", () => {
    test("should submit a form", async ({ page }) => {
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

    test.skip("should reset a form", async ({ page }) => {
        await page.getByTestId("a").fill("hello");
        await page.getByTestId("reset").click();
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
            a: "value",
            b: "value",
        });
    });
})
test.describe("button keyboard", () => {
    // counts clicks and records whether keydown/keyup reached the window with default prevented
    async function track(page: any, testid: string) {
        await page.evaluate((id: string) => {
            const w = window as any;
            w.CLICKS = 0;
            w.PREVENTED = {} as Record<string, boolean>;
            document.querySelector(`[data-testid="${id}"]`)!.addEventListener("click", () => w.CLICKS++);
            for (const type of ["keydown", "keyup"])
            {
                window.addEventListener(type, (e: any) => { w.PREVENTED[`${type}:${e.key}`] = e.defaultPrevented; });
            }
        }, testid);
    }

    const clicks = (page: any) => page.evaluate(() => (window as any).CLICKS);
    // read the state from ElementInternals (as the switch tests do); polling matches(":state()") makes webkit drop the following click()
    const isActive = (el: any) => el._internals.states.has("active") as boolean;
    // webkit can resolve keyboard actions before the key events are dispatched, so poll
    const activeOf = (target: any) => expect.poll(() => target.evaluate(isActive));
    const clicksOf = (page: any) => expect.poll(() => clicks(page));

    test("Space keydown prevents scrolling and sets active, keyup clicks", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await track(page, "base-target");
        await target.focus();

        await page.keyboard.down(" ");
        await activeOf(target).toBe(true);
        expect(await page.evaluate(() => (window as any).PREVENTED["keydown: "])).toBe(true);
        expect(await clicks(page)).toBe(0);

        await page.keyboard.up(" ");
        await activeOf(target).toBe(false);
        await clicksOf(page).toBe(1);
    });

    test("Enter activates the button once", async ({ page }) => {
        const target = page.getByTestId("base-target");
        await track(page, "base-target");
        await target.focus();

        await page.keyboard.down("Enter");
        await activeOf(target).toBe(true);
        await page.keyboard.up("Enter");
        await activeOf(target).toBe(false);
        await clicksOf(page).toBe(1);
    });

    test("Space on a submit button submits the form", async ({ page }) => {
        await page.getByTestId("submit").focus();
        await page.keyboard.press(" ");
        await expect.poll(() => page.evaluate(() => (window as any).SUBMITTED)).toBe(1);
    });

    for (const testid of ["disabled", "readonly"])
    {
        test(`${testid} button is not activated by Space or Enter`, async ({ page }) => {
            const target = page.getByTestId(testid);
            await track(page, testid);
            await target.focus();

            await page.keyboard.down(" ");
            expect(await target.evaluate(isActive)).toBe(false);
            await page.keyboard.up(" ");
            await page.keyboard.press("Enter");
            expect(await clicks(page)).toBe(0);
        });

        test(`${testid} button does not fire click`, async ({ page }) => {
            const target = page.getByTestId(testid);
            await track(page, testid);
            await target.click({ force: true });
            expect(await clicks(page)).toBe(0);
        });
    }
});
