import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Triangulation, Decomposition, isConvex } from '@papit/triangulation';

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/** Compute signed area (positive for CCW) */
function polygonArea(vertices) {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++)
    {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
}

/** Check if two numbers are approximately equal */
function approx(a, b, eps = 1e-9) {
    return Math.abs(a - b) < eps;
}

/** Compute area of a triangle from three vertex indices */
function triangleArea(vertices, i, j, k) {
    const a = vertices[i], b = vertices[j], c = vertices[k];
    return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

/** Sum of triangle areas from a triangulation result */
function sumTriangleAreas(vertices, triangles) {
    let sum = 0;
    for (let t = 0; t < triangles.length; t += 3)
    {
        sum += triangleArea(vertices, triangles[t], triangles[t + 1], triangles[t + 2]);
    }
    return sum;
}

/** Parse a flat shapes array into an array of vertex‑index arrays */
function parseShapes(shapes) {
    const result = [];
    let i = 0;
    while (i < shapes.length)
    {
        const size = shapes[i++];
        const shape = [];
        for (let j = 0; j < size; j++)
        {
            shape.push(shapes[i++]);
        }
        result.push(shape);
    }
    return result;
}

/** Check if a polygon (by indices) is convex using the provided isConvex utility */
function isConvexShape(vertices, indices) {
    const shape = indices.map(i => vertices[i]);
    return isConvex(shape);
}

// ----------------------------------------------------------------------
// Test data
// ----------------------------------------------------------------------

const triangleVerts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
]; // CCW

const squareVerts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
]; // CCW

const concaveLVerts = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
]; // CCW, L‑shape

const pentagonVerts = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2.5, y: 1 },
    { x: 1, y: 2 },
    { x: -0.5, y: 1 },
]; // CCW

// ----------------------------------------------------------------------
// Tests for Triangulation
// ----------------------------------------------------------------------

describe('Triangulation', () => {
    it('should return error for polygon with less than 3 vertices', () => {
        const poly = { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }], triangles: [] };
        const result = Triangulation(poly);
        assert.ok(result.error);
        assert.strictEqual(result.triangles.length, 0);
    });

    it('should triangulate a triangle', () => {
        const poly = { vertices: triangleVerts, triangles: [] };
        const result = Triangulation(poly);
        assert.strictEqual(result.error, false);
        const tris = result.triangles;
        assert.strictEqual(tris.length, 3);
        // The triangle may be output in any order; check it’s the same set
        const set = new Set(tris);
        assert.deepStrictEqual(set, new Set([0, 1, 2]));
        const area = sumTriangleAreas(poly.vertices, tris);
        assert.ok(approx(area, polygonArea(poly.vertices)));
    });

    it('should triangulate a convex square', () => {
        const poly = { vertices: squareVerts, triangles: [] };
        const result = Triangulation(poly);
        assert.strictEqual(result.error, false);
        const tris = result.triangles;
        assert.strictEqual(tris.length, 6); // 2 triangles
        const area = sumTriangleAreas(poly.vertices, tris);
        assert.ok(approx(area, polygonArea(poly.vertices)));
    });

    it('should triangulate a pentagon', () => {
        const poly = { vertices: pentagonVerts, triangles: [] };
        const result = Triangulation(poly);
        assert.strictEqual(result.error, false);
        const tris = result.triangles;
        assert.strictEqual(tris.length, 9); // 3 triangles for 5 vertices
        const area = sumTriangleAreas(poly.vertices, tris);
        assert.ok(approx(area, polygonArea(poly.vertices)));
    });

    it('should triangulate a concave L‑shape', () => {
        const poly = { vertices: concaveLVerts, triangles: [] };
        const result = Triangulation(poly);
        assert.strictEqual(result.error, false);
        const tris = result.triangles;
        assert.strictEqual(tris.length, 12); // 4 triangles for 6 vertices
        const area = sumTriangleAreas(poly.vertices, tris);
        assert.ok(approx(area, polygonArea(poly.vertices)));
    });
});

// ----------------------------------------------------------------------
// Tests for Decomposition
// ----------------------------------------------------------------------

