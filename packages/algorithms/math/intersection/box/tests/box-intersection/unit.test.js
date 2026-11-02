import { describe, it } from "node:test";
import assert from "node:assert";
import { AABB, isPointInRectangle } from "@papit/box-intersection"; // adjust import path as needed

// Minimal Vector2 mock if not imported; the real Vector2 from @papit/vector also works
// We'll just use plain objects for simplicity, since isPointInRectangle only expects x and y.
// If you need a real Vector2, import it and use new Vector2(x, y).

describe("AABB (Axis-Aligned Bounding Box) collision", () => {
    it("should return the overlapping rectangle when two rectangles overlap", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 5, y: 5, w: 10, h: 10 };
        const result = AABB(a, b);
        assert.deepStrictEqual(result, { x: 5, y: 5, w: 5, h: 5 });
    });

    it("should return false when two rectangles do not overlap", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 20, y: 20, w: 10, h: 10 };
        const result = AABB(a, b);
        assert.strictEqual(result, false);
    });

    it("should handle rectangles that touch at an edge (zero‑width or zero‑height overlap)", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 10, y: 5, w: 5, h: 5 }; // touches at x=10
        const result = AABB(a, b);
        // Overlap width is 0, height is 5, so rectangle with w=0
        assert.deepStrictEqual(result, { x: 10, y: 5, w: 0, h: 5 });
    });

    it("should handle rectangles with width/height properties (alternative naming)", () => {
        const a = { x: 0, y: 0, width: 10, height: 10 };
        const b = { x: 5, y: 5, width: 10, height: 10 };
        const result = AABB(a, b);
        // The returned rectangle uses 'w' and 'h' (not 'width'/'height')
        assert.deepStrictEqual(result, { x: 5, y: 5, w: 5, h: 5 });
    });

    it("should work when one rectangle completely contains the other", () => {
        const a = { x: 0, y: 0, w: 20, h: 20 };
        const b = { x: 5, y: 5, w: 5, h: 5 };
        const result = AABB(a, b);
        assert.deepStrictEqual(result, { x: 5, y: 5, w: 5, h: 5 });
    });

    it("should return false when rectangles are separated in x but overlap in y", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 15, y: 5, w: 5, h: 5 };
        const result = AABB(a, b);
        assert.strictEqual(result, false);
    });

    it("should return false when rectangles are separated in y but overlap in x", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 5, y: 15, w: 5, h: 5 };
        const result = AABB(a, b);
        assert.strictEqual(result, false);
    });
});

describe("isPointInRectangle", () => {
    it("should return true for a point strictly inside the rectangle", () => {
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 5, y: 5 };
        assert.strictEqual(isPointInRectangle(point, rect), true);
    });

    it("should return true for a point on the left edge", () => {
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 0, y: 5 };
        assert.strictEqual(isPointInRectangle(point, rect), true);
    });

    it("should return true for a point on the right edge", () => {
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 10, y: 5 };
        assert.strictEqual(isPointInRectangle(point, rect), true);
    });

    it("should return true for a point on the top edge", () => {
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 5, y: 0 };
        assert.strictEqual(isPointInRectangle(point, rect), true);
    });

    it("should return true for a point on the bottom edge", () => {
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 5, y: 10 };
        assert.strictEqual(isPointInRectangle(point, rect), true);
    });

    it("should return false for a point outside the rectangle", () => {
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 15, y: 15 };
        assert.strictEqual(isPointInRectangle(point, rect), false);
    });

    it("should handle rectangles with width/height properties", () => {
        const rect = { x: 0, y: 0, width: 10, height: 10 };
        const pointInside = { x: 5, y: 5 };
        const pointOutside = { x: 11, y: 5 };
        assert.strictEqual(isPointInRectangle(pointInside, rect), true);
        assert.strictEqual(isPointInRectangle(pointOutside, rect), false);
    });

    it("should work with a real Vector2 instance if used (duck typing okay)", () => {
        // If you have Vector2 from @papit/vector, you can construct one:
        // const point = new Vector2(5, 5);
        // For this test we just use a plain object with x/y.
        const rect = { x: 0, y: 0, w: 10, h: 10 };
        const point = { x: 5, y: 5 };
        assert.strictEqual(isPointInRectangle(point, rect), true);
    });
});
