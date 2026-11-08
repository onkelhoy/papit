import { Matrix3 } from "@papit/matrix";
import { Quaternion } from "@papit/quaternion";
import { Vector2, Vector3 } from "@papit/vector";
import type { QuatInput, VecInput } from "./types";
import { rotate, unrotate, worldInertia } from "./math";
import type { Shape } from "./shapes";

/** What `@papit/gjk` calls: a world-space support function. */
export type BodyConvex = { support(direction: { x: number; y: number; z?: number }): { x: number; y: number; z?: number } };

export type BodyOptions = {
    /** what it collides as, none means it only moves */
    shape?: Shape;
    /** kg, 0 (the default) makes the body static */
    mass?: number;
    position?: VecInput;
    rotation?: QuatInput;
    velocity?: VecInput;
    angularVelocity?: VecInput;
    /** fraction of velocity lost per second, default 0 */
    linearDamping?: number;
    /** fraction of angular velocity lost per second, default 0 */
    angularDamping?: number;
    /** 0 slides freely, 1 grips; pairs combine as the geometric mean. Default 0.5. */
    friction?: number;
    /** 0 stops dead, 1 bounces back fully; pairs take the larger. Default 0. */
    restitution?: number;
    /** static bodies that you move by hand: they push others but are not pushed */
    kinematic?: boolean;
};

let nextId = 0;

function vector(v?: VecInput): Vector3 {
    return new Vector3(v?.x ?? 0, v?.y ?? 0, v?.z ?? 0);
}

/**
 * A rigid body: position, rotation, velocities and mass. Mass 0 is static.
 * All state is plain float64 numbers you may read and write between steps.
 */
export class RigidBody {
    /** unique, ascending in creation order */
    readonly id = nextId++;
    readonly position: Vector3;
    /** unit quaternion; in 2D only z and w are used */
    readonly rotation: Quaternion;
    readonly velocity: Vector3;
    readonly angularVelocity: Vector3;
    linearDamping: number;
    angularDamping: number;
    kinematic: boolean;
    friction: number;
    restitution: number;
    readonly shape?: Shape;
    /** set by the world it is added to */
    dimensions: 2 | 3 = 3;
    /** world-space support for `@papit/gjk`, 2D points in a 2D world */
    readonly convex: BodyConvex;

    /** 1 / mass, 0 when static or kinematic */
    inverseMass = 0;
    /** local principal inverse inertia, 0 when static */
    readonly inverseInertiaLocal = new Vector3(0, 0, 0);
    /** world inverse inertia, refreshed each step */
    readonly inverseInertia = new Matrix3();
    /** force summed until the next step, then cleared */
    readonly force: Vector3 = new Vector3(0, 0, 0);
    /** torque summed until the next step, then cleared */
    readonly torque: Vector3 = new Vector3(0, 0, 0);

    /** true while resting: skipped by integration until something wakes it */
    sleeping = false;
    /** seconds spent below the world's sleep speed */
    sleepTime = 0;

    private _mass = 0;

    constructor(options: BodyOptions = {}) {
        this.position = vector(options.position);
        const r = options.rotation;
        this.rotation = r ? new Quaternion([r.x, r.y, r.z, r.w]).normalize() : Quaternion.identity;
        this.velocity = vector(options.velocity);
        this.angularVelocity = vector(options.angularVelocity);
        this.linearDamping = options.linearDamping ?? 0;
        this.angularDamping = options.angularDamping ?? 0;
        this.kinematic = options.kinematic ?? false;
        this.friction = options.friction ?? 0.5;
        this.restitution = options.restitution ?? 0;
        this.shape = options.shape;
        if (this.shape?.kind === "plane" && (options.mass ?? 0) > 0) throw new RangeError("a plane must be static");

        const flat = new Vector2(0, 0);
        const full = new Vector3(0, 0, 0);
        this.convex = {
            support: direction => {
                this.support(direction.x, direction.y, direction.z ?? 0, full);
                if (this.dimensions === 3) return full;
                flat.x = full.x;
                flat.y = full.y;
                return flat;
            },
        };
        this.mass = options.mass ?? 0;
    }

