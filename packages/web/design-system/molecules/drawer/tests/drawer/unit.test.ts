import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/drawer/');
});

test.describe("@papit/drawer unit tests", () => {
    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-drawer');
        expect(component).not.toBeNull();
    });

    test('closed by default', async ({ page }) => {
        const drawer = page.getByTestId('base-target');
        await expect(drawer).not.toHaveAttribute('open');
    });

    test('opens on toggle command', async ({ page }) => {
        await page.click('#trigger-right');
        const drawer = page.getByTestId('base-target');
        await expect(drawer).toHaveAttribute('open');
    });

    test('closes on close command', async ({ page }) => {
        await page.click('#trigger-right');
        await page.waitForTimeout(100);
        const drawer = page.getByTestId('base-target');
        await expect(drawer).toHaveAttribute('open');

        await page.click('#close-right');
        await page.waitForTimeout(100);
        await expect(drawer).not.toHaveAttribute('open');
    });

    test('toggle closes an already open drawer', async ({ page }) => {
        await page.click('#trigger-right');
        await page.waitForTimeout(100);
        const drawer = page.getByTestId('base-target');
        await expect(drawer).toHaveAttribute('open');

        await page.click('#trigger-right');
        await page.waitForTimeout(100);
        await expect(drawer).not.toHaveAttribute('open');
    });

    test('default placement is right', async ({ page }) => {
        const drawer = page.getByTestId('base-target');
        await expect(drawer).toHaveAttribute('placement', 'right');
    });

    test('left placement reflected', async ({ page }) => {
        const drawer = page.getByTestId('drawer-left');
        await expect(drawer).toHaveAttribute('placement', 'left');
    });

    test('top placement reflected', async ({ page }) => {
        const drawer = page.getByTestId('drawer-top');
        await expect(drawer).toHaveAttribute('placement', 'top');
    });

    test('bottom placement reflected', async ({ page }) => {
        const drawer = page.getByTestId('drawer-bottom');
        await expect(drawer).toHaveAttribute('placement', 'bottom');
    });

    test('opens imperatively via show()', async ({ page }) => {
        await page.evaluate(() => {
            (document.getElementById('base-target') as any).show();
        });
        const drawer = page.getByTestId('base-target');
        await expect(drawer).toHaveAttribute('open');
    });

    test('closes imperatively via close()', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.getElementById('base-target') as any;
            el.show();
            el.close();
        });
        const drawer = page.getByTestId('base-target');
        await expect(drawer).not.toHaveAttribute('open');
    });

    test('open command opens drawer', async ({ page }) => {
        // The button now uses command="show-modal"
        await page.click('button[commandfor="drawer-left"]');
        await page.waitForTimeout(100);
        const drawer = page.getByTestId('drawer-left');
        await expect(drawer).toHaveAttribute('open');
    });

    // Modal-specific tests using the modal-target drawer
    test.describe('modal drawer features', () => {
        test('panel is accessible as dialog role', async ({ page }) => {
            await page.click('#trigger-modal');
            await page.waitForTimeout(100);

            // Native dialog has implicit role="dialog", so check the element exists and is a dialog
            const hasDialogElement = await page.evaluate(() => {
                const drawer = document.querySelector('[data-testid="modal-target"]');
                if (drawer && drawer.shadowRoot)
                {
                    const dialog = drawer.shadowRoot.querySelector('dialog');
                    // Check that it's a dialog element (native role is implicit)
                    return dialog?.tagName === 'DIALOG';
                }
                return false;
            });
            expect(hasDialogElement).toBe(true);
        });

        test('panel has aria-modal', async ({ page }) => {
            await page.click('#trigger-modal');
            await page.waitForTimeout(100);

            const ariaModal = await page.evaluate(() => {
                const drawer = document.querySelector('[data-testid="modal-target"]');
                if (drawer && drawer.shadowRoot)
                {
                    const dialog = drawer.shadowRoot.querySelector('dialog');
                    return dialog?.getAttribute('aria-modal');
                }
                return null;
            });
            expect(ariaModal).toBe('true');
        });

        test('closes on Escape key', async ({ page }) => {
            await page.click('#trigger-modal');
            await page.waitForTimeout(100);
            const drawer = page.getByTestId('modal-target');
            await expect(drawer).toHaveAttribute('open');

            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            await expect(drawer).not.toHaveAttribute('open');
        });

        test('backdrop click closes drawer', async ({ page }) => {
            await page.click('#trigger-modal');
            await page.waitForTimeout(100);
            const drawer = page.getByTestId('modal-target');
            await expect(drawer).toHaveAttribute('open');

            // Click on backdrop (top-left corner of viewport)
            await page.mouse.click(5, 5);
            await page.waitForTimeout(200);
            await expect(drawer).not.toHaveAttribute('open');
        });

        test('close-on-outside-click=false prevents backdrop close', async ({ page }) => {
            // Set property before opening
            await page.evaluate(() => {
                const drawer = document.getElementById('modal-target') as any;
                drawer.closeoutsideclick = false;
            });

            await page.click('#trigger-modal');
            await page.waitForTimeout(100);
            const drawer = page.getByTestId('modal-target');
            await expect(drawer).toHaveAttribute('open');

            // Try to click backdrop
            await page.mouse.click(5, 5);
            await page.waitForTimeout(200);

            // Drawer should remain open
            await expect(drawer).toHaveAttribute('open');

            // Reset for other tests
            await page.evaluate(() => {
                const drawer = document.getElementById('modal-target') as any;
                drawer.closeoutsideclick = true;
            });
        });

        test('focus returns to trigger after close', async ({ page }) => {
            const triggerId = 'trigger-modal';

            await page.click(`#${triggerId}`);
            await page.waitForTimeout(100);

            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);

            const focusedId = await page.evaluate(() => document.activeElement?.id);
            expect(focusedId).toBe(triggerId);
        });
    });
});