import { test, expect } from '@playwright/test';
import { Camera, GameObject, easeFactor, follow, orbit } from '@papit/game-engine';

declare global {
  interface Window {
    game: any;
  }
}

const layer = { width: 800, height: 600, engine: null, setting: { type: "2d" } } as any;

/** Where a point ends up after `matrix`. */
function apply(matrix: ArrayLike<number>, x: number, y: number, z: number) {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
  ];
}

function camera(setting = {}) {
  const camera = new Camera(setting);
  camera.attach(layer);
  camera.start();
  return camera;
}

test.describe("Camera, run in node", () => {
  test.beforeEach(({ }, info) => test.skip(info.project.name !== "chromium"));

  test('works with no settings', () => {
    const empty = new Camera();
    empty.lateUpdate(1 / 60);
    expect(empty.zoom).toBe(1);
    expect(Array.from(empty.viewMatrix).map(Math.abs)).toEqual(Array.from(empty.worldMatrix).map(Math.abs));
  });

  test('easing moves the same distance at any frame rate', () => {
    const run = (hertz: number) => {
      let distance = 100;
      for (let i = 0; i < hertz; i++) distance -= distance * easeFactor(.08, 1 / hertz);
      return distance;
    };
    expect(run(60)).toBeCloseTo(run(144), 3);
  });

  test('an easing function picks the fraction', () => {
    expect(easeFactor(dt => dt * 2, .25)).toBe(.5);
  });

  test('follow lands on the target, then eases', () => {
    const target = new GameObject();
    target.position.set([100, 50, 0]);
    const view = camera({ controllers: [follow(target, { ease: .5 })] });

    view.lateUpdate(1 / 60);
    expect(view.position.x).toBe(100);

    target.position.x = 200;
    view.lateUpdate(1 / 60);
    expect(view.position.x).toBeCloseTo(150, 2);
  });

  test('follow takes anything with a position', () => {
    const view = camera({ controllers: [follow({ position: { x: 7, y: 8 } })] });
    view.lateUpdate(1 / 60);
    expect(view.position.y).toBe(8);
  });

  test('the deadzone holds an axis until the target leaves it', () => {
    const target = new GameObject();
    const view = camera({ controllers: [follow(target, { deadzone: { x: 50 } })] });
    view.lateUpdate(1 / 60);

    target.position.set([40, 40, 0]);
    view.lateUpdate(1 / 60);
    expect(view.position.x).toBe(0);
    expect(view.position.y).toBe(40);

    target.position.x = 60;
    view.lateUpdate(1 / 60);
    expect(view.position.x).toBe(60);
  });

  test('bounds keep the view inside, zoom included', () => {
    const view = camera({ bounds: { x: 0, y: 0, width: 2000, height: 1000 } });
    view.position.set([-500, 5000, 0]);
    view.lateUpdate(1 / 60);
    expect(view.position.x).toBe(400);
    expect(view.position.y).toBe(700);

    view.zoom = 2;
    view.position.set([-500, 5000, 0]);
    view.clamp();
    expect(view.position.x).toBe(200);
    expect(view.position.y).toBe(850);
  });

  test('orbit looks at its target from the set distance', () => {
    const controller = orbit({ target: { position: { x: 1, y: 2, z: 3 } }, distance: 4, yaw: .7, pitch: .4 });
    const view = new Camera({ controllers: [controller] });
    view.attach({ ...layer, setting: { type: "webgl2" } });
    controller.update(view, 0);

    const [x, y, z] = apply(view.viewMatrix, 1, 2, 3);
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(0, 3);
    expect(z).toBeCloseTo(-4, 3);
    expect(view.position.y).toBeGreaterThan(2);
  });

  test('perspective puts what is in front in clip space, and shrinks it with distance', () => {
    const view = new Camera();
    view.attach({ ...layer, setting: { type: "webgl2" } });
    const projection = view.projectionMatrix;

    const [near] = apply(projection, 1, 0, -2);
    const [far] = apply(projection, 1, 0, -20);
    const [, , depth] = apply(projection, 0, 0, -view.far);
    expect(near).toBeCloseTo(far * 10, 3);
    expect(depth).toBeCloseTo(1, 3);
  });

  test('orthographic ignores distance and shows two units high', () => {
    const view = new Camera({ projection: "orthographic", zoom: 2 });
    view.attach({ ...layer, setting: { type: "webgl2" } });

    const [, atNear] = apply(view.projectionMatrix, 0, .25, -2);
    const [, atFar] = apply(view.projectionMatrix, 0, .25, -20);
    expect(atNear).toBeCloseTo(.5, 4);
    expect(atFar).toBeCloseTo(.5, 4);
  });

  test('a view larger than the bounds is centered', () => {
    const view = camera({ bounds: { x: 0, y: 0, width: 100, height: 100 } });
    view.lateUpdate(1 / 60);
    expect(view.position.x).toBe(50);
    expect(view.position.y).toBe(50);
  });
});

