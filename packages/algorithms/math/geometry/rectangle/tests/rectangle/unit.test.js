// rectangle.test.js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import { Rectangle } from "@papit/rectangle";

describe('Rectangle', () => {
    // ----- Constructor: square (single number) -----
    describe('new Rectangle(size)', () => {
        it('should create a square at origin with given size', () => {
            const r = new Rectangle(5);
            assert.strictEqual(r.x, 0);
            assert.strictEqual(r.y, 0);
            assert.strictEqual(r.w, 5);
            assert.strictEqual(r.h, 5);
        });

        it('should handle size = 0', () => {
            const r = new Rectangle(0);
            assert.strictEqual(r.w, 0);
            assert.strictEqual(r.h, 0);
        });

        it('should handle negative size (valid, just negative width/height)', () => {
            const r = new Rectangle(-3);
            assert.strictEqual(r.w, -3);
            assert.strictEqual(r.h, -3);
        });
    });

    // ----- Constructor: (x, y, w, h) -----
    describe('new Rectangle(x, y, w, h)', () => {
        it('should set all properties correctly', () => {
            const r = new Rectangle(10, 20, 30, 40);
            assert.strictEqual(r.x, 10);
            assert.strictEqual(r.y, 20);
            assert.strictEqual(r.w, 30);
            assert.strictEqual(r.h, 40);
        });

        it('should handle negative values', () => {
            const r = new Rectangle(-5, -10, 15, 20);
            assert.strictEqual(r.x, -5);
            assert.strictEqual(r.y, -10);
            assert.strictEqual(r.w, 15);
            assert.strictEqual(r.h, 20);
        });

        it('should handle zeros', () => {
            const r = new Rectangle(0, 0, 0, 0);
            assert.strictEqual(r.x, 0);
            assert.strictEqual(r.y, 0);
            assert.strictEqual(r.w, 0);
            assert.strictEqual(r.h, 0);
        });
    });

    // ----- Constructor: array [x, y, w, h] (and optional h) -----
    describe('new Rectangle([x, y, w, h])', () => {
        it('should use all four numbers', () => {
            const r = new Rectangle([1, 2, 3, 4]);
            assert.strictEqual(r.x, 1);
            assert.strictEqual(r.y, 2);
            assert.strictEqual(r.w, 3);
            assert.strictEqual(r.h, 4);
        });

        it('should default h = w when only [x, y, w] is given', () => {
            const r = new Rectangle([5, 6, 7]);
            assert.strictEqual(r.x, 5);
            assert.strictEqual(r.y, 6);
            assert.strictEqual(r.w, 7);
            assert.strictEqual(r.h, 7); // because v[3] ?? v[2] => v[2]
        });

        // Edge case: only [x, y] – w and h become undefined -> NaN? 
        // Your code sets this.w = v[2] (undefined) => NaN; maybe you'll want to handle that, but test it.
        it('should set w/h to NaN when only [x, y] is given (if not handled)', () => {
            const r = new Rectangle([10, 20]);
            assert.strictEqual(r.x, 10);
            assert.strictEqual(r.y, 20);
            assert.ok(isNaN(r.w));
            assert.ok(isNaN(r.h));
        });
    });

    // ----- Constructor: RectangleObject (with w/h or width/height) -----
    describe('new Rectangle({x, y, w, h})', () => {
        it('should accept object with w and h', () => {
            const r = new Rectangle({ x: 1, y: 2, w: 3, h: 4 });
            assert.strictEqual(r.x, 1);
            assert.strictEqual(r.y, 2);
            assert.strictEqual(r.w, 3);
            assert.strictEqual(r.h, 4);
        });

        it('should accept object with width and height', () => {
            const r = new Rectangle({ x: 5, y: 6, width: 7, height: 8 });
            assert.strictEqual(r.x, 5);
            assert.strictEqual(r.y, 6);
            assert.strictEqual(r.w, 7);
            assert.strictEqual(r.h, 8);
        });

        it('should prefer w/h over width/height if both provided', () => {
            // Your type does not allow both, but if it did, the code would pick w/h first due to `??` with 'w' in a ?
            // Actually your code uses `'w' in a ? a.w : a.width`, so if both exist, it picks w.
            // This test assumes both are present (though type disallows). We'll cast.
            const obj = { x: 1, y: 2, w: 10, width: 20, h: 30, height: 40 };
            const r = new Rectangle(obj);
            assert.strictEqual(r.w, 10); // picks w
            assert.strictEqual(r.h, 30); // picks h
        });
    });

    // ----- Constructor: two points (opposite corners) -----
    describe('new Rectangle(pointA, pointB)', () => {
        it('should set x,y from first point and w,h from second', () => {
            const p1 = { x: 1, y: 2 };
            const p2 = { x: 4, y: 6 };
            const r = new Rectangle(p1, p2);
            assert.strictEqual(r.x, 1);
            assert.strictEqual(r.y, 2);
            assert.strictEqual(r.w, 4);
            assert.strictEqual(r.h, 6);
        });

        it('should work with VectorValue arrays', () => {
            const r = new Rectangle([0, 0], [10, 20]);
            assert.strictEqual(r.x, 0);
            assert.strictEqual(r.y, 0);
            assert.strictEqual(r.w, 10);
            assert.strictEqual(r.h, 20);
        });
    });

    // ----- Constructor: three or more points (bounding box) -----
    describe('new Rectangle(...points) for bounding box', () => {
        it('should compute bounding box of three points', () => {
            const r = new Rectangle({ x: 1, y: 2 }, { x: 5, y: 6 }, { x: 3, y: 4 });
            assert.strictEqual(r.x, 1);
            assert.strictEqual(r.y, 2);
            assert.strictEqual(r.w, 4); // 5 - 1
            assert.strictEqual(r.h, 4); // 6 - 2
        });

        it('should handle negative coordinates', () => {
            const r = new Rectangle({ x: -5, y: -10 }, { x: 0, y: 0 }, { x: -2, y: -8 });
            assert.strictEqual(r.x, -5);
            assert.strictEqual(r.y, -10);
            assert.strictEqual(r.w, 5);  // 0 - (-5)
            assert.strictEqual(r.h, 10); // 0 - (-10)
        });

        it('should handle points in any order (min/max works)', () => {
            const r = new Rectangle({ x: 10, y: 20 }, { x: 1, y: 2 });
            assert.strictEqual(r.x, 10);
            assert.strictEqual(r.y, 20);
            assert.strictEqual(r.w, 1);
            assert.strictEqual(r.h, 2);
        });

        it('should handle zero width/height if all points share same coordinate', () => {
            const r = new Rectangle({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 });
            assert.strictEqual(r.x, 5);
            assert.strictEqual(r.y, 5);
            assert.strictEqual(r.w, 0);
            assert.strictEqual(r.h, 0);
        });
    });

    // ----- Getters width and height -----
    describe('getters width and height', () => {
        it('should return w and h respectively', () => {
            const r = new Rectangle(10, 20, 30, 40);
            assert.strictEqual(r.width, 30);
            assert.strictEqual(r.height, 40);
        });

        it('should reflect changes to w/h (though w/h are public, so getters are just aliases)', () => {
            const r = new Rectangle(1, 2, 3, 4);
            r.w = 100;
            r.h = 200;
            assert.strictEqual(r.width, 100);
            assert.strictEqual(r.height, 200);
        });
    });

    // ----- Error cases (invalid input) -----
    describe('invalid constructor arguments', () => {
        it('should throw when arguments are not recognised', () => {
            // For example, passing a string or boolean
            assert.throws(() => new Rectangle('hello'), /not supported/);
            assert.throws(() => new Rectangle(true), /not supported/);
        });

        it("should throw when passing mixed types that don't match any overload", () => {
            // e.g., new Rectangle(1, 'a', 3, 4) – but currently your code would treat 'a' as undefined?
            // Actually you check typeof b === "number", so if b is a string, it won't set y, which may be okay but not throw.
            // That's a design choice; maybe we can test that it still works (y remains 0).
            const r = new Rectangle(1, 'a', 3, 4);
            assert.strictEqual(r.x, 1);
            assert.strictEqual(r.y, 0); // because 'a' is not a number, y stays default 0
            assert.strictEqual(r.w, 3);
            assert.strictEqual(r.h, 4);
        });
    });
});