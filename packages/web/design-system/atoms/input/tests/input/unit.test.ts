import { test, expect, type Locator, type Page } from '@playwright/test';

// Playwright computes accessible names itself and doesn't follow element references
// (ariaLabelledByElements), so these read the references, and on chromium the real tree
async function referenced(host: Locator) {
    return host.evaluate((el: any) => {
        const input = el.shadowRoot.querySelector('input');
        const text = (elements: Element[] | null) => (elements ?? []).map(element => element.textContent?.trim());
        return { labelledby: text(input.ariaLabelledByElements), describedby: text(input.ariaDescribedByElements) };
    });
}

async function accessible(page: Page, testid: string) {
    const cdp = await page.context().newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', {
        expression: `document.querySelector('[data-testid="${testid}"]').shadowRoot.querySelector('input')`,
    });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
    return { name: nodes[0].name?.value ?? '', description: nodes[0].description?.value ?? '' };
}

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/input/');
});

test.describe("@papit/input unit tests", () => {
    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-input');
        expect(component).not.toBeNull();
    });

    test('typing sets value', async ({ page }) => {
        const component = page.locator('[data-testid="base-target"]');
        const input = component.locator('input');

        await input.fill('hello');
        await expect(input).toHaveValue('hello');
    });

    test('format masks input', async ({ page }) => {
        const component = page.locator('[data-testid="format-target"]');
        const input = component.locator('input');

        await input.pressSequentially('5551234567');
        await expect(input).toHaveValue('(555) 123-4567');
    });

    test('clear button appears and clears value', async ({ page }) => {
        const component = page.locator('[data-testid="clear-target"]');
        const input = component.locator('input');
        const clearButton = component.locator('button[part="clear"]');

        await expect(clearButton).toBeHidden();

        await input.fill('some text');
        await expect(clearButton).toBeVisible();

        await clearButton.click();
        await expect(input).toHaveValue('');
    });

    test('password type shows eye toggle and switches visibility', async ({ page }) => {
        const component = page.locator('[data-testid="password-target"]');
        const input = component.locator('input');
        const eyeButton = component.locator('button[part="eye"]');

        await expect(input).toHaveAttribute('type', 'password');

        await eyeButton.click();
        await expect(input).toHaveAttribute('type', 'text');

        await eyeButton.click();
        await expect(input).toHaveAttribute('type', 'password');
    });

    test('defaultvalue restores value on form reset', async ({ page }) => {
        const component = page.locator('[data-testid="reset-target"]');
        const input = component.locator('input');
        const resetButton = page.locator('[data-testid="reset-button"]');

        await input.fill('changed');
        await expect(input).toHaveValue('changed');

        await resetButton.click();
        await expect(input).toHaveValue('default');
    });

    test('required field participates in form validity', async ({ page }) => {
        const component = page.locator('[data-testid="required-target"]');
        const isValid = await component.evaluate((el: any) => el.checkValidity?.() ?? true);

        expect(isValid).toBe(false);
    });

    test('name set as a property is submitted with the form', async ({ page }) => {
        // frameworks like React 19 assign props as properties on a defined element
        const entries = await page.getByTestId('property-form').evaluate(async (form: HTMLFormElement) => {
            const input = document.createElement('pap-input') as any;
            input.name = 'username';
            input.defaultValue = 'henry';
            form.append(input);
            await customElements.whenDefined('pap-input');
            await new Promise(resolve => setTimeout(resolve, 100));
            return Object.fromEntries(new FormData(form));
        });

        expect(entries).toEqual({ username: 'henry' });
    });

    test('Enter submits the parent form once', async ({ page }) => {
        const input = page.getByTestId('submit-target').locator('input');

        await input.fill('query');
        await input.press('Enter');

        await expect.poll(() => page.getByTestId('submit-form').evaluate((form: any) => form.submitcount)).toBe(1);
    });

    test('Enter while composing does not submit', async ({ page }) => {
        const input = page.getByTestId('submit-target').locator('input');

        await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true });

        expect(await page.getByTestId('submit-form').evaluate((form: any) => form.submitcount)).toBe(0);
    });

    test('Enter without a form does nothing and throws nothing', async ({ page }) => {
        const errors: Error[] = [];
        page.on('pageerror', error => errors.push(error));

        const input = page.getByTestId('base-target').locator('input');
        await input.fill('text');
        await input.press('Enter');

        await expect(input).toHaveValue('text');
        expect(errors).toEqual([]);
    });

    test('aria-label on the host names the textbox', async ({ page }) => {
        const host = page.getByTestId('label-target');
        await expect(host.getByRole('textbox', { name: 'Search' })).toBeVisible();

        await host.evaluate(el => el.setAttribute('aria-label', 'Find'));
        await expect(host.getByRole('textbox', { name: 'Find' })).toBeVisible();
    });

    test('aria-labelledby and aria-describedby on the host name and describe the textbox', async ({ page, browserName }) => {
        const host = page.getByTestId('labelledby-target');

        expect(await referenced(host)).toEqual({ labelledby: ['Search'], describedby: ['Find anything'] });
        if (browserName === 'chromium')
        {
            expect(await accessible(page, 'labelledby-target')).toEqual({ name: 'Search', description: 'Find anything' });
        }
    });

    test('<label for> the host names the textbox', async ({ page, browserName }) => {
        const host = page.getByTestId('for-target');

        expect(await referenced(host)).toEqual({ labelledby: ['Search'], describedby: [] });
        if (browserName === 'chromium')
        {
            expect(await accessible(page, 'for-target')).toEqual({ name: 'Search', description: '' });
        }
    });

    test('clear button has an accessible name', async ({ page }) => {
        const host = page.getByTestId('clear-target');

        await host.locator('input').fill('text');
        await host.getByRole('button', { name: 'Clear' }).click();
        await expect(host.locator('input')).toHaveValue('');
    });

    test('password toggle has an accessible name and aria-pressed', async ({ page }) => {
        const toggle = page.getByTestId('password-target').getByRole('button', { name: 'Show password' });

        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
});
