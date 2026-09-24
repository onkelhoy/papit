import { test, expect } from '@playwright/test';

declare global {
    interface Window {
        EVENTS: string[];
    }
}

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

    test.describe('modality and events', () => {
        const inner = (el: any) => {
            const dialog = el.shadowRoot.querySelector('dialog');
            return { open: dialog.open, modal: dialog.matches(':modal') };
        };

        test('static drawer opened with toggle is modal, Escape closes it and fires close', async ({ page }) => {
            const drawer = page.getByTestId('modal-target');
            await page.click('#trigger-modal');
            expect(await drawer.evaluate(inner)).toEqual({ open: true, modal: true });

            await page.keyboard.press('Escape');
            await page.waitForFunction(() => (document.getElementById('modal-target') as any).open === false);
            await page.waitForTimeout(100);
            expect(await drawer.evaluate(inner)).toEqual({ open: false, modal: false });
            expect(await page.evaluate(() => window.EVENTS)).toEqual(['open:modal-target', 'close:modal-target']);
        });

        test('static drawer opened with show() is modal', async ({ page }) => {
            const drawer = page.getByTestId('modal-target');
            await drawer.evaluate((el: any) => el.show());
            expect(await drawer.evaluate(inner)).toEqual({ open: true, modal: true });
        });

        test('static drawer opened with open = true is modal', async ({ page }) => {
            const drawer = page.getByTestId('modal-target');
            await drawer.evaluate((el: any) => el.open = true);
            expect(await drawer.evaluate(inner)).toEqual({ open: true, modal: true });
        });

        test('parsed static open drawer is modal on first render', async ({ page }) => {
            await page.evaluate(() => {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = '<pap-drawer id="parsed-open" data-testid="parsed-open" static open>parsed</pap-drawer>';
                document.body.appendChild(wrapper);
            });
            await page.waitForFunction(() => document.getElementById('parsed-open')?.shadowRoot?.querySelector('dialog'));
            expect(await page.getByTestId('parsed-open').evaluate(inner)).toEqual({ open: true, modal: true });
            expect(await page.evaluate(() => window.EVENTS)).toEqual([]);
        });

        test('default drawer opens non-modally', async ({ page }) => {
            const drawer = page.getByTestId('base-target');
            await page.click('#trigger-right');
            expect(await drawer.evaluate(inner)).toEqual({ open: true, modal: false });
        });

        test('open and close fire once on the host', async ({ page }) => {
            const drawer = page.getByTestId('base-target');
            await drawer.evaluate((el: any) => el.show());
            await drawer.evaluate((el: any) => el.close());
            await page.waitForTimeout(100);
            expect(await page.evaluate(() => window.EVENTS)).toEqual(['open:base-target', 'close:base-target']);
        });
    });

    test.describe('accessible name', () => {
        test('panel aria-label defaults to "drawer" with no aria-labelledby', async ({ page }) => {
            const panel = page.getByTestId('base-target').locator('dialog');
            await expect(panel).toHaveAttribute('aria-label', 'drawer');
            await expect(panel).not.toHaveAttribute('aria-labelledby');
        });

        test('panel aria-label comes from label and updates when it changes', async ({ page }) => {
            const drawer = page.getByTestId('base-target');
            await drawer.evaluate((el: any) => el.label = 'Settings');
            await expect(drawer.locator('dialog')).toHaveAttribute('aria-label', 'Settings');
            await drawer.evaluate((el: any) => el.setAttribute('label', 'Filters'));
            await expect(drawer.locator('dialog')).toHaveAttribute('aria-label', 'Filters');
        });

        test('open drawer is found by its label', async ({ page }) => {
            await page.getByTestId('modal-target').evaluate((el: any) => {
                el.label = 'Settings';
                el.show();
            });
            await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
        });
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