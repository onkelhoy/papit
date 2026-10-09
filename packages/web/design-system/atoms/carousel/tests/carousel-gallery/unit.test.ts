import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gallery(page: Page, id: string) {
    return page.locator(`pap-carousel-gallery#${id}`);
}

async function slide(page: Page, id: string): Promise<number> {
    return gallery(page, id).evaluate((el: any) => el.slide);
}

async function clones(page: Page, id: string) {
    return page.evaluate((id) => Array.from(document.querySelectorAll(`#${id} > .clone`)).map((clone: any) => ({
        slot: clone.slot,
        index: clone.getAttribute("data-slide"),
        hidden: clone.getAttribute("aria-hidden"),
        role: clone.getAttribute("role"),
        inert: clone.inert,
        id: clone.id,
        tabindex: clone.getAttribute("tabindex"),
    })), id);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
    await page.goto("tests/carousel-gallery/");
    await page.waitForFunction(() => (document.querySelector("#loop") as any)?.slides?.length === 3);
});

// ===========================================================================
test.describe("ARIA", () => {
    test("on its own, the gallery is the carousel region", async ({ page }) => {
        await expect(gallery(page, "loop")).toHaveAttribute("role", "region");
        await expect(gallery(page, "loop")).toHaveAttribute("aria-roledescription", "carousel");
    });

    test("children become slides: group, slide roledescription, focusable, indexed", async ({ page }) => {
        const slides = page.locator('#noloop > [slot="slide"]');
        await expect(slides).toHaveCount(3);

        for (let i = 0; i < 3; i++)
        {
            await expect(slides.nth(i)).toHaveAttribute("role", "group");
            await expect(slides.nth(i)).toHaveAttribute("aria-roledescription", "slide");
            await expect(slides.nth(i)).toHaveAttribute("tabindex", "0");
            await expect(slides.nth(i)).toHaveAttribute("data-slide", String(i));
        }
    });

    test("slides are labelled \"x of n\" in the current language", async ({ page }) => {
        await page.evaluate(() => (window as any).translator.change({
            id: "en",
            translations: { aria: { slide: "{index} of {size}" } },
        }));

        await expect(page.locator('#noloop > [slot="slide"]').nth(1)).toHaveAttribute("aria-label", "2 of 3");
    });

    test("an author label is kept", async ({ page }) => {
        await page.evaluate(() => (window as any).translator.change({
            id: "en",
            translations: { aria: { slide: "{index} of {size}" } },
        }));

        await expect(page.locator("#first-slide")).toHaveAttribute("aria-label", "Mine");
    });
});

// ===========================================================================
test.describe("clones (loop)", () => {
    test("each end gets clonecount copies, at most one per slide", async ({ page }) => {
        // three slides, clonecount 3: three copies before, three after
        const loop = await clones(page, "loop");
        expect(loop.filter(c => c.slot === "clone-prev").map(c => c.index)).toEqual(["0", "1", "2"]);
        expect(loop.filter(c => c.slot === "clone-next").map(c => c.index)).toEqual(["0", "1", "2"]);

        // four slides, clonecount 1: the last before the first, the first after the last
        const one = await clones(page, "onecopy");
        expect(one.map(c => [c.slot, c.index])).toEqual([["clone-prev", "3"], ["clone-next", "0"]]);
    });

    test("copies are hidden from assistive tech and can't take focus", async ({ page }) => {
        for (const clone of await clones(page, "loop"))
        {
            expect(clone.hidden).toBe("true");
            expect(clone.role).toBe("presentation");
            expect(clone.inert).toBe(true);
            expect(clone.tabindex).toBeNull();
        }
    });

    test("copies never repeat the slide's id", async ({ page }) => {
        for (const clone of await clones(page, "loop")) expect(clone.id).toBe("");
        await expect(page.locator("#first-slide")).toHaveCount(1);
    });

    test("no copies without loop, or with a single slide", async ({ page }) => {
        expect(await clones(page, "noloop")).toHaveLength(0);
        expect(await clones(page, "single")).toHaveLength(0);
    });

    test("switching loop off and on removes and rebuilds the copies", async ({ page }) => {
        await gallery(page, "loop").evaluate((el: any) => { el.loop = false; });
        expect(await clones(page, "loop")).toHaveLength(0);

        await gallery(page, "loop").evaluate((el: any) => { el.loop = true; });
        expect(await clones(page, "loop")).toHaveLength(6);
    });
});

// ===========================================================================
test.describe("slide", () => {
    test("with loop, any number wraps into range", async ({ page }) => {
        await gallery(page, "loop").evaluate((el: any) => { el.slide = 7; });
        await expect.poll(() => slide(page, "loop")).toBe(1);

        await gallery(page, "loop").evaluate((el: any) => { el.slide = -1; });
        await expect.poll(() => slide(page, "loop")).toBe(2);
    });

    test("without loop, it is clamped", async ({ page }) => {
        await gallery(page, "noloop").evaluate((el: any) => { el.slide = 7; });
        await expect.poll(() => slide(page, "noloop")).toBe(2);

        await gallery(page, "noloop").evaluate((el: any) => { el.slide = -3; });
        await expect.poll(() => slide(page, "noloop")).toBe(0);
    });

    test("with one slide per view, every slide is a position", async ({ page }) => {
        expect(await gallery(page, "noloop").evaluate((el: any) => el.stopcount)).toBe(3);
        expect(await gallery(page, "loop").evaluate((el: any) => el.stopcount)).toBe(3);
    });

    test("change fires once per real change, not on mount", async ({ page }) => {
        const changes = await gallery(page, "noloop").evaluate(async (el: any) => {
            let changes = 0;
            el.addEventListener("change", () => changes++);
            await new Promise(r => setTimeout(r, 100));
            const before = changes;
            el.slide = 1;
            el.slide = 1;  // same value, no change
            el.slide = 9;  // clamped to 2
            return { before, after: changes, slide: el.slide };
        });

        expect(changes).toEqual({ before: 0, after: 2, slide: 2 });
    });
});

// ===========================================================================
test.describe("dynamic slides", () => {
    test("replacing the slides rebuilds the list and indexes", async ({ page }) => {
        const result = await gallery(page, "noloop").evaluate(async (el: any) => {
            el.querySelectorAll(':scope > [slot="slide"]').forEach((s: Element) => s.remove());
            el.append(Object.assign(document.createElement("div"), { textContent: "X" }));
            el.append(Object.assign(document.createElement("div"), { textContent: "Y" }));
            await new Promise(r => setTimeout(r, 100));
            return {
                slides: el.slides.map((s: HTMLElement) => s.textContent),
                indexes: el.slides.map((s: HTMLElement) => s.getAttribute("data-slide")),
            };
        });

        expect(result).toEqual({ slides: ["X", "Y"], indexes: ["0", "1"] });
    });

    test("removing slides pulls the active slide back into range", async ({ page }) => {
        await gallery(page, "noloop").evaluate((el: any) => { el.slide = 2; });
        await expect.poll(() => slide(page, "noloop")).toBe(2);

        await page.evaluate(() => document.querySelector('#noloop > [slot="slide"]:last-of-type')!.remove());

        await expect.poll(() => slide(page, "noloop")).toBe(1);
    });

    test("carousel controls placed inside stay controls, not slides", async ({ page }) => {
        const slot = await gallery(page, "noloop").evaluate(async (el: any) => {
            const dots = document.createElement("pap-carousel-dots");
            el.append(dots);
            await new Promise(r => setTimeout(r, 100));
            return { slot: dots.slot, slides: el.slides.length };
        });

        expect(slot).toEqual({ slot: "", slides: 3 });
    });
});
