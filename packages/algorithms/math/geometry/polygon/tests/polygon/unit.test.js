import { describe, it } from "node:test";
import assert from "node:assert";
import { Polygon } from "@papit/polygon";

function square() {
    return new Polygon(
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
    );
}

function lshape() {
    return new Polygon(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
    );
}

describe("Polygon", () => {
    describe("center", () => {
        it("should compute the centroid of a square", () => {
            const poly = square();
            assert.strictEqual(poly.center.x, 2);
            assert.strictEqual(poly.center.y, 2);
        });

        it("should shift the centroid when the polygon is moved", () => {
            const poly = square();
            poly.move(10, -5);
            assert.strictEqual(poly.center.x, 12);
            assert.strictEqual(poly.center.y, -3);
        });

        it("should set an absolute offset (not additive) via set()", () => {
            const poly = square();
            poly.move(10, 10);
            poly.set(1, 1);
            assert.strictEqual(poly.center.x, 3);
            assert.strictEqual(poly.center.y, 3);
        });
    });

    describe("vertices / offset", () => {
        it("should apply the offset to vertices()", () => {
            const poly = square();
            poly.move(1, 2);
            const v = poly.vertices[0];
            assert.strictEqual(v.x, 1);
            assert.strictEqual(v.y, 2);
        });

        it("should re-triangulate when vertices are reassigned", () => {
            const poly = square();
            poly.vertices = [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 4 },
                { x: 2, y: 2 },
                { x: 0, y: 4 },
            ];
            assert.strictEqual(poly.vertices.length, 5);
            assert.ok(poly.triangles.length > 0);
        });
    });

    describe("boundary", () => {
        it("should compute a bounding box matching the extents of a square", () => {
            const poly = square();
            const b = poly.boundary;
            assert.strictEqual(b.x, 0);
            assert.strictEqual(b.y, 0);
            assert.strictEqual(b.w, 4);
            assert.strictEqual(b.h, 4);
        });

        it("should have boundaryindex entries within range", () => {
            const poly = square();
            for (const i of poly.boundaryindex)
            {
                assert.ok(i >= 0 && i < poly.vertices.length);
            }
        });
    });

    describe("concave", () => {
        it("should be false for a convex square", () => {
            const poly = square();
            assert.strictEqual(poly.concave, false);
        });

        it("should be true for an L-shape", () => {
            const poly = lshape();
            assert.strictEqual(poly.concave, true);
        });
    });

    describe("getVertex / getEdge / getTriangle", () => {
        it("should return the requested vertex", () => {
            const poly = square();
            const v = poly.getVertex(1);
            assert.strictEqual(v.x, 4);
            assert.strictEqual(v.y, 0);
        });

        it("should throw for an out-of-range vertex index", () => {
            const poly = square();
            assert.throws(() => poly.getVertex(99));
        });

        it("should return a pair of adjacent vertices for an edge, wrapping at the end", () => {
            const poly = square();
            const [a, b] = poly.getEdge(3);
            assert.strictEqual(a.x, 0);
            assert.strictEqual(a.y, 4);
            assert.strictEqual(b.x, 0);
            assert.strictEqual(b.y, 0);
        });

        it("should return three vertices for a triangle", () => {
            const poly = square();
            const [a, b, c] = poly.getTriangle(0);
            assert.ok(a && b && c);
        });

        it("should throw for an out-of-range triangle index", () => {
            const poly = square();
            assert.throws(() => poly.getTriangle(999));
        });
    });
});