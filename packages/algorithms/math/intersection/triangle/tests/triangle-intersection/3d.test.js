import { describe, it } from "node:test";
import assert from "node:assert";
import { closestPointOnTriangle, rayTriangle } from "@papit/triangle-intersection";

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, expected) => expected.every((e, i) => near(v[i], e));

// right triangle in the z = 0 plane
const a = { x: 0, y: 0, z: 0 };
const b = { x: 4, y: 0, z: 0 };
const c = { x: 0, y: 4, z: 0 };

describe("closestPointOnTriangle", () => {
    const cases = [
        ["face", { x: 1, y: 1, z: 3 }, [1, 1, 0], 3],
        ["vertex a", { x: -1, y: -1, z: 0 }, [0, 0, 0], Math.SQRT2],
        ["vertex b", { x: 6, y: -1, z: 0 }, [4, 0, 0], Math.hypot(2, 1)],
        ["vertex c", { x: -1, y: 6, z: 0 }, [0, 4, 0], Math.hypot(1, 2)],
        ["edge ab", { x: 2, y: -3, z: 0 }, [2, 0, 0], 3],
        ["edge ac", { x: -3, y: 2, z: 0 }, [0, 2, 0], 3],
        ["edge bc", { x: 3, y: 3, z: 0 }, [2, 2, 0], Math.SQRT2],
    ];

    for (const [region, p, expected, distance] of cases)
    {
        it(`finds the closest point in region ${region}`, () => {
            const result = closestPointOnTriangle(p, a, b, c);
            assert.ok(nearVec(result.point, expected), `${Array.from(result.point)}`);
            assert.ok(near(result.distance, distance));
        });
    }

    it("handles a degenerate triangle", () => {
        const result = closestPointOnTriangle({ x: 2, y: 1, z: 0 }, a, b, { x: 2, y: 0, z: 0 });
        assert.ok(nearVec(result.point, [2, 0, 0]));
        assert.ok(near(result.distance, 1));
    });

    it("works in 2D", () => {
        const result = closestPointOnTriangle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 });
        assert.strictEqual(result.point.length, 2);
        assert.ok(near(result.distance, 0));
    });
});

describe("rayTriangle", () => {
    it("hits the face", () => {
        const hit = rayTriangle({ x: 1, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, a, b, c);
        assert.ok(hit);
        assert.ok(near(hit.t, 5));
        assert.ok(near(hit.u, 0.25));
        assert.ok(near(hit.v, 0.25));
        assert.ok(nearVec(hit.point, [1, 1, 0]));
    });

    it("hits from the back", () => {
        assert.ok(rayTriangle({ x: 1, y: 1, z: -5 }, { x: 0, y: 0, z: 1 }, a, b, c));
    });

    it("hits an edge", () => {
        const hit = rayTriangle({ x: 2, y: 2, z: 1 }, { x: 0, y: 0, z: -1 }, a, b, c);
        assert.ok(hit);
        assert.ok(near(hit.u + hit.v, 1));
    });

    it("misses outside", () => {
        assert.strictEqual(rayTriangle({ x: 3, y: 3, z: 5 }, { x: 0, y: 0, z: -1 }, a, b, c), false);
    });

    it("is false when the triangle is behind", () => {
        assert.strictEqual(rayTriangle({ x: 1, y: 1, z: 5 }, { x: 0, y: 0, z: 1 }, a, b, c), false);
    });

    it("is false when parallel", () => {
        assert.strictEqual(rayTriangle({ x: -1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, a, b, c), false);
    });

    it("is false for a degenerate triangle", () => {
        assert.strictEqual(rayTriangle({ x: 1, y: 0, z: 5 }, { x: 0, y: 0, z: -1 }, a, b, { x: 2, y: 0, z: 0 }), false);
    });
});
