import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/switch/');
});

// helper: check :state(checked) via internals
const isChecked = (el: Element) => (el as any).checked;

test.describe("unit tests", () => {
    test("has role switch", async ({ page }) => {
        const target = page.getByTestId("a");
        await expect(target).toHaveRole("switch");
    });

    test("aria-checked reflects checked state", async ({ page }) => {
        const target = page.getByTestId("a");
        await expect(target).toHaveAttribute("aria-checked", "false");
        await target.click();
        await expect(target).toHaveAttribute("aria-checked", "true");
        await target.click();
        await expect(target).toHaveAttribute("aria-checked", "false");
    });

    test("clicking toggles checked property", async ({ page }) => {
        const target = page.getByTestId("a");
        expect(await target.evaluate(isChecked)).toBeFalsy();
        await target.click();
        expect(await target.evaluate(isChecked)).toBeTruthy();
        await target.click();
        expect(await target.evaluate(isChecked)).toBeFalsy();
    });

    test("clicking dispatches change event", async ({ page }) => {
        const target = page.getByTestId("a");
        const changed = target.evaluate(el =>
            new Promise(resolve => el.addEventListener("change", () => resolve(true), { once: true }))
        );
        await target.click();
        await expect(changed).resolves.toBe(true);
    });

    test("space key toggles checked", async ({ page }) => {
        const target = page.getByTestId("a");
        expect(await target.evaluate(isChecked)).toBeFalsy();
        await target.focus();
        await target.press(" ");
        expect(await target.evaluate(isChecked)).toBeTruthy();
    });

    test("enter key toggles checked", async ({ page }) => {
        const target = page.getByTestId("a");
        expect(await target.evaluate(isChecked)).toBeFalsy();
        await target.focus();
        await target.press("Enter");
        expect(await target.evaluate(isChecked)).toBeTruthy();
    });

    test("keydown adds active state, keyup removes it", async ({ page }) => {
        const target = page.getByTestId("a");
        await target.focus();

        await target.dispatchEvent("keydown", { key: "Enter" });
        expect(await target.evaluate(el => (el as any)._internals?.states?.has("active") ?? false)).toBe(true);

        await target.dispatchEvent("keyup", { key: "Enter" });
        expect(await target.evaluate(el => (el as any)._internals?.states?.has("active") ?? false)).toBe(false);
    });
});

test.describe("disabled tests", () => {
    test("disabled property is true", async ({ page }) => {
        const target = page.getByTestId("disabled");
        expect(await target.evaluate((el: any) => el.disabled)).toBe(true);
    });

    test("disabled click does not toggle", async ({ page }) => {
        const target = page.getByTestId("disabled");
        expect(await target.evaluate(isChecked)).toBeFalsy();
        await target.click({ force: true });
        expect(await target.evaluate(isChecked)).toBeFalsy();
    });

    test("disabled enter does not toggle", async ({ page }) => {
        const target = page.getByTestId("disabled");
        expect(await target.evaluate(isChecked)).toBeFalsy();
        await target.focus();
        await target.press("Enter");
        expect(await target.evaluate(isChecked)).toBeFalsy();
    });

    test("disabled keydown does not add active state", async ({ page }) => {
        const target = page.getByTestId("disabled");
        await target.focus();
        await target.dispatchEvent("keydown", { key: "Enter" });
        expect(await target.evaluate(el => (el as any)._internals?.states?.has("active") ?? false)).toBe(false);
    });
});

test.describe("readonly tests", () => {
    test("readonly click does not toggle", async ({ page }) => {
        const target = page.getByTestId("readonly");
        expect(await target.evaluate(isChecked)).toBeFalsy();
        await target.click();
        expect(await target.evaluate(isChecked)).toBeFalsy();
    });

    test("readonly enter does not toggle", async ({ page }) => {
        const target = page.getByTestId("readonly");
        await target.focus();
        await target.press("Enter");
        expect(await target.evaluate(isChecked)).toBeFalsy();
    });
});

test.describe("form tests", () => {
    test.beforeEach(async ({ page }) => {
        await page.waitForTimeout(500);
    });

    const getFormValues = (page: any) =>
        page.evaluate(() => {
            const form = document.querySelector("form");
            console.log('found form', !!form)
            if (!form) return null;
            const fd = new FormData(form);
            return {
                a: fd.get("a") || "false",
                b: fd.get("b") || "false",
                c: fd.get("c") || "false",
            };
        });

    test("initial submit reflects defaultchecked and checked", async ({ page }) => {
        await page.getByTestId("submit").click();
        const results = await getFormValues(page);
        expect(results).toMatchObject({ a: "false", b: "true", c: "true" });
    });

    test("submit reflects updated values after toggling", async ({ page }) => {
        await page.getByTestId("a").click();
        await page.getByTestId("b").click();
        await page.getByTestId("submit").click();
        const results = await getFormValues(page);
        expect(results).toMatchObject({ a: "true", b: "false", c: "true" });
    });

    test("reset restores defaultchecked values", async ({ page }) => {
        await page.getByTestId("a").click();
        await page.getByTestId("b").click();
        await page.getByTestId("reset").click();
        await page.getByTestId("submit").click();

        const results = await getFormValues(page);

        // a has no defaultchecked → resets to false
        // b has defaultchecked → resets to true
        // c has checked but no defaultchecked → resets to false
        expect(results).toMatchObject({ a: "false", b: "true", c: "true" });
    });
});