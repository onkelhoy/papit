import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/language-picker/');
});

test.describe("@papit/language-picker", () => {
    test("lists every language with its name and switches on select", async ({ page }) => {
        const trigger = page.getByRole("button", { name: "Language: English" });
        await expect(trigger).toBeVisible();
        await trigger.click();

        const items = page.getByRole("menuitem");
        await expect(items).toHaveCount(3);
        await expect(items.nth(1)).toContainText("Swedish");

        await items.nth(1).click();
        await expect.poll(() => page.evaluate(async () => (await import("@papit/translator")).translator.current()?.id)).toBe("sv-SE");
        await expect(page.getByRole("button", { name: "Språk: svenska" })).toBeVisible();
    });

    test("languageRegion reads meta, then the id", async ({ page }) => {
        const regions = await page.evaluate(async () => {
            const { languageRegion } = await import("@papit/language-picker");
            return [
                languageRegion({ id: "x", meta: { language: "en", region: "gb" } }),
                languageRegion({ id: "fr-FR" }),
                languageRegion({ id: "de" }),
            ];
        });
        expect(regions).toEqual(["GB", "FR", undefined]);
    });
});
