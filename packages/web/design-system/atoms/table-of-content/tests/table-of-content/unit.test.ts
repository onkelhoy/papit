import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/table-of-content/');
});

declare global {
    interface Window {
        EVENT_EMITTED: any;
    }
}

test.describe("@papit/table-of-content unit tests", () => {

    // -------------------------------------------------------------------------
    // Presence
    // -------------------------------------------------------------------------

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-table-of-content');
        expect(component).not.toBeNull();
    });

    test('is defined as a custom element', async ({ page }) => {
        const isDefined = await page.evaluate(() =>
            customElements.get('pap-table-of-content') !== undefined
        );
        expect(isDefined).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Heading discovery
    // -------------------------------------------------------------------------

    test('renders a tree item for every visible heading', async ({ page }) => {
        // 5 headings: h2×2, h3×2, h4×1 — aria-hidden and data-skipped excluded
        const count = await page.locator('pap-table-of-content pap-treeitem').count();
        expect(count).toBe(5);
    });

    test('does not include aria-hidden headings', async ({ page }) => {
        const items = await page.locator('pap-table-of-content pap-treeitem').allTextContents();
        expect(items.some(t => t.includes('Hidden heading'))).toBe(false);
    });

    test('does not include data-skipped headings', async ({ page }) => {
        const items = await page.locator('pap-table-of-content pap-treeitem').allTextContents();
        expect(items.some(t => t.includes('Skipped heading'))).toBe(false);
    });

    // -------------------------------------------------------------------------
    // ID injection
    // -------------------------------------------------------------------------

    test('assigns a hyphenated lowercase id to each heading', async ({ page }) => {
        const id = await page.locator('[data-testid="h2-a"]').getAttribute('id');
        expect(id).toBe('getting-started');
    });

    test('anchor href matches the injected heading id', async ({ page }) => {
        const hrefs = await page
            .locator('pap-table-of-content pap-treeitem a')
            .evaluateAll(els => els.map(a => (a as HTMLAnchorElement).getAttribute('href')));

        expect(hrefs).toContain('#getting-started');
        expect(hrefs).toContain('#api-reference');
        expect(hrefs).toContain('#prerequisites');
    });

    // -------------------------------------------------------------------------
    // Hierarchy
    // -------------------------------------------------------------------------

    test('h3 items are direct children of their parent h2 item', async ({ page }) => {
        const directChildCount = await page.evaluate(() => {
            const shadow = document.querySelector('pap-table-of-content')?.shadowRoot;
            const treeview = shadow?.querySelector('pap-treeview');
            if (!treeview) return -1;
            const parent = Array.from(treeview.querySelectorAll('pap-treeitem')).find(item =>
                item.querySelector(':scope > a[href="#getting-started"]')
            );
            return parent
                ? parent.querySelectorAll(':scope > pap-treeitem').length
                : 0;
        });
        expect(directChildCount).toBe(2); // Prerequisites + Installation
    });

    test('h2 items are top-level; h3 items are not', async ({ page }) => {
        // The test HTML has no h1, so h2s are the roots of the hierarchy.
        const topLevelHrefs = await page.evaluate(() => {
            const shadow = document.querySelector('pap-table-of-content')?.shadowRoot;
            const treeview = shadow?.querySelector('pap-treeview');
            if (!treeview) return [];
            return Array.from(treeview.children)
                .filter(el => el.tagName.toLowerCase() === 'pap-treeitem')
                .map(item => item.querySelector('a')?.getAttribute('href') ?? '');
        });

        expect(topLevelHrefs).toContain('#getting-started');
        expect(topLevelHrefs).toContain('#api-reference');
        expect(topLevelHrefs).not.toContain('#prerequisites');
        expect(topLevelHrefs).not.toContain('#installation');
    });

    // -------------------------------------------------------------------------
    // Custom query
    // -------------------------------------------------------------------------

    test('custom query limits discovered headings', async ({ page }) => {
        await page.evaluate(() => {
            const toc = document.querySelector('pap-table-of-content') as any;
            toc.query = 'h3';
        });
        await page.waitForTimeout(100);

        const count = await page.locator('pap-table-of-content pap-treeitem').count();
        expect(count).toBe(2); // Prerequisites + Installation
    });

    // -------------------------------------------------------------------------
    // value getter
    // -------------------------------------------------------------------------

    test('value returns an array', async ({ page }) => {
        const value = await page.evaluate(() =>
            (document.querySelector('pap-table-of-content') as any).value
        );
        expect(Array.isArray(value)).toBe(true);
    });

    test('value entries have href and name fields', async ({ page }) => {
        await page.locator('[data-testid="h2-a"]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);

        const value: { href: string; name: string }[] = await page.evaluate(() =>
            (document.querySelector('pap-table-of-content') as any).value
        );

        if (value.length > 0)
        {
            expect(value[0]).toHaveProperty('href');
            expect(value[0]).toHaveProperty('name');
            expect(value[0].href).toMatch(/^#/);
        }
    });

    // -------------------------------------------------------------------------
    // change event
    // -------------------------------------------------------------------------

    test('dispatches a change event when a heading enters the viewport', async ({ page }) => {
        await page.evaluate(() => {
            window.EVENT_EMITTED = null;
            document.querySelector('pap-table-of-content')!
                .addEventListener('change', () => { window.EVENT_EMITTED = true; });
        });

        await page.locator('[data-testid="h2-b"]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);

        expect(await page.evaluate(() => window.EVENT_EMITTED)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Slot / fallback
    // -------------------------------------------------------------------------

    test('renders slotted fallback content', async ({ page }) => {
        const slotText = await page.evaluate(() =>
            document.querySelector('pap-table-of-content')?.textContent?.trim()
        );
        expect(slotText).toContain('fallback');
    });

});