import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/menuitem/');
});

declare global {
    interface Window {
        EVENT_EMITTED: any;
    }
}

test.describe("@papit/menu menuitem unit tests", () => {

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-menuitem');
        expect(component).not.toBeNull();
    });

    test('has correct default role', async ({ page }) => {
        const role = await page.$eval('pap-menuitem', el => el.getAttribute('role'));
        expect(role).toBe('menuitem');
    });

    test('respects custom role attribute', async ({ page }) => {
        const role = await page.$eval('pap-menuitem[role="menuitemcheckbox"]', el => el.getAttribute('role'));
        expect(role).toBe('menuitemcheckbox');
    });

    test('is focusable', async ({ page }) => {
        const item = page.locator('pap-menuitem').first();
        await item.focus();
        await expect(item).toBeFocused();
    });

    test('has tabindex 0', async ({ page }) => {
        const tabindex = await page.$eval('pap-menuitem', el => el.tabIndex);
        expect(tabindex).toBe(0);
    });

    test.describe("submenu trigger", () => {

        test('detects slotted pap-menu and sets aria-haspopup', async ({ page }) => {
            const haspopup = await page.$eval('pap-menuitem[data-testid="with-submenu"]', el => el.getAttribute('aria-haspopup'));
            expect(haspopup).toBe('menu');
        });

        test('sets aria-expanded to false when submenu is closed', async ({ page }) => {
            const expanded = await page.$eval('pap-menuitem[data-testid="with-submenu"]', el => el.getAttribute('aria-expanded'));
            expect(expanded).toBe('false');
        });

        test('opens submenu on ArrowRight', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="with-submenu"]');
            await item.focus();
            await item.press('ArrowRight');
            const submenu = page.locator('pap-menuitem[data-testid="with-submenu"] pap-menu');
            await expect(submenu).toHaveAttribute('popover');
            const isOpen = await submenu.evaluate(el => el.matches(':popover-open'));
            expect(isOpen).toBe(true);
        });

        test('closes submenu on ArrowLeft', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="with-submenu"]');
            await item.focus();
            await item.press('ArrowRight');
            await item.press('ArrowLeft');
            const submenu = page.locator('pap-menuitem[data-testid="with-submenu"] pap-menu');
            const isOpen = await submenu.evaluate(el => el.matches(':popover-open'));
            expect(isOpen).toBe(false);
        });

        test('returns focus to item after ArrowLeft closes submenu', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="with-submenu"]');
            await item.focus();
            await item.press('ArrowRight');
            await item.press('ArrowLeft');
            await expect(item).toBeFocused();
        });

        test('opens submenu on Enter', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="with-submenu"]');
            await item.focus();
            await item.press('Enter');
            const submenu = page.locator('pap-menuitem[data-testid="with-submenu"] pap-menu');
            const isOpen = await submenu.evaluate(el => el.matches(':popover-open'));
            expect(isOpen).toBe(true);
        });

        test('opens submenu on click', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="with-submenu"]');
            await item.click();
            const submenu = page.locator('pap-menuitem[data-testid="with-submenu"] pap-menu');
            const isOpen = await submenu.evaluate(el => el.matches(':popover-open'));
            expect(isOpen).toBe(true);
        });
    });

    test.describe("leaf item", () => {

        test('dispatches click on Enter', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="leaf"]');
            await page.evaluate(() => {
                window.EVENT_EMITTED = null;
                const target = document.querySelector<HTMLElement>('pap-menuitem[data-testid="leaf"]');
                if (!target) return;
                target.addEventListener('click', () => {
                    window.EVENT_EMITTED = true;
                });
            });
            await item.focus();
            await item.press('Enter');
            expect(await page.evaluate(() => window.EVENT_EMITTED)).toBeTruthy();
        });

        test('dispatches click on Space', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="leaf"]');
            await page.evaluate(() => {
                window.EVENT_EMITTED = null;
                const target = document.querySelector<HTMLElement>('pap-menuitem[data-testid="leaf"]');
                if (!target) return;
                target.addEventListener('click', () => {
                    window.EVENT_EMITTED = true;
                });
            });
            await item.focus();
            await item.press('Space');
            expect(await page.evaluate(() => window.EVENT_EMITTED)).toBeTruthy();
        });

        test('does not have aria-haspopup', async ({ page }) => {
            const haspopup = await page.$eval('pap-menuitem[data-testid="leaf"]', el => el.getAttribute('aria-haspopup'));
            expect(haspopup).toBeNull();
        });

        test('ArrowRight does nothing', async ({ page }) => {
            const item = page.locator('pap-menuitem[data-testid="leaf"]');
            await item.focus();
            await item.press('ArrowRight');
            await expect(item).toBeFocused();
        });
    });
});