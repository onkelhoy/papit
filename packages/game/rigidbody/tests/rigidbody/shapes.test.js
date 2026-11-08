import { describe, it } from "node:test";
import assert from "node:assert";
import { Box, Capsule, Hull, Plane, RigidBody, Sphere, World } from "@papit/rigidbody";
import { Vector3 } from "@papit/vector";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const nearVec = (v, [x, y, z], eps = 1e-9) => near(v.x, x, eps) && near(v.y, y, eps) && near(v.z, z, eps);
const out = () => new Vector3(0, 0, 0);

describe("shapes 3D", () => {
    it("sphere support and inertia", () => {
        const s = new Sphere(2);
        assert.ok(nearVec(s.support(0, 3, 4, out()), [0, 1.2, 1.6]));
        assert.ok(near(s.inertia(5, 3, out()).x, 0.4 * 5 * 4));
    });

    it("box support picks the corner, inertia m/12 (h² + d²)", () => {
        const b = new Box(2, 4, 6);
        assert.ok(nearVec(b.support(1, -1, 1, out()), [1, -2, 3]));
        const i = b.inertia(12, 3, out());
        assert.ok(nearVec(i, [16 + 36, 4 + 36, 4 + 16]));
    });

    it("capsule support lands on a cap, inertia is between its parts", () => {
        const c = new Capsule(1, 2);
        assert.ok(nearVec(c.support(0, 1, 0, out()), [0, 2, 0]));
        const side = c.support(1, 0, 0, out());
        assert.ok(near(side.x, 1) && near(Math.abs(side.y), 1), "a tie lands on either cap");
        const i = c.inertia(1, 3, out());
        assert.ok(i.x > i.y, "longer about the side axes");
        assert.ok(i.y > 0.4 && i.y < 0.5, "between a sphere's and a cylinder's");
    });

    it("hull support ignores interior points", () => {
        const h = new Hull([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0.1, y: 0.1, z: 0 }]);
        assert.ok(nearVec(h.support(1, 1, 0, out()), [1, 0, 0]));
        assert.throws(() => new Hull([]), RangeError);
    });

    it("plane must be static", () => {
        assert.throws(() => new RigidBody({ shape: new Plane(), mass: 1 }), RangeError);
    });

    it("body support is rotated and moved", () => {
        // a quarter turn about z: local +x points to world +y
        const s = Math.SQRT1_2;
        const body = new RigidBody({ shape: new Box(4, 2, 2), position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: s, w: s } });
        const p = body.support(0.01, 1, 0.01, out());
        assert.ok(near(p.y, 2) && near(p.x, 11) && near(p.z, 1), `got ${JSON.stringify(p)}`);
        const min = out(), max = out();
        body.bounds(min, max);
        assert.ok(nearVec(min, [9, -2, -1]) && nearVec(max, [11, 2, 1]));
    });

    it("dynamic bodies take inverse inertia from the shape", () => {
        const world = new World();
        const body = world.add(new RigidBody({ shape: new Sphere(1), mass: 2 }));
        assert.ok(near(body.inverseInertia[0], 1 / 0.8));
        assert.ok(near(body.inverseInertia[1], 0));
    });
});

describe("ConvexShape and matrix", () => {
    it("takes any gjk convex, estimating inertia from its bounds", async () => {
        const { boxSupport } = await import("@papit/gjk");
        const { ConvexShape } = await import("@papit/rigidbody");
        const shape = new ConvexShape(boxSupport({ x: -1, y: -2, z: -3, w: 2, h: 4, d: 6 }));
        assert.ok(nearVec(shape.support(1, 1, 1, out()), [1, 2, 3]));
        assert.ok(nearVec(shape.inertia(12, 3, out()), new Box(2, 4, 6).inertia(12, 3, out())));
        const given = new ConvexShape(boxSupport({ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 }), { x: 1, y: 2, z: 3 });
        assert.ok(nearVec(given.inertia(2, 3, out()), [2, 4, 6]));
    });

    it("body.matrix writes rotation and position for WebGL", () => {
        const s = Math.SQRT1_2;
        const body = new RigidBody({ position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: s, w: s } });
        const m = body.matrix(new Float32Array(16));
        assert.deepStrictEqual([...m.subarray(12)], [1, 2, 3, 1]);
        assert.ok(near(m[1], 1, 1e-6), "local x turns to world y");
    });
});
