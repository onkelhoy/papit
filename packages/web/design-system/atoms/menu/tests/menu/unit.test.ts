import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/menu/');
});

declare global {
    interface Window {
        EVENT_EMITTED: any;
    }
}

test.describe("@papit/menu menu unit tests", () => {

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-menu');
        expect(component).not.toBeNull();
    });

    test('has correct role', async ({ page }) => {
        const role = await page.$eval('pap-menu', el => el.getAttribute('role'));
        expect(role).toBe('menu');
    });

    test('has popover attribute', async ({ page }) => {
        const popover = await page.$eval('pap-menu', el => el.getAttribute('popover'));
        expect(popover).toBe('auto');
    });

    test('has an id', async ({ page }) => {
        const id = await page.$eval('pap-menu', el => el.id);
        expect(id).toBeTruthy();
    });

    test.describe("trigger wiring", () => {

        test('trigger receives popovertarget attribute', async ({ page }) => {
            const menuId = await page.$eval('pap-menu[data-testid="with-trigger"]', el => el.id);
            const triggerTarget = await page.$eval('button[data-testid="trigger"]', el => el.getAttribute('popovertarget'));
            expect(triggerTarget).toBe(menuId);
        });

        test.skip('trigger receives anchor-name style', async ({ page }) => {
            const anchorName = await page.$eval('button[data-testid="trigger"]', el => el.style.getPropertyValue('anchor-name'));
            expect(anchorName).toBeTruthy();
        });

        test('menu receives aria-labelledby pointing to trigger', async ({ page }) => {
            const triggerId = await page.$eval('button[data-testid="trigger"]', el => el.id);
            const labelledby = await page.$eval('pap-menu[data-testid="with-trigger"]', el => el.getAttribute('aria-labelledby'));
            expect(labelledby).toBe(triggerId);
        });

        test('trigger has aria-expanded false initially', async ({ page }) => {
            const expanded = await page.$eval('button[data-testid="trigger"]', el => el.getAttribute('aria-expanded'));
            expect(expanded).toBe('false');
        });

    });

    test.describe("open / close", () => {

        test('opens when trigger is clicked', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            const isOpen = await page.$eval('pap-menu[data-testid="with-trigger"]', el => el.matches(':popover-open'));
            expect(isOpen).toBe(true);
        });

        test('sets aria-expanded to true when open', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            const expanded = await page.$eval('button[data-testid="trigger"]', el => el.getAttribute('aria-expanded'));
            expect(expanded).toBe('true');
        });

        test('closes on Escape', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('Escape');
            const isOpen = await page.$eval('pap-menu[data-testid="with-trigger"]', el => el.matches(':popover-open'));
            expect(isOpen).toBe(false);
        });

        test('sets aria-expanded to false when closed', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('Escape');
            const expanded = await page.$eval('button[data-testid="trigger"]', el => el.getAttribute('aria-expanded'));
            expect(expanded).toBe('false');
        });

        test('returns focus to trigger when closed via Escape', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('Escape');
            await expect(page.locator('button[data-testid="trigger"]')).toBeFocused();
        });

        test('closes and returns focus to trigger on focusout', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.locator('button[data-testid="outside"]').focus();
            const isOpen = await page.$eval('pap-menu[data-testid="with-trigger"]', el => el.matches(':popover-open'));
            expect(isOpen).toBe(false);
        });

    });

    test.describe("focus management", () => {

        test('focuses first item when opened', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await expect(page.locator('pap-menu[data-testid="with-trigger"] pap-menuitem').first()).toBeFocused();
        });

        test('navigates down with ArrowDown', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('ArrowDown');
            await expect(page.locator('pap-menu[data-testid="with-trigger"] pap-menuitem').nth(1)).toBeFocused();
        });

        test('navigates up with ArrowUp', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowUp');
            await expect(page.locator('pap-menu[data-testid="with-trigger"] pap-menuitem').first()).toBeFocused();
        });

        test('focuses first item with Home', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Home');
            await expect(page.locator('pap-menu[data-testid="with-trigger"] pap-menuitem').first()).toBeFocused();
        });

        test('focuses last item with End', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.keyboard.press('End');
            await expect(page.locator('pap-menu[data-testid="with-trigger"] pap-menuitem').last()).toBeFocused();
        });

    });

    test.describe("nested menu", () => {

        test('submenu trigger has aria-haspopup', async ({ page }) => {
            const haspopup = await page.$eval('pap-menuitem[data-testid="submenu-trigger"]', el => el.getAttribute('aria-haspopup'));
            expect(haspopup).toBe('menu');
        });

        test('submenu trigger has aria-expanded false initially', async ({ page }) => {
            const expanded = await page.$eval('pap-menuitem[data-testid="submenu-trigger"]', el => el.getAttribute('aria-expanded'));
            expect(expanded).toBe('false');
        });

        test('opens submenu on ArrowRight', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.locator('pap-menuitem[data-testid="submenu-trigger"]').focus();
            await page.keyboard.press('ArrowRight');
            const isOpen = await page.$eval('pap-menu[data-testid="submenu"]', el => el.matches(':popover-open'));
            expect(isOpen).toBe(true);
        });

        test('focuses first item in submenu when opened', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.locator('pap-menuitem[data-testid="submenu-trigger"]').focus();
            await page.keyboard.press('ArrowRight');
            await expect(page.locator('pap-menu[data-testid="submenu"] pap-menuitem').first()).toBeFocused();
        });

        test('parent menu stays open while submenu is open', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.locator('pap-menuitem[data-testid="submenu-trigger"]').focus();
            await page.keyboard.press('ArrowRight');
            const isOpen = await page.$eval('pap-menu[data-testid="with-trigger"]', el => el.matches(':popover-open'));
            expect(isOpen).toBe(true);
        });

        test('ArrowDown in submenu does not move parent menu focus', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.locator('pap-menuitem[data-testid="submenu-trigger"]').focus();
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('ArrowDown');
            await expect(page.locator('pap-menuitem[data-testid="submenu-trigger"]')).not.toBeFocused();
        });

        test('closes submenu on ArrowLeft and returns focus to parent item', async ({ page }) => {
            await page.click('button[data-testid="trigger"]');
            await page.waitForTimeout(1000);
            await page.locator('pap-menuitem[data-testid="submenu-trigger"]').focus();
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('ArrowLeft');
            const isOpen = await page.$eval('pap-menu[data-testid="submenu"]', el => el.matches(':popover-open'));
            expect(isOpen).toBe(false);
            await expect(page.locator('pap-menuitem[data-testid="submenu-trigger"]')).toBeFocused();
        });

    });

});