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
});