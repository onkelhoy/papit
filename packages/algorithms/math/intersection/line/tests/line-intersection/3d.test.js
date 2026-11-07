import { describe, it } from "node:test";
import assert from "node:assert";
import { closestPointOnSegment, closestSegmentPoints, rayPlane } from "@papit/line-intersection";

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, expected) => expected.every((e, i) => near(v[i], e));

describe("closestPointOnSegment", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 0, z: 0 };

    it("projects onto the middle", () => {
        const result = closestPointOnSegment({ x: 4, y: 3, z: 0 }, a, b);
        assert.ok(near(result.t, 0.4));
        assert.ok(nearVec(result.point, [4, 0, 0]));
        assert.ok(near(result.distance, 3));
    });

    it("clamps to the ends", () => {
        assert.ok(near(closestPointOnSegment({ x: -5, y: 0, z: 0 }, a, b).t, 0));
        assert.ok(near(closestPointOnSegment({ x: 15, y: 0, z: 0 }, a, b).t, 1));
    });

    it("handles a zero-length segment", () => {
        const result = closestPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
        assert.strictEqual(result.t, 0);
        assert.strictEqual(result.point.length, 2);
        assert.ok(near(result.distance, 5));
    });
});

describe("closestSegmentPoints", () => {
    it("finds the gap between skew 3D segments", () => {
        const result = closestSegmentPoints(
            { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
            { x: 0, y: -1, z: 2 }, { x: 0, y: 1, z: 2 },
        );
        assert.ok(near(result.s, 0.5));
        assert.ok(near(result.t, 0.5));
        assert.ok(nearVec(result.a, [0, 0, 0]));
        assert.ok(nearVec(result.b, [0, 0, 2]));
        assert.ok(near(result.distance, 2));
    });

    it("is 0 for crossing 2D segments", () => {
        const result = closestSegmentPoints({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 });
        assert.ok(near(result.distance, 0));
        assert.ok(nearVec(result.a, [1, 1]));
    });

    it("clamps when the closest points are at the ends", () => {
        const result = closestSegmentPoints(
            { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
            { x: 3, y: -1, z: 0 }, { x: 3, y: 1, z: 0 },
        );
        assert.ok(near(result.s, 1));
        assert.ok(near(result.distance, 2));
    });

    it("handles parallel segments", () => {
        const result = closestSegmentPoints(
            { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
            { x: 1, y: 3, z: 0 }, { x: 5, y: 3, z: 0 },
        );
        assert.ok(near(result.distance, 3));
    });

    it("handles zero-length segments", () => {
        const point = { x: 0, y: 5, z: 0 };
        const both = closestSegmentPoints(point, point, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        assert.ok(near(both.distance, 5));

        const first = closestSegmentPoints(point, point, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
        assert.ok(near(first.t, 0.5));
        assert.ok(near(first.distance, 5));

        const second = closestSegmentPoints({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, point, point);
        assert.ok(near(second.s, 0.5));
        assert.ok(near(second.distance, 5));
    });
});

describe("rayPlane", () => {
    const floor = { normal: { x: 0, y: 1, z: 0 }, d: 0 };

    it("hits", () => {
        const hit = rayPlane({ x: 1, y: 5, z: 2 }, { x: 0, y: -2, z: 0 }, floor);
        assert.ok(hit);
        assert.ok(near(hit.t, 2.5));
        assert.ok(nearVec(hit.point, [1, 0, 2]));
    });

    it("accepts a point on the plane and a non-unit normal", () => {
        const hit = rayPlane({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { normal: { x: 0, y: 0, z: 3 }, point: { x: 7, y: 7, z: 4 } });
        assert.ok(hit);
        assert.ok(near(hit.t, 4));
    });

    it("is false when the plane is behind", () => {
        assert.strictEqual(rayPlane({ x: 0, y: 5, z: 0 }, { x: 0, y: 1, z: 0 }, floor), false);
    });

    it("is false when parallel", () => {
        assert.strictEqual(rayPlane({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, floor), false);
    });

    it("hits at t = 0 when lying in the plane", () => {
        const hit = rayPlane({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, floor);
        assert.ok(hit);
        assert.strictEqual(hit.t, 0);
    });
});
