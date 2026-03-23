import { test, expect } from '@playwright/test';
import { translator } from "@papit/translator";

test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message))
    await page.goto('tests/translator/');
    await page.waitForFunction(() => typeof window.translator !== 'undefined');
});

declare global {
    interface Window {
        translator: typeof translator
    }
}

test.describe("translator unit tests", () => {
    test("current translation", async ({ page }) => {
        const current = await page.evaluate(() => window.translator.current());
        expect(current).not.toBeUndefined();
        expect(current).toMatchObject({
            id: "first",
            meta: { region: "GB", language: "en-UK" },
            translations: { hello: "world", "variable {name}": "{name} poop" }
        });
    });

    test("translate sentence", async ({ page }) => {
        const text = await page.getByTestId("hello").textContent();
        expect(text).toBe("world");
    });

    test("translate sentence with fallback", async ({ page }) => {
        const text = await page.getByTestId("none").textContent();
        expect(text).toBe("i dont have translation");
    });

    test("translate sentence with variables", async ({ page }) => {
        const text = await page.getByTestId("variable").textContent();
        expect(text).toBe("henry poop");
    });
});

test.describe("switching languages", () => {
    test("changes current", async ({ page }) => {
        await page.evaluate(() => window.translator.change('second'));
        const current = await page.evaluate(() => window.translator.current());
        expect(current).toMatchObject({ id: 'second' });
    });

    test("subscribe fires on change", async ({ page }) => {
        const fired = await page.evaluate(async () => {
            const prom = new Promise<void>(res => window.translator.subscribe(() => res()));
            window.translator.change('second');
            await prom;
            return true;
        });
        expect(fired).toBe(true);
    });
});

test.describe("loading translations", () => {
    test("loading by url", async ({ page }) => {
        await page.evaluate(async () => {
            const prom = new Promise<void>(res => window.translator.subscribe(() => res()));
            window.translator.change('custom');
            await prom;
        });
        const current = await page.evaluate(() => window.translator.current());

        expect(current).toMatchObject({ id: 'custom' });
        expect(current!.translations).not.toBeUndefined();
    });
});