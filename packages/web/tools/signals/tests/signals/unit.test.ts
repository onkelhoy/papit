import { test, expect } from '@playwright/test';

import type { signal, effect, computed } from "@papit/signals"

declare global {
    interface Window {
        signal: typeof signal;
        effect: typeof effect;
        computed: typeof computed;
    }
}

test.beforeEach(async ({ page }) => {
    await page.goto('tests/signals/');
    await page.waitForFunction(() => typeof window.signal === 'function', { timeout: 5000 })
});

test.describe("signal", () => {
    test("returns initial value", async ({ page }) => {
        const value = await page.evaluate(() => {
            const [read] = window.signal(42);
            return read();
        });
        expect(value).toBe(42);
    });

    test("updates value", async ({ page }) => {
        const value = await page.evaluate(() => {
            const [read, write] = window.signal(0);
            write(5);
            return read();
        });
        expect(value).toBe(5);
    });

    test("functional update", async ({ page }) => {
        const value = await page.evaluate(() => {
            const [read, write] = window.signal(2);
            write(v => v * 3);
            return read();
        });
        expect(value).toBe(6);
    });
});

test.describe("effect", () => {
    test("runs immediately", async ({ page }) => {
        const ran = await page.evaluate(() => {
            let ran = false;
            window.effect(() => { ran = true });
            return ran;
        });
        expect(ran).toBe(true);
    });

    test("re-runs when signal changes", async ({ page }) => {
        const count = await page.evaluate(() => {
            const [read, write] = window.signal(0);
            let count = 0;
            window.effect(() => { read(); count++ });
            write(1);
            write(2);
            return count;
        });
        expect(count).toBe(3); // initial + 2 updates
    });

    test("tracks multiple signals", async ({ page }) => {
        const result = await page.evaluate(() => {
            const [a, setA] = window.signal(1);
            const [b, setB] = window.signal(2);
            let last = 0;
            window.effect(() => { last = a() + b() });
            setA(10);
            setB(20);
            return last;
        });
        expect(result).toBe(30);
    });
});

test.describe("computed", () => {
    test("derives value", async ({ page }) => {
        const value = await page.evaluate(() => {
            const [count, setCount] = window.signal(2);
            const [doubled] = window.computed(() => count() * 2);
            return doubled();
        });
        expect(value).toBe(4);
    });

    test("updates when dependency changes", async ({ page }) => {
        const value = await page.evaluate(() => {
            const [count, setCount] = window.signal(2);
            const [doubled] = window.computed(() => count() * 2);
            setCount(5);
            return doubled();
        });
        expect(value).toBe(10);
    });

    test("is read only", async ({ page }) => {
        const length = await page.evaluate(() => {
            const [count] = window.signal(0);
            const result = window.computed(() => count());
            return result.length;
        });
        expect(length).toBe(2); // only read, no write
    });
});