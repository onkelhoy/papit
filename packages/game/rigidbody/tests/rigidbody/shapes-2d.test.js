import { describe, it } from "node:test";
import assert from "node:assert";
import { Box, Capsule, Circle, Polygon, RigidBody, World } from "@papit/rigidbody";
import { Vector3 } from "@papit/vector";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const out = () => new Vector3(0, 0, 0);

describe("shapes 2D", () => {
    it("circle has a disk's inertia", () => {
        assert.ok(near(new Circle(2).inertia(3, 2, out()).z, 0.5 * 3 * 4));
    });

    it("box inertia about z is m/12 (w² + h²)", () => {
        assert.ok(near(new Box(3, 4).inertia(12, 2, out()).z, 25));
    });

    it("polygon inertia matches a square box, in any point order", () => {
        const square = new Polygon([{ x: 1, y: 1 }, { x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 0, y: 0 }]);
        assert.ok(near(square.inertia(6, 2, out()).z, new Box(2, 2).inertia(6, 2, out()).z));
    });

    it("capsule 2D inertia sits between its rectangle and circle hull", () => {
        const i = new Capsule(1, 2).inertia(1, 2, out()).z;
        assert.ok(i > 0.5 && i < new Box(2, 4).inertia(1, 2, out()).z);
    });

    it("2D bodies support in xy only and turn only about z", () => {
        const world = new World({ dimensions: 2 });
        const body = world.add(new RigidBody({ shape: new Box(2, 2), mass: 1, position: { x: 3, y: 0 } }));
        const p = body.convex.support({ x: 1, y: 1, z: 0 });
        assert.deepStrictEqual([...p], [4, 1], "no z, so gjk runs in 2D");
        assert.strictEqual(body.inverseInertia[0], 0);
        assert.ok(near(body.inverseInertia[8], 1 / (8 / 12)));
    });
});
