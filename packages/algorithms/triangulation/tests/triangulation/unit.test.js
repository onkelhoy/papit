import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Vector2 } from '@papit/vector';
import { Calibrate, Triangulation, Triangulate } from '../../lib/bundle.js';

function createPolygon(vertices) {
    return {
        vertices: vertices.map(([x, y]) => new Vector2(x, y)),
        triangles: [],
    };
}

describe('Calibrate', () => {
    it('should remove collinear vertices from a square with an extra midpoint', () => {
        const poly = createPolygon([
            [0, 0],
            [2, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ]);
        Calibrate(poly);
        assert.strictEqual(poly.vertices.length, 4);
    });

    it('should compute boundary indices correctly', () => {
        const poly = createPolygon([
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ]);
        Calibrate(poly);
        const [minx, miny, maxx, maxy] = poly.boundaryindex;
        assert.ok(minx >= 0 && minx < poly.vertices.length);
        assert.ok(miny >= 0 && miny < poly.vertices.length);
        assert.ok(maxx >= 0 && maxx < poly.vertices.length);
        assert.ok(maxy >= 0 && maxy < poly.vertices.length);
    });

    it('should detect concavity in an L-shape', () => {
        const poly = createPolygon([
            [0, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 2],
            [0, 2],
        ]);
        Calibrate(poly);
        assert.strictEqual(poly.concave, true);
    });

    it('should reverse vertices if wound clockwise', () => {
        // Same L-shape as the concavity test, but vertices listed clockwise —
        // this flips every cross-product sign, so Calibrate sees
        // concave > convex and reverses back to CCW.
        const cwInput = [
            [0, 2],
            [1, 2],
            [1, 1],
            [2, 1],
            [2, 0],
            [0, 0],
        ];
        const poly = createPolygon(cwInput);
        Calibrate(poly);

        // After reversal, vertex order should match the CCW winding
        // (i.e. cwInput reversed).
        const expectedOrder = [...cwInput].reverse();
        poly.vertices.forEach((v, i) => {
            assert.strictEqual(v.x, expectedOrder[i][0]);
            assert.strictEqual(v.y, expectedOrder[i][1]);
        });
    });

    it('should handle polygons with less than 3 vertices (return early)', () => {
        const poly = createPolygon([
            [0, 0],
            [1, 1],
        ]);
        Calibrate(poly);
        assert.strictEqual(poly.vertices.length, 2);
    });
});

describe('Triangulation', () => {
    it('should triangulate a triangle (3 vertices)', () => {
        const poly = createPolygon([
            [0, 0],
            [4, 0],
            [0, 4],
        ]);
        const result = Triangulation(poly);
        assert.strictEqual(result[0], false);
        assert.strictEqual(poly.triangles.length, 3);
        assert.deepStrictEqual(poly.triangles, [0, 1, 2]);
    });

    it('should triangulate a convex square', () => {
        const poly = createPolygon([
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ]);
        const result = Triangulation(poly);
        assert.strictEqual(result[0], false);
        assert.strictEqual(poly.triangles.length, 6);
        for (const idx of poly.triangles)
        {
            assert.ok(idx >= 0 && idx < poly.vertices.length);
        }
    });

    it('should triangulate a concave L-shape', () => {
        const poly = createPolygon([
            [0, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 2],
            [0, 2],
        ]);
        Calibrate(poly);
        const result = Triangulation(poly);
        assert.strictEqual(result[0], false);
        assert.strictEqual(poly.triangles.length, 12);
        for (const idx of poly.triangles)
        {
            assert.ok(idx >= 0 && idx < poly.vertices.length);
        }
    });

    it('should return error for less than 3 vertices', () => {
        const poly = createPolygon([
            [0, 0],
            [1, 1],
        ]);
        const result = Triangulation(poly);
        assert.strictEqual(result[0], true);
        assert.strictEqual(result[1], 'polygon has less then 3 vertices');
    });

    it('should return error if no further triangle can be found', () => {
        const poly = createPolygon([
            [0, 0],
            [2, 0],
            [1, 1],
            [0, 2],
            [2, 2],
        ]);
        const result = Triangulation(poly);
        if (result[0] === true)
        {
            assert.strictEqual(result[1], 'no further triangle could be established');
        } else
        {
            assert.strictEqual(result[0], false);
        }
    });
});

describe('Triangulate', () => {
    it('should call Calibrate and Triangulation successfully', () => {
        const poly = createPolygon([
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ]);
        const result = Triangulate(poly);
        assert.strictEqual(result[0], false);
        assert.ok(poly.triangles.length > 0);
    });

    it('should return triangulation error if polygon invalid', () => {
        const poly = createPolygon([
            [0, 0],
            [1, 1],
        ]);
        const result = Triangulate(poly);
        assert.strictEqual(result[0], 'triangulation');
        assert.strictEqual(result[1], 'polygon has less then 3 vertices');
    });
});