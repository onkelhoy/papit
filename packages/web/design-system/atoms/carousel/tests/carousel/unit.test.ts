import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function carousel(page: Page, id: string) {
    return page.locator(`pap-carousel#${id}`);
}

async function slide(page: Page, id: string): Promise<number> {
    return carousel(page, id).evaluate((el: any) => el.slide);
}

/** Resolves once the carousel's gallery has stopped scrolling. */
async function waitForScrollIdle(page: Page, id: string) {
    await page.evaluate((id) => new Promise<void>(resolve => {
        const track = (document.querySelector(`#${id} pap-carousel-gallery`) as any).carousel as HTMLElement;
        let last = track.scrollLeft;
        let stable = 0;
        const check = () => {
            if (track.scrollLeft === last) stable++;
            else { stable = 0; last = track.scrollLeft; }
            if (stable >= 10) resolve();
            else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
    }), id);
    // let the gallery's own scrollend handling run
    await page.waitForTimeout(150);
}

/** Distance from the scroll container's edge to the start of a real slide. */
async function slideOffset(page: Page, id: string, index: number): Promise<number> {
    return page.evaluate(([id, index]) => {
        const gallery = document.querySelector(`#${id} pap-carousel-gallery`) as any;
        const slide = gallery.querySelectorAll(':scope > [slot="slide"]')[index] as HTMLElement;
        return slide.getBoundingClientRect().left - gallery.carousel.getBoundingClientRect().left;
    }, [id, index] as const);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
    await page.goto("tests/carousel/");
    // the gallery reports its slides to the carousel once both are up
    await page.waitForFunction(() => (document.querySelector("#basic") as any)?.slidecount === 3);
});

// ===========================================================================
test.describe("ARIA", () => {
    test("the carousel is a region with the carousel roledescription", async ({ page }) => {
        const basic = carousel(page, "basic");
        await expect(basic).toHaveAttribute("role", "region");
        await expect(basic).toHaveAttribute("aria-roledescription", "carousel");
    });

    test("a gallery inside a carousel leaves the region role to the carousel", async ({ page }) => {
        const gallery = page.locator("#basic pap-carousel-gallery");
        await expect(gallery).not.toHaveAttribute("role", "region");
    });

    test("the gallery's live region is polite, and off while autoplaying", async ({ page }) => {
        const live = (id: string) => page.evaluate((id) =>
            (document.querySelector(`#${id} pap-carousel-gallery`) as any).carousel.getAttribute("aria-live"), id);

        await expect.poll(() => live("basic")).toBe("polite");
        await expect.poll(() => live("auto")).toBe("off");
    });
});

// ===========================================================================
test.describe("navigation", () => {
    test("slidecount comes from the gallery", async ({ page }) => {
        expect(await carousel(page, "basic").evaluate((el: any) => el.slidecount)).toBe(3);
    });

    test("next() and prev() step the slide, and the gallery follows", async ({ page }) => {
        await carousel(page, "basic").evaluate((el: any) => el.next());
        await expect.poll(() => slide(page, "basic")).toBe(1);
        await expect.poll(() => page.locator("#basic pap-carousel-gallery").evaluate((el: any) => el.slide)).toBe(1);

        await carousel(page, "basic").evaluate((el: any) => el.prev());
        await expect.poll(() => slide(page, "basic")).toBe(0);
    });

    test("setting slide scrolls the gallery to it", async ({ page }) => {
        await carousel(page, "basic").evaluate((el: any) => { el.slide = 2; });
        await waitForScrollIdle(page, "basic");
        expect(Math.abs(await slideOffset(page, "basic", 2))).toBeLessThan(2);
    });

    test("with loop, next() from the last slide wraps to the first", async ({ page }) => {
        await carousel(page, "basic").evaluate((el: any) => { el.slide = 2; });
        await waitForScrollIdle(page, "basic");

        await carousel(page, "basic").evaluate((el: any) => el.next());
        await waitForScrollIdle(page, "basic");

        expect(await slide(page, "basic")).toBe(0);
        // landed on the real first slide, not its copy
        expect(Math.abs(await slideOffset(page, "basic", 0))).toBeLessThan(2);
    });

    test("with loop, prev() from the first slide wraps to the last", async ({ page }) => {
        await carousel(page, "basic").evaluate((el: any) => el.prev());
        await waitForScrollIdle(page, "basic");

        expect(await slide(page, "basic")).toBe(2);
        expect(Math.abs(await slideOffset(page, "basic", 2))).toBeLessThan(2);
    });

    test("without loop, it stops at both ends", async ({ page }) => {
        await carousel(page, "noloop").evaluate((el: any) => el.prev());
        await expect.poll(() => slide(page, "noloop")).toBe(0);

        await carousel(page, "noloop").evaluate((el: any) => { el.slide = 2; });
        // wait until it has actually arrived, a smooth scroll can start late under load
        await expect.poll(async () => Math.abs(await slideOffset(page, "noloop", 2))).toBeLessThan(2);
        await waitForScrollIdle(page, "noloop");
        expect(await slide(page, "noloop")).toBe(2);

        await carousel(page, "noloop").evaluate((el: any) => el.next());
        await expect.poll(() => slide(page, "noloop")).toBe(2);
    });

    test("loop on the carousel reaches the gallery", async ({ page }) => {
        const clones = await page.evaluate(() =>
            document.querySelectorAll("#noloop pap-carousel-gallery > .clone").length);
        expect(clones).toBe(0);
    });

    test("change fires when the slide changes, not on mount", async ({ page }) => {
        const changes = await carousel(page, "basic").evaluate(async (el: any) => {
            let changes = 0;
            el.addEventListener("change", () => changes++);
            await new Promise(r => setTimeout(r, 100));
            const before = changes;
            el.next();
            await new Promise(r => setTimeout(r, 100));
            return { before, after: changes };
        });

        expect(changes.before).toBe(0);
        expect(changes.after).toBe(1);
    });

    test("user scrolling updates the carousel's slide", async ({ page }) => {
        await page.evaluate(() => {
            const gallery = document.querySelector("#noloop pap-carousel-gallery") as any;
            const target = gallery.querySelectorAll(':scope > [slot="slide"]')[1] as HTMLElement;
            gallery.carousel.scrollLeft += target.getBoundingClientRect().left - gallery.carousel.getBoundingClientRect().left;
        });
        await waitForScrollIdle(page, "noloop");

        expect(await slide(page, "noloop")).toBe(1);
    });
});

