import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dots(page: Page, testid: string) {
    return page.getByTestId(testid).locator('[part="dot"]');
}

async function slide(page: Page, id: string): Promise<number> {
    return page.locator(`pap-carousel#${id}`).evaluate((el: any) => el.slide);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
    await page.goto("tests/carousel-dots/");
    await page.waitForFunction(() => (document.querySelector("#inside") as any)?.slidecount === 4);
});

// ===========================================================================
test.describe("rendering", () => {
    test("one dot per slide", async ({ page }) => {
        await expect(dots(page, "inside")).toHaveCount(4);
    });

    test("without a carousel it renders nothing", async ({ page }) => {
        await expect(dots(page, "alone")).toHaveCount(0);
        expect(await page.getByTestId("alone").evaluate((el) => el.shadowRoot?.childNodes.length)).toBe(0);
    });

    test("the dots follow the slide count", async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector("#inside pap-carousel-gallery")!.append(
                Object.assign(document.createElement("div"), { className: "slide", textContent: "5" }),
            );
        });

        await expect(dots(page, "inside")).toHaveCount(5);
    });

    test("each dot is labelled \"x of n\" in the current language", async ({ page }) => {
        await page.evaluate(() => (window as any).translator.change({
            id: "en",
            translations: { aria: { slide: "{index} of {size}" } },
        }));

        await expect(dots(page, "inside").nth(1)).toHaveAttribute("aria-label", "2 of 4");
    });
});

// ===========================================================================
test.describe("active dot", () => {
    test("the active dot is marked with aria-disabled", async ({ page }) => {
        await expect(dots(page, "inside").nth(0)).toHaveAttribute("aria-disabled", "true");
        await expect(dots(page, "inside").nth(1)).toHaveAttribute("aria-disabled", "false");
    });

    test("it follows the carousel's slide", async ({ page }) => {
        await page.locator("pap-carousel#inside").evaluate((el: any) => { el.slide = 2; });

        await expect(dots(page, "inside").nth(2)).toHaveAttribute("aria-disabled", "true");
        await expect(dots(page, "inside").nth(0)).toHaveAttribute("aria-disabled", "false");
    });
});

// ===========================================================================
test.describe("clicking", () => {
    test("a dot moves the carousel to its slide", async ({ page }) => {
        await dots(page, "inside").nth(3).click();
        await expect.poll(() => slide(page, "inside")).toBe(3);
    });

    test("dots outside the carousel find it through aria-controls", async ({ page }) => {
        await expect(dots(page, "remote")).toHaveCount(3);

        await dots(page, "remote").nth(2).click();
        await expect.poll(() => slide(page, "remote")).toBe(2);
    });
});

// ===========================================================================
test.describe("play button", () => {
    test("toggles the carousel's play, and its label follows", async ({ page }) => {
        await page.evaluate(() => (window as any).translator.change({
            id: "en",
            translations: { aria: { play: "Start slide rotation", pause: "Stop slide rotation" } },
        }));
        const play = page.getByTestId("auto").locator('[part="play"]');
        await expect(play).toHaveAttribute("aria-label", "Stop slide rotation");

        await play.click();
        await expect.poll(() => page.locator("pap-carousel#auto").evaluate((el: any) => el.play)).toBe(false);
        await expect(play).toHaveAttribute("aria-label", "Start slide rotation");

        await play.click();
        await expect.poll(() => page.locator("pap-carousel#auto").evaluate((el: any) => el.play)).toBe(true);
    });

    test("the dots know whether the carousel autoplays", async ({ page }) => {
        await expect(page.getByTestId("auto")).toHaveAttribute("autoplay", "true");
        await expect(page.getByTestId("inside")).toHaveAttribute("autoplay", "false");
    });
});
