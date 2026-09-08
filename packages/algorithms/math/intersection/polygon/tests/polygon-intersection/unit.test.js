import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    isPointInPolygonRayCasting,
    isPointInPolygonTriangles
} from '@papit/polygon-intersection'; // adjust path to your module

// ------------------------------------------------------------
// Helpers: create polygon objects
// ------------------------------------------------------------
function createSquare() {
    return {
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
        ]
    };
}

function createTriangle() {
    return {
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 5, y: 10 }
        ]
    };
}

function createConcave() {
    return {
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 7, y: 10 },
            { x: 5, y: 5 },   // notch apex
            { x: 3, y: 10 },
            { x: 0, y: 10 }
        ]
    };
}

function createComplex() {
    return {
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
            { x: 0, y: 0 },
            { x: 6, y: 6 },
            { x: 10, y: 6 },
            { x: 10, y: 10 },
            { x: 6, y: 10 },
            { x: 6, y: 6 }
        ]
    };
}

// Polygon with triangles defined (for triangulation test)
function createTriangulatedSquare() {
    // Two triangles: (0,0)-(10,0)-(10,10) and (0,0)-(10,10)-(0,10)
    return {
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
        ],
        triangles: [0, 1, 2, 0, 2, 3] // flat indices: triangle1: v0,v1,v2; triangle2: v0,v2,v3
    };
}

// ------------------------------------------------------------
// Tests for Ray Casting
// ------------------------------------------------------------
describe('isPointInPolygonRayCasting', () => {
    it('should return true for point inside a square', () => {
        const poly = createSquare();
        assert.strictEqual(isPointInPolygonRayCasting({ x: 5, y: 5 }, poly), true);
    });

    it('should return false for point outside a square', () => {
        const poly = createSquare();
        assert.strictEqual(isPointInPolygonRayCasting({ x: 15, y: 5 }, poly), false);
        assert.strictEqual(isPointInPolygonRayCasting({ x: -1, y: 5 }, poly), false);
        assert.strictEqual(isPointInPolygonRayCasting({ x: 5, y: -1 }, poly), false);
    });

    it('should return true for point on the edge of a square (ray casting counts as inside)', () => {
        const poly = createSquare();
        // On the right edge
        assert.strictEqual(isPointInPolygonRayCasting({ x: 10, y: 5 }, poly), true);
        // On the bottom edge
        assert.strictEqual(isPointInPolygonRayCasting({ x: 5, y: 10 }, poly), true);
    });

    it('should return true for point inside a triangle', () => {
        const poly = createTriangle();
        assert.strictEqual(isPointInPolygonRayCasting({ x: 5, y: 3 }, poly), true);
    });

    it('should return false for point outside a triangle', () => {
        const poly = createTriangle();
        assert.strictEqual(isPointInPolygonRayCasting({ x: 0, y: 5 }, poly), false);
        assert.strictEqual(isPointInPolygonRayCasting({ x: 10, y: 5 }, poly), false);
    });

    it('should return true for point inside a concave polygon (notch area)', () => {
        const poly = createConcave();
        assert.strictEqual(isPointInPolygonRayCasting({ x: 5, y: 2 }, poly), true);  // main body
        assert.strictEqual(isPointInPolygonRayCasting({ x: 2, y: 8 }, poly), true);  // left shoulder
        assert.strictEqual(isPointInPolygonRayCasting({ x: 8, y: 8 }, poly), true);  // right shoulder
    });

    it('should return false for point outside a concave polygon', () => {
        const poly = createConcave();
        assert.strictEqual(isPointInPolygonRayCasting({ x: 5, y: 8 }, poly), false); // inside the notch
        assert.strictEqual(isPointInPolygonRayCasting({ x: 12, y: 5 }, poly), false);
    });

    it('should handle degenerate polygons (no area) gracefully', () => {
        const degenerate = { vertices: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] };
        assert.strictEqual(isPointInPolygonRayCasting({ x: 1, y: 1 }, degenerate), false);
    });

    it('should work with a self‑intersecting polygon (undefined behaviour, just ensure no crash)', () => {
        const selfIntersect = {
            vertices: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
                { x: 10, y: 0 }
            ]
        };
        // The function should not throw; result may be unpredictable but we accept it.
        assert.doesNotThrow(() => isPointInPolygonRayCasting({ x: 5, y: 5 }, selfIntersect));
    });
});

// ------------------------------------------------------------
// Tests for Triangulation (deprecated)
// ------------------------------------------------------------
describe('isPointInPolygonTriangles', () => {
    it('should return false if no triangles array is provided', () => {
        const poly = createSquare();
        assert.strictEqual(isPointInPolygonTriangles({ x: 5, y: 5 }, poly), false);
    });

    it('should return true for point inside a triangulated square', () => {
        const poly = createTriangulatedSquare();
        const result = isPointInPolygonTriangles({ x: 5, y: 5 }, poly);
        assert.strictEqual(Array.isArray(result), true);
        assert.strictEqual(result[0], true);
        // result[1] should be an array of three vertices
        assert.strictEqual(result[1].length, 3);
        // Optional: check that the triangle contains the point
        const [a, b, c] = result[1];
        // Use the actual triangle test (we trust isPointInTriangle)
        // We could also check that the point is inside that triangle numerically.
    });

    it('should return false for point outside a triangulated square', () => {
        const poly = createTriangulatedSquare();
        assert.strictEqual(isPointInPolygonTriangles({ x: 15, y: 5 }, poly), false);
    });

    it('should return false for point outside if triangles defined but point outside all', () => {
        const poly = createTriangulatedSquare();
        assert.strictEqual(isPointInPolygonTriangles({ x: -1, y: -1 }, poly), false);
    });

    it('should return a triangle when point is on an edge', () => {
        const poly = createTriangulatedSquare();
        const result = isPointInPolygonTriangles({ x: 10, y: 5 }, poly);
        assert.strictEqual(result[0], true);
        assert.strictEqual(result[1].length, 3);
    });

    it('should handle polygons with more triangles', () => {
        // Use a pentagon triangulated into 3 triangles
        const pentagon = {
            vertices: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 12, y: 6 },
                { x: 5, y: 10 },
                { x: -2, y: 6 }
            ],
            triangles: [0, 1, 2, 0, 2, 3, 0, 3, 4] // fan triangulation
        };
        const result = isPointInPolygonTriangles({ x: 5, y: 4 }, pentagon);
        assert.strictEqual(result[0], true);
    });
});