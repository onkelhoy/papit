import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/codeblock/');
});

test.describe("@papit/codeblock", () => {

    test('available in DOM', async ({ page }) => {
        const component = page.locator('pap-codeblock');
        await expect(component).toHaveCount(1);
    });

    test.describe("color scheme", () => {
        test("defaults to ambient color scheme", async ({ page }) => {
            const component = page.locator('pap-codeblock');
            const scheme = await component.evaluate(el => getComputedStyle(el).colorScheme);
            // just check it's set to something valid, not that it's a specific value
            expect(["light", "dark"]).toContain(scheme);
        });

        test("switch toggles color scheme", async ({ page }) => {
            const component = page.locator('pap-codeblock');
            const sw = component.locator('pap-switch');

            const before = await component.evaluate((el: HTMLElement) => el.style.colorScheme);
            await sw.click();
            const after = await component.evaluate((el: HTMLElement) => el.style.colorScheme);

            expect(before).not.toBe(after);
        });

        test("switch toggles back on second click", async ({ page }) => {
            const component = page.locator('pap-codeblock');
            const sw = component.locator('pap-switch');

            const before = await component.evaluate((el: HTMLElement) => el.style.colorScheme);
            await sw.click();
            await sw.click();
            const after = await component.evaluate((el: HTMLElement) => el.style.colorScheme);

            expect(before).toBe(after);
        });
    });

    test.describe("copy", () => {
        test.beforeEach(async ({ page }) => {
            // mock clipboard so we don't need real permissions
            await page.evaluate(() => {
                let _text = "";
                Object.defineProperty(navigator, "clipboard", {
                    value: {
                        writeText: (text: string) => { _text = text; return Promise.resolve(); },
                        readText: () => Promise.resolve(_text),
                    },
                    configurable: true,
                });
            });
        });

        test("copy button adds .copied class", async ({ page }) => {
            const button = page.locator('pap-codeblock div[part="display"] button');
            await button.click();
            await expect(button).toHaveClass(/copied/);
        });

        test(".copied class is removed after 2s", async ({ page }) => {
            const button = page.locator('pap-codeblock div[part="display"] button');
            await button.click();
            await expect(button).toHaveClass(/copied/);
            await expect(button).not.toHaveClass(/copied/, { timeout: 3000 });
        });

        test("clipboard contains slot content", async ({ page }) => {
            const button = page.locator('pap-codeblock div[part="display"] button');
            await button.click();
            const text = await page.evaluate(() => navigator.clipboard.readText());
            expect(text.length).toBeGreaterThan(0);
        });
    });

    test.describe("code expand/collapse", () => {
        test("code is collapsed by default", async ({ page }) => {
            const details = page.locator('pap-codeblock details');
            await expect(details).not.toHaveAttribute('open');
        });

        test("clicking summary expands the code", async ({ page }) => {
            const summary = page.locator('pap-codeblock details summary');
            const details = page.locator('pap-codeblock details');
            await summary.click();
            await expect(details).toHaveAttribute('open', '');
        });

        test("clicking summary again collapses", async ({ page }) => {
            const summary = page.locator('pap-codeblock details summary');
            const details = page.locator('pap-codeblock details');
            await summary.click();
            await summary.click();
            await expect(details).not.toHaveAttribute('open');
        });
    });

    test.describe("slot content", () => {
        test("renders formatted content into code block", async ({ page }) => {
            const code = page.locator('pap-codeblock pre code');
            const text = await code.innerHTML();
            expect(text.trim().length).toBeGreaterThan(0);
        });

        test("content contains syntax spans", async ({ page }) => {
            const spans = page.locator('pap-codeblock pre code span');
            await expect(spans).not.toHaveCount(0);
        });
    });

    test.describe("color property", () => {
        for (const color of ["canvas", "background", "checker"] as const)
        {
            test(`accepts color="${color}"`, async ({ page }) => {
                await page.evaluate((c) => {
                    document.querySelector('pap-codeblock')?.setAttribute('color', c);
                }, color);
                const attr = await page.locator('pap-codeblock').getAttribute('color');
                expect(attr).toBe(color);
            });
        }
    });
});