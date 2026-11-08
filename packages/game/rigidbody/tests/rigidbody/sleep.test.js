import { describe, it } from "node:test";
import assert from "node:assert";
import { RigidBody, World, Plane, Box, Sphere } from "@papit/rigidbody";

function run(world, seconds) {
    for (let i = 0; i < seconds * 120; i++) world.step();
}

describe("sleeping", () => {
    it("puts a resting box to sleep and keeps it still", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const box = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 0.6, z: 0 } }));
        run(world, 3);
        assert.strictEqual(box.sleeping, true);
        const y = box.position.y;
        run(world, 1);
        assert.strictEqual(box.position.y, y);
        assert.strictEqual(box.velocity.y, 0);
    });

    it("never sleeps while falling", () => {
        const world = new World();
        const body = world.add(new RigidBody({ mass: 1, position: { x: 0, y: 100, z: 0 } }));
        run(world, 2);
        assert.strictEqual(body.sleeping, false);
    });

    it("wakes on impulse", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const box = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 0.5, z: 0 } }));
        run(world, 3);
        assert.strictEqual(box.sleeping, true);
        box.applyImpulse({ x: 0, y: 5, z: 0 });
        assert.strictEqual(box.sleeping, false);
        run(world, 0.1);
        assert.ok(box.position.y > 0.6, "moved up");
    });

    it("wakes when hit by a moving body", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const box = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 0.5, z: 0 } }));
        run(world, 3);
        assert.strictEqual(box.sleeping, true);
        world.add(new RigidBody({ shape: new Sphere(0.5), mass: 1, position: { x: 0, y: 3, z: 0 } }));
        let woke = false;
        for (let i = 0; i < 120 && !woke; i++)
        {
            world.step();
            woke = !box.sleeping;
        }
        assert.ok(woke);
    });

    it("can be turned off", () => {
        const world = new World({ allowSleep: false });
        world.add(new RigidBody({ shape: new Plane() }));
        const box = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 0.5, z: 0 } }));
        run(world, 3);
        assert.strictEqual(box.sleeping, false);
    });
});
