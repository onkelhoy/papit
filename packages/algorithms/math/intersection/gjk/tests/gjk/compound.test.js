import { describe, it } from "node:test";
import assert from "node:assert";
import { boxSupport, distance, gjk, hullSupport, penetration, sphereSupport } from "@papit/gjk";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const box = (x, y, w, h) => boxSupport({ x, y, z: 0, w, h, d: 1 });
const point = (x, y) => hullSupport([{ x, y, z: 0.5 }]);

// an L: a 1x3 upright and a 3x1 foot, the inner corner at (1, 1)
const L = [box(0, 0, 1, 3), box(0, 0, 3, 1)];

describe("compound (Convex[])", () => {
    it("hits when any piece hits", () => {
        assert.strictEqual(gjk(L, point(0.5, 2.5)), true, "in the upright");
        assert.strictEqual(gjk(point(2.5, 0.5), L), true, "in the foot, swapped");
    });

    it("misses the concave corner", () => {
        assert.strictEqual(gjk(L, point(2, 2)), false);
    });

    it("distance to the closest piece", () => {
        const result = distance(L, sphereSupport({ x: 2.5, y: 2.5, z: 0.5, r: 0.5 }));
        assert.ok(result);
        assert.ok(near(result.distance, 1));
        assert.strictEqual(distance(L, point(0.5, 0.5)), false);
    });

    it("penetration of the deepest piece", () => {
        // the probe reaches 0.2 into the upright and 0.6 into the foot
        const probe = boxSupport({ x: 0.8, y: 0.4, z: 0, w: 0.4, h: 0.2, d: 1 });
        const result = penetration(L, probe);
        assert.ok(result);
        assert.ok(near(result.depth, 0.6));
    });

    it("throws on an empty list", () => {
        assert.throws(() => gjk([], point(0, 0)), RangeError);
    });
});
