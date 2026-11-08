import { describe, it } from "node:test";
import assert from "node:assert";
import { RigidBody, World } from "@papit/rigidbody";

const run = (world, steps) => { for (let i = 0; i < steps; i++) world.step(); };

describe("2D mode", () => {
    it("falls exactly like 3D", () => {
        const flat = new World({ dimensions: 2 });
        const full = new World({ dimensions: 3 });
        const a = flat.add(new RigidBody({ mass: 1, velocity: { x: 2, y: 3 } }));
        const b = full.add(new RigidBody({ mass: 1, velocity: { x: 2, y: 3, z: 0 } }));
        run(flat, 120);
        run(full, 120);
        assert.strictEqual(a.position.x, b.position.x);
        assert.strictEqual(a.position.y, b.position.y);
    });

    it("keeps z at 0 and rotation about z only", () => {
        const world = new World({ dimensions: 2, gravity: { x: 0, y: -9.81, z: -5 } });
        const body = world.add(new RigidBody({
            mass: 1,
            position: { x: 0, y: 0, z: 4 },
            velocity: { x: 0, y: 0, z: 3 },
            angularVelocity: { x: 1, y: 2, z: 3 },
        }));
        body.applyForce({ x: 0, y: 0, z: 100 });
        body.applyTorque({ x: 5, y: 5, z: 0 });
        run(world, 60);
        assert.strictEqual(body.position.z, 0);
        assert.strictEqual(body.velocity.z, 0);
        assert.strictEqual(body.rotation.x, 0);
        assert.strictEqual(body.rotation.y, 0);
        assert.strictEqual(body.angularVelocity.x, 0);
        assert.strictEqual(body.angularVelocity.y, 0);
        // 3 rad/s for 0.5 s about z
        assert.ok(Math.abs(2 * Math.atan2(body.rotation.z, body.rotation.w) - 1.5) < 1e-3);
    });
});
