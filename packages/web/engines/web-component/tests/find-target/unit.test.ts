import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/find-target/');
    await page.waitForFunction(() => typeof (window as any).findTarget === "function");
});

// runs findTarget in the page from the element with data-testid `from` and returns the found data-testid
function find(page: Page, from: string, code: string) {
    return page.evaluate(([from, code]) => {
        const start = document.querySelector(`[data-testid="${from}"]`)
            ?? document.getElementById("shadow-host")!.shadowRoot!.querySelector(`[data-testid="${from}"]`);
        const run = new Function("findTarget", "element", `return ${code};`);
        const found = run((window as any).findTarget, start) as HTMLElement | null;
        return found ? found.dataset.testid ?? found.tagName.toLowerCase() : null;
    }, [from, code] as const);
}

test.describe("findTarget - query", () => {
    test("a single match in the root is returned directly, ancestor or not", async ({ page }) => {
        expect(await find(page, "start-far", `findTarget(element, "#unique")`)).toBe("unique");
    });

    test("several matches: the nearest matching ancestor wins", async ({ page }) => {
        expect(await find(page, "start-a", `findTarget(element, ".zone")`)).toBe("zone-a");
        expect(await find(page, "start-b", `findTarget(element, ".zone")`)).toBe("zone-b");
    });

    test("a query function is called with the element as this", async ({ page }) => {
        const code = `findTarget(element, function () { return this.dataset.testid === "start-a" ? "#unique" : ".missing"; })`;
        expect(await find(page, "start-a", code)).toBe("unique");
        expect(await find(page, "start-b", code)).toBeNull();
    });

    test("no match returns null", async ({ page }) => {
        expect(await find(page, "start-a", `findTarget(element, ".missing")`)).toBeNull();
    });

    test("the query only searches the element's own root", async ({ page }) => {
        expect(await find(page, "inner", `findTarget(element, ".only-inside")`)).toBe("only-inside");
        // #unique lives in the document, not in the shadow root, and is no ancestor
        expect(await find(page, "inner", `findTarget(element, "#unique")`)).toBeNull();
    });
});

test.describe("findTarget - finder", () => {
    test("without a query, the finder walks up from the parent", async ({ page }) => {
        const code = `findTarget(element, undefined, t => t.tagName === "SECTION" ? t : null)`;
        expect(await find(page, "start-a", code)).toBe("zone-a");
    });

    test("the element itself is not a candidate", async ({ page }) => {
        const code = `findTarget(element, undefined, t => t.tagName === "SPAN" ? t : null)`;
        expect(await find(page, "start-b", code)).toBeNull();
    });

    test("with several query matches, the finder decides", async ({ page }) => {
        const code = `findTarget(element, ".zone", t => t.tagName === "BODY" ? t : null)`;
        expect(await find(page, "start-a", code)).toBe("body");
    });

    test("the walk crosses a shadow boundary to the host", async ({ page }) => {
        const code = `findTarget(element, undefined, t => t.id === "shadow-host" ? t : null)`;
        expect(await find(page, "inner", code)).toBe("shadow-host");
    });

    test("neither query nor finder returns null", async ({ page }) => {
        expect(await find(page, "start-a", `findTarget(element, undefined)`)).toBeNull();
    });
});