// ===========================================================================
test.describe("controls", () => {
    test("the prev / next buttons inside the carousel drive it", async ({ page }) => {
        await page.getByTestId("basic-next").click();
        await expect.poll(() => slide(page, "basic")).toBe(1);

        await page.getByTestId("basic-prev").click();
        await expect.poll(() => slide(page, "basic")).toBe(0);
    });

    test("controls outside the carousel find it through aria-controls", async ({ page }) => {
        await page.getByTestId("outside-next").click();
        await expect.poll(() => slide(page, "outside")).toBe(1);

        await page.getByTestId("outside-prev").click();
        await expect.poll(() => slide(page, "outside")).toBe(0);
    });

    test("any element can drive it through the API", async ({ page }) => {
        await page.getByTestId("custom-next").click();
        await expect.poll(() => slide(page, "custom")).toBe(1);

        await page.getByTestId("custom-first").click();
        await expect.poll(() => slide(page, "custom")).toBe(0);
    });

    test("the buttons are labelled in the current language", async ({ page }) => {
        await page.evaluate(() => (window as any).translator.change({
            id: "en",
            translations: { aria: { prev: "previous slide", next: "next slide" } },
        }));

        await expect(page.getByTestId("basic-prev")).toHaveAttribute("aria-label", "previous slide");
        await expect(page.getByTestId("basic-next")).toHaveAttribute("aria-label", "next slide");
    });
});

// ===========================================================================
test.describe("autoplay", () => {
    test("advances after the duration", async ({ page }) => {
        await expect.poll(() => slide(page, "auto"), { timeout: 3000 }).toBeGreaterThan(0);
    });

    test("play = false stops it", async ({ page }) => {
        await carousel(page, "auto").evaluate((el: any) => { el.play = false; });
        const before = await slide(page, "auto");

        await page.waitForTimeout(1000);
        expect(await slide(page, "auto")).toBe(before);
    });

    test("pauses while the pointer is over the carousel", async ({ page }) => {
        await carousel(page, "auto").hover();
        const before = await slide(page, "auto");

        await page.waitForTimeout(1000);
        expect(await slide(page, "auto")).toBe(before);

        await page.mouse.move(0, 0);
        await expect.poll(() => slide(page, "auto"), { timeout: 3000 }).not.toBe(before);
    });
});

