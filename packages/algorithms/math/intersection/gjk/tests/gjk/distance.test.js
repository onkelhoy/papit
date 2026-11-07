import { describe, it } from "node:test";
import assert from "node:assert";
import { boxSupport, capsuleSupport, distance, sphereSupport } from "@papit/gjk";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearVec = (v, expected, eps) => expected.every((e, i) => near(v[i], e, eps));
const sphere = (x, y, z, r) => sphereSupport({ x, y, z, r });
const cube = (x, y, z, size) => boxSupport({ x, y, z, w: size, h: size, d: size });

describe("distance", () => {
    it("sphere vs sphere with closest points", () => {
        const result = distance(sphere(0, 0, 0, 1), sphere(3, 4, 0, 1));
        assert.ok(result);
        assert.ok(near(result.distance, 3));
        assert.ok(nearVec(result.pointA, [0.6, 0.8, 0]));
        assert.ok(nearVec(result.pointB, [2.4, 3.2, 0]));
    });

    it("box vs box, face to face", () => {
        const result = distance(cube(0, 0, 0, 1), cube(3, 0, 0, 1));
        assert.ok(result);
        assert.ok(near(result.distance, 2));
        assert.ok(near(result.pointA[0], 1));
        assert.ok(near(result.pointB[0], 3));
    });

    it("box vs box, corner to corner", () => {
        const result = distance(cube(0, 0, 0, 1), cube(2, 2, 2, 1));
        assert.ok(result);
        assert.ok(near(result.distance, Math.sqrt(3)));
        assert.ok(nearVec(result.pointA, [1, 1, 1]));
        assert.ok(nearVec(result.pointB, [2, 2, 2]));
    });

    it("capsule vs box", () => {
        const capsule = capsuleSupport({ a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 2, z: 0 }, r: 0.5 });
        const result = distance(capsule, cube(2, 0, 0, 1));
        assert.ok(result);
        assert.ok(near(result.distance, 1.5));
    });

    it("near-touching (1e-6)", () => {
        const result = distance(sphere(0, 0, 0, 1), sphere(2 + 1e-6, 0, 0, 1));
        assert.ok(result);
        assert.ok(near(result.distance, 1e-6, 1e-9));

        const boxes = distance(cube(0, 0, 0, 1), cube(1 + 1e-6, 0.5, 0.5, 1));
        assert.ok(boxes);
        assert.ok(near(boxes.distance, 1e-6, 1e-9));
    });

    it("2D squares give 2D points", () => {
        const result = distance(boxSupport({ x: 0, y: 0, w: 1, h: 1 }), boxSupport({ x: 4, y: 5, w: 1, h: 1 }));
        assert.ok(result);
        assert.ok(near(result.distance, 5));
        assert.strictEqual(result.pointA.length, 2);
        assert.ok(nearVec(result.pointA, [1, 1]));
        assert.ok(nearVec(result.pointB, [4, 5]));
    });

    it("false when overlapping or touching", () => {
        assert.strictEqual(distance(sphere(0, 0, 0, 1), sphere(1, 0, 0, 1)), false);
        assert.strictEqual(distance(cube(0, 0, 0, 1), cube(1, 0, 0, 1)), false);
    });
});
