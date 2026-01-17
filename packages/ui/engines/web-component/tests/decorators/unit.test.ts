import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/decorators/');
    await page.waitForTimeout(1); // wait for wc to load
});

test.describe("decorators - property", () => {
    test("attribute cases", async ({ page }) => {
        const component = page.getByTestId("a");
        expect(component).toHaveAttribute("attributecase", "attribute");
        expect(component).toHaveAttribute("attribute-case-2", "attribute");
        expect(component).not.toHaveAttribute("attribute-case-3");
    });

    test("initial value cases", async ({ page }) => {
        const component = page.getByTestId("a");
        expect(component).toHaveJSProperty("initialValue", "initial");
        expect(component).toHaveJSProperty("initialValue2", "initial-property");
        // attributes 
        expect(component).toHaveAttribute("initialValue", "initial");
        expect(component).toHaveAttribute("initial-value-2", "initial-property");
    });

    test("attribute takes president over property", async ({ page }) => {
        const component = page.getByTestId("b");
        expect(component).toHaveJSProperty("initialValue2", "initial-attribute");
    });

    test("type casting should work", async ({ page }) => {
        const component = page.getByTestId("a");
        expect(component).toHaveJSProperty("object", { hello: "henry" });
        expect(component).toHaveAttribute("object", JSON.stringify({ hello: "henry" }));
    });

    test("attribute-remove", async ({ page }) => {
        const component = page.getByTestId("a");
        expect(component).not.toHaveAttribute("booleanWithRemove");
        expect(component).toHaveJSProperty("booleanWithRemove", false);
        await component.evaluate((el: any) => el.booleanWithRemove = true);
        expect(component).toHaveAttribute("booleanWithRemove", "true");
        expect(component).toHaveJSProperty("booleanWithRemove", true);
        await component.evaluate((el: any) => el.booleanWithRemove = false);
        expect(component).not.toHaveAttribute("booleanWithRemove");
    });

    test("readonly should throw", async ({ page }) => {
        const component = page.getByTestId("a");
        expect(component).toHaveJSProperty("readonly", 3);
        await component.evaluate((el: any) => { el.readonly = 5 });
        expect(component).toHaveJSProperty("readonly", 3);
        await component.evaluate((el: any) => el.setAttribute("readonly", "5"))
        expect(component).toHaveJSProperty("readonly", 3);
    });

    test("rerender", async ({ page }) => {
        const component = page.getByTestId("a");
        let value = await component.evaluate((el: any) => el.span.textContent);
        expect(value).toBe("0");

        await component.evaluate((el: any) => { el.counter = 4 });
        await page.waitForTimeout(100); // wait for paint
        value = await component.evaluate((el: any) => el.span.textContent);
        expect(value).toBe("4");

        await component.evaluate((el: any) => el.setAttribute("counter", "3"));
        await page.waitForTimeout(100); // wait for paint
        value = await component.evaluate((el: any) => el.span.textContent);
        expect(value).toBe("3");
    });
});

test.describe("decorators - query", () => {
    test('buttonA should be available', async ({ page }) => {
        const component = page.getByTestId("a");
        const buttonA = await component.evaluate((el: any) => el.buttonA);
        expect(buttonA).not.toBeNull();
    });

    test('once loading buttonB "queryCase" should be true', async ({ page }) => {
        const component = page.getByTestId("a");
        const queryCase = await component.evaluate((el: any) => el.queryCase);
        expect(queryCase).toBeTruthy();
    });
});

test.describe("decorators - bind", () => {
    test('without bind', async ({ page }) => {
        const component = page.getByTestId("a");
        await component.evaluate((el: any) => el.buttonA.click());
        const bindCase = await component.evaluate((el: any) => el.bindCase);

        expect(bindCase).toBe(0);
    });

    test('with bind', async ({ page }) => {
        const component = page.getByTestId("a");
        await component.evaluate((el: any) => el.buttonB.click());
        const bindCase = await component.evaluate((el: any) => el.bindCase);

        expect(bindCase).toBe(1);
    });
});

test.describe("decorators - debounce", () => {
    test('debounce standard case', async ({ page }) => {
        const component = page.getByTestId("a");
        await component.evaluate((el: any) => el.debounceStandard());
        let number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(0);

        await page.waitForTimeout(300); // wait STANDARD_DELAY

        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);
    });

    test('debounce delay case', async ({ page }) => {
        const component = page.getByTestId("a");
        await component.evaluate((el: any) => el.debounceDelay());
        let number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(0);

        await page.waitForTimeout(300); // wait STANDARD_DELAY

        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(0);

        await page.waitForTimeout(300); // total 600

        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);
    });

    test('debounce name case', async ({ page }) => {
        const component = page.getByTestId("a");
        await component.evaluate((el: any) => el.debounceName());
        let number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);

        await component.evaluate((el: any) => el.debounceNameDebounced());
        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);

        await page.waitForTimeout(300); // wait STANDARD_DELAY

        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(2);
    });

    test('debounce full case', async ({ page }) => {
        const component = page.getByTestId("a");
        await component.evaluate((el: any) => el.debounceFull());
        let number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);

        await component.evaluate((el: any) => el.debounceFullDebounced());
        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);

        await page.waitForTimeout(300); // wait STANDARD_DELAY
        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(1);

        await page.waitForTimeout(300); // wait STANDARD_DELAY
        number = await component.evaluate((el: any) => el.number);
        expect(number).toBe(2);
    });
});
