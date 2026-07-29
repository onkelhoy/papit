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

test.describe('@papit/checkbox group (aria-controls) tests', () => {

    test('clicking the group checkbox checks all children', async ({ page }) => {
        await page.locator('#group-parent').click();

        for (const id of ['#child-a', '#child-b', '#child-c'])
        {
            expect(await page.locator(id).evaluate((n: any) => n.checked)).toBe(true);
        }
        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'true');
    });

    test('clicking the group checkbox twice unchecks all children', async ({ page }) => {
        await page.locator('#group-parent').click(); // check all
        await page.locator('#group-parent').click(); // uncheck all

        for (const id of ['#child-a', '#child-b', '#child-c'])
        {
            expect(await page.locator(id).evaluate((n: any) => n.checked)).toBe(false);
        }
        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'false');
    });

    test('checking one child puts the group into indeterminate state', async ({ page }) => {
        await page.locator('#child-a').click();

        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'mixed');
        expect(await page.locator('#group-parent').evaluate((n: any) => n.checked)).toBe(false);
    });

    test('checking all children individually fully checks the group', async ({ page }) => {
        await page.locator('#child-a').click();
        await page.locator('#child-b').click();
        await page.locator('#child-c').click();

        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'true');
        expect(await page.locator('#group-parent').evaluate((n: any) => n.indeterminate)).toBeFalsy();
    });

    test('unchecking all children individually fully unchecks the group', async ({ page }) => {
        await page.locator('#group-parent').click(); // check all first
        await page.locator('#child-a').click();
        await page.locator('#child-b').click();
        await page.locator('#child-c').click();

        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'false');
        expect(await page.locator('#group-parent').evaluate((n: any) => n.indeterminate)).toBeFalsy();
    });

    // Regression test for: clicking a mixed group checkbox once didn't
    // cascade to children, requiring extra clicks to fully check them.
    test('activating a mixed group checkbox checks all children in a single click', async ({ page }) => {
        await page.locator('#child-a').click(); // -> group becomes indeterminate
        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'mixed');

        await page.locator('#group-parent').click(); // one click while mixed

        for (const id of ['#child-a', '#child-b', '#child-c'])
        {
            expect(await page.locator(id).evaluate((n: any) => n.checked)).toBe(true);
        }
        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'true');
        expect(await page.locator('#group-parent').evaluate((n: any) => n.indeterminate)).toBeFalsy();
    });

    test('group checkbox is not both checked and indeterminate at the same time', async ({ page }) => {
        await page.locator('#child-a').click(); // group -> indeterminate

        const state = await page.locator('#group-parent').evaluate((n: any) => ({
            checked: n.checked,
            indeterminate: n.indeterminate
        }));
        expect(state.indeterminate).toBe(true);
        expect(state.checked).toBe(false);
    });

    // Programmatic assignment (e.g. from external app code) should behave
    // the same as a user click — it should still cascade to children.
    test('setting checked programmatically on the group cascades to children', async ({ page }) => {
        await page.locator('#group-parent').evaluate((n: any) => { n.checked = true; });

        for (const id of ['#child-a', '#child-b', '#child-c'])
        {
            expect(await page.locator(id).evaluate((n: any) => n.checked)).toBe(true);
        }
    });

    test('unsetting checked programmatically on the group cascades to children', async ({ page }) => {
        await page.locator('#group-parent').evaluate((n: any) => { n.checked = true; }); // check all first
        await page.locator('#group-parent').evaluate((n: any) => { n.checked = false; });

        for (const id of ['#child-a', '#child-b', '#child-c'])
        {
            expect(await page.locator(id).evaluate((n: any) => n.checked)).toBe(false);
        }
    });

    // Setting indeterminate directly is purely a display flag on the group —
    // it must NOT force children into an unchecked state.
    test('assigning indeterminate directly does not force children unchecked', async ({ page }) => {
        await page.locator('#child-a').click(); // child-a checked directly by user

        await page.locator('#group-parent').evaluate((n: any) => { n.indeterminate = true; });

        expect(await page.locator('#child-a').evaluate((n: any) => n.checked)).toBe(true);
        await expect(page.locator('#group-parent')).toHaveAttribute('aria-checked', 'mixed');
    });

});