import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/splitter/');
});

const getSeparator = (page: any, testid = "base-target") =>
    page.locator(`[data-testid="${testid}"]`).locator('[role="separator"]');

test.describe("@papit/splitter unit tests", () => {

    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-splitter');
        expect(component).not.toBeNull();
    });

    test('separator has correct ARIA attributes', async ({ page }) => {
        const separator = getSeparator(page);
        await expect(separator).toHaveAttribute('aria-valuemin', '0');
        await expect(separator).toHaveAttribute('aria-valuemax', '100');
        await expect(separator).toHaveAttribute('aria-valuenow', '50');
        await expect(separator).toHaveAttribute('aria-orientation', 'vertical');
        await expect(separator).toHaveAttribute('tabindex', '0');
    });

    test('horizontal separator has correct orientation', async ({ page }) => {
        const separator = getSeparator(page, "horizontal");
        await expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    });

    test('custom min/max attributes are set', async ({ page }) => {
        const separator = getSeparator(page, "custom");
        await expect(separator).toHaveAttribute('aria-valuemin', '20');
        await expect(separator).toHaveAttribute('aria-valuemax', '80');
    });

    test('separator is focusable', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        await expect(separator).toBeFocused();
    });

    test('ArrowRight increases value (vertical)', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        const before = Number(await separator.getAttribute('aria-valuenow'));
        await page.keyboard.press('ArrowRight');
        const after = Number(await separator.getAttribute('aria-valuenow'));
        expect(after).toBeGreaterThan(before);
    });

    test('ArrowLeft decreases value (vertical)', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        const before = Number(await separator.getAttribute('aria-valuenow'));
        await page.keyboard.press('ArrowLeft');
        const after = Number(await separator.getAttribute('aria-valuenow'));
        expect(after).toBeLessThan(before);
    });

    test('ArrowDown increases value (horizontal)', async ({ page }) => {
        const separator = getSeparator(page, "horizontal");
        await separator.focus();
        const before = Number(await separator.getAttribute('aria-valuenow'));
        await page.keyboard.press('ArrowDown');
        const after = Number(await separator.getAttribute('aria-valuenow'));
        expect(after).toBeGreaterThan(before);
    });

    test('ArrowUp decreases value (horizontal)', async ({ page }) => {
        const separator = getSeparator(page, "horizontal");
        await separator.focus();
        const before = Number(await separator.getAttribute('aria-valuenow'));
        await page.keyboard.press('ArrowUp');
        const after = Number(await separator.getAttribute('aria-valuenow'));
        expect(after).toBeLessThan(before);
    });

    test('Home key sets value to min', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        await page.keyboard.press('Home');
        await expect(separator).toHaveAttribute('aria-valuenow', '0');
    });

    test('End key sets value to max', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        await page.keyboard.press('End');
        await expect(separator).toHaveAttribute('aria-valuenow', '100');
    });

    test('Enter collapses primary pane to min', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        await page.keyboard.press('Enter');
        await expect(separator).toHaveAttribute('aria-valuenow', '0');
    });

    test('Enter restores value after collapse', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        const before = Number(await separator.getAttribute('aria-valuenow'));
        await page.keyboard.press('Enter'); // collapse
        await page.keyboard.press('Enter'); // restore
        const after = Number(await separator.getAttribute('aria-valuenow'));
        expect(after).toBe(before);
    });

    test('value does not exceed max', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(separator).toHaveAttribute('aria-valuenow', '100');
    });

    test('value does not go below min', async ({ page }) => {
        const separator = getSeparator(page);
        await separator.focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await expect(separator).toHaveAttribute('aria-valuenow', '0');
    });

    test('custom min/max clamps keyboard movement', async ({ page }) => {
        const separator = getSeparator(page, "custom");
        await separator.focus();
        await page.keyboard.press('End');
        await expect(separator).toHaveAttribute('aria-valuenow', '80');
        await page.keyboard.press('Home');
        await expect(separator).toHaveAttribute('aria-valuenow', '20');
    });
});