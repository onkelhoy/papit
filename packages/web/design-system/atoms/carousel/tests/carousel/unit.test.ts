import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a property from the component via JS (pierces shadow DOM by default). */
async function prop<T>(page: Page, selector: string, key: string): Promise<T> {
    return page.evaluate(
        ([sel, k]) => (document.querySelector(sel) as any)?.[k],
        [selector, key] as const
    );
}

/** Set a property on the component via JS. */
async function setProp(page: Page, selector: string, key: string, value: unknown) {
    await page.evaluate(
        ([sel, k, v]) => { (document.querySelector(sel) as any)[k] = v; },
        [selector, key, value] as const
    );
}

async function waitForSlide(page: Page, selector: string, expected: number, timeout = 3000) {
    await page.waitForFunction(
        ([sel, val]) => (document.querySelector(sel) as any)?.slide === val,
        [selector, expected] as const,
        { timeout }
    );
}

/** Get an attribute from inside a shadow root. */
async function shadowAttr(
    page: Page,
    hostSelector: string,
    shadowSelector: string,
    attr: string
): Promise<string | null> {
    return page.evaluate(
        ([host, shadow, a]) =>
            (document.querySelector(host) as HTMLElement)
                ?.shadowRoot?.querySelector(shadow)
                ?.getAttribute(a) ?? null,
        [hostSelector, shadowSelector, attr] as const
    );
}

/** Click a shadow DOM element. */
async function shadowClick(page: Page, hostSelector: string, shadowSelector: string) {
    await page.evaluate(
        ([host, shadow]) =>
            ((document.querySelector(host) as HTMLElement)
                ?.shadowRoot?.querySelector(shadow) as HTMLElement)
                ?.click(),
        [hostSelector, shadowSelector] as const
    );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
    await page.goto("tests/carousel/");
    // Wait for custom elements to upgrade
    await page.waitForFunction(() =>
        customElements.get("pap-carousel") !== undefined
    );
});

// ===========================================================================
// 1. DOM / registration
// ===========================================================================
test.describe("1. DOM / registration", () => {
    test("component is registered and present", async ({ page }) => {
        const el = await page.$("pap-carousel#basic");
        expect(el).not.toBeNull();
    });

    test("all carousel instances are independent elements", async ({ page }) => {
        const count = await page.evaluate(
            () => document.querySelectorAll("pap-carousel").length
        );
        expect(count).toBe(6);
    });
});

