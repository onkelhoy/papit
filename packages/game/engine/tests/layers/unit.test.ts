import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    GameEngine: any;
    InputEvents: any;
    warnings: string[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('tests/layers/');
  await page.waitForFunction(() => window.GameEngine);
});

test.describe("@papit/game-engine layers", () => {
  test('a layer has its size right after creation', async ({ page }) => {
    const size = await page.evaluate(() => {
      const engine = new window.GameEngine("#a");
      return [engine.width / devicePixelRatio, engine.height / devicePixelRatio];
    });
    expect(size).toEqual([200, 100]);
  });

  test('names are lowercase and any case finds them', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = new window.GameEngine({ name: "Background", query: "#a" });
      return [Object.keys(engine.layers), engine.layer("BACKGROUND") === engine.layers.background];
    });
    expect(result).toEqual([["background"], true]);
  });

  test('an unnamed layer is named by position', async ({ page }) => {
    const keys = await page.evaluate(() => Object.keys(new window.GameEngine("#a", "#b").layers));
    expect(keys).toEqual(["layer0", "layer1"]);
  });

  test('main is the default layer, otherwise the first', async ({ page }) => {
    const result = await page.evaluate(() => [
      new window.GameEngine({ name: "back", query: "#a" }, { name: "Main", query: "#b" }).defaultLayer.name,
      new window.GameEngine({ name: "back", query: "#a" }, { name: "front", query: "#b" }).defaultLayer.name,
    ]);
    expect(result).toEqual(["main", "back"]);
  });

  test('a repeated name warns and keeps the first', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = new window.GameEngine({ name: "main", query: "#a" }, { name: "MAIN", query: "#b" });
      return [engine.layers.main.element.id, engine.layers.layer1.element.id, window.warnings.length];
    });
    expect(result).toEqual(["a", "b", 1]);
  });

  test('main and default together warn and the first wins', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = new window.GameEngine({ name: "default", query: "#a" }, { name: "main", query: "#b" });
      return [engine.defaultLayer.name, window.warnings.length];
    });
    expect(result).toEqual(["default", 1]);
  });

  test('a layer is 2D or 3D by its type', async ({ page }) => {
    test.skip(!await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2")), "no WebGL2 in this browser");

    const result = await page.evaluate(() => {
      const engine = new window.GameEngine({ name: "flat", query: "#a" }, { name: "deep", query: "#gl", type: "webgl2" });
      return [engine.layers.flat.ctx instanceof CanvasRenderingContext2D, engine.layers.deep.gl instanceof WebGL2RenderingContext];
    });
    expect(result).toEqual([true, true]);
  });

  test('a size from the settings stays', async ({ page }) => {
    const size = await page.evaluate(async () => {
      const engine = new window.GameEngine({ query: "#fixed", width: 50, height: 60 });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [engine.width, engine.height];
    });
    expect(size).toEqual([50, 60]);
  });

  test('a stopped layer follows its element', async ({ page }) => {
    const width = await page.evaluate(async () => {
      const engine = new window.GameEngine("#a");
      engine.canvas.style.width = "300px";
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return engine.width / devicePixelRatio;
    });
    expect(width).toBe(300);
  });

  test('a running layer resizes before it draws', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const engine = new window.GameEngine("#a");
      const sizes: number[] = [];
      engine.loop(() => sizes.push(engine.width / devicePixelRatio));
      engine.canvas.style.width = "300px";
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      engine.stop();
      return sizes.at(-1);
    });
    expect(result).toBe(300);
  });

  test('theme is off by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    const theme = await page.evaluate(() => new window.GameEngine("#a").theme);
    expect(theme).toBe("light");
  });

  test('theme follows the system and tells listeners', async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => {
      const engine = new window.GameEngine({ query: "#a", theme: true });
      (window as any).engine = engine;
      (window as any).switches = [];
      engine.on("theme", (theme: string) => (window as any).switches.push(theme));
    });
    expect(await page.evaluate(() => (window as any).engine.foreground)).toBe("white");

    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => (window as any).switches.length === 1);
    expect(await page.evaluate(() => (window as any).switches)).toEqual(["light"]);
    expect(await page.evaluate(() => (window as any).engine.foreground)).toBe("black");
  });

  test('theme follows data-theme and a stopped game draws once', async ({ page }) => {
    await page.addStyleTag({ content: `[data-theme="dark"] { color-scheme: dark; }` });
    await page.emulateMedia({ colorScheme: "light" });
    await page.evaluate(() => {
      const engine = new window.GameEngine({ query: "#a", theme: true });
      (window as any).engine = engine;
      (window as any).drawn = 0;
      engine.loop(() => (window as any).drawn++);
      engine.stop();
      (window as any).drawn = 0;
      document.documentElement.dataset.theme = "dark";
    });

    await page.waitForFunction(() => (window as any).engine.theme === "dark");
    expect(await page.evaluate(() => (window as any).drawn)).toBe(1);
    expect(await page.evaluate(() => (window as any).engine.state)).toBe("paused");
  });

  test('the mouse position is in canvas pixels', async ({ page }) => {
    const position = await page.evaluate(() => {
      const engine = new window.GameEngine({ query: "#b", width: 400, height: 200 });
      const events = new window.InputEvents(engine.canvas, { mouse: { pointerlock: false } });

      // the canvas is 200x100 on the page, so it shows two canvas pixels per CSS pixel
      const { left, top } = engine.canvas.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: left + 100, clientY: top + 25 }));
      return [events.position.x, events.position.y];
    });
    expect(position[0]).toBeCloseTo(200);
    expect(position[1]).toBeCloseTo(50);
  });
});
