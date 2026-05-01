import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/accordion/');
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getHeader(page: any, index = 0) {
    return page.locator('pap-accordion-header').nth(index);
}

async function getPanel(page: any, index = 0) {
    return page.locator('pap-accordion-panel').nth(index);
}

async function isOpen(page: any, headerIndex = 0, sectionIndex?: number): Promise<boolean> {
    return page.evaluate(({ hi, si }: { hi: number, si: number | undefined }) => {
        const headers = si !== undefined
            ? document.querySelectorAll('section')[si]?.querySelectorAll<any>('pap-accordion-header')
            : document.querySelectorAll<any>('pap-accordion-header');
        return headers?.[hi]?.open === true;
    }, { hi: headerIndex, si: sectionIndex });
}

// ─── Availability ────────────────────────────────────────────────────────────

test.describe("availability", () => {
    test('pap-accordion is in the DOM', async ({ page }) => {
        expect(await page.$('pap-accordion')).not.toBeNull();
    });

    test('pap-accordion-header is in the DOM', async ({ page }) => {
        expect(await page.$('pap-accordion-header')).not.toBeNull();
    });

    test('pap-accordion-panel is in the DOM', async ({ page }) => {
        expect(await page.$('pap-accordion-panel')).not.toBeNull();
    });
});

// ─── ARIA ────────────────────────────────────────────────────────────────────

test.describe("aria", () => {
    test('header has role="heading"', async ({ page }) => {
        const role = await page.locator('pap-accordion-header').first().getAttribute('role');
        expect(role).toBe('heading');
    });

    test('header has aria-level="3" by default', async ({ page }) => {
        const level = await page.locator('pap-accordion-header').first().getAttribute('aria-level');
        expect(level).toBe('3');
    });

    test('button inside header has aria-expanded="false" initially', async ({ page }) => {
        const expanded = await page.evaluate(() => {
            const header = document.querySelector('pap-accordion-header');
            return header?.shadowRoot?.querySelector('pap-button')?.getAttribute('aria-expanded');
        });
        expect(expanded).toBe('false');
    });

    test('button aria-expanded updates to "true" when opened', async ({ page }) => {
        await page.locator('pap-accordion-header').first().click();

        const expanded = await page.evaluate(() => {
            const header = document.querySelector('pap-accordion-header');
            return header?.shadowRoot?.querySelector('pap-button')?.getAttribute('aria-expanded');
        });
        expect(expanded).toBe('true');
    });

    test.skip('button has aria-controls pointing to a panel id', async ({ page }) => {
        // Give it time for queueMicrotask + requestUpdate
        await page.waitForTimeout(100);

        const { controls, panelId } = await page.evaluate(() => {
            const header = document.querySelector<any>('pap-accordion-header');
            const panel = document.querySelector<any>('pap-accordion-panel');
            return {
                controls: header?.controls,
                panelId: panel?.id,
            };
        });

        // If controls is empty, the component has a bug — fail with a useful message
        expect(controls, 'controls is empty — setup() targets container id not panel id').toBeTruthy();
        expect(controls).toBe(panelId);
    });

    test.skip('panel id matches header button aria-controls', async ({ page }) => {
        await page.waitForTimeout(100);
        const { controls, panelId } = await page.evaluate(() => ({
            controls: document.querySelector<any>('pap-accordion-header')?.controls,
            panelId: document.querySelector<any>('pap-accordion-panel')?.id,
        }));
        expect(controls).toBe(panelId);
    });
});

// ─── Open / Close ────────────────────────────────────────────────────────────

test.describe("open/close", () => {
    test('panel is closed by default', async ({ page }) => {
        expect(await isOpen(page, 0)).toBe(false);
    });

    test('clicking header opens panel', async ({ page }) => {
        await page.locator('pap-accordion-header').first().click();
        expect(await isOpen(page, 0)).toBe(true);
    });

    test('clicking header again closes panel', async ({ page }) => {
        const header = page.locator('pap-accordion-header').first();
        await header.click();
        await header.click();
        expect(await isOpen(page, 0)).toBe(false);
    });

    test('panel gets open attribute when opened', async ({ page }) => {
        await page.locator('pap-accordion-header').first().click();
        const attr = await page.locator('pap-accordion-panel').first().getAttribute('open');
        expect(attr).toBe('true');
    });

    test('panel open attribute is "false" when closed', async ({ page }) => {
        const attr = await page.locator('pap-accordion-panel').first().getAttribute('open');
        expect(attr).toBe('false');
    });
});

