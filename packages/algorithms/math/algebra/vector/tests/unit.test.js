import {describe, it} from "node:test";
import assert from "node:assert";
import {Vector, Vector2, Vector3} from "@papit/vector";

describe("Vector (N-dimensional) tests", () => {

    it('should expose xyzw & rgba getters and setters', () => {
        const v = new Vector(1, 2, 3, 4);
        assert.strictEqual(v.x, 1);
        assert.strictEqual(v.y, 2);
        assert.strictEqual(v.z, 3);
        assert.strictEqual(v.w, 4);

        v.x = 4; v.y = 5; v.z = 6; v.w = 7;
        assert.strictEqual(v.x, 4);
        assert.strictEqual(v.y, 5);
        assert.strictEqual(v.z, 6);
        assert.strictEqual(v.w, 7);

        assert.strictEqual(v.r, 4);
        assert.strictEqual(v.g, 5);
        assert.strictEqual(v.b, 6);
        assert.strictEqual(v.a, 7);

        v.r = 5; v.g = 6; v.b = 7; v.a = 8;
        assert.strictEqual(v.r, 5);
        assert.strictEqual(v.g, 6);
        assert.strictEqual(v.b, 7);
        assert.strictEqual(v.a, 8);
    });

    it("should construct correctly from numbers and arrays", () => {
        const a = new Vector(3); // 3-dimensional zero vector
        assert.deepStrictEqual([...a], [0, 0, 0]);

        const b = new Vector([1, 2, 3]);
        assert.deepStrictEqual([...b], [1, 2, 3]);

        const c = new Vector(1, 2, 3);
        assert.deepStrictEqual([...c], [1, 2, 3]);
    });

    it("should compute magnitude correctly", () => {
        const v = new Vector(3, 4);
        assert.strictEqual(v.magnitude, 5);
    });

    it("should scale magnitude correctly", () => {
        const v = new Vector(3, 4);
        v.magnitude = 10;
        assert.strictEqual(v.magnitude, 10);
        assert.deepStrictEqual([...v], [6, 8]);
    });

    it("should add", () => {
        const vec = new Vector(10, 8, 4);

        const sum1 = vec.clone.add(10);
        assert.deepStrictEqual([...sum1], [20, 18, 14]);

        const sum2 = vec.clone.add([3, 2, 1]);
        assert.deepStrictEqual([...sum2], [13, 10, 5]);

        const sum3 = vec.clone.add([3, 2]);
        assert.deepStrictEqual([...sum3], [13, 10, 7]);

        // static
        const sum4 = Vector.add(vec, 10);
        assert.deepStrictEqual([...sum4], [20, 18, 14]);

        const sum5 = Vector.add(vec, [3, 2, 1]);
        assert.deepStrictEqual([...sum5], [13, 10, 5]);

        const sum6 = Vector.add(vec, [3, 2]);
        assert.deepStrictEqual([...sum6], [13, 10, 7]);
    });

    it("should subtract", () => {
        const vec = new Vector(10, 8, 4);

        const sum1 = vec.clone.subtract(10);
        assert.deepStrictEqual([...sum1], [0, -2, -6]);

        const sum2 = vec.clone.subtract([3, 2, 1]);
        assert.deepStrictEqual([...sum2], [7, 6, 3]);

        const sum3 = vec.clone.subtract([3, 2]);
        assert.deepStrictEqual([...sum3], [7, 6, 1]);

        // static
        const sum4 = Vector.subtract(vec, 10);
        assert.deepStrictEqual([...sum4], [0, -2, -6]);

        const sum5 = Vector.subtract(vec, [3, 2, 1]);
        assert.deepStrictEqual([...sum5], [7, 6, 3]);

        const sum6 = Vector.subtract(vec, [3, 2]);
        assert.deepStrictEqual([...sum6], [7, 6, 1]);
    });

    it("should multiply", () => {
        const vec = new Vector(10, 8, 4);

        const sum1 = vec.clone.multiply(10);
        assert.deepStrictEqual([...sum1], [100, 80, 40]);

        const sum2 = vec.clone.multiply([3, 2, 1]);
        assert.deepStrictEqual([...sum2], [30, 16, 4]);

        const sum3 = vec.clone.multiply([3, 2]);
        assert.deepStrictEqual([...sum3], [30, 16, 12]);

        // static
        const sum4 = Vector.multiply(vec, 10);
        assert.deepStrictEqual([...sum4], [100, 80, 40]);

        const sum5 = Vector.multiply(vec, [3, 2, 1]);
        assert.deepStrictEqual([...sum5], [30, 16, 4]);

        const sum6 = Vector.multiply(vec, [3, 2]);
        assert.deepStrictEqual([...sum6], [30, 16, 12]);
    });

    it("should divide", () => {
        const vec = new Vector(210, 80, 120);

        const sum1 = vec.clone.divide(10);
        assert.deepStrictEqual([...sum1], [21, 8, 12]);

        const sum2 = vec.clone.divide([3, 2, 1]);
        assert.deepStrictEqual([...sum2], [70, 40, 120]);

        const sum3 = vec.clone.divide([3, 2]);
        assert.deepStrictEqual([...sum3], [70, 40, 40]);

        // static
        const sum4 = Vector.divide(vec, 10);
        assert.deepStrictEqual([...sum4], [21, 8, 12]);

        const sum5 = Vector.divide(vec, [3, 2, 1]);
        assert.deepStrictEqual([...sum5], [70, 40, 120]);

        const sum6 = Vector.divide(vec, [3, 2]);
        assert.deepStrictEqual([...sum6], [70, 40, 40]);
    });

    it("should normalize correctly", () => {
        const v = new Vector(3, 4);
        const n = v.clone.normalize();
        assert.ok(Math.abs(n.magnitude - 1) < 1e-6);
    });

    it("should compute dot product correctly", () => {
        const a = new Vector(1, 2, 3);
        const b = new Vector(4, 5, 6);
        const dot = a.dot(b);
        assert.strictEqual(dot, 1 * 4 + 2 * 5 + 3 * 6);
    });

    it("should clone correctly", () => {
        const a = new Vector(1, 2, 3);
        const b = a.clone;
        assert.deepStrictEqual([...a], [...b]);
        b[0] = 10;
        assert.notStrictEqual(a[0], b[0]);
    });
});

