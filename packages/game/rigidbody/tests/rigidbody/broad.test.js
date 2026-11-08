import { describe, it } from "node:test";
import assert from "node:assert";
import { BroadPhase, RigidBody, World, Plane, Box, Sphere, collide, RawContact } from "@papit/rigidbody";

// deterministic pseudo random
function random(seed) {
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

describe("BroadPhase", () => {
    it("finds the same touching pairs as brute force", () => {
        const next = random(7);
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        for (let i = 0; i < 60; i++)
        {
            world.add(new RigidBody({
                shape: i % 2 ? new Box(1, 1, 1) : new Sphere(0.5),
                mass: 1,
                position: { x: next() * 8, y: next() * 4, z: next() * 8 },
            }));
        }
        const bodies = world.bodies, count = bodies.length, raw = new RawContact();
        const brute = [];
        for (let i = 0; i < count; i++)
        {
            for (let j = i + 1; j < count; j++)
            {
                if (bodies[i].isStatic && bodies[j].isStatic) continue;
                if (collide(bodies[i], bodies[j], raw)) brute.push(i * count + j);
            }
        }
        world.step();
        const found = world.contacts.map(m => bodies.indexOf(m.a) * count + bodies.indexOf(m.b));
        assert.ok(brute.length > 10, "scene has contacts");
        assert.deepStrictEqual(found, brute);
    });

    it("skips bodies far apart on any axis", () => {
        const broad = new BroadPhase();
        const bodies = [
            new RigidBody({ shape: new Sphere(1), mass: 1 }),
            new RigidBody({ shape: new Sphere(1), mass: 1, position: { x: 0, y: 5, z: 0 } }),
            new RigidBody({ shape: new Sphere(1), mass: 1, position: { x: 0, y: 0, z: 5 } }),
            new RigidBody({ shape: new Sphere(1), mass: 1, position: { x: 1.5, y: 0, z: 0 } }),
        ];
        assert.strictEqual(broad.update(bodies), 1);
        assert.deepStrictEqual(broad.pairs, [0 * 4 + 3]);
    });

    it("skips static pairs", () => {
        const broad = new BroadPhase();
        assert.strictEqual(broad.update([new RigidBody({ shape: new Plane() }), new RigidBody({ shape: new Sphere(1) })]), 0);
    });
});
