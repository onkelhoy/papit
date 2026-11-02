import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    GameEngine: any;
    GameObject: any;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('tests/objects/');
  await page.waitForFunction(() => window.GameObject);
});

test.describe("@papit/game-engine objects", () => {
  test('runs the lifecycle in order, start once', async ({ page }) => {
    const calls = await page.evaluate(() => {
      const calls: string[] = [];
      class Thing extends window.GameObject {
        start() { calls.push("start"); }
        update() { calls.push("update"); }
        lateUpdate() { calls.push("lateUpdate"); }
        render() { calls.push("render"); }
      }
      const engine = new window.GameEngine("#a");
      engine.add(new Thing());
      engine.start();
      engine.stop();
      return calls;
    });
    expect(calls).toEqual(["start", "update", "lateUpdate", "render"]);
  });

  test('the fixed step gets the same dt and catches up', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const steps: number[] = [];
      class Thing extends window.GameObject {
        fixedUpdate(dt: number) { steps.push(dt); }
      }
      const engine = new window.GameEngine("#a");
      engine.add(new Thing());
      engine.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      engine.stop();
      return { steps, time: engine.time, fixed: engine.fixedDeltaTime };
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(new Set(result.steps).size).toBe(1);
    expect(result.steps[0]).toBe(result.fixed);
    expect(Math.abs(result.steps.length * result.fixed - result.time)).toBeLessThan(result.fixed * 2);
  });

  test('picks its layer by name and children inherit it', async ({ page }) => {
    const layers = await page.evaluate(() => {
      const layers: string[] = [];
      class Thing extends window.GameObject {
        render(layer: { name: string }) { layers.push(layer.name); }
      }
      const engine = new window.GameEngine({ name: "front", query: "#a" }, { name: "back", query: "#b" });
      engine.add(new Thing());
      const parent = engine.add(new Thing());
      parent.layer = "Back";
      parent.add(new Thing());
      engine.start();
      engine.stop();
      return layers;
    });
    expect(layers).toEqual(["front", "back", "back"]);
  });

  test('a 2D object draws from its world position and a callback from the origin', async ({ page }) => {
    const result = await page.evaluate(() => {
      class Thing extends window.GameObject {
        render({ ctx }: { ctx: CanvasRenderingContext2D }) { ctx.fillRect(0, 0, 1, 1); }
      }
      const engine = new window.GameEngine("#a");
      const parent = engine.add(new Thing());
      parent.position.x = 10;
      parent.add(new Thing()).position.y = 5;

      let transform: DOMMatrix | undefined;
      engine.loop(() => transform = engine.ctx.getTransform());
      engine.stop();

      const pixel = (x: number, y: number) => engine.ctx.getImageData(x, y, 1, 1).data[3];
      return { parent: pixel(10, 0), child: pixel(10, 5), empty: pixel(0, 0), origin: transform?.e };
    });
    expect(result).toEqual({ parent: 255, child: 255, empty: 0, origin: 0 });
  });

  test('a layer nothing draws on is not cleared', async ({ page }) => {
    const alpha = await page.evaluate(() => {
      const engine = new window.GameEngine("#a");
      engine.ctx.fillRect(0, 0, 10, 10);
      engine.add(new window.GameObject());
      engine.start();
      engine.stop();
      return engine.ctx.getImageData(1, 1, 1, 1).data[3];
    });
    expect(alpha).toBe(255);
  });

  test('removing runs destroy down the tree and an object can remove itself', async ({ page }) => {
    const result = await page.evaluate(() => {
      const calls: string[] = [];
      class Thing extends window.GameObject {
        constructor(public label: string) { super(); }
        update() {
          calls.push(this.label);
          if (this.label === "first") this.parent.remove(this);
        }
        destroy() { calls.push(`destroy ${this.label}`); }
      }
      const engine = new window.GameEngine("#a");
      engine.add(new Thing("first")).add(new Thing("child"));
      engine.add(new Thing("second"));
      engine.start();
      engine.stop();
      return { calls, left: engine.world.children.length };
    });
    expect(result.calls).toEqual(["first", "destroy child", "destroy first", "second"]);
    expect(result.left).toBe(1);
  });

  test('find looks through the tree, add moves an object', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = new window.GameEngine("#a");
      const a = engine.add(new window.GameObject());
      const b = engine.add(new window.GameObject());
      const child = a.add(new window.GameObject());
      child.name = "child";
      const found = engine.world.find("child") === child;
      b.add(child);
      return { found, a: a.children.length, b: b.children.length, engine: child.engine === engine };
    });
    expect(result).toEqual({ found: true, a: 0, b: 1, engine: true });
  });
});
