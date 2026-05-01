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
    test('available in DOM', async ({ page }) => {
        // Interact with your component and make assertions
        const component = await page.$('pap-button');
        expect(component).not.toBeNull();

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