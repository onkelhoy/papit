import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/group/');
});

test.describe("@papit/group unit tests", () => {
    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-group');
        expect(component).not.toBeNull();
    });

    test.describe("focus", () => {
        test('focus on host delegates to first element', async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('host tabIndex becomes -1 after focus', async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
            const tabIndex = await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.tabIndex);
            expect(tabIndex).toBe(-1);
        });

        test('host tabIndex restores to 0 when focus leaves group', async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
            await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="outside"]')?.focus());
            const tabIndex = await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.tabIndex);
            expect(tabIndex).toBe(0);
        });

        test('re-focusing group restores last active element', async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
            await page.keyboard.press('ArrowRight');
            await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="outside"]')?.focus());
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-1');
        });
    });

    test.describe("keyboard navigation", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('ArrowRight moves to next element', async ({ page }) => {
            await page.keyboard.press('ArrowRight');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-1');
        });

        test('ArrowLeft moves to previous element', async ({ page }) => {
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('Home moves to first element', async ({ page }) => {
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('Home');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('End moves to last element', async ({ page }) => {
            await page.keyboard.press('End');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-2');
        });
    });

    test.describe("loop", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('loops from last to first', async ({ page }) => {
            await page.keyboard.press('End');
            await page.keyboard.press('ArrowRight');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('loops from first to last', async ({ page }) => {
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-2');
        });

        test('does not loop when loop=false', async ({ page }) => {
            await page.evaluate(() => {
                const group = document.querySelector<HTMLElement>('pap-group');
                if (group) group.setAttribute('loop', 'false');
            });
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });
    });

    test.describe("disabled", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('skips disabled element going forward', async ({ page }) => {
            await page.evaluate(() => {
                document.querySelector('[data-testid="item-1"]')?.setAttribute('disabled', '');
            });
            await page.keyboard.press('ArrowRight');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-2');
        });

        test('skips disabled element going backward', async ({ page }) => {
            await page.evaluate(() => {
                document.querySelector('[data-testid="item-1"]')?.setAttribute('disabled', '');
            });
            await page.keyboard.press('End');
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });
    });

    test.describe("orientation: vertical", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => {
                document.querySelector('pap-group')?.setAttribute('aria-orientation', 'vertical');
            });
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('ArrowDown moves to next', async ({ page }) => {
            await page.keyboard.press('ArrowDown');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-1');
        });

        test('ArrowUp moves to previous', async ({ page }) => {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowUp');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('ArrowRight does nothing in vertical mode', async ({ page }) => {
            await page.keyboard.press('ArrowRight');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('ArrowLeft does nothing in vertical mode', async ({ page }) => {
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });
    });

    test.describe("disabled arrow keys", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('ArrowRight does nothing when right=false', async ({ page }) => {
            await page.evaluate(() => document.querySelector('pap-group')?.setAttribute('right', 'false'));
            await page.keyboard.press('ArrowRight');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });

        test('ArrowLeft does nothing when left=false', async ({ page }) => {
            await page.keyboard.press('ArrowRight'); // move to item-1 first
            await page.evaluate(() => document.querySelector('pap-group')?.setAttribute('left', 'false'));
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-1');
        });

        test('Home does nothing when home=false', async ({ page }) => {
            await page.keyboard.press('ArrowRight');
            await page.evaluate(() => document.querySelector('pap-group')?.setAttribute('home', 'false'));
            await page.keyboard.press('Home');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-1');
        });

        test('End does nothing when end=false', async ({ page }) => {
            await page.evaluate(() => document.querySelector('pap-group')?.setAttribute('end', 'false'));
            await page.keyboard.press('End');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });
    });

    test.describe("all arrow keys enabled", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => {
                const group = document.querySelector('pap-group');
                if (!group) return;
                group.setAttribute('up', 'true');
                group.setAttribute('down', 'true');
                group.setAttribute('left', 'true');
                group.setAttribute('right', 'true');
            });
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('ArrowDown moves to next', async ({ page }) => {
            await page.keyboard.press('ArrowDown');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-1');
        });

        test('ArrowUp moves to previous', async ({ page }) => {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowUp');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });
    });

    test.describe("loop disabled", () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(() => document.querySelector('pap-group')?.removeAttribute('loop'));
            await page.evaluate(() => document.querySelector<HTMLElement>('pap-group')?.focus());
        });

        test('does not loop forward from last', async ({ page }) => {
            await page.keyboard.press('End');
            await page.keyboard.press('ArrowRight');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-2');
        });

        test('does not loop backward from first', async ({ page }) => {
            await page.keyboard.press('ArrowLeft');
            const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            expect(focused).toBe('item-0');
        });
    });
});