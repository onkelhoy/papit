import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/create-element/');
    await page.evaluate(() => customElements.whenDefined("create-fixture"));
});

test.describe("client-side creation", () => {
    test("document.createElement returns an upgraded instance with no attributes", async ({ page }) => {
        const result = await page.evaluate(() => {
            const el = document.createElement("create-fixture") as any;
            return {
                upgraded: el instanceof customElements.get("create-fixture")!,
                attributes: Array.from(el.attributes as NamedNodeMap).map(a => a.name),
                variant: el.variant,
                size: el.size,
                pressed: el.pressed,
            };
        });

        expect(result.upgraded).toBe(true);
        expect(result.attributes).toEqual([]);
        expect(result.variant).toBe("filled");
        expect(result.size).toBe(3);
        expect(result.pressed).toBe(false);
    });

    test("new Ctor() has no attributes before connect", async ({ page }) => {
        const attributes = await page.evaluate(() => {
            const Ctor = customElements.get("create-fixture")!;
            const el = new Ctor();
            return Array.from(el.attributes).map(a => a.name);
        });
        expect(attributes).toEqual([]);
    });

    test("defaults are reflected to attributes and aria after connect", async ({ page }) => {
        await page.evaluate(() => {
            const el = document.createElement("create-fixture");
            el.setAttribute("data-testid", "created");
            document.querySelector('[data-testid="mount"]')!.append(el);
        });

        const el = page.getByTestId("created");
        await expect(el).toHaveAttribute("variant", "filled");
        await expect(el).toHaveAttribute("size", "3");
        await expect(el).toHaveAttribute("pressed", "false");
        await expect(el).toHaveAttribute("aria-pressed", "false");
        await expect(el).not.toHaveAttribute("flag");
        await expect(el).toHaveJSProperty("variant", "filled");
    });

    test("attribute set before connect is not overwritten by the default", async ({ page }) => {
        await page.evaluate(() => {
            const el = document.createElement("create-fixture");
            el.setAttribute("data-testid", "created");
            el.setAttribute("variant", "clear");
            document.querySelector('[data-testid="mount"]')!.append(el);
        });

        const el = page.getByTestId("created");
        await expect(el).toHaveAttribute("variant", "clear");
        await expect(el).toHaveJSProperty("variant", "clear");
        await expect(el).toHaveAttribute("size", "3");
    });

    test("property set before connect wins over an earlier attribute", async ({ page }) => {
        await page.evaluate(() => {
            const el = document.createElement("create-fixture") as any;
            el.setAttribute("data-testid", "created");
            el.setAttribute("variant", "clear");
            el.variant = "outline";
            el.flag = true;
            document.querySelector('[data-testid="mount"]')!.append(el);
        });

        const el = page.getByTestId("created");
        await expect(el).toHaveAttribute("variant", "outline");
        await expect(el).toHaveJSProperty("variant", "outline");
        await expect(el).toHaveAttribute("flag", "true");
    });

    test("parsed markup reflects defaults", async ({ page }) => {
        const el = page.getByTestId("parsed");
        await expect(el).toHaveAttribute("variant", "filled");
        await expect(el).toHaveAttribute("size", "3");
        await expect(el).toHaveAttribute("aria-pressed", "false");
    });

    test("parsed markup attributes are not overwritten by defaults", async ({ page }) => {
        const el = page.getByTestId("parsed-attribute");
        await expect(el).toHaveAttribute("variant", "outline");
        await expect(el).toHaveJSProperty("variant", "outline");
        await expect(el).toHaveAttribute("pressed", "true");
        await expect(el).toHaveJSProperty("pressed", true);
        await expect(el).toHaveAttribute("size", "3");
    });

    test("innerHTML creation keeps given attributes and reflects the rest", async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector('[data-testid="mount"]')!.innerHTML =
                `<create-fixture data-testid="created" variant="text"></create-fixture>`;
        });

        const el = page.getByTestId("created");
        await expect(el).toHaveAttribute("variant", "text");
        await expect(el).toHaveJSProperty("variant", "text");
        await expect(el).toHaveAttribute("size", "3");
    });

    test("context resolves and applies its attribute only after connect", async ({ page }) => {
        const before = await page.evaluate(() => {
            const el = document.createElement("create-fixture");
            el.setAttribute("data-testid", "created");
            const attributes = Array.from(el.attributes).map(a => a.name);
            document.querySelector('[data-testid="provider"]')!.append(el);
            return attributes;
        });

        expect(before).toEqual(["data-testid"]);
        const el = page.getByTestId("created");
        await expect(el).toHaveJSProperty("hello", "from-provider");
        await expect(el).toHaveAttribute("hello", "from-provider");
    });
});
