import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/tabs/');

    // Wait for all pap-tab elements to be fully initialised before each test.
    // The context update that writes aria-selected is async, so we wait until
    // the first tab has the attribute before proceeding.
    await page.waitForFunction(() => {
        const tab = document.querySelector('pap-tab');
        return tab !== null && tab.hasAttribute('aria-selected');
    });
});

test.describe("@papit/tabs unit tests", () => {

    // ── Presence ──────────────────────────────────────────────────────────────

    test('pap-tabs is available in DOM', async ({ page }) => {
        const component = await page.$('pap-tabs');
        expect(component).not.toBeNull();
    });

    test('pap-tab elements are available in DOM', async ({ page }) => {
        const tabs = await page.$$('pap-tab');
        expect(tabs.length).toBeGreaterThan(0);
    });

    test('pap-tabpanel elements are available in DOM', async ({ page }) => {
        const panels = await page.$$('pap-tabpanel');
        expect(panels.length).toBeGreaterThan(0);
    });

    // ── ARIA roles ─────────────────────────────────────────────────────────────

    test('tablist role is present on the inner group element', async ({ page }) => {
        const tablist = await page.$('[role="tablist"]');
        expect(tablist).not.toBeNull();
    });

    test('each pap-tab has role="tab"', async ({ page }) => {
        const tabs = await page.$$('pap-tab');
        for (const tab of tabs)
        {
            const role = await tab.getAttribute('role');
            expect(role).toBe('tab');
        }
    });

    test('each pap-tabpanel has role="tabpanel"', async ({ page }) => {
        const panels = await page.$$('pap-tabpanel');
        for (const panel of panels)
        {
            const role = await panel.getAttribute('role');
            expect(role).toBe('tabpanel');
        }
    });

    // ── aria-orientation ──────────────────────────────────────────────────────

    test('tablist defaults to aria-orientation="horizontal"', async ({ page }) => {
        // Scope to fixture 1 to avoid interference from the vertical fixture.
        const tablist = page.locator('#tabs-default [role="tablist"]');
        await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    });

    test('aria-orientation="vertical" is reflected to the tablist', async ({ page }) => {
        // Use the pre-rendered vertical fixture (fixture 2) rather than mutating
        // fixture 1 mid-test and racing against the re-render cycle.
        const tablist = page.locator('#tabs-vertical [role="tablist"]');
        await expect(tablist).toHaveAttribute('aria-orientation', 'vertical');
    });

    // ── Selection & aria-selected ─────────────────────────────────────────────

    test('first tab is selected by default', async ({ page }) => {
        // Scope to fixture 1 so we always look at the same element.
        const firstTab = page.locator('#tabs-default pap-tab').first();
        await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });

    test('non-active tabs have aria-selected="false"', async ({ page }) => {
        const tabs = await page.$$('#tabs-default pap-tab');
        // Skip index 0 (the active tab); all others must be false.
        for (let i = 1; i < tabs.length; i++)
        {
            const selected = await tabs[i].getAttribute('aria-selected');
            expect(selected).toBe('false');
        }
    });

    test('clicking a tab sets it as selected', async ({ page }) => {
        const tabs = await page.$$('#tabs-default pap-tab');
        if (tabs.length < 2) test.skip();

        await tabs[1].click();
        await expect(page.locator('#tabs-default pap-tab').nth(1))
            .toHaveAttribute('aria-selected', 'true');
    });

    test('clicking a tab deselects the previously active tab', async ({ page }) => {
        const tabs = await page.$$('#tabs-default pap-tab');
        if (tabs.length < 2) test.skip();

        await tabs[1].click();
        await expect(page.locator('#tabs-default pap-tab').first())
            .toHaveAttribute('aria-selected', 'false');
    });

    test('setting pap-tabs value attribute selects the matching tab', async ({ page }) => {
        // Use the isolated programmatic fixture so mutations don't affect other tests.
        const secondValue = await page.evaluate(() => {
            return document.querySelectorAll('#tabs-programmatic pap-tab')[1]
                ?.getAttribute('value') ?? null;
        });
        if (!secondValue) return test.skip();

        await page.evaluate((val) => {
            document.querySelector('#tabs-programmatic')?.setAttribute('value', val);
        }, secondValue);

        await expect(
            page.locator(`#tabs-programmatic pap-tab[value="${secondValue}"]`)
        ).toHaveAttribute('aria-selected', 'true');
    });

    // ── ARIA relationships ─────────────────────────────────────────────────────

    test('each pap-tab has an aria-controls attribute', async ({ page }) => {
        const tabs = await page.$$('#tabs-default pap-tab');
        for (const tab of tabs)
        {
            const controls = await tab.getAttribute('aria-controls');
            expect(controls).toBeTruthy();
        }
    });

    test('aria-controls on each tab points to an existing element id', async ({ page }) => {
        const tabs = await page.$$('#tabs-default pap-tab');
        for (const tab of tabs)
        {
            const controls = await tab.getAttribute('aria-controls');
            if (!controls) continue;

            // UUIDs may start with a digit, so `#uuid` is an invalid CSS selector.
            // Use getElementById instead of a CSS ID selector.
            const exists = await page.evaluate(
                (id) => document.getElementById(id) !== null,
                controls
            );
            expect(exists).toBe(true);
        }
    });

    test('each pap-tabpanel has an aria-labelledby attribute', async ({ page }) => {
        const panels = await page.$$('#tabs-default pap-tabpanel');
        for (const panel of panels)
        {
            const labelledBy = await panel.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
        }
    });

    test('aria-labelledby on each panel points to an existing element id', async ({ page }) => {
        const panels = await page.$$('#tabs-default pap-tabpanel');
        for (const panel of panels)
        {
            const labelledBy = await panel.getAttribute('aria-labelledby');
            if (!labelledBy) continue;

            // Same UUID caveat — use getElementById.
            const exists = await page.evaluate(
                (id) => document.getElementById(id) !== null,
                labelledBy
            );
            expect(exists).toBe(true);
        }
    });

    test('tab aria-controls and panel aria-labelledby are cross-referencing', async ({ page }) => {
        const pairs = await page.evaluate(() => {
            return Array.from(
                document.querySelectorAll('#tabs-default pap-tab')
            ).map(tab => ({
                tabId: tab.id,
                controls: tab.getAttribute('aria-controls'),
            }));
        });

        for (const { tabId, controls } of pairs)
        {
            if (!controls) continue;
            const labelledBy = await page.evaluate(
                (id) => document.getElementById(id)?.getAttribute('aria-labelledby'),
                controls
            );
            expect(labelledBy).toBe(tabId);
        }
    });

    // ── Keyboard interaction ───────────────────────────────────────────────────
    // https://www.w3.org/WAI/ARIA/apg/patterns/tabs/#keyboardinteraction

    test('Right Arrow moves focus to the next tab', async ({ page }) => {
        // Tab into the tablist (lands on the active tab), then press ArrowRight.
        await page.locator('#tabs-default pap-tab').first().focus();
        await page.keyboard.press('ArrowRight');

        const focused = await page.evaluate(
            () => document.activeElement?.getAttribute('value')
        );
        const secondValue = await page.evaluate(
            () => document.querySelectorAll('#tabs-default pap-tab')[1]?.getAttribute('value')
        );
        expect(focused).toBe(secondValue);
    });

    test('Left Arrow moves focus to the previous tab', async ({ page }) => {
        // Navigate to the second tab via keyboard so pap-group's internal
        // roving-tabindex state is consistent (avoids the focusin→select
        // side-effect that occurs when calling .focus() on an inactive tab directly).
        await page.locator('#tabs-default pap-tab').first().focus();
        await page.keyboard.press('ArrowRight'); // now on beta
        await page.keyboard.press('ArrowLeft'); // back to alpha

        const focused = await page.evaluate(
            () => document.activeElement?.getAttribute('value')
        );
        const firstValue = await page.evaluate(
            () => document.querySelector('#tabs-default pap-tab')?.getAttribute('value')
        );
        expect(focused).toBe(firstValue);
    });

    test('Tab key moves focus out of the tablist into the active panel', async ({ page }) => {
        await page.locator('#tabs-default pap-tab').first().focus();
        await page.keyboard.press('Tab');

        const activeRole = await page.evaluate(
            () => document.activeElement?.getAttribute('role')
        );
        expect(activeRole).not.toBe('tab');
    });

    // ── tabindex ───────────────────────────────────────────────────────────────

    test('tabs have tabindex attribute set', async ({ page }) => {
        const tabs = await page.$$('#tabs-default pap-tab');
        for (const tab of tabs)
        {
            const tabindex = await tab.getAttribute('tabindex');
            expect(tabindex).not.toBeNull();
        }
    });
});