    /** World point of the shape furthest along the world direction `(x, y, z)`, into `out`. */
    support(x: number, y: number, z: number, out: Vector3): Vector3 {
        if (!this.shape)
        {
            out[0] = this.position[0]; out[1] = this.position[1]; out[2] = this.position[2];
            return out;
        }
        unrotate(this.rotation, x, y, z, out);
        this.shape.support(out.x, out.y, out.z, out);
        rotate(this.rotation, out.x, out.y, out.z, out);
        out.x += this.position.x;
        out.y += this.position.y;
        out.z += this.position.z;
        return out;
    }

    /**
     * Writes the model matrix (rotation and position, column-major 4x4) into `out`:
     * a `Matrix4`, or a `Float32Array` to hand straight to WebGL.
     */
    matrix<T extends Float32Array | Float64Array>(out: T): T {
        return this.rotation.writeMatrix(out, this.position);
    }

    /** World axis-aligned bounds into `min` and `max`, infinite for a plane. */
    bounds(min: Vector3, max: Vector3) {
        if (this.shape?.kind === "plane")
        {
            min.x = min.y = min.z = -Infinity;
            max.x = max.y = max.z = Infinity;
            return;
        }
        min.x = this.support(-1, 0, 0, max).x;
        min.y = this.support(0, -1, 0, max).y;
        min.z = this.support(0, 0, -1, max).z;
        const x = this.support(1, 0, 0, max).x;
        const y = this.support(0, 1, 0, max).y;
        const z = this.support(0, 0, 1, max).z;
        max.x = x; max.y = y; max.z = z;
    }

    /** kg. Setting it recomputes the inverse mass and inertia. */
    get mass() { return this._mass; }
    set mass(value: number) {
        if (!(value >= 0)) throw new RangeError("mass must be 0 or more");
        this._mass = value;
        this.updateMass();
    }

    /** true when nothing moves it: mass 0 or kinematic */
    get isStatic() { return this.inverseMass === 0; }

    /** Wakes a sleeping body, call it after setting velocity or position by hand. */
    wake() {
        this.sleeping = false;
        this.sleepTime = 0;
    }

    /** @internal stops it until woken */
    sleep() {
        this.sleeping = true;
        this.velocity.x = this.velocity.y = this.velocity.z = 0;
        this.angularVelocity.x = this.angularVelocity.y = this.angularVelocity.z = 0;
    }

    /** Adds a force through the center of mass, applied on the next step. */
    applyForce(force: VecInput) {
        this.wake();
        this.force.x += force.x;
        this.force.y += force.y;
        this.force.z += force.z ?? 0;
    }

    /** Adds a torque, applied on the next step. */
    applyTorque(torque: VecInput) {
        this.wake();
        this.torque.x += torque.x;
        this.torque.y += torque.y;
        this.torque.z += torque.z ?? 0;
    }

    /** Changes velocity at once, `impulse` in N·s through the center of mass. */
    applyImpulse(impulse: VecInput) {
        this.wake();
        this.velocity.x += impulse.x * this.inverseMass;
        this.velocity.y += impulse.y * this.inverseMass;
        this.velocity.z += (impulse.z ?? 0) * this.inverseMass;
    }

    /** @internal recomputes inverse mass and local inverse inertia */
    updateMass() {
        const dynamic = this._mass > 0 && !this.kinematic;
        this.inverseMass = dynamic ? 1 / this._mass : 0;
        const local = this.inverseInertiaLocal;
        if (!dynamic) local.x = local.y = local.z = 0;
        else if (this.shape) this.shape.inertia(this._mass, this.dimensions, local);
        // no shape: a solid sphere of diameter 1
        else local.x = local.y = local.z = 0.1 * this._mass;
        local.x = local.x > 0 ? 1 / local.x : 0;
        local.y = local.y > 0 ? 1 / local.y : 0;
        local.z = local.z > 0 ? 1 / local.z : 0;
        // 2D turns only about z
        if (this.dimensions === 2) local.x = local.y = 0;
        this.updateInertia();
    }

    /** @internal world inverse inertia from the current rotation */
    updateInertia() {
        worldInertia(this.rotation, this.inverseInertiaLocal, this.inverseInertia);
    }
}
