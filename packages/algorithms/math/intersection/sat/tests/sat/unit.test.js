import { describe, it } from "node:test";
import assert from "node:assert";
import { SAT } from "@papit/sat";

// ---------- Helpers (plain objects, no external class) ----------
function v(x, y) {
    return { x, y };
}

/**
 * Create a polygon as a plain object.
 * If `shapes` is omitted, treat the whole vertex list as one convex shape.
 */
function createPolygon(vertices, shapes) {
    return {
        vertices,
        shapes: shapes || [vertices.map((_, i) => i)], // default: single shape using all indices
    };
}

// ---------- Original test helpers (reimplemented) ----------
function square(x, y, size = 4) {
    return createPolygon([
        v(x, y),
        v(x + size, y),
        v(x + size, y + size),
        v(x, y + size),
    ]);
}

// L-shape: a 2x2 square with a 1x1 notch bitten out of the top-right corner
function lshape(x, y) {
    const verts = [
        v(x, y),
        v(x + 2, y),
        v(x + 2, y + 1),
        v(x + 1, y + 1),
        v(x + 1, y + 2),
        v(x, y + 2),
    ];
    // Decompose into two convex quads (bottom rectangle + top rectangle)
    return createPolygon(verts, [
        [0, 1, 2, 3], // bottom rectangle
        [3, 4, 5, 0], // top rectangle
    ]);
}

