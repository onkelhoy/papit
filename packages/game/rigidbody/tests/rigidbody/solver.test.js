import { describe, it } from "node:test";
import assert from "node:assert";
import { Box, Circle, Plane, RigidBody, Sphere, World } from "@papit/rigidbody";

const run = (world, seconds, each) => {
    const steps = Math.round(seconds / world.timestep);
    for (let i = 0; i < steps; i++)
    {
        world.step();
        each?.();
    }
};

/** peak heights between bounces */
function peaks(body, world, seconds) {
    const found = [];
    let last = body.velocity.y;
    run(world, seconds, () => {
        if (last > 0 && body.velocity.y <= 0) found.push(body.position.y);
        last = body.velocity.y;
    });
    return found;
}

describe("solver", () => {
    it("ball bounces lower each time", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const ball = world.add(new RigidBody({ shape: new Sphere(0.5), mass: 1, restitution: 0.7, position: { x: 0, y: 3, z: 0 } }));
        const heights = peaks(ball, world, 4);
        assert.ok(heights.length >= 3, `got ${heights}`);
        assert.ok(heights[0] < 3);
        for (let i = 1; i < heights.length; i++) assert.ok(heights[i] < heights[i - 1], `got ${heights}`);
        assert.ok(Math.abs(heights[0] - 0.5 - 2.5 * 0.49) < 0.15, `first peak near e² of the drop, got ${heights[0]}`);
    });

    it("ball without restitution stays down", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const ball = world.add(new RigidBody({ shape: new Sphere(0.5), mass: 1, position: { x: 0, y: 2, z: 0 } }));
        run(world, 2);
        assert.ok(Math.abs(ball.position.y - 0.5) < 0.01, `y ${ball.position.y}`);
        assert.ok(Math.abs(ball.velocity.y) < 0.05);
    });

    it("tilted box comes to rest flat", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const angle = 0.4;
        const box = world.add(new RigidBody({
            shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 1.5, z: 0 },
            rotation: { x: Math.sin(angle / 2) * 0.6, y: 0, z: Math.sin(angle / 2) * 0.8, w: Math.cos(angle / 2) },
        }));
        run(world, 5);
        const speed = Math.hypot(box.velocity.x, box.velocity.y, box.velocity.z);
        const spin = Math.hypot(box.angularVelocity.x, box.angularVelocity.y, box.angularVelocity.z);
        assert.ok(speed < 0.02 && spin < 0.05, `speed ${speed} spin ${spin}`);
        assert.ok(Math.abs(box.position.y - 0.5) < 0.02, `y ${box.position.y}`);
        // some local axis points straight up
        const q = box.rotation;
        const ups = [
            2 * (q.x * q.y + q.z * q.w),
            1 - 2 * (q.x * q.x + q.z * q.z),
            2 * (q.y * q.z - q.x * q.w),
        ];
        assert.ok(ups.some(u => Math.abs(Math.abs(u) - 1) < 0.01), `ups ${ups}`);
    });

    it("box on box stack stays put", () => {
        const world = new World();
        world.add(new RigidBody({ shape: new Plane() }));
        const low = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 0.5, z: 0 } }));
        const high = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, position: { x: 0, y: 1.5, z: 0 } }));
        run(world, 3);
        assert.ok(Math.abs(low.position.y - 0.5) < 0.02 && Math.abs(high.position.y - 1.5) < 0.03, `${low.position.y} ${high.position.y}`);
        assert.ok(Math.abs(high.position.x) < 0.01 && Math.abs(high.position.z) < 0.01);
    });

    it("friction stops a sliding box, none lets it slide", () => {
        const slide = (friction) => {
            const world = new World();
            world.add(new RigidBody({ shape: new Plane(), friction }));
            const box = world.add(new RigidBody({ shape: new Box(1, 1, 1), mass: 1, friction, position: { x: 0, y: 0.5, z: 0 }, velocity: { x: 3, y: 0, z: 0 } }));
            run(world, 2);
            return box;
        };
        const grip = slide(0.8), ice = slide(0);
        assert.ok(Math.abs(grip.velocity.x) < 0.01, `grip ${grip.velocity.x}`);
        assert.ok(Math.abs(ice.velocity.x - 3) < 0.01, `ice ${ice.velocity.x}`);
        assert.ok(grip.position.x < 1, "3²/(2·0.8·9.81) ≈ 0.57 m");
    });

    it("2D circle rolls to rest on a 2D box floor", () => {
        const world = new World({ dimensions: 2 });
        world.add(new RigidBody({ shape: new Box(20, 1), position: { x: 0, y: -0.5 } }));
        const ball = world.add(new RigidBody({ shape: new Circle(0.5), mass: 1, position: { x: 0, y: 2 } }));
        run(world, 2);
        assert.ok(Math.abs(ball.position.y - 0.5) < 0.02, `y ${ball.position.y}`);
        assert.strictEqual(ball.position.z, 0);
    });
});
