import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    GameEngine: any;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('tests/loop/');
  await page.waitForFunction(() => window.GameEngine);
});

test.describe("@papit/game-engine loop", () => {
  test('runs the first frame right away with a delta of 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = new window.GameEngine("#a");
      const deltas: number[] = [];
      engine.loop((milliseconds: number, seconds: number) => deltas.push(milliseconds, seconds));
      engine.stop();
      return { deltas, frame: engine.frame };
    });
    expect(result).toEqual({ deltas: [0, 0], frame: 1 });
  });

  test('every layer shares one loop', async ({ page }) => {
    const calls = await page.evaluate(async () => {
      const calls: string[] = [];
      const engine = new window.GameEngine(
        { query: "#a", callbacks: [() => calls.push("a")] },
        { query: "#b", callbacks: [() => calls.push("b")] },
      );
      engine.start();
      engine.start();
      await frames(2);
      engine.stop();
      return calls;

      function frames(count: number) {
        return new Promise<void>(resolve => {
          const next = () => count-- > 0 ? requestAnimationFrame(next) : resolve();
          next();
        });
      }
    });
    expect(calls.length).toBeGreaterThan(2);
    expect(calls.length % 2).toBe(0);
    expect(calls.filter(name => name === "a").length).toBe(calls.length / 2);
  });

  test('stop ends the loop and start picks it up without a jump', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const engine = new window.GameEngine("#a");
      const deltas: number[] = [];
      engine.loop((_: number, seconds: number) => deltas.push(seconds));
      engine.stop();
      const frame = engine.frame;
      await new Promise(resolve => setTimeout(resolve, 100));
      const stopped = engine.frame === frame;
      engine.start();
      engine.stop();
      return { stopped, last: deltas.at(-1) };
    });
    expect(result).toEqual({ stopped: true, last: 0 });
  });

  test('timeScale slows the game and 0 freezes it', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const engine = new window.GameEngine("#a");
      engine.timeScale = 0;
      engine.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const frozen = engine.time;
      engine.timeScale = 1;
      await new Promise(resolve => setTimeout(resolve, 50));
      engine.stop();
      return { frozen, time: engine.time, frame: engine.frame };
    });
    expect(result.frozen).toBe(0);
    expect(result.time).toBeGreaterThan(0);
    expect(result.frame).toBeGreaterThan(1);
  });

  test('a long frame is capped', async ({ page }) => {
    const delta = await page.evaluate(async () => {
      const engine = new window.GameEngine("#a");
      engine.start();
      const end = performance.now() + 250;
      while (performance.now() < end);
      await new Promise(resolve => requestAnimationFrame(resolve));
      engine.stop();
      return engine.deltaTime;
    });
    expect(delta).toBeLessThanOrEqual(0.1 + 1e-6);
  });
});
