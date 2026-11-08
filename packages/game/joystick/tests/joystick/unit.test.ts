import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('tests/joystick/');
  await page.waitForFunction(() => !!document.querySelector('pap-joystick')?.shadowRoot?.querySelector('#base'));
});

// centre of the stick base, in page coordinates
async function center(page: Page, testid: string) {
  return page.evaluate((testid) => {
    const host = document.querySelector(`[data-testid="${testid}"]`)!;
    const rect = host.shadowRoot!.querySelector('#base')!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, testid);
}

function read(page: Page, testid: string) {
  return page.evaluate((testid) => {
    const joystick = document.querySelector<any>(`[data-testid="${testid}"]`);
    return { x: joystick.x, y: joystick.y, strength: joystick.strength };
  }, testid);
}

test.describe("@papit/joystick", () => {
  test('dragging sets x, y and strength', async ({ page }) => {
    const c = await center(page, 'fixed');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 25, c.y); // half the 50px radius

    const value = await read(page, 'fixed');
    expect(value.x).toBeCloseTo(0.5, 2);
    expect(value.y).toBeCloseTo(0, 2);
    expect(value.strength).toBeCloseTo(0.5, 2);
  });

  test('clamps to the edge', async ({ page }) => {
    const c = await center(page, 'fixed');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x, c.y - 200);

    const value = await read(page, 'fixed');
    expect(value.y).toBeCloseTo(-1, 2);
    expect(value.strength).toBeCloseTo(1, 2);
  });

  test('release resets to zero', async ({ page }) => {
    const c = await center(page, 'fixed');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 40, c.y + 10);
    await page.mouse.up();

    expect(await read(page, 'fixed')).toEqual({ x: 0, y: 0, strength: 0 });
  });

  test('fixed ignores presses outside the base', async ({ page }) => {
    const box = (await page.getByTestId('fixed').boundingBox())!;
    await page.mouse.move(box.x + box.width - 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 40, box.y + 10);

    expect((await read(page, 'fixed')).strength).toBe(0);
  });

  test('floating moves the base under the pointer', async ({ page }) => {
    const box = (await page.getByTestId('floating').boundingBox())!;
    const start = { x: box.x + 300, y: box.y + 80 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();

    const c = await center(page, 'floating');
    expect(c.x).toBeCloseTo(start.x, 0);
    expect(c.y).toBeCloseTo(start.y, 0);
    expect((await read(page, 'floating')).strength).toBeCloseTo(0, 2);
  });

  test('follow drags the base along past the edge', async ({ page }) => {
    await page.getByTestId('follow').scrollIntoViewIfNeeded();
    const box = (await page.getByTestId('follow').boundingBox())!;
    const start = { x: box.x + 100, y: box.y + 150 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 150, start.y); // 100px past the 50px radius

    const c = await center(page, 'follow');
    expect(c.x).toBeCloseTo(start.x + 100, 0);
    expect((await read(page, 'follow')).x).toBeCloseTo(1, 2);
  });

  test('editable drags the stick, emits layout-change and ignores input', async ({ page }) => {
    await page.evaluate(() => {
      const joystick = document.querySelector('[data-testid="editable"]')!;
      joystick.addEventListener('layout-change', (event: any) => (window as any).LAYOUT = event.detail);
    });
    await page.getByTestId('editable').scrollIntoViewIfNeeded();
    const box = (await page.getByTestId('editable').boundingBox())!;
    const c = await center(page, 'editable');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 150);
    await page.mouse.up();

    const layout = await page.evaluate(() => (window as any).LAYOUT);
    expect(layout.stick.x).toBeCloseTo(50, 0);
    expect(layout.stick.y).toBeCloseTo(50, 0);
    expect(layout.jump).toBeDefined();
    expect((await read(page, 'editable')).strength).toBe(0);
  });

  test('layout restores positions', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const joystick = document.querySelector<any>('[data-testid="editable"]');
      joystick.layout = { stick: { x: 10, y: 20 }, jump: { x: 90, y: 80 } };
      return joystick.layout;
    });
    expect(layout).toEqual({ stick: { x: 10, y: 20 }, jump: { x: 90, y: 80 } });
  });
});