describe("Vector2 - 2D tests", () => {

    it("should compute angle correctly", () => {
        const v = new Vector2(0, 1);
        assert.ok(Math.abs(v.angle - Math.PI / 2) < 1e-6);
    });

    it("should set angle correctly", () => {
        const v = new Vector2(1, 0);
        v.angle = Math.PI / 2;
        assert.ok(Math.abs(v.x) < 1e-6);
        assert.ok(Math.abs(v.y - 1) < 1e-6);
    });

    it("should compute perpendicular vectors", () => {
        const a = new Vector2(1, 0);
        const b = new Vector2(0, 1);
        const p = Vector2.perpendicular(a, b);
        assert.ok(p instanceof Vector2);
        assert.strictEqual(p.length, 2);
    });

    it("should compute 2D cross product", () => {
        const a = new Vector2(1, 0);
        const b = new Vector2(0, 1);
        const cross = Vector2.cross(a, b);
        assert.ok(Math.abs(cross - 1) < 1e-6);
    });
});

describe('Vector3 (3D) tests', () => {

    it('should compute cross product correctly', () => {
        const a = new Vector3(1, 0, 0);
        const b = new Vector3(0, 1, 0);
        const c = Vector3.cross(a, b);
        assert.ok(c instanceof Vector3);
        assert.strictEqual(c.x, 0);
        assert.strictEqual(c.y, 0);
        assert.strictEqual(c.z, 1);
    });

    function close(a, b, eps = 1e-10) {
        assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
    }

    it("should rotate around X", () => {
        const v = new Vector3([0, 1, 0]);  // pointing along +Y

        v.rotateX(Math.PI / 2);  // rotate in plane [1,2] => YZ plane

        // +Y rotated 90° around X becomes +Z
        close(v[0], 0);
        close(v[1], 0);
        close(v[2], 1);
    });

    it("should rotate around Y", () => {
        const v = new Vector3([0, 0, 1]); // pointing along +Z

        v.rotateY(Math.PI / 2); // rotate in plane [0,2] => XZ plane

        // +Z rotated 90° around Y becomes -X
        close(v[0], -1);
        close(v[1], 0);
        close(v[2], 0);
    });

    it("should rotate around Z", () => {
        const v = new Vector3([1, 0, 0]); // pointing along +X

        v.rotateZ(Math.PI / 2); // rotate in plane [0,1] => XY plane

        // +X rotated 90° around Z becomes +Y
        close(v[0], 0);
        close(v[1], 1);
        close(v[2], 0);
    });
});