// ===========================================================================
test.describe("client-side creation", () => {
    test("document.createElement works and starts with no attributes", async ({ page }) => {
        const attributes = await page.evaluate(() =>
            Array.from(document.createElement("pap-carousel").attributes).map(a => a.name));
        expect(attributes).toEqual([]);
    });

    test("a carousel built in script connects to its gallery", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const el = document.createElement("pap-carousel") as any;
            const gallery = document.createElement("pap-carousel-gallery");
            gallery.innerHTML = '<div class="slide">1</div><div class="slide">2</div>';
            el.append(gallery);
            document.body.append(el);
            await new Promise(r => setTimeout(r, 150));
            el.next();
            await new Promise(r => setTimeout(r, 100));
            return { count: el.slidecount, slide: (gallery as any).slide };
        });

        expect(result).toEqual({ count: 2, slide: 1 });
    });
});

// ===========================================================================
test.describe("several per view (align start)", () => {
    // 8 slides at 30% of the column: the last three share the end of the track,
    // so there are 6 positions to scroll to
    async function atEnd(page: Page) {
        return page.evaluate(() => {
            const track = (document.querySelector("#bleed pap-carousel-gallery") as any).carousel as HTMLElement;
            return Math.ceil(track.scrollLeft) >= track.scrollWidth - track.clientWidth - 1;
        });
    }

    test("stopcount counts the positions the track can scroll to", async ({ page }) => {
        await expect.poll(() => carousel(page, "bleed").evaluate((el: any) => el.stopcount)).toBe(6);
        expect(await carousel(page, "bleed").evaluate((el: any) => el.slidecount)).toBe(8);
        // with loop every slide is a position
        expect(await carousel(page, "basic").evaluate((el: any) => el.stopcount)).toBe(3);
    });

    test("the dots show one per position", async ({ page }) => {
        await expect(page.getByTestId("bleed-dots").locator('[part="dot"]')).toHaveCount(6);
    });

    test("next() walks every position, the last being the end of the track", async ({ page }) => {
        for (let i = 1; i <= 5; i++)
        {
            await carousel(page, "bleed").evaluate((el: any) => el.next());
            await expect.poll(() => slide(page, "bleed")).toBe(i);
            await waitForScrollIdle(page, "bleed");
        }

        expect(await atEnd(page)).toBe(true);
        expect(await slide(page, "bleed")).toBe(5);
    });

    test("a slide past the last position is clamped to it", async ({ page }) => {
        await carousel(page, "bleed").evaluate((el: any) => { el.slide = 7; });
        await expect.poll(() => slide(page, "bleed")).toBe(5);
        await waitForScrollIdle(page, "bleed");
        expect(await atEnd(page)).toBe(true);
    });

    test("the last dot goes to the end and stays active", async ({ page }) => {
        const last = page.getByTestId("bleed-dots").locator('[part="dot"]').last();
        await last.click();
        await waitForScrollIdle(page, "bleed");

        expect(await atEnd(page)).toBe(true);
        expect(await slide(page, "bleed")).toBe(5);
        await expect(last).toHaveAttribute("aria-disabled", "true");
    });

    test("scrolling to the end by hand makes the last position active", async ({ page }) => {
        await page.evaluate(() => {
            const gallery = document.querySelector("#bleed pap-carousel-gallery") as any;
            gallery.carousel.scrollLeft = gallery.carousel.scrollWidth;
        });
        await waitForScrollIdle(page, "bleed");

        expect(await slide(page, "bleed")).toBe(5);
    });

    test("next() puts the next slide on the scroll-padding gutter", async ({ page }) => {
        await carousel(page, "bleed").evaluate((el: any) => el.next());
        await waitForScrollIdle(page, "bleed");

        expect(await slide(page, "bleed")).toBe(1);
        expect(Math.abs(await slideOffset(page, "bleed", 1) - 40)).toBeLessThan(2);
    });

    test("user scroll picks the slide on the gutter, not the centre one", async ({ page }) => {
        await page.evaluate(() => {
            const gallery = document.querySelector("#bleed pap-carousel-gallery") as any;
            const target = gallery.querySelectorAll(':scope > [slot="slide"]')[2] as HTMLElement;
            gallery.carousel.scrollLeft += target.getBoundingClientRect().left - gallery.carousel.getBoundingClientRect().left - 40;
        });
        await waitForScrollIdle(page, "bleed");

        expect(await slide(page, "bleed")).toBe(2);
    });

    test("next() at the end of the track does nothing", async ({ page }) => {
        await page.evaluate(() => {
            const gallery = document.querySelector("#bleed pap-carousel-gallery") as any;
            gallery.carousel.scrollLeft = gallery.carousel.scrollWidth;
        });
        await waitForScrollIdle(page, "bleed");
        const before = await slide(page, "bleed");

        await carousel(page, "bleed").evaluate((el: any) => el.next());
        await waitForScrollIdle(page, "bleed");

        expect(await slide(page, "bleed")).toBe(before);
    });
});
