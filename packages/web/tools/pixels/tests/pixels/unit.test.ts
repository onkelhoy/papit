import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    pixels: any;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('tests/pixels/');
  await page.waitForFunction(() => window.pixels);
});

test.describe("@papit/pixels", () => {
  test('FromCanvas reads an element or a query', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { Pixels } = window.pixels;
      const first = Pixels.FromCanvas(document.querySelector("#small"));
      const second = Pixels.FromCanvas("#small");
      const { r, a, col, row, index } = first.get(0, 0);
      return { r, a, col, row, index, width: second.width, height: second.height, red: second.get(0, 0).r };
    });
    expect(result).toEqual({ r: 255, a: 255, col: 0, row: 0, index: 0, width: 3, height: 2, red: 255 });
  });

  test('FromCanvas throws on a missing element or a canvas without a 2D context', async ({ page }) => {
    const errors = await page.evaluate(() => {
      const { Pixels } = window.pixels;
      const attempt = (query: string) => {
        try { Pixels.FromCanvas(query); return null; }
        catch (error) { return (error as Error).message; }
      };
      // the browser may have no WebGL to hold the context, so #gl alone proves nothing
      document.querySelector<HTMLCanvasElement>("#gl")!.getContext = () => null;
      return [attempt("#nothing"), attempt("#gl")];
    });
    expect(errors[0]).toContain("#nothing");
    expect(errors[1]).toContain("2D context");
  });

  test('FromImage reads all of an image larger than a default canvas', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { Pixels } = window.pixels;
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 200;
      const ctx = canvas.getContext("2d")!;
      ctx.fillRect(399, 199, 1, 1);

      const pixels = await Pixels.FromImage(canvas.toDataURL());
      return { width: pixels.width, height: pixels.height, corner: pixels.get(399, 199).a, empty: pixels.get(0, 0).a };
    });
    expect(result).toEqual({ width: 400, height: 200, corner: 255, empty: 0 });
  });

  test('get answers by index and stays inside the image', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pixels = window.pixels.Pixels.FromCanvas("#small");
      return {
        index: [pixels.get(4).col, pixels.get(4).row],
        outside: [pixels.get(-1), pixels.get(6), pixels.get(3, 0), pixels.get(0, 2), pixels.get(-1, 0)].filter(Boolean).length,
      };
    });
    expect(result).toEqual({ index: [1, 1], outside: 0 });
  });

  test('surrounding names the neighbours and leaves the edge empty', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pixels = window.pixels.Pixels.FromCanvas("#small");
      const around = pixels.surrounding(pixels.get(0, 0));
      return { right: around.right.col, top: around.top ?? null, found: around.array.filter(Boolean).length };
    });
    expect(result).toEqual({ right: 1, top: null, found: 3 });
  });

  test('iterating goes through every pixel', async ({ page }) => {
    const count = await page.evaluate(() => [...window.pixels.Pixels.FromCanvas("#small")].length);
    expect(count).toBe(6);
  });
});
