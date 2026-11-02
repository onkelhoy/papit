import { test, expect } from '@playwright/test';
import { Matrix4 } from '@papit/matrix';
import { Transform } from '@papit/game-engine';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) expect(actual[i]).toBeCloseTo(expected[i], 4);
}

// runs in node, one project is enough
test.beforeEach(({ }, info) => test.skip(info.project.name !== "chromium"));

test.describe("Transform", () => {
  test('starts as identity', () => {
    const transform = new Transform();
    expectClose(transform.localMatrix, Matrix4.identity(4));
    expectClose(transform.worldMatrix, Matrix4.identity(4));
  });

  test('local is translate * rotate * scale', () => {
    const transform = new Transform();
    transform.position.set([1, 2, 3]);
    transform.rotation.set([.3, .5, .7]);
    transform.scale.set([2, 3, 4]);

    const expected = Matrix4.identity(4).translate([1, 2, 3]).rotateY(.5).rotateX(.3).rotateZ(.7).scale([2, 3, 4]);
    expectClose(transform.localMatrix, expected);
  });

  test('world follows the parent chain', () => {
    const grandparent = new Transform();
    const parent = new Transform();
    const child = new Transform();
    parent.parent = grandparent;
    child.parent = parent;

    grandparent.position.x = 10;
    parent.rotation.z = Math.PI / 2;
    child.position.x = 5;

    const world = child.worldMatrix;
    expect(world[12]).toBeCloseTo(10, 4);
    expect(world[13]).toBeCloseTo(5, 4);
  });

  test('recomputes after a vector changes in place', () => {
    const parent = new Transform();
    const child = new Transform();
    child.parent = parent;
    expect(child.worldMatrix[12]).toBe(0);

    parent.position.x = 4;
    expect(child.worldMatrix[12]).toBe(4);

    child.position.add(1, 0, 0);
    expect(child.worldMatrix[12]).toBe(5);
  });

  test('worldVersion only moves when the matrix changes', () => {
    const transform = new Transform();
    transform.worldMatrix;
    const version = transform.worldVersion;

    transform.worldMatrix;
    expect(transform.worldVersion).toBe(version);

    transform.position.x = 1;
    transform.worldMatrix;
    expect(transform.worldVersion).toBe(version + 1);
  });

  test('moving to another parent or none updates both sides', () => {
    const a = new Transform();
    const b = new Transform();
    const child = new Transform();
    a.position.x = 1;
    b.position.x = 2;

    child.parent = a;
    expect(child.worldMatrix[12]).toBe(1);

    child.parent = b;
    expect(a.children).toEqual([]);
    expect(b.children).toEqual([child]);
    expect(child.worldMatrix[12]).toBe(2);

    child.parent = null;
    expect(b.children).toEqual([]);
    expect(child.worldMatrix[12]).toBe(0);
  });

  test('refuses a cycle', () => {
    const parent = new Transform();
    const child = new Transform();
    child.parent = parent;
    expect(() => parent.parent = child).toThrow();
    expect(() => parent.parent = parent).toThrow();
  });
});
