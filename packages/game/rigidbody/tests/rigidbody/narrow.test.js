import { describe, it } from "node:test";
import assert from "node:assert";
import { Box, Capsule, Circle, collide, Plane, RawContact, RigidBody, Sphere, World } from "@papit/rigidbody";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearVec = (v, [x, y, z], eps = 1e-6) => near(v.x, x, eps) && near(v.y, y, eps) && near(v.z, z, eps);
const body = (shape, x, y, z = 0, rotation) => new RigidBody({ shape, position: { x, y, z }, rotation, mass: 1 });
const ground = () => new RigidBody({ shape: new Plane() });

describe("collide", () => {
    it("sphere-sphere: exact normal, depth and surface points", () => {
        const out = new RawContact();
        assert.strictEqual(collide(body(new Sphere(1), 0, 0), body(new Sphere(1), 1.5, 0), out), true);
        assert.ok(nearVec(out.normal, [1, 0, 0]));
        assert.strictEqual(out.count, 1);
        assert.ok(near(out.points[0].depth, 0.5));
        assert.ok(nearVec(out.points[0].a, [1, 0, 0]) && nearVec(out.points[0].b, [0.5, 0, 0]));
        assert.strictEqual(collide(body(new Sphere(1), 0, 0), body(new Sphere(1), 2.5, 0), out), false);
    });

    it("box on a plane: four corners", () => {
        const out = new RawContact();
        assert.strictEqual(collide(ground(), body(new Box(2, 2, 2), 0, 0.9), out), true);
        assert.ok(nearVec(out.normal, [0, 1, 0]));
        assert.strictEqual(out.count, 4);
        for (let i = 0; i < out.count; i++) assert.ok(near(out.points[i].depth, 0.1));
    });

    it("box on a plane at 45° yaw still finds four corners", () => {
        const s = Math.sin(Math.PI / 8), c = Math.cos(Math.PI / 8);
        const out = new RawContact();
        collide(ground(), body(new Box(2, 2, 2), 0, 0.9, 0, { x: 0, y: s, z: 0, w: c }), out);
        assert.strictEqual(out.count, 4);
    });

    it("plane second: normal flips to point from a to b", () => {
        const out = new RawContact();
        assert.strictEqual(collide(body(new Sphere(1), 0, 0.5), ground(), out), true);
        assert.ok(nearVec(out.normal, [0, -1, 0]));
        assert.ok(near(out.points[0].depth, 0.5));
        assert.ok(nearVec(out.points[0].a, [0, -0.5, 0]), "a's point is on the sphere");
    });

    it("box on box (GJK/EPA): up normal, depth, face points", () => {
        const out = new RawContact();
        assert.strictEqual(collide(body(new Box(4, 2, 4), 0, 0), body(new Box(2, 2, 2), 0, 1.9), out), true);
        assert.ok(nearVec(out.normal, [0, 1, 0], 1e-5));
        assert.ok(out.count >= 4, `got ${out.count}`);
        for (let i = 0; i < out.count; i++)
        {
            assert.ok(near(out.points[i].depth, 0.1, 1e-5));
            assert.ok(Math.abs(out.points[i].b.x) <= 1 + 1e-6, "points stay on the small box");
        }
    });

    it("capsule lying on a plane: both caps", () => {
        const sideways = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
        const out = new RawContact();
        collide(ground(), body(new Capsule(0.5, 2), 0, 0.45, 0, sideways), out);
        const xs = out.points.slice(0, out.count).map(p => p.b.x);
        assert.ok(Math.min(...xs) < -0.9 && Math.max(...xs) > 0.9, `got ${xs}`);
    });

    it("2D circle vs box", () => {
        const world = new World({ dimensions: 2 });
        const a = world.add(body(new Box(2, 2), 0, 0));
        const b = world.add(body(new Circle(1), 0, 1.8));
        const out = new RawContact();
        assert.strictEqual(collide(a, b, out), true);
        assert.ok(nearVec(out.normal, [0, 1, 0], 1e-5));
        assert.ok(near(out.points[0].depth, 0.2, 1e-5));
    });

    it("misses apart shapes", () => {
        const out = new RawContact();
        assert.strictEqual(collide(body(new Box(1, 1, 1), 0, 0), body(new Capsule(0.5, 1), 3, 0), out), false);
        assert.strictEqual(collide(ground(), body(new Box(1, 1, 1), 0, 2), out), false);
    });
});

describe("narrow phase regressions", () => {
    it("box vs capsule from a real scene does not hang in EPA", () => {
        const a = new RigidBody({ shape: new Box(.6, .6, .6), mass: 1, position: { x: 0.8783260600832868, y: 0.517532069498706, z: -0.19179462596859048 } });
        const b = new RigidBody({ shape: new Capsule(.25, .5), mass: 1, position: { x: 0.1019943652590414, y: 0.5468454585983614, z: 0.2767744333817676 } });
        a.rotation.set([-0.3504015957276102, -0.002650639530701192, 0.33733339669178797, -0.8737378756228914]);
        b.rotation.set([-0.3865374565449176, -0.6225812919021829, 0.6768711867930259, -0.0694746439400423]);
        assert.strictEqual(collide(a, b, new RawContact()), true);
    });
});
