import { describe, it } from "node:test";
import assert from "node:assert";
import { RigidBody, World } from "@papit/rigidbody";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
// semi-implicit Euler: after n steps of dt the drop is g * dt^2 * n(n+1)/2
const drop = (g, dt, n) => g * dt * dt * n * (n + 1) / 2;

describe("World", () => {
    it("drops a body by the semi-implicit Euler distance in 1 s", () => {
        const world = new World({ maxSteps: 1000 });
        const body = world.add(new RigidBody({ mass: 1, position: { x: 0, y: 10, z: 0 } }));
        assert.strictEqual(world.update(1 + 1e-9), 120);
        assert.ok(near(10 - body.position.y, drop(9.81, 1 / 120, 120)));
        assert.ok(near(10 - body.position.y, 4.905, 0.05), "close to g/2");
        assert.ok(near(body.velocity.y, -9.81, 1e-9));
    });

    it("keeps static bodies still", () => {
        const world = new World();
        const ground = world.add(new RigidBody({ position: { x: 1, y: 2, z: 3 } }));
        for (let i = 0; i < 60; i++) world.step();
        assert.deepStrictEqual([...ground.position], [1, 2, 3]);
        assert.strictEqual(ground.isStatic, true);
    });

    it("carries leftover time over to the next update", () => {
        const world = new World({ timestep: 0.1 });
        assert.strictEqual(world.update(0.05), 0);
        assert.strictEqual(world.update(0.06), 1);
    });

    it("caps steps per update", () => {
        const world = new World({ maxSteps: 4 });
        assert.strictEqual(world.update(10), 4);
        assert.strictEqual(world.update(1 / 240), 0, "a slow frame's backlog is dropped");
    });

    it("spins at a constant angular velocity", () => {
        const world = new World({ gravity: { x: 0, y: 0, z: 0 } });
        const body = world.add(new RigidBody({ mass: 1, angularVelocity: { x: 0, y: Math.PI, z: 0 } }));
        for (let i = 0; i < 60; i++) world.step(); // half a second, a quarter turn
        assert.ok(near(body.rotation.y, Math.sin(Math.PI / 4), 1e-3));
        assert.ok(near(body.rotation.w, Math.cos(Math.PI / 4), 1e-3));
    });

    it("rejects a negative mass", () => {
        assert.throws(() => new RigidBody({ mass: -1 }), RangeError);
    });
});
