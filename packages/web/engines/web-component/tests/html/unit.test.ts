import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/html/');
    await page.waitForTimeout(1); // wait for wc to load
});

test.describe("attribute cases", () => {

    test("update should reflected content", async ({ page }) => {
        const component = page.getByTestId("inside");
        expect(component).toHaveAttribute("name", "oscar");
        let pText = await component.evaluate((el: any) => el.shadowRoot?.querySelector("p")?.textContent);
        expect(pText).not.toBeNull();
        expect(pText).toBe("oscar");

        await component.evaluate((el: any) => el.setAttribute("name", "henry"));
        await page.waitForTimeout(300);

        pText = await component.evaluate((el: any) => el.shadowRoot?.querySelector("p")?.textContent);
        expect(pText).not.toBeNull();
        expect(pText).toBe("henry");
    });

    test("update should reflected content - nested", async ({ page }) => {
        const component = page.getByTestId("outside");
        expect(component).toHaveAttribute("name", "oscar");
        await page.waitForTimeout(300);

        let pText = await component.evaluate((el: any) => el.shadowRoot?.querySelector("attr-inside")?.shadowRoot?.querySelector('p')?.textContent);
        expect(pText).not.toBeNull();
        expect(pText).toBe("oscar");

        await component.evaluate((el: any) => el.setAttribute("name", "henry"));
        await page.waitForTimeout(300);

        pText = await component.evaluate((el: any) => el.shadowRoot?.querySelector("attr-inside")?.shadowRoot?.querySelector('p')?.textContent);
        expect(pText).not.toBeNull();
        expect(pText).toBe("henry");
    });

    test("select case base", async ({ page }) => {
        const component = page.getByTestId("select");
        expect(component).toHaveAttribute("name", "oscar");
        const option = await component.evaluate((el: any) => el.shadowRoot?.querySelector("option[selected]")?.value);
        expect(option).not.toBeNull();
        expect(option).toBe("oscar");
    });

    test("select case update", async ({ page }) => {
        const component = page.getByTestId("select");
        await component.evaluate((el: any) => el.setAttribute("name", "henry"));
        await page.waitForTimeout(300);

        const option = await component.evaluate((el: any) => el.shadowRoot?.querySelector("option[selected]")?.value);
        expect(option).not.toBeNull();
        expect(option).toBe("henry");
    });

    test("child must allow parent to know which attributes are markers", async ({ page }) => {
        const component = page.getByTestId("event");
        expect(component).not.toBeNull();
        expect(component).toHaveAttribute("count", "5");
        await page.waitForTimeout(300);

        const insideAttr = await component.evaluate((el: any) => el.shadowRoot?.querySelector("attr-event-inside")?.getAttribute("count"));
        expect(insideAttr).toBe("5");
        const pAttribute = await component.evaluate((el: any) => el.shadowRoot?.querySelector("attr-event-inside")?.shadowRoot?.querySelector("p")?.getAttribute("count"));
        const pContent = await component.evaluate((el: any) => el.shadowRoot?.querySelector("attr-event-inside")?.shadowRoot?.querySelector("p")?.textContent);
        expect(pAttribute).toBe("5");
        expect(pContent).toBe("5");
    });

    test("static text around values in an attribute keeps the following bindings in place", async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.reload();
        await page.waitForTimeout(300);

        const component = page.getByTestId("partial");
        const read = () => component.evaluate((el: any) => {
            const button = el.shadowRoot?.querySelector("button");
            return { id: button?.getAttribute("data-id"), title: button?.getAttribute("title"), text: button?.textContent };
        });

        expect(errors).toEqual([]);
        expect(await read()).toEqual({ id: "tip-henry", title: "henry-0!", text: "0" });

        await component.evaluate((el: any) => el.shadowRoot.querySelector("button").click());
        await component.evaluate((el: any) => el.setAttribute("name", "oscar"));
        await page.waitForTimeout(300);

        expect(await read()).toEqual({ id: "tip-oscar", title: "oscar-1!", text: "1" });
    });
});

test.describe("keyed list", () => {

    test("reorder keeps values, order and moves the same nodes", async ({ page }) => {
        const component = page.getByTestId("keyed");
        await page.waitForTimeout(300);

        const before = await component.evaluate((el: any) => {
            const items = [...el.shadowRoot.querySelectorAll("li")];
            items.forEach((li: any) => li.__tag = li.textContent);
            return items.map(li => li.textContent);
        });
        expect(before).toEqual(["A", "B", "C"]);

        for (const next of [["C", "A", "B"], ["B", "C", "A", "D"], ["D", "A"], ["A", "B", "C"]])
        {
            await component.evaluate((el: any, next) => el.items = next, next);
            await page.waitForTimeout(100);

            const result = await component.evaluate((el: any) =>
                [...el.shadowRoot.querySelectorAll("li")].map((li: any) => [li.textContent, li.__tag ?? null]));
            expect(result.map(([text]) => text)).toEqual(next);
            // a reused node still has its own tag, so it was never handed another item's value
            for (const [text, tag] of result) if (tag !== null) expect(tag).toBe(text);
        }
    });
});