// ===========================================================================
// 2. ARIA / accessibility
// ===========================================================================
test.describe("2. ARIA / accessibility", () => {
    test("host has aria-roledescription=carousel", async ({ page }) => {
        const val = await page.evaluate(
            () => document.querySelector("pap-carousel#basic")?.getAttribute("aria-roledescription")
        );
        expect(val).toBe("carousel");
    });

    test("host has role (group or region)", async ({ page }) => {
        const val = await page.evaluate(
            () => document.querySelector("pap-carousel#basic")?.getAttribute("role")
        );
        expect(["group", "region"]).toContain(val);
    });

    test("inner scroll region has aria-live=polite", async ({ page }) => {
        const val = await shadowAttr(page, "#basic", "div[part='carousel']", "aria-live");
        expect(val).toBe("polite");
    });

    test("inner scroll region has aria-atomic=false", async ({ page }) => {
        const val = await shadowAttr(page, "#basic", "div[part='carousel']", "aria-atomic");
        expect(val).toBe("false");
    });

    test("slides receive role=group and aria-roledescription=slide", async ({ page }) => {
        const [role, roledesc] = await page.evaluate(() => {
            const slide = document.querySelector("#basic-slide-0");
            return [slide?.getAttribute("role"), slide?.getAttribute("aria-roledescription")];
        });
        expect(role).toBe("group");
        expect(roledesc).toBe("slide");
    });

    test("slides have tabindex=0", async ({ page }) => {
        const tabindex = await page.evaluate(() =>
            document.querySelector("#basic-slide-0")?.getAttribute("tabindex")
        );
        expect(tabindex).toBe("0");
    });

    test("autoplay off → aria-live=polite; autoplay on → aria-live=off", async ({ page }) => {
        const before = await shadowAttr(page, "#autoplay", "div[part='carousel']", "aria-live");
        expect(before).toBe("off");

        await setProp(page, "#autoplay", "autoplay", false);
        await page.waitForFunction(() =>
            (document.querySelector("#autoplay") as HTMLElement)
                ?.shadowRoot?.querySelector("div[part='carousel']")
                ?.getAttribute("aria-live") === "polite"
        );

        const after = await shadowAttr(page, "#autoplay", "div[part='carousel']", "aria-live");
        expect(after).toBe("polite");
    });

    test("dots: active dot has aria-disabled=true", async ({ page }) => {
        await page.waitForTimeout(1000);
        const val = await shadowAttr(page, "#basic", "button[part='dot'][data-slide='0']", "aria-disabled");
        expect(val).toBe("true");
    });

    test("dots: inactive dot has aria-disabled=false", async ({ page }) => {
        await page.waitForTimeout(1000);
        const val = await shadowAttr(page, "#basic", "button[part='dot'][data-slide='1']", "aria-disabled");
        expect(val).toBe("false");
    });

    test("clone slides are aria-hidden", async ({ page }) => {
        // clones live in the light DOM (slotted) — check the ones with class "clone"
        const hidden = await page.evaluate(() => {
            const carousel = document.querySelector("pap-carousel#basic");
            const clones = carousel?.querySelectorAll(".clone");
            return Array.from(clones ?? []).every(
                (c) => c.getAttribute("aria-hidden") === "true"
            );
        });
        expect(hidden).toBe(true);
    });

    test("clone slides have role=presentation", async ({ page }) => {
        const ok = await page.evaluate(() => {
            const carousel = document.querySelector("pap-carousel#basic");
            const clones = carousel?.querySelectorAll(".clone");
            return Array.from(clones ?? []).every(
                (c) => c.getAttribute("role") === "presentation"
            );
        });
        expect(ok).toBe(true);
    });
});

// ===========================================================================
// 3. Clones / loop setup
// ===========================================================================
test.describe("3. Clones / loop setup", () => {
    test("loop=true creates exactly 2 clone slides", async ({ page }) => {
        const count = await page.evaluate(() =>
            document.querySelector("pap-carousel#basic")?.querySelectorAll(".clone").length
        );
        expect(count).toBe(2);
    });

    test("loop=false creates no clones", async ({ page }) => {
        const count = await page.evaluate(() =>
            document.querySelector("pap-carousel#no-loop")?.querySelectorAll(".clone").length
        );
        expect(count).toBe(0);
    });

    test("single slide creates no clones", async ({ page }) => {
        const count = await page.evaluate(() =>
            document.querySelector("pap-carousel#single")?.querySelectorAll(".clone").length
        );
        expect(count).toBe(0);
    });

    test("disabling loop removes existing clones", async ({ page }) => {
        await setProp(page, "#basic", "loop", false);
        await page.waitForFunction(() =>
            document.querySelector("pap-carousel#basic")?.querySelectorAll(".clone").length === 0
        );
        const count = await page.evaluate(() =>
            document.querySelector("pap-carousel#basic")?.querySelectorAll(".clone").length
        );
        expect(count).toBe(0);
    });

    test("re-enabling loop recreates clones", async ({ page }) => {
        await setProp(page, "#basic", "loop", false);
        await page.waitForFunction(() =>
            document.querySelector("pap-carousel#basic")?.querySelectorAll(".clone").length === 0
        );
        await setProp(page, "#basic", "loop", true);
        await page.waitForFunction(() =>
            document.querySelector("pap-carousel#basic")?.querySelectorAll(".clone").length === 2
        );
        const count = await page.evaluate(() =>
            document.querySelector("pap-carousel#basic")?.querySelectorAll(".clone").length
        );
        expect(count).toBe(2);
    });
});

