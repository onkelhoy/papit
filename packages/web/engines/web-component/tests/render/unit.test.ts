import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/render/');
    await page.evaluate(() => customElements.whenDefined("render-toggle"));
});

test.describe("render returning nothing", () => {
    test("null renders nothing, but firstRender still runs (styles get adopted)", async ({ page }) => {
        const toggle = page.getByTestId("toggle");

        await expect(toggle.locator("p")).toHaveCount(0);
        expect(await toggle.evaluate((el: any) => el.firstRenders)).toBe(1);
        expect(await toggle.evaluate((el) => el.shadowRoot!.adoptedStyleSheets.length)).toBe(1);
    });

    test("content appears once render returns a template", async ({ page }) => {
        const toggle = page.getByTestId("toggle");

        await toggle.evaluate((el: any) => { el.show = true; });

        await expect(toggle.locator("p")).toHaveText("hello");
        expect(await toggle.evaluate((el: any) => el.firstRenders)).toBe(1);
    });

    test("the same template keeps updating in place", async ({ page }) => {
        const toggle = page.getByTestId("toggle");

        await toggle.evaluate((el: any) => { el.show = true; });
        await expect(toggle.locator("p")).toHaveText("hello");
        await toggle.evaluate((el: any) => { el.before = el.text; });

        await toggle.evaluate((el: any) => { el.label = "world"; });
        await expect(toggle.locator("p")).toHaveText("world");

        // the paragraph was patched, not replaced
        expect(await toggle.evaluate((el: any) => el.text === el.before)).toBe(true);
    });

    test("returning null again removes the content and resets queries", async ({ page }) => {
        const toggle = page.getByTestId("toggle");

        await toggle.evaluate((el: any) => { el.show = true; });
        await expect(toggle.locator("p")).toHaveCount(1);

        await toggle.evaluate((el: any) => { el.show = false; });
        await expect(toggle.locator("p")).toHaveCount(0);
        expect(await toggle.evaluate((el: any) => el.text)).toBeNull();
    });

    test("content mounts fresh after being removed, firstRender still ran once", async ({ page }) => {
        const toggle = page.getByTestId("toggle");

        await toggle.evaluate((el: any) => { el.show = true; });
        await expect(toggle.locator("p")).toHaveCount(1);
        await toggle.evaluate((el: any) => { el.show = false; });
        await expect(toggle.locator("p")).toHaveCount(0);

        await toggle.evaluate((el: any) => { el.label = "again"; el.show = true; });
        await expect(toggle.locator("p")).toHaveText("again");
        await expect(toggle.locator("p")).toHaveCount(1);

        expect(await toggle.evaluate((el: any) => el.firstRenders)).toBe(1);
        expect(await toggle.evaluate((el: any) => el.text?.textContent)).toBe("again");
    });

    test("a created element that renders nothing can be appended", async ({ page }) => {
        const count = await page.evaluate(async () => {
            const el = document.createElement("render-toggle") as any;
            document.body.append(el);
            await new Promise(r => setTimeout(r, 100));
            return el.shadowRoot.childNodes.length;
        });

        expect(count).toBe(0);
    });
});

test.describe("switching templates", () => {
    test("a different template replaces the mounted one", async ({ page }) => {
        const swap = page.getByTestId("swap");
        await expect(swap.locator('[data-mode="a"]')).toHaveText("first");

        await swap.evaluate((el: any) => { el.mode = "b"; });

        await expect(swap.locator('[data-mode="b"]')).toHaveText("first");
        await expect(swap.locator('[data-mode="a"]')).toHaveCount(0);
    });

    test("the new template is live: values update and events fire", async ({ page }) => {
        const swap = page.getByTestId("swap");
        await swap.evaluate((el: any) => { el.mode = "b"; });
        await expect(swap.locator("button")).toHaveCount(1);

        await swap.evaluate((el: any) => { el.label = "second"; });
        await expect(swap.locator("button")).toHaveText("second");

        await swap.locator("button").click();
        expect(await swap.evaluate((el: any) => el.clicks)).toBe(1);
    });

    test("switching back mounts the first template again", async ({ page }) => {
        const swap = page.getByTestId("swap");
        await swap.evaluate((el: any) => { el.mode = "b"; });
        await expect(swap.locator("button")).toHaveCount(1);

        await swap.evaluate((el: any) => { el.mode = "a"; el.label = "back"; });

        await expect(swap.locator('[data-mode="a"]')).toHaveText("back");
        await expect(swap.locator("button")).toHaveCount(0);
    });
});

test.describe("light DOM", () => {
    test("removing the render keeps the author's children", async ({ page }) => {
        const light = page.getByTestId("light");
        await expect(light.locator("[data-rendered]")).toHaveCount(1);

        await light.evaluate((el: any) => { el.show = false; });

        await expect(light.locator("[data-rendered]")).toHaveCount(0);
        await expect(light.locator("[data-author]")).toHaveText("author");
    });

    test("rendering again adds it back next to the author's children", async ({ page }) => {
        const light = page.getByTestId("light");
        await light.evaluate((el: any) => { el.show = false; });
        await expect(light.locator("[data-rendered]")).toHaveCount(0);

        await light.evaluate((el: any) => { el.show = true; });

        await expect(light.locator("[data-rendered]")).toHaveCount(1);
        await expect(light.locator("[data-author]")).toHaveCount(1);
    });
});
