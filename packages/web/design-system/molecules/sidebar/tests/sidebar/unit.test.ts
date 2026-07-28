import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/sidebar/');
});

test.describe("@papit/sidebar unit tests", () => {
    test('available in DOM', async ({ page }) => {
        const component = await page.$('pap-sidebar');
        expect(component).not.toBeNull();
    });

    test('is closed by default', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        await expect(component).not.toHaveAttribute('open');
    });

    test('hamburger click opens and closes the sidebar', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const hamburger = component.locator('pap-button[part="hamburger"]');

        await hamburger.click();
        await expect(component).toHaveAttribute('open', 'true');

        await hamburger.click();
        await expect(component).not.toHaveAttribute('open');
    });

    test('hamburger reflects aria-expanded', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const hamburger = component.locator('pap-button[part="hamburger"]');

        await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
        await hamburger.click();
        await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    });

    test('clicking the nav area opens the sidebar when closed', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const navDiv = component.locator('nav div[role="button"]');

        await navDiv.click();
        await expect(component).toHaveAttribute('open', 'true');
    });

    test('nav area click is a no-op when already open', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const hamburger = component.locator('pap-button[part="hamburger"]');
        const navDiv = component.locator('nav div[role="button"]');

        await hamburger.click();
        await expect(component).toHaveAttribute('open', 'true');

        await navDiv.click();
        await expect(component).toHaveAttribute('open', 'true');
    });

    test('hover sets and clears the hover custom state while closed', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const navDiv = component.locator('nav div[role="button"]');

        await navDiv.hover();
        const hasHoverState = await component.evaluate(
            (el) => el.matches(':state(hover)')
        );
        expect(hasHoverState).toBe(true);

        await page.mouse.move(0, 0);
        const hasHoverStateAfter = await component.evaluate(
            (el) => el.matches(':state(hover)')
        );
        expect(hasHoverStateAfter).toBe(false);
    });

    test('hover state is cleared when opened', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const hamburger = component.locator('pap-button[part="hamburger"]');

        await component.hover();
        await hamburger.click();

        const hasHoverState = await component.evaluate(
            (el) => el.matches(':state(hover)')
        );
        expect(hasHoverState).toBe(false);
    });

    test('Escape closes the sidebar and refocuses the hamburger button', async ({ page }) => {
        const component = page.locator('pap-sidebar');
        const hamburger = component.locator('pap-button[part="hamburger"]');

        await hamburger.click();
        await expect(component).toHaveAttribute('open', 'true');

        await page.keyboard.press('Escape');
        await expect(component).not.toHaveAttribute('open');

        const isFocused = await component.evaluate(
            (el, expectedPart) =>
                el.shadowRoot?.activeElement?.getAttribute('part') === expectedPart,
            'hamburger'
        );
        expect(isFocused).toBe(true);
    });

    test('Escape is a no-op when already closed', async ({ page }) => {
        const component = page.locator('pap-sidebar');

        await page.keyboard.press('Escape');
        await expect(component).not.toHaveAttribute('open');
    });

    test('slots render header, default, and footer content', async ({ page }) => {
        const header = page.locator('pap-sidebar [slot="header"]');
        const footer = page.locator('pap-sidebar [slot="footer"]');

        await expect(header).toBeAttached();
        await expect(footer).toBeAttached();
    });
});