// ---------- Tests ----------
describe("SAT", () => {
    // ----- Existing tests (now use plain objects) -----
    describe("convex vs convex", () => {
        it("should detect collision between two overlapping squares", () => {
            const a = square(0, 0);
            const b = square(2, 2);
            const result = SAT(a, b);
            assert.notStrictEqual(result, false);
            assert.ok(result.overlap > 0);
        });

        it("should return false for two separated squares", () => {
            const a = square(0, 0);
            const b = square(10, 10);
            const result = SAT(a, b);
            assert.strictEqual(result, false);
        });

        it("should report zero overlap for two squares touching edge-to-edge", () => {
            const a = square(0, 0);
            const b = square(4, 0); // shares the x=4 edge exactly
            const result = SAT(a, b);
            assert.notStrictEqual(result, false);
            assert.strictEqual(result.overlap, 0);
        });

        it("should be symmetric: SAT(a, b) and SAT(b, a) agree on collision state", () => {
            const a = square(0, 0);
            const b = square(2, 2);
            const ab = SAT(a, b);
            const ba = SAT(b, a);
            assert.notStrictEqual(ab, false);
            assert.notStrictEqual(ba, false);
            assert.strictEqual(ab.overlap, ba.overlap);
        });
    });

    describe("respects move()/set() offsets", () => {
        // We need to add move/set methods manually because we don't have the Polygon class.
        // We'll extend the plain object with those functions for these tests.
        function withMoveSet(poly) {
            const p = { ...poly };
            p.move = function (dx, dy) {
                this.vertices = this.vertices.map(pt => v(pt.x + dx, pt.y + dy));
            };
            p.set = function (x, y) {
                const dx = x - this.vertices[0].x;
                const dy = y - this.vertices[0].y;
                this.vertices = this.vertices.map(pt => v(pt.x + dx, pt.y + dy));
            };
            return p;
        }

        it("should stop colliding once a polygon is moved away", () => {
            const a = square(0, 0);
            const b = withMoveSet(square(2, 2));
            assert.notStrictEqual(SAT(a, b), false);

            b.move(20, 20);
            assert.strictEqual(SAT(a, b), false);
        });

        it("should start colliding once a polygon is moved into range", () => {
            const a = square(0, 0);
            const b = withMoveSet(square(0, 0));
            b.move(20, 20);
            assert.strictEqual(SAT(a, b), false);
            b.set(2, 2);
            assert.notStrictEqual(SAT(a, b), false);
        });
    });

    describe("concave polygons (decomposed shapes)", () => {
        it("should detect collision when overlap is in the solid part of an L-shape", () => {
            const a = lshape(0, 0);
            const b = square(-1, -1, 2);
            const result = SAT(a, b);
            assert.notStrictEqual(result, false);
        });

        it("should NOT detect collision when the other shape sits only in the L-shape's missing notch", () => {
            const a = lshape(0, 0);
            const b = square(1.1, 1.1, 0.8);
            const result = SAT(a, b);
            assert.strictEqual(result, false);
        });
    });

    // ---------- NEW TESTS: simple convex shapes ----------
    describe("triangles", () => {
        it("detects overlapping triangles", () => {
            const a = createPolygon([v(0, 0), v(2, 0), v(1, 2)]);
            const b = createPolygon([v(1, 0.5), v(3, 0.5), v(2, 2.5)]);
            const result = SAT(a, b);
            assert.notStrictEqual(result, false);
            assert.ok(result.overlap > 0);
        });

        it("returns false for separated triangles", () => {
            const a = createPolygon([v(0, 0), v(1, 0), v(0.5, 1)]);
            const b = createPolygon([v(3, 0), v(4, 0), v(3.5, 1)]);
            assert.strictEqual(SAT(a, b), false);
        });

        it("reports zero overlap for triangles touching at a point", () => {
            const a = createPolygon([v(0, 0), v(2, 0), v(1, 2)]);
            const b = createPolygon([v(2, 0), v(4, 0), v(3, 2)]); // share vertex (2,0)
            const result = SAT(a, b);
            assert.notStrictEqual(result, false);
            assert.strictEqual(result.overlap, 0);
        });
    });

    describe("triangle vs square", () => {
        it("detects collision when they overlap", () => {
            const triangle = createPolygon([v(0, 0), v(3, 0), v(1.5, 3)]);
            const square = createPolygon([v(1, 1), v(4, 1), v(4, 4), v(1, 4)]);
            const result = SAT(triangle, square);
            assert.notStrictEqual(result, false);
            assert.ok(result.overlap > 0);
        });

        it("returns false when separated", () => {
            const triangle = createPolygon([v(0, 0), v(1, 0), v(0.5, 1)]);
            const square = createPolygon([v(5, 0), v(7, 0), v(7, 2), v(5, 2)]);
            assert.strictEqual(SAT(triangle, square), false);
        });
    });

    describe("pentagons", () => {
        // Helper to generate regular n-gon vertices
        function regularPolygon(n, radius, cx = 0, cy = 0, rotation = 0) {
            return Array.from({ length: n }, (_, i) => {
                const angle = (2 * Math.PI * i) / n + rotation;
                return v(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            });
        }

        it("detects collision between two overlapping pentagons (one rotated)", () => {
            const pent1 = createPolygon(regularPolygon(5, 2, 0, 0, 0));
            const pent2 = createPolygon(regularPolygon(5, 2, 0, 0, Math.PI / 5));
            const result = SAT(pent1, pent2);
            assert.notStrictEqual(result, false);
            assert.ok(result.overlap > 0);
        });

        it("returns false for two pentagons far apart", () => {
            const pent1 = createPolygon(regularPolygon(5, 2, 0, 0));
            const pent2 = createPolygon(regularPolygon(5, 2, 10, 0));
            assert.strictEqual(SAT(pent1, pent2), false);
        });
    });

    // Additional symmetry test with a triangle and a pentagon
    it("is symmetric for a triangle and a pentagon", () => {
        const a = createPolygon([v(0, 0), v(3, 0), v(1.5, 3)]);
        const b = createPolygon([
            v(1, 1), v(3.5, 1), v(4.5, 2.5), v(3, 4), v(0.5, 3)
        ]);
        const ab = SAT(a, b);
        const ba = SAT(b, a);
        assert.notStrictEqual(ab, false);
        assert.notStrictEqual(ba, false);
        assert.strictEqual(ab.overlap, ba.overlap);
        // Axis direction may be opposite; compare absolute values
        assert.deepStrictEqual(
            { x: Math.abs(ab.axis.x), y: Math.abs(ab.axis.y) },
            { x: Math.abs(ba.axis.x), y: Math.abs(ba.axis.y) }
        );
    });
});