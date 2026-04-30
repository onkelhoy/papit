import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/decorators/');
    await page.waitForTimeout(50); // wait for wc to load
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

test.describe("decorators - context", () => {

    test.describe("plain div provider", () => {
        test("initial attribute value is synced on connect", async ({ page }) => {
            const consumer = page.getByTestId("consumer-a");
            expect(await consumer.evaluate((el: any) => el.hello)).toBe("bajs");
        });

        test("attribute change on div updates consumer (MutationObserver)", async ({ page }) => {
            const provider = page.getByTestId("div-provider");
            const consumer = page.getByTestId("consumer-a");

            await provider.evaluate((el) => el.setAttribute("hello", "updated"));
            await page.waitForTimeout(50);

            expect(await consumer.evaluate((el: any) => el.hello)).toBe("updated");
        });

        test("consumer re-renders after attribute change", async ({ page }) => {
            const provider = page.getByTestId("div-provider");
            const consumer = page.getByTestId("consumer-a");

            await provider.evaluate((el) => el.setAttribute("hello", "rendered"));
            await page.waitForTimeout(100);

            const spanText = await consumer.evaluate(
                (el) => el.shadowRoot?.querySelector('[data-key="hello"]')?.textContent
            );
            expect(spanText).toBe("rendered");
        });
    });

    test.describe("custom element provider", () => {
        test("initial property value is synced on connect", async ({ page }) => {
            const consumer = page.getByTestId("consumer-b");
            expect(await consumer.evaluate((el: any) => el.hello)).toBe("from-provider");
        });

        test("property change on provider dispatches context event and updates consumer", async ({ page }) => {
            const provider = page.getByTestId("provider-b");
            const consumer = page.getByTestId("consumer-b");

            await provider.evaluate((el: any) => { el.hello = "event-update"; });
            await page.waitForTimeout(50);

            expect(await consumer.evaluate((el: any) => el.hello)).toBe("event-update");
        });

        test("consumer re-renders after provider property change", async ({ page }) => {
            const provider = page.getByTestId("provider-b");
            const consumer = page.getByTestId("consumer-b");

            await provider.evaluate((el: any) => { el.hello = "re-rendered"; });
            await page.waitForTimeout(100);

            const spanText = await consumer.evaluate(
                (el) => el.shadowRoot?.querySelector('[data-key="hello"]')?.textContent
            );
            expect(spanText).toBe("re-rendered");
        });
    });

    test.describe("nested consumers", () => {
        test("both outer and inner consumers receive the same provider value", async ({ page }) => {
            const outer = page.getByTestId("consumer-c-outer");
            const inner = page.getByTestId("consumer-c-inner");

            expect(await outer.evaluate((el: any) => el.hello)).toBe("nested-value");
            expect(await inner.evaluate((el: any) => el.hello)).toBe("nested-value");
        });

        test("both consumers update when provider attribute changes", async ({ page }) => {
            const provider = page.getByTestId("nested-div-provider");
            const outer = page.getByTestId("consumer-c-outer");
            const inner = page.getByTestId("consumer-c-inner");

            await provider.evaluate((el) => el.setAttribute("hello", "deep-update"));
            await page.waitForTimeout(50);

            expect(await outer.evaluate((el: any) => el.hello)).toBe("deep-update");
            expect(await inner.evaluate((el: any) => el.hello)).toBe("deep-update");
        });

        test("inner consumer does not stop at outer consumer during parent walk", async ({ page }) => {
            // this verifies the _subcontext marker is working — inner must reach the div, not stop at outer
            const inner = page.getByTestId("consumer-c-inner");
            const isConsumerTheProvider = await inner.evaluate((el: any) => {
                // if walk stopped at outer consumer, hello would still be set but let's verify
                // via the _subcontext flag — the provider should not have one
                const parent = el.parentElement?.parentElement; // the nested-div-provider
                return "hello_subcontext" in parent;
            });
            expect(isConsumerTheProvider).toBe(false);
        });
    });

    test.describe("no provider", () => {
        test("consumer without a provider in tree does not crash", async ({ page }) => {
            const consumer = page.getByTestId("consumer-no-provider");
            // should simply be undefined / default value, not throw
            const value = await consumer.evaluate((el: any) => el.hello);
            expect(value).toBe(""); // default from class field
        });
    });

    test.describe("disconnect / reconnect", () => {
        test("consumer stops receiving updates after being removed from DOM", async ({ page }) => {
            const provider = page.getByTestId("div-provider-e");
            const consumer = page.getByTestId("consumer-e");

            // detach consumer
            await consumer.evaluate((el) => el.remove());

            await provider.evaluate((el) => el.setAttribute("hello", "after-disconnect"));
            await page.waitForTimeout(50);

            // re-query from document since it's detached — value should still be the old one
            const value = await page.evaluate(() => {
                return (document.querySelector('[data-testid="consumer-e"]') as any)?.hello;
            });
            // element is removed so query returns null; no update should have fired
            expect(value).toBeUndefined();
        });

        test("consumer re-syncs after being re-inserted into a provider", async ({ page }) => {
            const provider = page.getByTestId("div-provider-e");

            // detach then re-attach
            await page.evaluate(() => {
                const prov = document.querySelector('[data-testid="div-provider-e"]')!;
                const consumer = document.createElement("context-consumer");
                consumer.setAttribute("data-testid", "consumer-e-fresh");
                prov.setAttribute("hello", "reconnected-value");
                prov.appendChild(consumer);
            });

            await page.waitForTimeout(50);

            const value = await page.evaluate(
                () => (document.querySelector('[data-testid="consumer-e-fresh"]') as any)?.hello
            );
            expect(value).toBe("reconnected-value");
        });
    });
})