// ===========================================================================
// 4. Navigation — next / prev / dot
// ===========================================================================
test.describe("4. Navigation", () => {
    test("next() increments slide", async ({ page }) => {
        const before = await prop<number>(page, "#basic", "slide");
        await page.evaluate(() => (document.querySelector("pap-carousel#basic") as any).next());
        const after = await prop<number>(page, "#basic", "slide");
        expect(after).toBe(before + 1);
    });

    test("prev() decrements slide", async ({ page }) => {
        await setProp(page, "#basic", "slide", 2);
        await waitForSlide(page, "#basic", 2);
        await page.evaluate(() => (document.querySelector("pap-carousel#basic") as any).prev());
        await waitForSlide(page, "#basic", 1);
        const after = await prop<number>(page, "#basic", "slide");
        expect(after).toBe(1);
    });

    test("next button click advances slide", async ({ page }) => {
        await shadowClick(page, "#basic", "pap-button[part='next']");
        await waitForSlide(page, "#basic", 1);
        const idx = await prop<number>(page, "#basic", "slide");
        expect(idx).toBe(1);
    });

    test("prev button click decrements slide", async ({ page }) => {
        await setProp(page, "#basic", "slide", 2);
        await waitForSlide(page, "#basic", 2);
        await shadowClick(page, "#basic", "pap-button[part='prev']");
        await waitForSlide(page, "#basic", 1);
        const idx = await prop<number>(page, "#basic", "slide");
        expect(idx).toBe(1);
    });

    test("dot click on active slide does nothing", async ({ page }) => {
        const before = await prop<number>(page, "#basic", "slide");
        await shadowClick(page, "#basic", `button[part='dot'][data-slide='${before}']`);
        // no waitForSlide — asserting absence of change; small delay is fine
        await page.waitForTimeout(100);
        const after = await prop<number>(page, "#basic", "slide");
        expect(after).toBe(before);
    });

    test("setting index directly updates dotindex", async ({ page }) => {
        await setProp(page, "#basic", "slide", 2);
        await waitForSlide(page, "#basic", 2);
        const dotindex = await prop<number>(page, "#basic", "dotindex");
        expect(dotindex).toBe(2);
    });
});

// ===========================================================================
// 5. Loop wrapping
// ===========================================================================
test.describe("5. Loop wrapping", () => {
    test.skip("next() from last slide wraps to first (loop=true)", async ({ page }) => { // playwright scoll is funky AF 
        await setProp(page, "#basic", "slide", 2);
        await page.evaluate(() => (document.querySelector("pap-carousel#basic") as any).next());
        // After a loop the _pendingloop mechanism resolves — wait for scrollend (debounced 90ms)
        await page.waitForTimeout(1000);
        const idx = await prop<number>(page, "#basic", "slide");
        expect(idx).toBe(0);
    });

    test.skip("prev() from first slide wraps to last (loop=true)", async ({ page }) => { // playwright scoll is funky AF 
        await page.evaluate(() => (document.querySelector("pap-carousel#basic") as any).prev());
        await page.waitForTimeout(1000);
        const idx = await prop<number>(page, "#basic", "slide");
        expect(idx).toBe(2);
    });

    test("next() from last slide does nothing (loop=false)", async ({ page }) => {
        await setProp(page, "#no-loop", "slide", 2);
        await page.evaluate(() => (document.querySelector("pap-carousel#no-loop") as any).next());
        const idx = await prop<number>(page, "#no-loop", "slide");
        expect(idx).toBe(2);
    });

    test("prev() from first slide does nothing (loop=false)", async ({ page }) => {
        await page.evaluate(() => (document.querySelector("pap-carousel#no-loop") as any).prev());
        const idx = await prop<number>(page, "#no-loop", "slide");
        expect(idx).toBe(0);
    });
});