test.describe("Camera on a layer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tests/camera/');
    await page.waitForFunction(() => window.game);
  });

  test('the camera position lands at the center of the canvas and zoom scales around it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { GameEngine, GameObject, Camera } = window.game;
      const transforms: DOMMatrix[] = [];
      class Thing extends GameObject {
        render({ ctx }: { ctx: CanvasRenderingContext2D }) { transforms.push(ctx.getTransform()); }
      }
      const engine = new GameEngine("#a");
      engine.add(new Thing()).position.set([110, 30, 0]);
      const camera = new Camera({ zoom: 2 });
      camera.position.set([100, 20, 0]);
      engine.defaultLayer.camera = camera;
      engine.start();
      engine.stop();
      const { a, e, f } = transforms[0];
      return { a, e: e - engine.width / 2, f: f - engine.height / 2 };
    });
    expect(result).toEqual({ a: 2, e: 20, f: 20 });
  });

  test('a camera on two layers moves once per frame', async ({ page }) => {
    const updates = await page.evaluate(() => {
      const { GameEngine, Camera } = window.game;
      let updates = 0;
      const engine = new GameEngine({ name: "a", query: "#a" }, { name: "b", query: "#a" });
      const camera = new Camera({ controllers: [{ update: () => updates++ }] });
      engine.layers.a.camera = camera;
      engine.layers.b.camera = camera;
      engine.start();
      engine.stop();
      return updates;
    });
    expect(updates).toBe(1);
  });

  test('the wheel zooms and a removed camera stops listening', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { GameEngine, Camera, zoom, pan } = window.game;
      const engine = new GameEngine("#a");
      const camera = new Camera({ controllers: [zoom(), pan()] });
      engine.defaultLayer.camera = camera;
      engine.start();
      engine.stop();

      const canvas = engine.canvas;
      const frame = () => camera.controllers.forEach((controller: any) => controller.update(camera, 1));

      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -500, bubbles: true, cancelable: true }));
      frame();
      const zoomed = camera.zoom;

      engine.defaultLayer.camera = null;
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -500, bubbles: true, cancelable: true }));
      frame();

      return { zoomed, after: camera.zoom };
    });
    expect(result.zoomed).toBeGreaterThan(1.5);
    expect(result.after).toBe(result.zoomed);
  });

  test('dragging pans, and follow keeps that offset', async ({ page }) => {
    await page.evaluate(() => {
      const { GameEngine, GameObject, Camera, follow, pan } = window.game;
      const engine = new GameEngine("#a");
      const target = engine.add(new GameObject());
      const camera = new Camera({ controllers: [follow(target), pan()] });
      engine.defaultLayer.camera = camera;
      engine.start();
      Object.assign(window, { camera, target });
    });

    await page.mouse.move(50, 50);
    await page.mouse.down();
    await page.mouse.move(30, 50);
    await page.mouse.up();

    const result = await page.evaluate(async () => {
      const { camera, target } = window as any;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      target.position.x = 500;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { offset: camera.offset.x, distance: camera.position.x - target.position.x };
    });
    expect(result.offset).toBeCloseTo(20 * await page.evaluate(() => devicePixelRatio), 1);
    expect(result.distance).toBeCloseTo(result.offset, 1);
  });

  test('fps walks where it faces', async ({ page }) => {
    test.skip(!await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2")), "no WebGL2 in this browser");

    const position = await page.evaluate(() => {
      const { GameEngine, Camera, fps } = window.game;
      const engine = new GameEngine({ query: "#gl", type: "webgl2" });
      const controller = fps({ speed: 2 });
      const camera = new Camera({ controllers: [controller] });
      engine.defaultLayer.camera = camera;
      engine.start();
      engine.stop();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
      camera.rotation.y = Math.PI / 2; // facing -x
      controller.update(camera, 1);
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "w" }));
      controller.update(camera, 1);

      return [...camera.position];
    });
    expect(position[0]).toBeCloseTo(-2, 3);
    expect(position[2]).toBeCloseTo(0, 3);
  });

  test('a shake moves the view, then it settles', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { Camera } = window.game;
      const camera = new Camera();
      camera.shake(.1, 10);
      camera.lateUpdate(.05);
      const shaking = Math.abs(camera.viewMatrix[12]) + Math.abs(camera.viewMatrix[13]);
      camera.lateUpdate(.1);
      return { shaking, settled: camera.viewMatrix[12] + camera.viewMatrix[13] };
    });
    expect(result.shaking).toBeGreaterThan(0);
    expect(result.settled).toBe(0);
  });

  test('a reduced motion setting skips the shake', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const moved = await page.evaluate(() => {
      const { Camera } = window.game;
      const camera = new Camera();
      camera.shake(.1, 10);
      camera.lateUpdate(.05);
      return camera.viewMatrix[12] + camera.viewMatrix[13];
    });
    expect(moved).toBe(0);
  });
});
