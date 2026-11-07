import { describe, it } from "node:test";
import assert from "node:assert";
import { CircleOverlap, isPointInCircle, rayCircle } from "@papit/circle-intersection";

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, expected) => expected.every((e, i) => near(v[i], e));

describe("isPointInCircle 3D", () => {
    const sphere = { x: 0, y: 0, z: 0, r: 5 };
    it("checks z", () => {
        assert.strictEqual(isPointInCircle({ x: 0, y: 3, z: 4 }, sphere), true); // on the surface
        assert.strictEqual(isPointInCircle({ x: 0, y: 3, z: 4.1 }, sphere), false);
    });
});

describe("CircleOverlap", () => {
    it("returns normal and depth for spheres", () => {
        const result = CircleOverlap({ x: 0, y: 0, z: 0, r: 2 }, { x: 0, y: 0, z: 3, r: 2 });
        assert.ok(result);
        assert.ok(near(result.depth, 1));
        assert.ok(nearVec(result.normal, [0, 0, 1]));
    });

    it("works for 2D circles", () => {
        const result = CircleOverlap({ x: 0, y: 0, r: 1 }, { x: 1, y: 0, radius: 1 });
        assert.ok(result);
        assert.strictEqual(result.normal.length, 2);
        assert.ok(near(result.depth, 1));
    });

    it("counts tangent spheres as depth 0", () => {
        const result = CircleOverlap({ x: 0, y: 0, z: 0, r: 1 }, { x: 2, y: 0, z: 0, r: 1 });
        assert.ok(result);
        assert.ok(near(result.depth, 0));
    });

    it("is false when apart", () => {
        assert.strictEqual(CircleOverlap({ x: 0, y: 0, z: 0, r: 1 }, { x: 0, y: 0, z: 2.01, r: 1 }), false);
    });

    it("picks +x when concentric", () => {
        const result = CircleOverlap({ x: 1, y: 1, z: 1, r: 1 }, { x: 1, y: 1, z: 1, r: 2 });
        assert.ok(result);
        assert.ok(near(result.depth, 3));
        assert.ok(nearVec(result.normal, [1, 0, 0]));
    });
});

describe("rayCircle", () => {
    const sphere = { x: 0, y: 0, z: 0, r: 1 };

    it("hits the near surface", () => {
        const hit = rayCircle({ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: 2 }, sphere);
        assert.ok(hit);
        assert.ok(near(hit.t, 2));
        assert.ok(nearVec(hit.point, [0, 0, -1]));
        assert.ok(nearVec(hit.normal, [0, 0, -1]));
    });

    it("misses to the side", () => {
        assert.strictEqual(rayCircle({ x: 2, y: 0, z: -5 }, { x: 0, y: 0, z: 1 }, sphere), false);
    });

    it("is false when pointing away", () => {
        assert.strictEqual(rayCircle({ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: -1 }, sphere), false);
    });

    it("hits at t = 0 from inside", () => {
        const hit = rayCircle({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 0, z: 0 }, sphere);
        assert.ok(hit);
        assert.strictEqual(hit.t, 0);
        assert.ok(nearVec(hit.normal, [0, 0, 0]));
    });

    it("is false for a zero direction outside", () => {
        assert.strictEqual(rayCircle({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, sphere), false);
    });

    it("hits a zero radius sphere only through its center", () => {
        const point = { x: 0, y: 0, z: 0, r: 0 };
        const hit = rayCircle({ x: -2, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, point);
        assert.ok(hit);
        assert.ok(near(hit.t, 2));
        assert.strictEqual(rayCircle({ x: -2, y: 0.1, z: 0 }, { x: 1, y: 0, z: 0 }, point), false);
    });

    it("works in 2D", () => {
        const hit = rayCircle({ x: -3, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0, radius: 1 });
        assert.ok(hit);
        assert.ok(near(hit.t, 2));
        assert.strictEqual(hit.point.length, 2);
        assert.ok(nearVec(hit.normal, [-1, 0]));
    });
});
