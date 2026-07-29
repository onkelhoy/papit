import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/checkbox/');
});

test.describe('@papit/checkbox unit tests', () => {

    // -------------------------------------------------------------------------
    // DOM presence & ARIA
    // -------------------------------------------------------------------------

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-checkbox');
        expect(component).not.toBeNull();
    });

    test('has role="checkbox"', async ({ page }) => {
        await expect(page.locator('#c1')).toHaveAttribute('role', 'checkbox');
    });

    test('aria-checked is "false" by default', async ({ page }) => {
        await expect(page.locator('#c1')).toHaveAttribute('aria-checked', 'false');
    });

    test('aria-checked reflects checked state', async ({ page }) => {
        await page.locator('#c1').click();
        await expect(page.locator('#c1')).toHaveAttribute('aria-checked', 'true');
    });

    test('is tabbable by default', async ({ page }) => {
        await expect(page.locator('#c1')).toHaveAttribute('tabindex', '0');
    });

    // -------------------------------------------------------------------------
    // defaultchecked
    // -------------------------------------------------------------------------

    test('defaultchecked sets initial checked state', async ({ page }) => {
        expect(await page.locator('#c2').evaluate((node: any) => node.checked)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Click behaviour
    // -------------------------------------------------------------------------

    test('clicking an unchecked checkbox checks it', async ({ page }) => {
        await page.locator('#c1').click();
        expect(await page.locator('#c1').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('clicking a checked checkbox unchecks it', async ({ page }) => {
        await page.locator('#c1').click(); // check
        await page.locator('#c1').click(); // uncheck
        expect(await page.locator('#c1').evaluate((node: any) => node.checked)).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Keyboard – Space & Enter
    // -------------------------------------------------------------------------

    test('Space toggles a focused checkbox', async ({ page }) => {
        await page.locator('#c1').focus();
        await page.keyboard.press('Space');
        expect(await page.locator('#c1').evaluate((node: any) => node.checked)).toBe(true);

        await page.keyboard.press('Space');
        expect(await page.locator('#c1').evaluate((node: any) => node.checked)).toBe(false);
    });

    test('Enter does not toggle a focused checkbox', async ({ page }) => {
        await page.locator('#c1').focus();
        await page.keyboard.press('Enter');
        expect(await page.locator('#c1').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    // -------------------------------------------------------------------------
    // Indeterminate
    // -------------------------------------------------------------------------

    test('indeterminate reflects aria-checked="mixed"', async ({ page }) => {
        await expect(page.locator('#c-indeterminate')).toHaveAttribute('aria-checked', 'mixed');
        expect(await page.locator('#c-indeterminate').evaluate((node: any) => node.checked)).toBe(false);
    });

    test('activating an indeterminate checkbox clears indeterminate and checks it', async ({ page }) => {
        await page.locator('#c-indeterminate').click();

        expect(await page.locator('#c-indeterminate').evaluate((node: any) => node.indeterminate)).toBeFalsy();
        await expect(page.locator('#c-indeterminate')).toHaveAttribute('aria-checked', 'true');
    });

    // -------------------------------------------------------------------------
    // Disabled
    // -------------------------------------------------------------------------

    test('disabled checkbox cannot be checked by click', async ({ page }) => {
        await page.locator('#c-disabled').click({ force: true });
        expect(await page.locator('#c-disabled').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('disabled checkbox cannot be checked by Space', async ({ page }) => {
        await page.locator('#c-disabled').focus();
        await page.keyboard.press('Space');
        expect(await page.locator('#c-disabled').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('disabled checkbox has no tabindex', async ({ page }) => {
        await expect(page.locator('#c-disabled')).not.toHaveAttribute('tabindex', /.+/);
    });

    // -------------------------------------------------------------------------
    // Readonly
    // -------------------------------------------------------------------------

    test('readonly checkbox cannot be changed by click', async ({ page }) => {
        await page.locator('#c-readonly').click({ force: true });
        expect(await page.locator('#c-readonly').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('readonly checkbox cannot be changed by Space', async ({ page }) => {
        await page.locator('#c-readonly').focus();
        await page.keyboard.press('Space');
        expect(await page.locator('#c-readonly').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('readonly checkbox remains tabbable', async ({ page }) => {
        await expect(page.locator('#c-readonly')).toHaveAttribute('tabindex', '0');
    });

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    test('change event fires when checked changes', async ({ page }) => {
        const fired = await page.locator('#c1').evaluate((node: Element) =>
            new Promise<boolean>(resolve => {
                node.addEventListener('change', () => resolve(true), { once: true });
                (node as any).checked = true;
            })
        );
        expect(fired).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Form integration
    // -------------------------------------------------------------------------

    test('form reset restores defaultchecked checkbox', async ({ page }) => {
        await page.locator('#c2').click(); // uncheck it
        expect(await page.locator('#c2').evaluate((node: any) => node.checked)).toBe(false);

        await page.locator('#reset-btn').click();
        expect(await page.locator('#c2').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('form reset unchecks checkboxes without defaultchecked', async ({ page }) => {
        await page.locator('#c1').click();
        await page.locator('#reset-btn').click();
        expect(await page.locator('#c1').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('submits value via FormData when checked', async ({ page }) => {
        await page.locator('#c1').click();

        const value = await page.evaluate(() => {
            const form = document.getElementById('main-form') as HTMLFormElement;
            return new FormData(form).get('agree');
        });
        expect(value).toBe('yes');
    });

    test('does not submit a value when unchecked', async ({ page }) => {
        const value = await page.evaluate(() => {
            const form = document.getElementById('main-form') as HTMLFormElement;
            return new FormData(form).get('agree');
        });
        expect(value).toBeNull();
    });

});