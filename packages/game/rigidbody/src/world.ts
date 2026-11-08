import { Vector3 } from "@papit/vector";
import { RigidBody } from "./body";
import { BroadPhase } from "./broad";
import { Manifold } from "./manifold";
import { multiply3 } from "./math";
import { collide, RawContact } from "./narrow";
import { prepare, solvePositions, solveVelocities } from "./solver";
import { overlap, raycast, type RayHit } from "./query";
import type { Shape } from "./shapes";
import type { QuatInput, VecInput, WorldOptions } from "./types";

const scratch = new Vector3(0, 0, 0);
const raw = new RawContact();
/** dynamic and not sleeping */
function awake(body: RigidBody) { return !body.isStatic && !body.sleeping; }

/** position passes per step */
const POSITION_ITERATIONS = 3;

/**
 * Steps rigid bodies with a fixed timestep (semi-implicit Euler).
 * Feed real frame time to `update`, it runs as many fixed steps as fit.
 */
export class World {
    readonly dimensions: 2 | 3;
    readonly gravity: Vector3;
    readonly timestep: number;
    maxSteps: number;
    iterations: number;
    allowSleep: boolean;
    sleepSpeed: number;
    sleepTime: number;
    readonly bodies: RigidBody[] = [];
    /** this step's touching pairs, in a stable order */
    readonly contacts: Manifold[] = [];

    private accumulator = 0;
    private readonly manifolds = new Map<number, Manifold>();
    private readonly broad = new BroadPhase();
    private stamp = 0;

    constructor(options: WorldOptions = {}) {
        this.dimensions = options.dimensions ?? 3;
        const g = options.gravity ?? { x: 0, y: -9.81 };
        this.gravity = new Vector3(g.x, g.y, this.dimensions === 2 ? 0 : g.z ?? 0);
        this.timestep = options.timestep ?? 1 / 120;
        if (!(this.timestep > 0)) throw new RangeError("timestep must be above 0");
        this.maxSteps = options.maxSteps ?? 8;
        this.iterations = options.iterations ?? 10;
        this.allowSleep = options.allowSleep ?? true;
        this.sleepSpeed = options.sleepSpeed ?? 0.05;
        this.sleepTime = options.sleepTime ?? 0.5;
    }

    /** Adds a body and returns it. */
    add<T extends RigidBody>(body: T): T {
        if (this.bodies.includes(body)) return body;
        this.bodies.push(body);
        body.dimensions = this.dimensions;
        body.updateMass();
        if (this.dimensions === 2) this.flatten(body);
        return body;
    }

    /** Removes a body, returns false when it was not in the world. */
    remove(body: RigidBody): boolean {
        const index = this.bodies.indexOf(body);
        if (index < 0) return false;
        this.bodies.splice(index, 1);
        for (const [key, manifold] of this.manifolds)
        {
            if (manifold.a === body || manifold.b === body) this.manifolds.delete(key);
        }
        return true;
    }

    /**
     * Advances by `delta` seconds of real time in fixed steps, the rest carries over.
     * Returns the number of steps run.
     */
    update(delta: number): number {
        if (!(delta > 0)) return 0;
        this.accumulator += delta;
        let steps = 0;
        while (this.accumulator >= this.timestep && steps < this.maxSteps)
        {
            this.step();
            this.accumulator -= this.timestep;
            steps++;
        }
        // drop what a slow frame could not catch up on
        if (steps === this.maxSteps && this.accumulator > this.timestep) this.accumulator = 0;
        return steps;
    }

    /** Closest body the ray hits within `maxDistance`, or null. */
    raycast(origin: VecInput, direction: VecInput, maxDistance = Infinity): RayHit | null {
        return raycast(this.bodies, origin, direction, maxDistance);
    }

    /** Closest body the segment from `start` to `end` hits, or null. `t` is the distance from `start`. */
    segmentCast(start: VecInput, end: VecInput): RayHit | null {
        const x = end.x - start.x, y = end.y - start.y, z = (end.z ?? 0) - (start.z ?? 0);
        return raycast(this.bodies, start, { x, y, z }, Math.sqrt(x * x + y * y + z * z));
    }

    /** Bodies overlapping `shape` placed at `position` / `rotation`, planes skipped. */
    overlap(shape: Shape, position: VecInput, rotation?: QuatInput): RigidBody[] {
        return overlap(this.bodies, shape, position, rotation);
    }

    /** Runs one fixed step. */
    step() {
        const dt = this.timestep;
        for (const body of this.bodies) this.integrateVelocity(body, dt);
        this.detect();
        prepare(this.contacts, dt);
        for (let i = 0; i < this.iterations; i++) solveVelocities(this.contacts);
        for (const body of this.bodies) this.integratePosition(body, dt);
        for (let i = 0; i < POSITION_ITERATIONS; i++) solvePositions(this.contacts);
        if (this.allowSleep) this.updateSleep(dt);
    }

