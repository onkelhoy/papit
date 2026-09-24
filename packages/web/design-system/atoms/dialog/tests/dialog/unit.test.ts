import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/dialog/');
});

declare global {
    interface Window {
        EVENT_EMITTED: any;
        EVENTS: string[];
    }
}

test.describe("@papit/dialog unit tests", () => {

    // -------------------------------------------------------------------------
    // Presence
    // -------------------------------------------------------------------------

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-dialog');
        expect(component).not.toBeNull();
    });

    test('registers as custom element', async ({ page }) => {
        const isDefined = await page.evaluate(() =>
            customElements.get('pap-dialog') !== undefined
        );
        expect(isDefined).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Attributes / properties
    // -------------------------------------------------------------------------

    test('header attribute renders h1 text', async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).header = 'Test Header';
        });

        await page.waitForFunction(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('h1')?.textContent?.trim() === 'Test Header';
        });

        const headerText = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('h1')?.textContent?.trim();
        });

        expect(headerText).toBe('Test Header');
    });

    test('open attribute defaults to false', async ({ page }) => {
        const open = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog') as any;
            return dialog.open;
        });
        expect(open).toBe(false);
    });

    test('close-outside-click attribute defaults to false', async ({ page }) => {
        const val = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog') as any;
            return dialog.closeoutsideclick;
        });
        expect(val).toBe(false);
    });

    test('close-outside-click attribute can be set', async ({ page }) => {
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog') as any;
            dialog.setAttribute('close-outside-click', '');
        });

        const val = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog') as any;
            return dialog.closeoutsideclick;
        });
        expect(val).toBe(true);
    });

    // -------------------------------------------------------------------------
    // show() / close()
    // -------------------------------------------------------------------------

    test('show() opens the dialog as non-modal', async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).show();
        });

        const isOpen = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('dialog')?.open;
        });
        expect(isOpen).toBe(true);
    });

    test('show() sets open property to true', async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).show();
        });

        const open = await page.evaluate(() => {
            return (document.querySelector('pap-dialog') as any).open;
        });
        expect(open).toBe(true);
    });

    test('close() closes the dialog', async ({ page }) => {
        // open first
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).show();
        });

        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).close();
        });

        const isOpen = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('dialog')?.open;
        });
        expect(isOpen).toBe(false);
    });

    // -------------------------------------------------------------------------
    // showModal()
    // -------------------------------------------------------------------------

    test('showModal() opens the dialog as modal', async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).showModal();
        });

        const isOpen = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('dialog')?.open;
        });
        expect(isOpen).toBe(true);
    });

    test('showModal() sets open property to true', async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).showModal();
        });

        const open = await page.evaluate(() => {
            return (document.querySelector('pap-dialog') as any).open;
        });
        expect(open).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Built-in close button
    // -------------------------------------------------------------------------

    test('built-in close button is rendered in shadow DOM', async ({ page }) => {
        const button = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('button[aria-label="close"]') !== null;
        });
        expect(button).toBe(true);
    });

    test('built-in close button closes the dialog', async ({ page }) => {
        await page.evaluate(() => {
            (document.querySelector('pap-dialog') as any).show();
        });

        // Click the close button inside shadow DOM
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            const btn = dialog.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="close"]');
            btn?.click();
        });

        const isOpen = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('dialog')?.open;
        });
        expect(isOpen).toBe(false);
    });

    // -------------------------------------------------------------------------
    // command / commandfor API
    // -------------------------------------------------------------------------

    test('commandfor + command="show-modal" opens the dialog', async ({ page }) => {
        // Inject a trigger button that uses the commandfor pattern
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            dialog.id = 'cmd-dialog';

            const btn = document.createElement('button');
            btn.setAttribute('commandfor', 'cmd-dialog');
            btn.setAttribute('command', 'show-modal');
            document.body.appendChild(btn);

            // Re-connect so the component picks up the new ref
            dialog.remove();
            document.body.appendChild(dialog);

            btn.click();
        });

        const isOpen = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('dialog')?.open;
        });
        expect(isOpen).toBe(true);
    });

    test('commandfor + command="close" closes the dialog', async ({ page }) => {
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog') as any;
            dialog.id = 'cmd-dialog-close';
            dialog.showModal();
        });

        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            const closeBtn = document.createElement('button');
            closeBtn.setAttribute('commandfor', 'cmd-dialog-close');
            closeBtn.setAttribute('command', 'close');
            document.body.appendChild(closeBtn);

            dialog.remove();
            document.body.appendChild(dialog);

            closeBtn.click();
        });

        const isOpen = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('dialog')?.open;
        });
        expect(isOpen).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Events (open / close on the host)
    // -------------------------------------------------------------------------

    test.describe("events", () => {
        // the native close event is async, so give any double a chance to show up before asserting
        async function events(page: any, expected: string[]) {
            await page.waitForFunction((n: number) => window.EVENTS.filter(e => e.endsWith(":base-target")).length >= n, expected.length);
            await page.waitForTimeout(100);
            const recorded = await page.evaluate(() => window.EVENTS.filter(e => e.endsWith(":base-target")));
            expect(recorded).toEqual(expected);
        }

        test('nothing fires on the initial render', async ({ page }) => {
            await page.waitForFunction(() => customElements.get('pap-dialog') !== undefined);
            await page.waitForTimeout(100);
            expect(await page.evaluate(() => window.EVENTS)).toEqual([]);
        });

        test('nothing fires on the initial render of a parsed open dialog', async ({ page }) => {
            await page.evaluate(() => {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = '<pap-dialog data-testid="initial-open" open>initially open</pap-dialog>';
                document.body.appendChild(wrapper);
            });
            await page.waitForTimeout(100);
            expect(await page.getByTestId('initial-open').evaluate((el: any) => el.open)).toBe(true);
            expect(await page.evaluate(() => window.EVENTS)).toEqual([]);
        });

        test('showModal() fires open once', async ({ page }) => {
            await page.getByTestId('base-target').evaluate((el: any) => el.showModal());
            await events(page, ['open:base-target']);
        });

        test('show() fires open once', async ({ page }) => {
            await page.getByTestId('base-target').evaluate((el: any) => el.show());
            await events(page, ['open:base-target']);
        });

        test('close() fires close once', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.showModal());
            await target.evaluate((el: any) => el.close());
            await events(page, ['open:base-target', 'close:base-target']);
        });

        test('setting the open property fires open and close once each', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.open = true);
            await events(page, ['open:base-target']);
            await target.evaluate((el: any) => el.open = false);
            await events(page, ['open:base-target', 'close:base-target']);
        });

        test('native Escape on a modal fires close once', async ({ page }) => {
            await page.getByTestId('base-target').evaluate((el: any) => el.showModal());
            await events(page, ['open:base-target']);
            await page.keyboard.press('Escape');
            await events(page, ['open:base-target', 'close:base-target']);
        });

        test('backdrop click with close-outside-click fires close once', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => {
                el.setAttribute('close-outside-click', '');
                el.showModal();
            });
            await events(page, ['open:base-target']);
            await page.mouse.click(2, 2);
            await events(page, ['open:base-target', 'close:base-target']);
            expect(await target.evaluate((el: any) => el.open)).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // open property / attribute
    // -------------------------------------------------------------------------

    test.describe("open property", () => {
        const inner = (el: any) => {
            const dialog = el.shadowRoot.querySelector('dialog');
            return { open: dialog.open, modal: dialog.matches(':modal') };
        };

        test('open = true on a modal dialog opens it modally', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.open = true);
            expect(await target.evaluate(inner)).toEqual({ open: true, modal: true });
        });

        test('open attribute on a modal dialog opens it modally', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.setAttribute('open', ''));
            expect(await target.evaluate(inner)).toEqual({ open: true, modal: true });
        });

        test('Escape closes a dialog opened through the open property', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.open = true);
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => (document.querySelector('[data-testid="base-target"]') as any).open === false);
            expect(await target.evaluate(inner)).toEqual({ open: false, modal: false });
        });

        test('open = false closes a modally opened dialog', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.open = true);
            await target.evaluate((el: any) => el.open = false);
            expect(await target.evaluate(inner)).toEqual({ open: false, modal: false });
        });

        test('open = true on a non-modal dialog opens it with show()', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => {
                el.ismodal = false;
                el.open = true;
            });
            expect(await target.evaluate(inner)).toEqual({ open: true, modal: false });
        });

        test('parsed open attribute opens modally on first render and Escape closes it', async ({ page }) => {
            await page.evaluate(() => {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = '<pap-dialog data-testid="parsed-open" open>initially open</pap-dialog>';
                document.body.appendChild(wrapper);
            });
            const target = page.getByTestId('parsed-open');
            await page.waitForFunction(() => (document.querySelector('[data-testid="parsed-open"]') as any)?.shadowRoot?.querySelector('dialog'));
            expect(await target.evaluate(inner)).toEqual({ open: true, modal: true });
            expect(await page.evaluate(() => window.EVENTS)).toEqual([]);

            await page.keyboard.press('Escape');
            await page.waitForFunction(() => (document.querySelector('[data-testid="parsed-open"]') as any).open === false);
            expect(await target.evaluate(inner)).toEqual({ open: false, modal: false });
        });

        test('open = true after close() opens the dialog again', async ({ page }) => {
            const target = page.getByTestId('base-target');
            await target.evaluate((el: any) => el.showModal());
            await target.evaluate((el: any) => el.close());
            // let the native close event settle
            await page.waitForTimeout(100);
            await target.evaluate((el: any) => el.open = true);
            expect(await target.evaluate(inner)).toEqual({ open: true, modal: true });
        });
    });

    // -------------------------------------------------------------------------
    // Slots
    // -------------------------------------------------------------------------

    test('default slot renders content in main area', async ({ page }) => {
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            const p = document.createElement('p');
            p.textContent = 'Main content';
            dialog.appendChild(p);
        });

        const text = await page.$eval('pap-dialog p', el => el.textContent);
        expect(text).toBe('Main content');
    });

    test('header slot overrides header attribute', async ({ page }) => {
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog') as any;
            dialog.header = 'Attribute Header';

            const slotContent = document.createElement('span');
            slotContent.slot = 'header';
            slotContent.textContent = 'Slot Header';
            dialog.appendChild(slotContent);
        });

        // The h1 from the attribute should not be rendered when slot is filled
        const h1 = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('h1')?.textContent ?? null;
        });
        expect(h1).toBeNull();

        const slotText = await page.$eval('pap-dialog [slot="header"]', el => el.textContent);
        expect(slotText).toBe('Slot Header');
    });

    test('footer slot renders footer content', async ({ page }) => {
        await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            const btn = document.createElement('button');
            btn.slot = 'footer';
            btn.textContent = 'Confirm';
            dialog.appendChild(btn);
        });

        const text = await page.$eval('pap-dialog [slot="footer"]', el => el.textContent);
        expect(text).toBe('Confirm');
    });

    // -------------------------------------------------------------------------
    // CSS Parts
    // -------------------------------------------------------------------------

    test('dialog part is exposed', async ({ page }) => {
        const hasPart = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('[part="dialog"]') !== null;
        });
        expect(hasPart).toBe(true);
    });

    test('header part is exposed', async ({ page }) => {
        const hasPart = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('[part="header"]') !== null;
        });
        expect(hasPart).toBe(true);
    });

    test('main part is exposed', async ({ page }) => {
        const hasPart = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('[part="main"]') !== null;
        });
        expect(hasPart).toBe(true);
    });

    test('footer part is exposed', async ({ page }) => {
        const hasPart = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot?.querySelector('[part="footer"]') !== null;
        });
        expect(hasPart).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Accessibility
    // -------------------------------------------------------------------------

    test('dialog is named by the header attribute', async ({ page }) => {
        await page.getByTestId('base-target').evaluate((el: any) => {
            el.header = 'Confirm';
            el.showModal();
        });
        await expect(page.getByRole('dialog', { name: 'Confirm' })).toBeVisible();
    });

    test('dialog is named by a slotted header', async ({ page }) => {
        await page.getByTestId('base-target').evaluate((el: any) => {
            const title = document.createElement('h2');
            title.slot = 'header';
            title.textContent = 'Confirm';
            el.appendChild(title);
            el.showModal();
        });
        await expect(page.getByRole('dialog', { name: 'Confirm' })).toBeVisible();
    });

    test('close button has aria-label="close"', async ({ page }) => {
        const label = await page.evaluate(() => {
            const dialog = document.querySelector('pap-dialog')!;
            return dialog.shadowRoot
                ?.querySelector('button[aria-label="close"]')
                ?.getAttribute('aria-label');
        });
        expect(label).toBe('close');
    });
});