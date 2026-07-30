import { test, expect } from '@playwright/test';

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
});