describe('Decomposition', () => {
    it('should return error if triangles are missing or invalid', () => {
        const poly = { vertices: squareVerts, triangles: [] };
        let result = Decomposition(poly);
        assert.ok(result.error);
        assert.strictEqual(result.shapes.length, 0);

        poly.triangles = [0, 1, 2, 3]; // not multiple of 3
        result = Decomposition(poly);
        assert.ok(result.error);
        assert.strictEqual(result.shapes.length, 0);
    });

    it('should decompose a triangle into one convex piece', () => {
        const poly = { vertices: triangleVerts, triangles: [0, 1, 2] };
        const result = Decomposition(poly);
        assert.strictEqual(result.error, false);
        const shapes = parseShapes(result.shapes);
        assert.strictEqual(shapes.length, 1);
        const shape = shapes[0];
        assert.strictEqual(shape.length, 3);
        assert.deepStrictEqual(new Set(shape), new Set([0, 1, 2]));
        assert.ok(isConvexShape(poly.vertices, shape));
        // area check
        const area = shapes.reduce((sum, idxs) => {
            const pts = idxs.map(i => poly.vertices[i]);
            return sum + Math.abs(polygonArea(pts));
        }, 0);
        assert.ok(approx(area, Math.abs(polygonArea(poly.vertices))));
    });

    it('should decompose a convex square into one convex piece', () => {
        // First triangulate the square
        const poly = { vertices: squareVerts, triangles: [] };
        const triResult = Triangulation(poly);
        assert.strictEqual(triResult.error, false);
        poly.triangles = triResult.triangles;

        const result = Decomposition(poly);
        assert.strictEqual(result.error, false);
        const shapes = parseShapes(result.shapes);
        // Should merge the two triangles into one square
        assert.strictEqual(shapes.length, 1);
        const shape = shapes[0];
        assert.strictEqual(shape.length, 4);
        // The order might be 0,1,2,3 or 0,3,2,1; just check set
        assert.deepStrictEqual(new Set(shape), new Set([0, 1, 2, 3]));
        assert.ok(isConvexShape(poly.vertices, shape));
        const area = shapes.reduce((sum, idxs) => {
            const pts = idxs.map(i => poly.vertices[i]);
            return sum + Math.abs(polygonArea(pts));
        }, 0);
        assert.ok(approx(area, Math.abs(polygonArea(poly.vertices))));
    });

    it('should decompose a concave L‑shape into multiple convex pieces', () => {
        const poly = { vertices: concaveLVerts, triangles: [] };
        const triResult = Triangulation(poly);
        assert.strictEqual(triResult.error, false);
        poly.triangles = triResult.triangles;

        const result = Decomposition(poly);
        assert.strictEqual(result.error, false);
        const shapes = parseShapes(result.shapes);
        // Expect at least 2 pieces (the L‑shape is not convex)
        assert.ok(shapes.length >= 2);
        // Each piece must be convex
        for (const shape of shapes)
        {
            assert.ok(isConvexShape(poly.vertices, shape));
        }
        // Total area should match
        const area = shapes.reduce((sum, idxs) => {
            const pts = idxs.map(i => poly.vertices[i]);
            return sum + Math.abs(polygonArea(pts));
        }, 0);
        assert.ok(approx(area, Math.abs(polygonArea(poly.vertices))));
    });

    it('should handle a pentagon (convex) and produce one piece', () => {
        const poly = { vertices: pentagonVerts, triangles: [] };
        const triResult = Triangulation(poly);
        assert.strictEqual(triResult.error, false);
        poly.triangles = triResult.triangles;

        const result = Decomposition(poly);
        assert.strictEqual(result.error, false);
        const shapes = parseShapes(result.shapes);
        // Should be one convex pentagon
        assert.strictEqual(shapes.length, 1);
        const shape = shapes[0];
        assert.strictEqual(shape.length, 5);
        assert.ok(isConvexShape(poly.vertices, shape));
        const area = Math.abs(polygonArea(shapes[0].map(i => poly.vertices[i])));
        assert.ok(approx(area, Math.abs(polygonArea(poly.vertices))));
    });
});