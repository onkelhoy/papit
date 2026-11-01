import { describe, it } from "node:test";
import assert from "node:assert";
import { isPointInTriangle } from "@papit/triangle-intersection";

describe("isPointInTriangle", () => {
    // Triangle vertices in counter‑clockwise (CCW) order.
    // A simple right triangle: (0,0) -> (4,0) -> (0,4)
    const v1 = { x: 0, y: 0 };
    const v2 = { x: 4, y: 0 };
    const v3 = { x: 0, y: 4 };

    it("should return true for a point strictly inside the triangle", () => {
        const p = { x: 1, y: 1 };
        const result = isPointInTriangle(p, v1, v2, v3);
        assert.strictEqual(result, true);
    });

    it("should return true for a point on an edge", () => {
        // Point on the hypotenuse (line from (4,0) to (0,4): x+y=4)
        const p = { x: 2, y: 2 };
        const result = isPointInTriangle(p, v1, v2, v3);
        assert.strictEqual(result, true);
    });

    it("should return true for a point on a vertex", () => {
        const p = { x: 0, y: 0 };
        const result = isPointInTriangle(p, v1, v2, v3);
        assert.strictEqual(result, true);
    });

    it("should return false for a point outside the triangle", () => {
        const p = { x: 5, y: 5 };
        const result = isPointInTriangle(p, v1, v2, v3);
        assert.strictEqual(result, false);
    });

    it("should return false for a point outside but near an edge", () => {
        const p = { x: -1, y: 1 };
        const result = isPointInTriangle(p, v1, v2, v3);
        assert.strictEqual(result, false);
    });

    it("should work with clockwise‑ordered vertices (returns false, as expected)", () => {
        // Same triangle but vertices in clockwise order: (0,0) -> (0,4) -> (4,0)
        const cwV1 = { x: 0, y: 0 };
        const cwV2 = { x: 0, y: 4 };
        const cwV3 = { x: 4, y: 0 };
        const p = { x: 1, y: 1 }; // geometrically inside

        const result = isPointInTriangle(p, cwV1, cwV2, cwV3);
        // The function uses cross(edge, ap) >= 0 for each edge.
        // For CW winding, the cross products will be negative, so it returns false.
        assert.strictEqual(result, false);
    });

    it("should accept Vector2 instances (duck typing works)", () => {
        // Simulate Vector2 objects (they have x/y properties)
        const v1v = { x: 0, y: 0 };
        const v2v = { x: 4, y: 0 };
        const v3v = { x: 0, y: 4 };
        const pv = { x: 2, y: 2 };
        const result = isPointInTriangle(pv, v1v, v2v, v3v);
        assert.strictEqual(result, true);
    });

    it("should throw an error when fewer than 3 vertices are provided", () => {
        const p = { x: 1, y: 1 };
        const vA = { x: 0, y: 0 };
        const vB = { x: 4, y: 0 };

        // @ts-expect-error: intentionally passing only 2 vertices
        assert.throws(() => isPointInTriangle(p, vA, vB), /is not a triangle/);
    });

    it("should throw an error when more than 3 vertices are provided", () => {
        const p = { x: 1, y: 1 };
        const vA = { x: 0, y: 0 };
        const vB = { x: 4, y: 0 };
        const vC = { x: 0, y: 4 };
        const vD = { x: 2, y: 2 };

        // @ts-expect-error: intentionally passing 4 vertices
        assert.throws(() => isPointInTriangle(p, vA, vB, vC, vD), /is not a triangle/);
    });
});