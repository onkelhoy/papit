import { describe, it } from "node:test";
import assert from "node:assert";
import { boxSupport, capsuleSupport, gjk, hullSupport, sphereSupport } from "@papit/gjk";

const sphere = (x, y, z, r) => sphereSupport({ x, y, z, r });
const cube = (x, y, z, size) => boxSupport({ x, y, z, w: size, h: size, d: size });
const point = (x, y, z) => hullSupport([{ x, y, z }]);

describe("gjk 3D", () => {
    it("sphere vs sphere", () => {
        assert.strictEqual(gjk(sphere(0, 0, 0, 1), sphere(1.5, 0, 0, 1)), true);
        assert.strictEqual(gjk(sphere(0, 0, 0, 1), sphere(2.01, 0, 0, 1)), false);
        assert.strictEqual(gjk(sphere(0, 0, 0, 1), sphere(0, 2, 0, 1)), true, "touching");
        assert.strictEqual(gjk(sphere(0, 0, 0, 5), sphere(1, 1, 1, 1)), true, "deep containment");
    });

    it("box vs box", () => {
        assert.strictEqual(gjk(cube(0, 0, 0, 2), cube(1, 1, 1, 2)), true);
        assert.strictEqual(gjk(cube(0, 0, 0, 2), cube(0, 0, 3, 2)), false, "separated on z only");
        assert.strictEqual(gjk(cube(0, 0, 0, 2), cube(2, 0, 0, 2)), true, "touching faces");
        assert.strictEqual(gjk(cube(0, 0, 0, 2), cube(0, 0, 0, 2)), true, "identical");
        assert.strictEqual(gjk(cube(0, 0, 0, 10), cube(4, 4, 4, 1)), true, "deep containment");
    });

    it("sphere vs box", () => {
        assert.strictEqual(gjk(sphere(3, 1, 1, 1.5), cube(0, 0, 0, 2)), true);
        assert.strictEqual(gjk(sphere(3, 3, 3, 1), cube(0, 0, 0, 2)), false, "near the corner but outside");
    });

    it("capsule vs box", () => {
        const capsule = capsuleSupport({ a: { x: -3, y: 1, z: 1 }, b: { x: 5, y: 1, z: 1 }, r: 0.5 });
        assert.strictEqual(gjk(capsule, cube(0, 0, 0, 2)), true);
        assert.strictEqual(gjk(capsule, cube(0, 3, 0, 2)), false);
    });

    it("hull (tetrahedron) vs sphere", () => {
        const tetra = hullSupport([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]);
        assert.strictEqual(gjk(tetra, sphere(1, 1, 1, 0.5)), false);
        assert.strictEqual(gjk(tetra, sphere(1, 1, 1, 1.2)), true);
    });

    it("point vs shape", () => {
        assert.strictEqual(gjk(point(1, 1, 1), cube(0, 0, 0, 2)), true);
        assert.strictEqual(gjk(point(3, 1, 1), cube(0, 0, 0, 2)), false);
        assert.strictEqual(gjk(point(0, 0, 2), sphere(0, 0, 0, 2)), true, "on the surface");
    });
});

describe("gjk 2D", () => {
    const circle = (x, y, r) => sphereSupport({ x, y, r });
    const square = (x, y, size) => boxSupport({ x, y, w: size, h: size });

    it("circle vs circle", () => {
        assert.strictEqual(gjk(circle(0, 0, 1), circle(1, 1, 1)), true);
        assert.strictEqual(gjk(circle(0, 0, 1), circle(3, 0, 1)), false);
        assert.strictEqual(gjk(circle(0, 0, 1), circle(2, 0, 1)), true, "touching");
    });

    it("square vs triangle", () => {
        const triangle = hullSupport([[0, 0], [4, 0], [0, 4]]);
        assert.strictEqual(gjk(square(1, 1, 1), triangle), true, "inside");
        assert.strictEqual(gjk(square(2.5, 2.5, 1), triangle), false, "past the hypotenuse");
        assert.strictEqual(gjk(square(2, 2, 1), triangle), true, "touching the hypotenuse");
    });

    it("identical and point", () => {
        assert.strictEqual(gjk(square(0, 0, 1), square(0, 0, 1)), true);
        assert.strictEqual(gjk(hullSupport([[0.5, 0.5]]), square(0, 0, 1)), true);
        assert.strictEqual(gjk(hullSupport([[1.5, 0.5]]), square(0, 0, 1)), false);
    });
});

describe("gjk with @papit/vector", () => {
    it("takes Vector2 / Vector3 points and custom Convex shapes returning vectors", async () => {
        const { Vector2, Vector3 } = await import("@papit/vector");
        const ball = (center, r) => ({
            support(direction) {
                const d = new Vector3(direction);
                const length = d.magnitude || 1;
                return new Vector3(center.x + d.x / length * r, center.y + d.y / length * r, center.z + d.z / length * r);
            },
        });
        assert.strictEqual(gjk(ball(new Vector3(0, 0, 0), 1), hullSupport([new Vector3(0.5, 0, 0)])), true);
        assert.strictEqual(gjk(ball(new Vector3(0, 0, 0), 1), hullSupport([new Vector3(2, 0, 0)])), false);
        const capsule = capsuleSupport({ a: new Vector2(0, 0), b: new Vector2(0, 3), r: 1 });
        assert.strictEqual(gjk(capsule, hullSupport([new Vector2(0.5, 2)])), true);
    });
});
