import { describe, it } from "node:test";
import assert from "node:assert";
import { boxSupport, capsuleSupport, hullSupport, margin, sphereSupport, transformed, translated } from "@papit/gjk";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const nearPoint = (p, expected) => {
    const keys = ["x", "y", "z"];
    for (let i = 0; i < expected.length; i++)
    {
        assert.ok(near(p[keys[i]], expected[i]), `${keys[i]}: ${p[keys[i]]} vs ${expected[i]}`);
    }
};
const d = (x, y, z = 0) => ({ x, y, z });
const S = Math.SQRT1_2;

describe("sphereSupport", () => {
    it("3D: center plus r along axis and diagonal", () => {
        const s = sphereSupport({ x: 1, y: 2, z: 3, r: 2 });
        nearPoint(s.support(d(0, 0, 5)), [1, 2, 5]);
        nearPoint(s.support(d(-1, 0, 0)), [-1, 2, 3]);
        nearPoint(s.support(d(1, 1, 0)), [1 + 2 * S, 2 + 2 * S, 3]);
    });

    it("2D: returns no z", () => {
        const p = sphereSupport({ x: 0, y: 0, r: 1 }).support(d(0, -3));
        nearPoint(p, [0, -1]);
        assert.strictEqual(p.z, undefined);
    });

    it("zero direction gives the center", () => {
        nearPoint(sphereSupport({ x: 4, y: 5, z: 6, r: 1 }).support(d(0, 0, 0)), [4, 5, 6]);
    });
});

describe("boxSupport", () => {
    const box = boxSupport({ x: 0, y: 0, z: 0, w: 2, h: 3, depth: 4 });

    it("picks the corner along each axis sign", () => {
        nearPoint(box.support(d(1, 1, 1)), [2, 3, 4]);
        nearPoint(box.support(d(-1, -1, -1)), [0, 0, 0]);
        nearPoint(box.support(d(1, -1, 1)), [2, 0, 4]);
    });

    it("2D with long size names", () => {
        const p = boxSupport({ x: 1, y: 1, width: 2, height: 2 }).support(d(-1, 1));
        nearPoint(p, [1, 3]);
        assert.strictEqual(p.z, undefined);
    });
});

describe("capsuleSupport", () => {
    const capsule = capsuleSupport({ a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 4, z: 0 }, r: 1 });

    it("uses the end furthest along the direction", () => {
        nearPoint(capsule.support(d(0, 1, 0)), [0, 5, 0]);
        nearPoint(capsule.support(d(0, -1, 0)), [0, -1, 0]);
    });

    it("sideways and diagonal", () => {
        nearPoint(capsule.support(d(1, 0, 0)), [1, 0, 0]);
        nearPoint(capsule.support(d(1, 1, 0)), [S, 4 + S, 0]);
    });
});

describe("hullSupport", () => {
    it("returns the furthest point, ignoring interior points", () => {
        const hull = hullSupport([d(0, 0, 0), d(1, 0, 0), d(0, 1, 0), d(0, 0, 1), d(0.1, 0.1, 0.1)]);
        nearPoint(hull.support(d(1, 0, 0)), [1, 0, 0]);
        nearPoint(hull.support(d(0, 0, 1)), [0, 0, 1]);
        nearPoint(hull.support(d(-1, -1, -1)), [0, 0, 0]);
    });

    it("accepts arrays and 2D points", () => {
        const p = hullSupport([[0, 0], [2, 0], [1, 3]]).support(d(0, 1));
        nearPoint(p, [1, 3]);
        assert.strictEqual(p.z, undefined);
    });

    it("throws on no points", () => {
        assert.throws(() => hullSupport([]), RangeError);
    });
});

describe("wrappers", () => {
    const unit = boxSupport({ x: -1, y: -1, z: -1, w: 2, h: 2, d: 2 });

    it("translated moves every support point", () => {
        nearPoint(translated(unit, { x: 10, y: 0, z: -5 }).support(d(1, 1, 1)), [11, 1, -4]);
    });

    it("transformed rotates and translates (column-major 4x4)", () => {
        // 90° about z, then move by (5, 0, 0)
        const m = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1];
        const rod = transformed(boxSupport({ x: 0, y: -0.5, z: -0.5, w: 4, h: 1, d: 1 }), m);
        // the rod now points along +y from (5, 0, 0)
        assert.ok(near(rod.support(d(0, 1, 0)).y, 4));
        assert.ok(near(rod.support(d(0, -1, 0)).y, 0));
        assert.ok(near(rod.support(d(1, 0, 0)).x, 5.5));
        assert.ok(near(rod.support(d(-1, 0, 0)).x, 4.5));
    });

    it("transformed scales a 2D shape (3x3)", () => {
        const m = [2, 0, 0, 0, 3, 0, 1, 1, 1];
        const p = transformed(sphereSupport({ x: 0, y: 0, r: 1 }), m).support(d(0, 1));
        nearPoint(p, [1, 4]);
    });

    it("transformed throws on a wrong matrix size", () => {
        assert.throws(() => transformed(unit, [1, 0, 0, 1]), RangeError);
    });

    it("margin grows along the direction", () => {
        nearPoint(margin(unit, 0.5).support(d(1, 0, 0)), [1.5, 1, 1]);
        nearPoint(margin(unit, 1).support(d(1, 1, 0)), [1 + S, 1 + S, 1]);
    });
});
