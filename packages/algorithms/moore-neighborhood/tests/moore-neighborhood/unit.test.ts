import { test, expect } from '@playwright/test';

declare global {
    interface Window {
        MooreNeighborhood: any;
    }
}

test.beforeEach(async ({ page }) => {
    // Navigate to your test page
    await page.goto('tests/moore-neighborhood/');
});

test.describe("@papit/moore-neighborhood unit tests", () => {
    test('the page runs without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));

        await page.reload({ waitUntil: 'networkidle' });

        // WebKit reports this harmless notice as a page error
        expect(errors.filter(message => !message.startsWith("ResizeObserver loop"))).toEqual([]);
    });

    for (const name of ["big-1", "big-2", "big-3", "big-4", "small-1", "small-2", "small-3", "small-4", "small-5", "small-6"])
    {
        test(`${name} gives polygons in every anchor`, async ({ page }) => {
            const counts = await page.evaluate(async image => {
                const anchors = ["auto", "top-left", "center"];
                const results = [];
                for (const anchor of anchors)
                {
                    results.push((await window.MooreNeighborhood(image, 1, true, anchor)).length);
                }
                return results;
            }, `/case.${name}.png`);

            expect(Math.min(...counts)).toBeGreaterThan(0);
        });
    }

    test('auto keeps the corners of a shape that fills the image', async ({ page }) => {
        const boundary = await page.evaluate(async () => {
            const [polygon] = await window.MooreNeighborhood("/case.big-4.png");
            return polygon.boundary;
        });

        expect(boundary.w).toBeGreaterThanOrEqual(127);
        expect(boundary.h).toBeGreaterThanOrEqual(127);
    });
});
