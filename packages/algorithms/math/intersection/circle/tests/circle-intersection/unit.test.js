// tests/circle-intersection/unit.test.js
import { describe, it } from "node:test";
import assert from "node:assert";
import { CircleIntersection, isPointInCircle } from "@papit/circle-intersection";

function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function isOnCircle(p, center, r, tol = 1e-4) {
    return Math.abs(distance(p, center) - r) < tol;
}

describe("CircleIntersection", () => {
    it("returns intersection points for two overlapping circles of equal radius", () => {
        const a = { x: 0, y: 0, r: 5 };
        const b = { x: 6, y: 0, r: 5 };
        const result = CircleIntersection(a, b);
        assert.notStrictEqual(result, false);
        assert.ok(isOnCircle(result.va, a, 5));
        assert.ok(isOnCircle(result.va, b, 5));
        assert.ok(isOnCircle(result.vb, a, 5));
        assert.ok(isOnCircle(result.vb, b, 5));
        assert.ok(Math.abs(result.vc.x - 3) < 1e-4);
        assert.ok(Math.abs(result.vc.y) < 1e-4);
    });

    it("returns intersection points for circles with different radii", () => {
        const a = { x: 0, y: 0, r: 10 };
        const b = { x: 8, y: 0, r: 6 };
        const result = CircleIntersection(a, b);
        assert.notStrictEqual(result, false);
        assert.ok(isOnCircle(result.va, a, 10));
        assert.ok(isOnCircle(result.va, b, 6));
        assert.ok(isOnCircle(result.vb, a, 10));
        assert.ok(isOnCircle(result.vb, b, 6));
        assert.ok(Math.abs(result.vc.x - 8) < 1e-4);
        assert.ok(Math.abs(result.vc.y) < 1e-4);
    });

    it("returns false when one circle fully contains the other without touching", () => {
        const a = { x: 0, y: 0, r: 10 };
        const b = { x: 2, y: 0, r: 3 };
        assert.strictEqual(CircleIntersection(a, b), false);
    });

    it("returns false for disjoint circles", () => {
        const a = { x: 0, y: 0, r: 5 };
        const b = { x: 12, y: 0, r: 5 };
        assert.strictEqual(CircleIntersection(a, b), false);
    });

    it("returns false for concentric circles", () => {
        const a = { x: 0, y: 0, r: 5 };
        const b = { x: 0, y: 0, r: 3 };
        assert.strictEqual(CircleIntersection(a, b), false);
    });

    it("returns a repeated point when circles touch externally", () => {
        const a = { x: 0, y: 0, r: 5 };
        const b = { x: 10, y: 0, r: 5 };
        const result = CircleIntersection(a, b);
        assert.notStrictEqual(result, false);
        assert.ok(isOnCircle(result.va, a, 5));
        assert.ok(isOnCircle(result.va, b, 5));
        assert.ok(Math.abs(result.h) < 1e-4);
        assert.ok(distance(result.va, result.vb) < 1e-4);
    });

    it("returns a repeated point when one circle touches the other internally", () => {
        const a = { x: 0, y: 0, r: 10 };
        const b = { x: 4, y: 0, r: 6 };
        const result = CircleIntersection(a, b);
        assert.notStrictEqual(result, false);
        assert.ok(isOnCircle(result.va, a, 10));
        assert.ok(isOnCircle(result.va, b, 6));
        assert.ok(Math.abs(result.h) < 1e-4);
    });

    it("works with 'radius' property instead of 'r'", () => {
        const a = { x: 0, y: 0, radius: 5 };
        const b = { x: 6, y: 0, radius: 5 };
        const result = CircleIntersection(a, b);
        assert.notStrictEqual(result, false);
        assert.ok(isOnCircle(result.va, a, 5));
        assert.ok(isOnCircle(result.va, b, 5));
    });
});

describe("isPointInCircle", () => {
    const circle = { x: 0, y: 0, r: 5 };

    it("returns true for a point inside the circle", () => {
        assert.strictEqual(isPointInCircle({ x: 3, y: 4 }, circle), true);
    });

    it("returns true for a point on the circumference", () => {
        assert.strictEqual(isPointInCircle({ x: 5, y: 0 }, circle), true);
    });

    it("returns false for a point outside the circle", () => {
        assert.strictEqual(isPointInCircle({ x: 6, y: 0 }, circle), false);
    });

    it("works with 'radius' property", () => {
        assert.strictEqual(isPointInCircle({ x: 3, y: 4 }, { x: 0, y: 0, radius: 5 }), true);
    });
});