import { describe, it } from "node:test";
import assert from "node:assert";
import { boxSupport, hullSupport, penetration, sphereSupport } from "@papit/gjk";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearVec = (v, expected, eps) => expected.every((e, i) => near(v[i], e, eps));
const sphere = (x, y, z, r) => sphereSupport({ x, y, z, r });
const cube = (x, y, z, size) => boxSupport({ x, y, z, w: size, h: size, d: size });

describe("penetration 3D", () => {
    it("sphere vs sphere: depth and normal from a to b", () => {
        const result = penetration(sphere(0, 0, 0, 1), sphere(1.5, 0.3, 0.2, 1));
        assert.ok(result);
        const length = Math.hypot(1.5, 0.3, 0.2);
        assert.ok(near(result.depth, 2 - length));
        assert.ok(nearVec(result.normal, [1.5 / length, 0.3 / length, 0.2 / length]));
    });

    it("normal flips when the shapes swap", () => {
        const result = penetration(sphere(1.5, 0, 0, 1), sphere(0, 0, 0, 1));
        assert.ok(result);
        assert.ok(nearVec(result.normal, [-1, 0, 0]));
    });

    it("box vs box: the shallowest axis", () => {
        const result = penetration(cube(0, 0, 0, 2), cube(0.2, 0.3, 1.9, 2));
        assert.ok(result);
        assert.ok(near(result.depth, 0.1));
        assert.ok(nearVec(result.normal, [0, 0, 1]));
    });

    it("sphere vs box", () => {
        const result = penetration(cube(0, 0, 0, 2), sphere(1, 2.5, 1, 1));
        assert.ok(result);
        assert.ok(near(result.depth, 0.5));
        assert.ok(nearVec(result.normal, [0, 1, 0]));
    });

    it("near-touching boxes", () => {
        const result = penetration(cube(0, 0, 0, 1), cube(1 - 1e-6, 0.5, 0.5, 1));
        assert.ok(result);
        assert.ok(near(result.depth, 1e-6, 1e-9));
        assert.ok(nearVec(result.normal, [1, 0, 0]));
    });

    it("touching faces: depth 0", () => {
        const result = penetration(cube(0, 0, 0, 1), cube(1, 0, 0, 1));
        assert.ok(result);
        assert.ok(near(result.depth, 0));
    });

    it("flat shapes in 3D: no depth out of their plane", () => {
        const a = hullSupport([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }]);
        const b = hullSupport([{ x: 1, y: 1, z: 0 }, { x: 3, y: 1, z: 0 }, { x: 3, y: 3, z: 0 }, { x: 1, y: 3, z: 0 }]);
        const result = penetration(a, b);
        assert.ok(result);
        assert.ok(near(result.depth, 0));
        assert.ok(near(Math.abs(result.normal[2]), 1));
    });

    it("false when separated", () => {
        assert.strictEqual(penetration(sphere(0, 0, 0, 1), sphere(3, 0, 0, 1)), false);
    });
});

describe("penetration 2D", () => {
    it("circle vs circle", () => {
        const result = penetration(sphereSupport({ x: 0, y: 0, r: 1 }), sphereSupport({ x: 0.3, y: 1.2, r: 1 }));
        assert.ok(result);
        const length = Math.hypot(0.3, 1.2);
        assert.strictEqual(result.normal.length, 2);
        assert.ok(near(result.depth, 2 - length));
        assert.ok(nearVec(result.normal, [0.3 / length, 1.2 / length]));
    });

    it("square vs square", () => {
        const result = penetration(boxSupport({ x: 0, y: 0, w: 2, h: 2 }), boxSupport({ x: 1.5, y: 0.5, w: 2, h: 2 }));
        assert.ok(result);
        assert.ok(near(result.depth, 0.5));
        assert.ok(nearVec(result.normal, [1, 0]));
    });
});
