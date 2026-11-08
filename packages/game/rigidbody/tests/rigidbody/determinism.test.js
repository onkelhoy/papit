import { describe, it } from "node:test";
import assert from "node:assert";
import { RigidBody, World, Plane, Box, Sphere, Capsule, Circle, Polygon } from "@papit/rigidbody";

function random(seed) {
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function build(dimensions) {
    const next = random(42);
    const world = new World({ dimensions });
    world.add(new RigidBody({ shape: new Plane() }));
    for (let i = 0; i < 40; i++)
    {
        const shape = dimensions === 2
            ? (i % 2 ? new Circle(0.4) : new Polygon([{ x: -0.5, y: -0.3 }, { x: 0.5, y: -0.3 }, { x: 0, y: 0.5 }]))
            : [new Box(0.8, 0.6, 1), new Sphere(0.4), new Capsule(0.3, 0.6)][i % 3];
        world.add(new RigidBody({
            shape,
            mass: 0.5 + next(),
            friction: next(),
            restitution: next() * 0.5,
            position: { x: next() * 4, y: 1 + i * 0.7, z: dimensions === 2 ? 0 : next() * 4 },
            angularVelocity: { x: next(), y: next(), z: next() },
        }));
    }
    return world;
}

function state(world) {
    return world.bodies.flatMap(b => [...b.position, ...b.rotation, ...b.velocity, ...b.angularVelocity, b.sleeping]);
}

describe("determinism", () => {
    for (const dimensions of [2, 3])
    {
        it(`two ${dimensions}D worlds with the same input match bit for bit`, () => {
            const a = build(dimensions), b = build(dimensions);
            for (let i = 0; i < 600; i++)
            {
                a.step();
                b.step();
            }
            assert.deepStrictEqual(state(a), state(b));
        });
    }

    it("update with uneven frames equals the same number of steps", () => {
        const a = build(3), b = build(3);
        let steps = 0;
        for (const delta of [0.013, 0.021, 0.004, 0.033, 0.016, 0.009]) steps += a.update(delta);
        for (let i = 0; i < steps; i++) b.step();
        assert.deepStrictEqual(state(a), state(b));
    });
});
