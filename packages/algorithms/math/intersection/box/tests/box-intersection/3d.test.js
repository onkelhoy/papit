import { describe, it } from "node:test";
import assert from "node:assert";
import { AABB, isPointInRectangle, rayBox } from "@papit/box-intersection";

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, expected) => expected.every((e, i) => near(v[i], e));

describe("AABB 3D", () => {
    it("returns the overlapping box", () => {
        const a = { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 };
        const b = { x: 5, y: 5, z: 5, w: 10, h: 10, d: 10 };
        assert.deepStrictEqual(AABB(a, b), { x: 5, y: 5, w: 5, h: 5, z: 5, d: 5 });
    });

    it("counts touching faces as overlap", () => {
        const a = { x: 0, y: 0, z: 0, w: 10, h: 10, depth: 10 };
        const b = { x: 0, y: 0, z: 10, w: 10, h: 10, depth: 10 };
        assert.deepStrictEqual(AABB(a, b), { x: 0, y: 0, w: 10, h: 10, z: 10, d: 0 });
    });

    it("is false when separated on z only", () => {
        const a = { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 };
        const b = { x: 0, y: 0, z: 20, w: 10, h: 10, d: 10 };
        assert.strictEqual(AABB(a, b), false);
    });

    it("ignores z when only one box is 3D", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 5, y: 5, z: 100, w: 10, h: 10, d: 10 };
        assert.deepStrictEqual(AABB(a, b), { x: 5, y: 5, w: 5, h: 5 });
    });
});

describe("isPointInRectangle 3D", () => {
    const box = { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 };
    it("checks z when both have it", () => {
        assert.strictEqual(isPointInRectangle({ x: 5, y: 5, z: 5 }, box), true);
        assert.strictEqual(isPointInRectangle({ x: 5, y: 5, z: 11 }, box), false);
        assert.strictEqual(isPointInRectangle({ x: 5, y: 5, z: 10 }, box), true);
    });

    it("ignores z for a 2D point", () => {
        assert.strictEqual(isPointInRectangle({ x: 5, y: 5 }, box), true);
    });
});

describe("rayBox", () => {
    const box = { x: 0, y: 0, z: 0, w: 2, h: 2, d: 2 };

    it("hits the near face with its normal", () => {
        const hit = rayBox({ x: -3, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, box);
        assert.ok(hit);
        assert.ok(near(hit.t, 3));
        assert.ok(nearVec(hit.point, [0, 1, 1]));
        assert.ok(nearVec(hit.normal, [-1, 0, 0]));
    });

    it("hits from the other side with a positive normal", () => {
        const hit = rayBox({ x: 1, y: 1, z: 5 }, { x: 0, y: 0, z: -2 }, box);
        assert.ok(hit);
        assert.ok(near(hit.t, 1.5));
        assert.ok(nearVec(hit.normal, [0, 0, 1]));
    });

    it("misses", () => {
        assert.strictEqual(rayBox({ x: -3, y: 5, z: 1 }, { x: 1, y: 0, z: 0 }, box), false);
    });

    it("is false when the box is behind", () => {
        assert.strictEqual(rayBox({ x: 5, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, box), false);
    });

    it("hits at t = 0 from inside", () => {
        const hit = rayBox({ x: 1, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, box);
        assert.ok(hit);
        assert.strictEqual(hit.t, 0);
        assert.ok(nearVec(hit.normal, [0, 0, 0]));
    });

    it("handles a ray parallel to a face", () => {
        assert.ok(rayBox({ x: -1, y: 2, z: 1 }, { x: 1, y: 0, z: 0 }, box)); // grazes the top face
        assert.strictEqual(rayBox({ x: -1, y: 2.1, z: 1 }, { x: 1, y: 0, z: 0 }, box), false);
    });

    it("handles a zero direction", () => {
        assert.ok(rayBox({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }, box));
        assert.strictEqual(rayBox({ x: 5, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }, box), false);
    });

    it("works in 2D", () => {
        const hit = rayBox({ x: 1, y: -4 }, { x: 0, y: 2 }, { x: 0, y: 0, w: 2, h: 2 });
        assert.ok(hit);
        assert.ok(near(hit.t, 2));
        assert.strictEqual(hit.point.length, 2);
        assert.ok(nearVec(hit.normal, [0, -1]));
    });
});