    /**
     * Bodies resting for `sleepTime` fall asleep. A body touching a moving one
     * restarts its timer, so a stack sleeps together.
     */
    private updateSleep(dt: number) {
        const limit = this.sleepSpeed * this.sleepSpeed;
        for (const body of this.bodies)
        {
            if (body.isStatic || body.sleeping) continue;
            const v = body.velocity, w = body.angularVelocity;
            const resting = v.x * v.x + v.y * v.y + v.z * v.z < limit && w.x * w.x + w.y * w.y + w.z * w.z < limit;
            body.sleepTime = resting ? body.sleepTime + dt : 0;
        }
        for (const contact of this.contacts)
        {
            const { a, b } = contact;
            if (awake(a) && a.sleepTime < this.sleepTime) b.sleepTime = Math.min(b.sleepTime, a.sleepTime);
            if (awake(b) && b.sleepTime < this.sleepTime) a.sleepTime = Math.min(a.sleepTime, b.sleepTime);
        }
        for (const body of this.bodies)
        {
            if (awake(body) && body.sleepTime >= this.sleepTime) body.sleep();
        }
    }

    /** Finds touching pairs and updates their manifolds. */
    private detect() {
        this.contacts.length = 0;
        const stamp = ++this.stamp;
        const bodies = this.bodies;
        const count = bodies.length;
        const pairs = this.broad.pairs;
        this.broad.update(bodies);
        for (let i = 0; i < pairs.length; i++)
        {
            const pair = pairs[i];
            const a = bodies[Math.floor(pair / count)], b = bodies[pair % count];
            if (!collide(a, b, raw)) continue;
            // an awake body touching a sleeper wakes it
            if (a.sleeping && awake(b)) a.wake();
            if (b.sleeping && awake(a)) b.wake();
            const key = a.id * 1e7 + b.id;
            let manifold = this.manifolds.get(key);
            if (!manifold)
            {
                manifold = new Manifold(a, b);
                this.manifolds.set(key, manifold);
            }
            manifold.update(raw);
            manifold.stamp = stamp;
            this.contacts.push(manifold);
        }
        // pairs that stopped touching lose their warm start
        if (this.manifolds.size > this.contacts.length)
        {
            for (const [key, manifold] of this.manifolds)
            {
                if (manifold.stamp !== stamp) this.manifolds.delete(key);
            }
        }
    }

    private integrateVelocity(body: RigidBody, dt: number) {
        if (!body.isStatic && !body.sleeping)
        {
            const v = body.velocity, f = body.force, m = body.inverseMass;
            v.x += (this.gravity.x + f.x * m) * dt;
            v.y += (this.gravity.y + f.y * m) * dt;
            v.z += (this.gravity.z + f.z * m) * dt;

            const w = body.angularVelocity, t = body.torque;
            multiply3(body.inverseInertia, t.x, t.y, t.z, scratch);
            w.x += scratch.x * dt;
            w.y += scratch.y * dt;
            w.z += scratch.z * dt;

            const linear = 1 / (1 + body.linearDamping * dt);
            const angular = 1 / (1 + body.angularDamping * dt);
            v.x *= linear; v.y *= linear; v.z *= linear;
            w.x *= angular; w.y *= angular; w.z *= angular;
            if (this.dimensions === 2) this.flatten(body);
        }
        body.force.x = 0; body.force.y = 0; body.force.z = 0;
        body.torque.x = 0; body.torque.y = 0; body.torque.z = 0;
    }

    private integratePosition(body: RigidBody, dt: number) {
        if ((body.inverseMass === 0 && !body.kinematic) || body.sleeping) return;
        const p = body.position, v = body.velocity, w = body.angularVelocity;
        p.x += v.x * dt;
        p.y += v.y * dt;
        p.z += v.z * dt;
        body.rotation.integrate(w.x, w.y, w.z, dt);
        if (this.dimensions === 2) this.flatten(body);
        body.updateInertia();
    }

    /** 2D lock: z = 0 and rotation only about z. */
    private flatten(body: RigidBody) {
        body.position.z = 0;
        body.velocity.z = 0;
        body.angularVelocity.x = 0;
        body.angularVelocity.y = 0;
        const q = body.rotation;
        const length = Math.sqrt(q.z * q.z + q.w * q.w);
        q.x = 0;
        q.y = 0;
        if (length === 0)
        {
            q.z = 0; q.w = 1;
        }
        else
        {
            q.z /= length; q.w /= length;
        }
    }
}
