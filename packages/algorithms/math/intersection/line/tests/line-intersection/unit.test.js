import { describe, it } from "node:test";
import assert from "node:assert";
import { LineIntersection, SegmentIntersection } from "@papit/line-intersection"; // adjust import path

// We use plain objects with x/y properties. The Vector2 methods from @papit/vector
// accept such "VectorValue" objects, so this works without instantiating Vector2.

describe("LineIntersection (infinite lines)", () => {
    it("should return intersection point for two crossing lines", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 10, y: 0 };
        const p3 = { x: 5, y: -5 };
        const p4 = { x: 5, y: 5 };

        const result = LineIntersection(p1, p2, p3, p4);
        assert.notStrictEqual(result, false);
        // The result includes x,y and also t,u
        assert.deepStrictEqual(result, { x: 5, y: 0, t: 0.5, u: 0.5 });
    });

    it("should return intersection point when lines cross at non‑right angles", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 4, y: 4 };
        const p3 = { x: 0, y: 4 };
        const p4 = { x: 4, y: 0 };

        const result = LineIntersection(p1, p2, p3, p4);
        assert.notStrictEqual(result, false);
        // Intersection at (2,2)
        assert.strictEqual(result.x, 2);
        assert.strictEqual(result.y, 2);
        assert.strictEqual(result.t, 0.5);
        assert.strictEqual(result.u, 0.5);
    });

    it("should return false for parallel lines (denominator = 0)", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 10, y: 0 };
        const p3 = { x: 0, y: 5 };
        const p4 = { x: 10, y: 5 };

        const result = LineIntersection(p1, p2, p3, p4);
        assert.strictEqual(result, false);
    });

    it("should return false for coincident lines (denominator = 0)", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 10, y: 0 };
        const p3 = { x: 3, y: 0 };
        const p4 = { x: 7, y: 0 };

        const result = LineIntersection(p1, p2, p3, p4);
        assert.strictEqual(result, false);
    });

    it("should handle negative coordinates correctly", () => {
        const p1 = { x: -5, y: -5 };
        const p2 = { x: 5, y: 5 };
        const p3 = { x: -5, y: 5 };
        const p4 = { x: 5, y: -5 };

        const result = LineIntersection(p1, p2, p3, p4);
        assert.notStrictEqual(result, false);
        assert.strictEqual(result.x, 0);
        assert.strictEqual(result.y, 0);
    });
});

describe("SegmentIntersection (finite segments)", () => {
    it("should return intersection point when segments cross", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 10, y: 0 };
        const p3 = { x: 5, y: -5 };
        const p4 = { x: 5, y: 5 };

        const result = SegmentIntersection(p1, p2, p3, p4);
        assert.notStrictEqual(result, false);
        assert.deepStrictEqual(result, { x: 5, y: 0, t: 0.5, u: 0.5 });
    });

    it("should return false when intersection lies outside first segment (t < 0)", () => {
        const p1 = { x: -5, y: 0 };   // start left
        const p2 = { x: -1, y: 0 };   // end left of crossing line
        const p3 = { x: 0, y: -5 };
        const p4 = { x: 0, y: 5 };

        // The infinite lines intersect at (0,0), but that's outside segment1 (t > 1 or t < 0? Let's check)
        // p1->p2 is from x=-5 to -1, so intersection at x=0 is beyond p2, so t will be >1.
        const result = SegmentIntersection(p1, p2, p3, p4);
        assert.strictEqual(result, false);
    });

    it("should return false when intersection lies outside second segment (u < 0 or u > 1)", () => {
        const p1 = { x: 0, y: -10 };
        const p2 = { x: 0, y: 10 };
        const p3 = { x: 5, y: -5 };
        const p4 = { x: 5, y: 5 };
        // Infinite lines intersect at (0,0)? Actually line1 is x=0, line2 is x=5? Wait, p3->p4 is vertical at x=5, p1->p2 is vertical at x=0 => parallel, so false.
        // Let's use a crossing but outside segment2.
        const p1_ = { x: -5, y: 0 };
        const p2_ = { x: 5, y: 0 };
        const p3_ = { x: 0, y: 5 };
        const p4_ = { x: 0, y: 10 }; // segment2 from y=5 to 10, intersection at (0,0) is outside (u<0)
        const result = SegmentIntersection(p1_, p2_, p3_, p4_);
        assert.strictEqual(result, false);
    });

    it("should return false when segments do not intersect at all (parallel)", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 10, y: 0 };
        const p3 = { x: 0, y: 5 };
        const p4 = { x: 10, y: 5 };
        const result = SegmentIntersection(p1, p2, p3, p4);
        assert.strictEqual(result, false);
    });

    it("should return false when lines intersect but outside both segments", () => {
        // Lines intersect at (10,0) but segments are both to the left
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 5, y: 0 };
        const p3 = { x: 0, y: -5 };
        const p4 = { x: 5, y: 5 };
        // Infinite lines intersect at (5,0)? Actually let's compute: line1 y=0, line2 through (0,-5) and (5,5) slope=2, equation y=2x-5. Intersection: 0=2x-5 => x=2.5. That's within p1-p2 (x=0..5), and within p3-p4 (x=0..5) so it would actually intersect. Need a case where intersection outside.
        // Let's make line2 from x=10 to 15, so intersect at (2.5,0) is outside segment2.
        const p1_ = { x: 0, y: 0 };
        const p2_ = { x: 5, y: 0 };
        const p3_ = { x: 10, y: -5 };
        const p4_ = { x: 15, y: 5 };
        // line1 y=0, line2 through (10,-5) and (15,5) slope=2, equation y=2x-25. Intersection with y=0 => x=12.5, which is outside p1-p2 (0..5)
        const result = SegmentIntersection(p1_, p2_, p3_, p4_);
        assert.strictEqual(result, false);
    });

    it("should return intersection when segments touch at endpoints", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 10, y: 0 };
        const p3 = { x: 10, y: -5 };
        const p4 = { x: 10, y: 5 };
        const result = SegmentIntersection(p1, p2, p3, p4);
        assert.notStrictEqual(result, false);
        assert.strictEqual(result.x, 10);
        assert.strictEqual(result.y, 0);
        assert.strictEqual(result.t, 1);
        assert.strictEqual(result.u, 0.5);
    });

    it("should return false when segments are collinear but disjoint", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 5, y: 0 };
        const p3 = { x: 10, y: 0 };
        const p4 = { x: 15, y: 0 };
        const result = SegmentIntersection(p1, p2, p3, p4);
        assert.strictEqual(result, false); // Lines are parallel/coincident, denominator=0 => false
    });
});