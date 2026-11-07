import { test, expect } from '@playwright/test';
import { Circle, Line, Rectangle } from '@papit/game-shape';

declare global {
  interface Window {
    shape: any;
  }
}

test.describe("shapes, run in node", () => {
  test.beforeEach(({ }, info) => test.skip(info.project.name !== "chromium"));

  test('a circle knows its boundary', () => {
    expect(new Circle({ x: 10, y: 20 }, 5).boundary).toEqual({ x: 5, y: 15, w: 10, h: 10 });
  });

  test('the support function of a circle leaves the circle where it is', () => {
    const circle = new Circle({ x: 10, y: 20 }, 5);
    const point = circle.supportFunction({ x: 1, y: 0 });
    expect(point.x).toBeCloseTo(15, 4);
    expect(point.y).toBeCloseTo(20, 4);
    expect([circle.x, circle.y]).toEqual([10, 20]);
  });

  test('a rectangle exposes its corners and center', () => {
    const rectangle = new Rectangle(10, 20, 30, 40);
    expect(rectangle.bottomRight).toEqual({ x: 40, y: 60 });
    expect(rectangle.center).toEqual({ x: 25, y: 40 });
    expect([rectangle.width, rectangle.height]).toEqual([30, 40]);
  });

  test('the support function of a rectangle picks the corner along the direction', () => {
    const rectangle = new Rectangle(10, 20, 30, 40);
    const corner = (x: number, y: number) => {
      const p = rectangle.supportFunction({ x, y });
      return [p.x, p.y];
    };
    expect(corner(1, 1)).toEqual([40, 60]);
    expect(corner(-1, -1)).toEqual([10, 20]);
    expect(corner(1, -1)).toEqual([40, 20]);
    expect(corner(-1, 1)).toEqual([10, 60]);
  });

  test('support is the same as supportFunction', () => {
    const circle = new Circle({ x: 0, y: 0 }, 2);
    expect(circle.support({ x: 0, y: 1 }).y).toBeCloseTo(2, 4);
    expect(new Rectangle(0, 0, 1, 1).support([1, 1])[0]).toBe(1);
  });

  test('a line keeps both its ends', () => {
    const line = new Line({ x: 1, y: 2 }, { x: 4, y: 6 });
    expect([line.a.x, line.b.x, line.b.y]).toEqual([1, 4, 6]);
    expect([line.direction.x, line.direction.y]).toEqual([3, 4]);
  });
});

test.describe("drawing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tests/shape/');
    await page.waitForFunction(() => window.shape);
  });

  test('shapes draw where they are', async ({ page }) => {
    const alpha = await page.evaluate(() => {
      const { Circle, Rectangle, Line, DrawPolygon, Polygon } = window.shape;
      const ctx = document.querySelector("canvas")!.getContext("2d")!;
      const read = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3] > 0;
      const clear = () => ctx.clearRect(0, 0, 100, 100);

      new Circle({ x: 50, y: 50 }, 20).draw(ctx);
      const circle = [read(50, 50), read(5, 5)];
      clear();

      new Rectangle(10, 10, 20, 20).draw(ctx);
      const rectangle = [read(20, 20), read(60, 60)];
      clear();

      new Line({ x: 0, y: 50 }, { x: 100, y: 50 }).draw(ctx, "black", 2);
      const line = [read(50, 50), read(50, 10)];
      clear();

      DrawPolygon(new Polygon({ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 50, y: 90 }), ctx);
      const polygon = [read(50, 30), read(5, 80)];

      return { circle, rectangle, line, polygon };
    });
    expect(alpha).toEqual({
      circle: [true, false],
      rectangle: [true, false],
      line: [true, false],
      polygon: [true, false],
    });
  });
});