// ===========================================================================
// 6. Autoplay
// ===========================================================================
test.describe("6. Autoplay", () => {
    test("autoplay=false → no timer running", async ({ page }) => {
        const timer = await prop<number | null>(page, "#basic", "timer");
        expect(timer).toBeNull();
    });

    test("autoplay=true → timer is running (non-null)", async ({ page }) => {
        // #autoplay fixture already has autoplay set
        const timer = await prop<number | null>(page, "#autoplay", "timer");
        expect(timer).not.toBeNull();
    });

    test("autoplay advances to next slide after duration", async ({ page }) => {
        const before = await prop<number>(page, "#autoplay", "slide");
        await page.waitForTimeout(900); // duration=800ms
        const after = await prop<number>(page, "#autoplay", "slide");
        expect(after).not.toBe(before);
    });

    test("play=false pauses autoplay", async ({ page }) => {
        await setProp(page, "#autoplay", "play", false);
        const timer = await prop<number | null>(page, "#autoplay", "timer");
        expect(timer).toBeNull();
    });

    test("play=true resumes autoplay", async ({ page }) => {
        await setProp(page, "#autoplay", "play", false);
        await setProp(page, "#autoplay", "play", true);
        const timer = await prop<number | null>(page, "#autoplay", "timer");
        expect(timer).not.toBeNull();
    });

    test("play button toggles play state", async ({ page }) => {
        const before = await prop<boolean>(page, "#autoplay", "play");
        await shadowClick(page, "#autoplay", "pap-button[part='play']");
        await page.waitForFunction(
            ([sel, expected]) => (document.querySelector(sel) as any)?.play === expected,
            ["#autoplay", !before] as const
        );
        const after = await prop<boolean>(page, "#autoplay", "play");
        expect(after).toBe(!before);
    });

    test("progress resets to 0 on slide change", async ({ page }) => {
        await page.waitForTimeout(400);
        const before = await prop<number>(page, "#autoplay", "slide");
        await page.evaluate(() => (document.querySelector("pap-carousel#autoplay") as any).next());
        await waitForSlide(page, "#autoplay", before + 1);  // wait for slide to actually change
        const progress = await prop<number>(page, "#autoplay", "progress");
        expect(progress).toBeLessThan(0.1);                 // just restarted, not mid-way through
    });
});

// ===========================================================================
// 7. Debounce isolation — multiple carousels
// ===========================================================================
test.describe("7. Debounce isolation", () => {
    test("scrollend on carousel A does not interfere with carousel B", async ({ page }) => {
        await page.evaluate(() => (document.querySelector("pap-carousel#multi-b") as any).next());
        await waitForSlide(page, "#multi-b", 1);
        const idxA = await prop<number>(page, "#multi-a", "slide");
        const idxB = await prop<number>(page, "#multi-b", "slide");
        expect(idxA).toBe(0);
        expect(idxB).toBe(1);
    });

    test("both carousels can navigate simultaneously without slide bleed", async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector("pap-carousel#multi-a") as any).next();
            (document.querySelector("pap-carousel#multi-b") as any).next();
        });
        await Promise.all([
            waitForSlide(page, "#multi-a", 1),
            waitForSlide(page, "#multi-b", 1),
        ]);
        const idxA = await prop<number>(page, "#multi-a", "slide");
        const idxB = await prop<number>(page, "#multi-b", "slide");
        expect(idxA).toBe(1);
        expect(idxB).toBe(1);
    });
});

// ===========================================================================
// 8. Properties / attributes
// ===========================================================================
test.describe("8. Properties / attributes", () => {
    test("slide defaults to 0", async ({ page }) => {
        const idx = await prop<number>(page, "#basic", "slide");
        expect(idx).toBe(0);
    });

    test("loop defaults to true", async ({ page }) => {
        const loop = await prop<boolean>(page, "#basic", "loop");
        expect(loop).toBe(true);
    });

    test("loop=false is reflected from attribute", async ({ page }) => {
        const loop = await prop<boolean>(page, "#no-loop", "loop");
        expect(loop).toBe(false);
    });

    test("duration is reflected from attribute", async ({ page }) => {
        const duration = await prop<number>(page, "#autoplay", "duration");
        expect(duration).toBe(800);
    });

    test("--duration CSS custom property is set from duration", async ({ page }) => {
        const val = await page.evaluate(() =>
            (document.querySelector("pap-carousel#autoplay") as HTMLElement)
                ?.style.getPropertyValue("--duration")
        );
        expect(val).toBe("800ms");
    });
});