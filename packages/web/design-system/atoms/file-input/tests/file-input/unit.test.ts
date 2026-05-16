import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/file-input/');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inline file — no fixture files or __dirname needed */
const txtFile = (name = 'sample.txt') => ({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('hello world'),
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test.describe("Rendering", () => {
    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-file-input');
        expect(component).not.toBeNull();
    });

    test('renders upload button', async ({ page }) => {
        const button = page.locator('pap-file-input[data-testid="base-target"]').locator('[part="button"]');
        await expect(button).toBeVisible();
    });

    test('hides native input visually', async ({ page }) => {
        const input = page.locator('pap-file-input[data-testid="base-target"]').locator('[part="input"]');
        await expect(input).toBeAttached();
        await expect(input).toBeHidden();
    });

    test('dropzone not visible by default', async ({ page }) => {
        const dropzone = page.locator('pap-file-input[data-testid="base-target"]').locator('[part="dropzone"]');
        await expect(dropzone).toBeHidden();
    });

    test('dropzone visible when attribute set', async ({ page }) => {
        const dropzone = page.locator('pap-file-input[data-testid="dropzone-target"]').locator('[part="dropzone"]');
        await expect(dropzone).toBeVisible();
    });

    test('indicator not rendered by default', async ({ page }) => {
        const indicator = page.locator('pap-file-input[data-testid="base-target"]').locator('[part="indicator"]');
        await expect(indicator).not.toBeAttached();
    });

    test('indicator rendered when attribute set', async ({ page }) => {
        const indicator = page.locator('pap-file-input[data-testid="indicator-target"]').locator('[part="indicator"]');
        await expect(indicator).toBeAttached();
    });
});

// ---------------------------------------------------------------------------
// File selection
// ---------------------------------------------------------------------------

test.describe("File selection", () => {
    test('selecting a file shows it in the indicator', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');

        await component.locator('[part="input"]').setInputFiles(txtFile());

        const link = component.locator('[part="link"]');
        await expect(link).toBeVisible();
        await expect(link).toContainText('sample.txt');
    });

    test('selecting a file dispatches change event', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');

        const eventFired = page.evaluate(() =>
            new Promise<boolean>(resolve => {
                document
                    .querySelector('pap-file-input[data-testid="indicator-target"]')
                    ?.addEventListener('change', () => resolve(true), { once: true });
            })
        );

        await component.locator('[part="input"]').setInputFiles(txtFile());
        expect(await eventFired).toBe(true);
    });

    test('duplicate files are not added twice', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');
        const input = component.locator('[part="input"]');

        await input.setInputFiles(txtFile('dup.txt'));
        await input.setInputFiles(txtFile('dup.txt'));

        await expect(component.locator('[part="link"]')).toHaveCount(1);
    });

    test('multiple files added when multiple attribute set', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="multiple-target"]');

        await component.locator('[part="input"]').setInputFiles([
            txtFile('a.txt'),
            txtFile('b.txt'),
        ]);

        await expect(component.locator('[part="link"]')).toHaveCount(2);
    });

    test('native input carries multiple attribute', async ({ page }) => {
        const input = page.locator('pap-file-input[data-testid="multiple-target"]').locator('[part="input"]');
        await expect(input).toHaveAttribute('multiple', '');
    });

    test('native input carries accept attribute', async ({ page }) => {
        const input = page.locator('pap-file-input[data-testid="accept-target"]').locator('[part="input"]');
        await expect(input).toHaveAttribute('accept', 'image/*');
    });
});

// ---------------------------------------------------------------------------
// File deletion
// ---------------------------------------------------------------------------

test.describe("File deletion", () => {
    test('deleting a file removes it from the indicator', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');
        await component.locator('[part="input"]').setInputFiles(txtFile());

        await component.locator('pap-button[aria-label*="delete"]').first().click();

        await expect(component.locator('[part="link"]')).toHaveCount(0);
    });

    test('deleting a file dispatches change event', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');
        await component.locator('[part="input"]').setInputFiles(txtFile());

        const eventFired = page.evaluate(() =>
            new Promise<boolean>(resolve => {
                document
                    .querySelector('pap-file-input[data-testid="indicator-target"]')
                    ?.addEventListener('change', () => resolve(true), { once: true });
            })
        );

        await component.locator('pap-button[aria-label*="delete"]').first().click();
        expect(await eventFired).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// File size
// ---------------------------------------------------------------------------

test.describe("File size formatting", () => {
    test('displays file size after selection', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');
        await component.locator('[part="input"]').setInputFiles(txtFile());

        const size = component.locator('[aria-label="file size"]').first();
        await expect(size).toBeVisible();
        await expect(size).not.toBeEmpty();
    });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test.describe("Accessibility", () => {
    test('label is associated with input via for/id', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="base-target"]');
        await expect(component.locator('label')).toHaveAttribute('for', 'input');
        await expect(component.locator('#input')).toBeAttached();
    });

    test('indicator has aria-live="polite"', async ({ page }) => {
        const indicator = page.locator('pap-file-input[data-testid="indicator-target"]').locator('[part="indicator"]');
        await expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    test.skip('delete button aria-label includes filename', async ({ page }) => {
        // problem with loading the translation it seems 
        await page.waitForTimeout(8000);
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');

        const html = await component.evaluate(el => {
            return el.shadowRoot?.innerHTML;
        });

        console.log(html);

        await component.locator('[part="input"]').setInputFiles(txtFile('report.pdf'));

        await expect(component.locator('pap-button[aria-label*="report.pdf"]')).toBeAttached();
    });

    test('file link opens in new tab', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');
        await component.locator('[part="input"]').setInputFiles(txtFile());

        await expect(component.locator('[part="link"]').first()).toHaveAttribute('target', '_blank');
    });

    test('file link has blob href', async ({ page }) => {
        const component = page.locator('pap-file-input[data-testid="indicator-target"]');
        await component.locator('[part="input"]').setInputFiles(txtFile());

        const href = await component.locator('[part="link"]').first().getAttribute('href');
        expect(href).toMatch(/^blob:/);
    });
});