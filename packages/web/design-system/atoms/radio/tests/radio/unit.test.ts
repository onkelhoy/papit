import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/radio/');
});

test.describe('@papit/radio unit tests', () => {

    // -------------------------------------------------------------------------
    // DOM presence & ARIA
    // -------------------------------------------------------------------------

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-radio');
        expect(component).not.toBeNull();
    });

    test('has role="radio"', async ({ page }) => {
        await expect(page.locator('#r1')).toHaveAttribute('role', 'radio');
    });

    test('aria-checked is "false" by default', async ({ page }) => {
        await expect(page.locator('#r1')).toHaveAttribute('aria-checked', 'false');
    });

    test('aria-checked reflects checked state', async ({ page }) => {
        await page.locator('#r1').click();
        await expect(page.locator('#r1')).toHaveAttribute('aria-checked', 'true');
    });

    // -------------------------------------------------------------------------
    // defaultchecked
    // -------------------------------------------------------------------------

    test('defaultchecked sets initial checked state', async ({ page }) => {
        expect(await page.locator('#r2').evaluate((node: any) => node.checked)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Click behaviour
    // -------------------------------------------------------------------------

    test('clicking an unchecked radio checks it', async ({ page }) => {
        await page.locator('#r1').click();
        expect(await page.locator('#r1').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('clicking a checked radio does not uncheck it', async ({ page }) => {
        await page.locator('#r1').click(); // check
        await page.locator('#r1').click(); // should stay checked
        expect(await page.locator('#r1').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('checking one named radio unchecks the previously checked one', async ({ page }) => {
        await page.locator('#r1').click();
        await page.locator('#r3').click();

        expect(await page.locator('#r1').evaluate((node: any) => node.checked)).toBe(false);
        expect(await page.locator('#r3').evaluate((node: any) => node.checked)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Keyboard – Space & Enter
    // -------------------------------------------------------------------------

    test('Space checks a focused radio', async ({ page }) => {
        await page.locator('#r1').focus();
        await page.keyboard.press('Space');
        expect(await page.locator('#r1').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('Enter checks a focused radio', async ({ page }) => {
        await page.locator('#r1').focus();
        await page.keyboard.press('Enter');
        expect(await page.locator('#r1').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('Space on an already-checked radio does nothing', async ({ page }) => {
        await page.locator('#r2').focus(); // defaultchecked
        await page.keyboard.press('Space');
        expect(await page.locator('#r2').evaluate((node: any) => node.checked)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Disabled
    // -------------------------------------------------------------------------

    test('disabled radio cannot be checked by click', async ({ page }) => {
        await page.locator('#r-disabled').click({ force: true });
        // checked is undefined (falsy) when never set — disabled blocks the setter
        expect(await page.locator('#r-disabled').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('disabled radio cannot be checked by Space', async ({ page }) => {
        await page.locator('#r-disabled').focus();
        await page.keyboard.press('Space');
        expect(await page.locator('#r-disabled').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    // -------------------------------------------------------------------------
    // Readonly
    // -------------------------------------------------------------------------

    test('readonly radio cannot be changed by click', async ({ page }) => {
        await page.locator('#r-readonly').click({ force: true });
        expect(await page.locator('#r-readonly').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    test('readonly radio cannot be changed by Space', async ({ page }) => {
        await page.locator('#r-readonly').focus();
        await page.keyboard.press('Space');
        expect(await page.locator('#r-readonly').evaluate((node: any) => node.checked)).toBeFalsy();
    });

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    test('change event fires when checked changes', async ({ page }) => {
        const fired = await page.locator('#r1').evaluate((node: Element) =>
            new Promise<boolean>(resolve => {
                node.addEventListener('change', () => resolve(true), { once: true });
                (node as any).checked = true;
            })
        );
        expect(fired).toBe(true);
    });

    test('change event does not fire when clicking an already-checked radio', async ({ page }) => {
        // ensure r2 is checked (defaultchecked)
        expect(await page.locator('#r2').evaluate((node: any) => node.checked)).toBe(true);

        const fired = await page.locator('#r2').evaluate((node: Element) =>
            new Promise<boolean>(resolve => {
                let didFire = false;
                node.addEventListener('change', () => { didFire = true; }, { once: true });
                (node as any).click();
                // give it a tick to fire synchronously if it was going to
                setTimeout(() => resolve(didFire), 50);
            })
        );
        expect(fired).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Form integration
    // -------------------------------------------------------------------------

    test('form reset restores defaultchecked radio', async ({ page }) => {
        await page.locator('#r1').click(); // move away from r2
        expect(await page.locator('#r2').evaluate((node: any) => node.checked)).toBe(false);

        await page.locator('#reset-btn').click();
        expect(await page.locator('#r2').evaluate((node: any) => node.checked)).toBe(true);
    });

    test('form reset unchecks radios without defaultchecked', async ({ page }) => {
        await page.locator('#r3').click();
        await page.locator('#reset-btn').click();
        expect(await page.locator('#r3').evaluate((node: any) => node.checked)).toBeFalsy();
    });

});