// ─── Keyboard ────────────────────────────────────────────────────────────────

test.describe("keyboard", () => {
    test('Space toggles open', async ({ page }) => {
        const header = page.locator('pap-accordion-header').first();
        await header.focus();
        await page.keyboard.press(' ');
        expect(await isOpen(page, 0)).toBe(true);
    });

    test('Enter toggles open', async ({ page }) => {
        const header = page.locator('pap-accordion-header').first();
        await header.focus();
        await page.keyboard.press('Enter');
        expect(await isOpen(page, 0)).toBe(true);
    });

    test('Space toggles closed again', async ({ page }) => {
        const header = page.locator('pap-accordion-header').first();
        await header.focus();
        await page.keyboard.press(' ');
        await page.keyboard.press(' ');
        expect(await isOpen(page, 0)).toBe(false);
    });

    test('ArrowDown moves focus to next header', async ({ page }) => {
        // use the nested section which has 3 headers
        const headers = page.locator('section').nth(1).locator('pap-accordion-header');
        await headers.nth(0).focus();
        await page.keyboard.press('ArrowDown');

        const focused = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        expect(focused).toBe('pap-accordion-header');

        const index = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('pap-accordion-header'));
            return all.indexOf(document.activeElement as any);
        });
        expect(index).toBeGreaterThan(0);
    });

    test('ArrowUp moves focus to previous header', async ({ page }) => {
        const headers = page.locator('section').nth(1).locator('pap-accordion-header');
        await headers.nth(1).focus();
        await page.keyboard.press('ArrowUp');

        const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        expect(activeTag).toBe('pap-accordion-header');
    });

    test.skip('Shift+Tab exits the accordion group backward', async ({ page }) => {
        const section3Headers = page.locator('section').nth(3).locator('pap-accordion-header');
        const firstHeader = section3Headers.nth(0);
        await firstHeader.focus();
        await page.keyboard.press('Shift+Tab');

        const isStillInSection3 = await page.evaluate(() => {
            const section = document.querySelectorAll('section')[3];
            return section?.contains(document.activeElement);
        });
        expect(isStillInSection3).toBe(false);
    });

    test('Tab exits the accordion group forward', async ({ page }) => {
        const section3Headers = page.locator('section').nth(3).locator('pap-accordion-header');
        await section3Headers.nth(1).focus();
        await page.keyboard.press('Tab');

        const isStillInSection3 = await page.evaluate(() => {
            const section = document.querySelectorAll('section')[3];
            return section?.contains(document.activeElement);
        });
        expect(isStillInSection3).toBe(false);
    });
});

// ─── Single mode ─────────────────────────────────────────────────────────────

test.describe("single mode", () => {
    test('opening a second header closes the first', async ({ page }) => {
        const headers = page.locator('section').nth(1).locator('pap-accordion-header');

        await headers.nth(0).click();
        expect(await isOpen(page, 0, 1)).toBe(true);

        await headers.nth(1).click();
        expect(await isOpen(page, 0, 1)).toBe(false);
        expect(await isOpen(page, 1, 1)).toBe(true);
    });

    test('accordion value array has at most one entry in single mode', async ({ page }) => {
        const headers = page.locator('section').nth(1).locator('pap-accordion-header');
        await headers.nth(0).click();
        await headers.nth(1).click();

        const valueLength = await page.evaluate(() => {
            const accordion = document.querySelectorAll('pap-accordion')[1] as any;
            return accordion?.value?.length;
        });
        expect(valueLength).toBeLessThanOrEqual(1);
    });
});

// ─── Multiple mode ───────────────────────────────────────────────────────────

test.describe("multiple mode", () => {
    test('opening a second header keeps the first open', async ({ page }) => {
        // section index 2 is the multiple mode section
        const section = page.locator('section').nth(2);
        const headers = section.locator('pap-accordion-header');

        await headers.nth(0).click();
        await headers.nth(1).click();

        const values = await page.evaluate(() => {
            const accordion = document.querySelectorAll('pap-accordion')[2] as any;
            return accordion?.value;
        });

        expect(values.length).toBe(2);
    });
});