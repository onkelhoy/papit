import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/treeview/');
});

test.describe("@papit/treeview unit tests", () => {

    // -------------------------------------------------------------------------
    // DOM presence

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-treeview');
        expect(component).not.toBeNull();
    });

    test('has role="tree"', async ({ page }) => {
        const role = await page.getAttribute('pap-treeview', 'role');
        expect(role).toBe('tree');
    });

    test('treeitems have role="treeitem"', async ({ page }) => {
        const roles = await page.$$eval('pap-treeitem', els =>
            els.map(el => el.getAttribute('role'))
        );
        expect(roles.every(r => r === 'treeitem')).toBeTruthy();
    });

    // -------------------------------------------------------------------------
    // initial tabindex

    test('first visible item has tabIndex=0, rest have tabIndex=-1', async ({ page }) => {
        const tabIndices = await page.$$eval('pap-treeitem', els =>
            els.map(el => (el as HTMLElement).tabIndex)
        );
        expect(tabIndices[0]).toBe(0);
        expect(tabIndices.slice(1).every(t => t === -1)).toBeTruthy();
    });

    test('host steps out of tab order once a node is focused', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.first().click();
        const tabIndex = await page.getAttribute('pap-treeview', 'tabindex');
        expect(tabIndex).toBe('-1');
    });

    // -------------------------------------------------------------------------
    // expand / collapse

    test('expandable items have aria-expanded', async ({ page }) => {
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await expect(expandable).toHaveAttribute('aria-expanded', 'false');
    });

    test('ArrowRight expands a collapsed branch', async ({ page }) => {
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await expandable.click(); // click goes through handleclick → setFocus
        await page.keyboard.press('ArrowRight');
        await expect(expandable).toHaveAttribute('aria-expanded', 'true');
    });


    test('ArrowLeft collapses an expanded branch', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await items.first().click(); // focus tree via leaf, no expand side effect
        await page.keyboard.press('ArrowDown'); // move to expandable
        await page.keyboard.press('ArrowRight'); // expand
        await page.keyboard.press('ArrowLeft'); // collapse
        await expect(expandable).toHaveAttribute('aria-expanded', 'false');
    });

    test('Enter toggles expand on branch', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await items.first().click(); // focus tree via leaf
        await page.keyboard.press('ArrowDown'); // move to expandable
        await page.keyboard.press('Enter'); // expand
        await expect(expandable).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Enter'); // collapse
        await expect(expandable).toHaveAttribute('aria-expanded', 'false');
    });

    test('click toggles expand on branch', async ({ page }) => {
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await expandable.click();
        await expect(expandable).toHaveAttribute('aria-expanded', 'true');
        await expandable.click();
        await expect(expandable).toHaveAttribute('aria-expanded', 'false');
    });

    // -------------------------------------------------------------------------
    // keyboard navigation

    test('ArrowDown moves focus to next visible item', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.first().click();
        await page.keyboard.press('ArrowDown');
        await expect(items.nth(1)).toBeFocused();
    });

    test('ArrowUp moves focus to previous item', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.nth(1).click();
        await page.keyboard.press('ArrowUp');
        await expect(items.first()).toBeFocused();
    });

    test('ArrowDown skips children of collapsed branch', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.first().click();
        await page.keyboard.press('ArrowDown');
        await expect(items.nth(1)).toBeFocused();
    });

    test('ArrowRight into open branch moves to first child', async ({ page }) => {
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await expandable.click();
        await page.keyboard.press('ArrowRight'); // expand
        await page.keyboard.press('ArrowRight'); // move into
        const firstChild = expandable.locator('pap-treeitem').first();
        await expect(firstChild).toBeFocused();
    });

    test('ArrowLeft on child moves focus back to parent', async ({ page }) => {
        const expandable = page.locator('pap-treeitem[aria-expanded]').first();
        await expandable.click();
        await page.keyboard.press('ArrowRight'); // expand
        await page.keyboard.press('ArrowRight'); // into first child
        await page.keyboard.press('ArrowLeft'); // back to parent
        await expect(expandable).toBeFocused();
    });




    test('Home moves focus to first visible item', async ({ page }) => {
        const items = page.locator('pap-treeitem');
        await items.nth(1).focus();
        await page.keyboard.press('Home');
        await expect(items.first()).toBeFocused();
    });

    test('End moves focus to last visible item', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.first().focus();
        await page.keyboard.press('End');
        await expect(items.last()).toBeFocused();
    });

    // -------------------------------------------------------------------------
    // selection

    test('Space selects a leaf item', async ({ page }) => {
        const leaf = page.locator('pap-treeitem:not([aria-expanded])').first();
        await leaf.focus();
        await page.keyboard.press('Space');
        await expect(leaf).toHaveAttribute('aria-selected', 'true');
    });

    test('single mode clears previous selection', async ({ page }) => {
        const items = page.locator('pap-treeitem:not([aria-expanded])');
        await items.first().focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        const selected = await page.$$eval(
            'pap-treeitem[aria-selected="true"]',
            els => els.length
        );
        expect(selected).toBe(1);
    });

    test('click selects a leaf item', async ({ page }) => {
        const leaf = page.locator('pap-treeitem:not([aria-expanded])').first();
        await leaf.click();
        await expect(leaf).toHaveAttribute('aria-selected', 'true');
    });

    // -------------------------------------------------------------------------
    // typeahead search

    // test('typing a letter moves focus to matching item', async ({ page }) => {
    //     const items = page.locator('pap-treeitem');
    //     await items.first().focus();
    //     // type first letter of second item's label — adjust to your test HTML
    //     await page.keyboard.press('n');
    //     const matched = page.locator('pap-treeitem[tabindex="0"]');
    //     const label = await matched.evaluate(el =>
    //         Array.from(el.childNodes)
    //             .filter(n => n.nodeType === Node.TEXT_NODE)
    //             .map(n => n.textContent ?? '')
    //             .join('').trim().toLowerCase()
    //     );
    //     expect(label.startsWith('n')).toBeTruthy();
    // });

    test('typing a letter moves focus to matching item', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.first().click(); // focus "Hello Tree Item"
        await page.keyboard.press('n'); // should jump to "Nested"
        await expect(items.nth(1)).toBeFocused();
    });

    // -------------------------------------------------------------------------
    // tab order / focus trap

    test('Tab leaves the tree entirely', async ({ page }) => {
        const items = page.locator('pap-treeitem');
        await items.first().focus();
        await page.keyboard.press('Tab');
        // focus should no longer be inside pap-treeview
        const focusedInTree = await page.evaluate(() =>
            document.querySelector('pap-treeview')?.contains(document.activeElement)
        );
        expect(focusedInTree).toBeFalsy();
    });

    test.skip('Shift+Tab leaves the tree entirely', async ({ page }) => {
        const items = page.locator('pap-treeitem');
        await items.first().focus();
        await page.keyboard.press('Shift+Tab');
        const focusedInTree = await page.evaluate(() =>
            document.querySelector('pap-treeview')?.contains(document.activeElement)
        );
        expect(focusedInTree).toBeFalsy();
    });


    test('re-entering tree lands on last active item', async ({ page }) => {
        const items = page.locator('pap-treeview > pap-treeitem');
        await items.nth(1).click(); // set active item to "Nested"
        await page.keyboard.press('Tab');       // leave tree
        await page.keyboard.press('Shift+Tab'); // come back
        await expect(items.nth(1)).toBeFocused();
    });
});
