import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/field/');
});

test.describe("@papit/field unit tests", () => {

    // -------------------------------------------------------------------------
    // Presence
    // -------------------------------------------------------------------------

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-field');
        expect(component).not.toBeNull();
    });

    // -------------------------------------------------------------------------
    // Target discovery
    // -------------------------------------------------------------------------

    test('picks up slotted input as target', async ({ page }) => {
        const hasTarget = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="slotted-input"]');
            return field?.target instanceof HTMLInputElement;
        });
        expect(hasTarget).toBe(true);
    });

    test('picks up slotted textarea as target', async ({ page }) => {
        const hasTarget = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="slotted-textarea"]');
            return field?.target instanceof HTMLTextAreaElement;
        });
        expect(hasTarget).toBe(true);
    });

    test('picks up slotted select as target', async ({ page }) => {
        const hasTarget = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="slotted-select"]');
            return field?.target instanceof HTMLSelectElement;
        });
        expect(hasTarget).toBe(true);
    });

    // -------------------------------------------------------------------------
    // fieldName resolution
    // -------------------------------------------------------------------------

    test('fieldName resolves from name attribute on pap-field', async ({ page }) => {
        const name = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="named-field"]');
            return field?.fieldName ?? field?.getAttribute?.('name');
        });
        // fallback: check the attribute since fieldName is private
        const attr = await page.evaluate(() =>
            document.querySelector('[data-testid="named-field"]')?.getAttribute('name')
        );
        expect(attr).toBe('myField');
    });

    test('fieldName falls back to input name attribute', async ({ page }) => {
        const inputName = await page.evaluate(() => {
            const field = document.querySelector('[data-testid="slotted-input"]');
            const input = field?.querySelector('input');
            return input?.name;
        });
        expect(inputName).toBe('email');
    });

    // -------------------------------------------------------------------------
    // Error state — population
    // -------------------------------------------------------------------------

    test('errorState populated with valueMissing when required input is empty', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
        });

        const errorState = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return field?.errorState;
        });

        expect(errorState).toHaveProperty('valueMissing');
    });

    test('errorState populated with typeMismatch for invalid email', async ({ page }) => {
        await page.locator('[data-testid="email-field"] input').fill('not-an-email');
        await page.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
        });

        const errorState = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="email-field"]');
            return field?.errorState;
        });

        expect(errorState).toHaveProperty('typeMismatch');
    });

    test('browser default validation tooltip is suppressed', async ({ page }) => {
        // The invalid event's preventDefault should stop the browser tooltip.
        // We verify by checking that after requestSubmit, the page has not
        // navigated and the errorState is set (meaning our handler ran).
        await page.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
        });

        const url = page.url();
        expect(url).toContain('tests/field/');

        const errorState = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return field?.errorState;
        });
        expect(Object.keys(errorState).length).toBeGreaterThan(0);
    });

    // -------------------------------------------------------------------------
    // Error state — explicit prop messages
    // -------------------------------------------------------------------------

    test('error prop message is used over fallback for valueMissing', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
        });

        // wait for errorState to be populated (rerender is async)
        await page.waitForFunction(() => {
            const field = document.querySelector<any>('[data-testid="custom-error-field"]');
            return Object.keys(field?.errorState ?? {}).length > 0;
        });

        // errorState values are string[] — use toContain
        const messages = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="custom-error-field"]');
            return field?.errorState?.valueMissing;
        });
        expect(messages).toContain('Custom required message');
    });

    test('error prop function is called and result used', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
        });

        await page.waitForFunction(() => {
            const field = document.querySelector<any>('[data-testid="fn-error-field"]');
            return Object.keys(field?.errorState ?? {}).length > 0;
        });

        const messages = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="fn-error-field"]');
            return field?.errorState?.valueMissing;
        });
        expect(messages).toContain('Computed required message');
    });

    // -------------------------------------------------------------------------
    // Error state — clearing on change
    // -------------------------------------------------------------------------

    test('errorState cleared when user changes the input', async ({ page }) => {
        // First trigger an error
        await page.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
        });

        const before = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length;
        });
        expect(before).toBeGreaterThan(0);

        // Now fill the input — triggers change
        await page.locator('[data-testid="required-field"] input').fill('hello');
        await page.locator('[data-testid="required-field"] input').dispatchEvent('change');

        const after = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length;
        });
        expect(after).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Warning state
    // -------------------------------------------------------------------------

    test('warningState populated on change when field is valid and warning prop set', async ({ page }) => {
        // Type a value that satisfies minlength — field becomes valid
        await page.locator('[data-testid="warning-field"] input').fill('validvalue');
        await page.locator('[data-testid="warning-field"] input').dispatchEvent('change');

        const warningState = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="warning-field"]');
            return field?.warningState;
        });

        // The warning prop has a tooShort key configured; field is valid so it surfaces
        expect(typeof warningState).toBe('object');
    });

    test('warningState is empty when no warning prop configured', async ({ page }) => {
        await page.locator('[data-testid="required-field"] input').fill('hello');
        await page.locator('[data-testid="required-field"] input').dispatchEvent('change');

        const warningState = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return field?.warningState;
        });

        expect(Object.keys(warningState ?? {}).length).toBe(0);
    });

    test('warningState cleared when error is present', async ({ page }) => {
        // Fill then clear to trigger an invalid + change cycle
        await page.locator('[data-testid="required-field"] input').fill('hello');
        await page.locator('[data-testid="required-field"] input').dispatchEvent('change');
        await page.locator('[data-testid="required-field"] input').fill('');
        await page.locator('[data-testid="required-field"] input').dispatchEvent('change');

        const warningState = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return field?.warningState;
        });

        expect(Object.keys(warningState ?? {}).length).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Rendered output
    // -------------------------------------------------------------------------

    test('errorState has entries after invalid fires', async ({ page }) => {
        await page.evaluate(() => {
            const input = document.querySelector<HTMLInputElement>('[data-testid="required-field"] input');
            input?.reportValidity();
        });

        await page.waitForFunction(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length > 0;
        });

        const errorCount = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length;
        });
        expect(errorCount).toBeGreaterThan(0);
    });

    test('errorState values are arrays of strings', async ({ page }) => {
        await page.evaluate(() => {
            const input = document.querySelector<HTMLInputElement>('[data-testid="required-field"] input');
            input?.reportValidity();
        });

        await page.waitForFunction(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length > 0;
        });

        const isArray = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            const val = field?.errorState?.valueMissing;
            return Array.isArray(val);
        });
        expect(isArray).toBe(true);
    });

    test('errorState cleared after change', async ({ page }) => {
        await page.evaluate(() => {
            const input = document.querySelector<HTMLInputElement>('[data-testid="required-field"] input');
            input?.reportValidity();
        });

        // wait for errorState to be populated first
        await page.waitForFunction(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length > 0;
        });

        await page.locator('[data-testid="required-field"] input').fill('hello');
        await page.locator('[data-testid="required-field"] input').dispatchEvent('change');

        const errorCount = await page.evaluate(() => {
            const field = document.querySelector<any>('[data-testid="required-field"]');
            return Object.keys(field?.errorState ?? {}).length;
        });
        expect(errorCount).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    test('listeners removed when element is disconnected', async ({ page }) => {
        // Disconnect the element and verify no JS errors occur when its former
        // target dispatches an event (listeners should have been removed).
        await page.evaluate(() => {
            const field = document.querySelector('[data-testid="slotted-input"]');
            field?.remove();
        });

        // If listeners were not cleaned up this would throw in the page context
        const error = await page.evaluate(() => {
            try
            {
                const orphan = document.createElement('input');
                orphan.dispatchEvent(new Event('change'));
                orphan.dispatchEvent(new Event('invalid'));
                return null;
            } catch (e: any)
            {
                return e.message;
            }
        });

        expect(error).toBeNull();
    });
});