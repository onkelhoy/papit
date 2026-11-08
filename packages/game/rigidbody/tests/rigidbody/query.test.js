import { describe, it } from "node:test";
import assert from "node:assert";
import { RigidBody, World, Plane, Box, Sphere, Circle } from "@papit/rigidbody";

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

function scene() {
    const world = new World();
    const ground = world.add(new RigidBody({ shape: new Plane() }));
    const ball = world.add(new RigidBody({ shape: new Sphere(1), mass: 1, position: { x: 0, y: 2, z: 0 } }));
    const box = world.add(new RigidBody({ shape: new Box(2, 2, 2), mass: 1, position: { x: 5, y: 1, z: 0 } }));
    return { world, ground, ball, box };
}

describe("raycast", () => {
    it("hits the closest body with distance, point and normal", () => {
        const { world, ball } = scene();
        const hit = world.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: -2, z: 0 });
        assert.strictEqual(hit.body, ball);
        assert.ok(near(hit.t, 7), `t ${hit.t}`);
        assert.ok(near(hit.point.y, 3));
        assert.ok(near(hit.normal.y, 1));
    });

    it("hits a box side and the plane", () => {
        const { world, box, ground } = scene();
        const side = world.raycast({ x: 0, y: 1, z: 0.5 }, { x: 1, y: 0, z: 0 });
        assert.strictEqual(side.body, box);
        assert.ok(near(side.t, 4), `t ${side.t}`);
        assert.ok(near(side.normal.x, -1));
        const floor = world.raycast({ x: 20, y: 4, z: 0 }, { x: 0, y: -1, z: 0 });
        assert.strictEqual(floor.body, ground);
        assert.ok(near(floor.t, 4));
    });

    it("misses past maxDistance, pointing away and with zero direction", () => {
        const { world } = scene();
        assert.strictEqual(world.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, 5), null);
        assert.strictEqual(world.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: 0 }), null);
        assert.strictEqual(world.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 0 }), null);
    });

    it("starts inside at t = 0", () => {
        const { world, ball } = scene();
        const hit = world.raycast({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 });
        assert.strictEqual(hit.body, ball);
        assert.strictEqual(hit.t, 0);
    });

    it("works in 2D", () => {
        const world = new World({ dimensions: 2 });
        const circle = world.add(new RigidBody({ shape: new Circle(1), mass: 1, position: { x: 3, y: 0 } }));
        const hit = world.raycast({ x: 0, y: 0 }, { x: 1, y: 0 });
        assert.strictEqual(hit.body, circle);
        assert.ok(near(hit.t, 2));
        assert.ok(near(hit.normal.x, -1));
    });
});

describe("segmentCast", () => {
    it("only hits within the segment", () => {
        const { world, ball } = scene();
        assert.strictEqual(world.segmentCast({ x: 0, y: 10, z: 0 }, { x: 0, y: 5, z: 0 }), null);
        const hit = world.segmentCast({ x: 0, y: 10, z: 0 }, { x: 0, y: 2, z: 0 });
        assert.strictEqual(hit.body, ball);
        assert.ok(near(hit.t, 7));
    });
});

describe("overlap", () => {
    it("lists bodies touching a placed shape, planes skipped", () => {
        const { world, ball, box } = scene();
        assert.deepStrictEqual(world.overlap(new Sphere(0.5), { x: 0, y: 3.2, z: 0 }), [ball]);
        assert.deepStrictEqual(world.overlap(new Box(6, 1, 1), { x: 2.5, y: 1.5, z: 0 }), [ball, box]);
        assert.deepStrictEqual(world.overlap(new Sphere(0.5), { x: 0, y: 10, z: 0 }), []);
    });
});
