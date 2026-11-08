import { rayBox } from "@papit/box-intersection";
import { distance, gjk, type Convex } from "@papit/gjk";
import { Quaternion } from "@papit/quaternion";
import { Vector2, Vector3 } from "@papit/vector";
import type { RigidBody } from "./body";
import { rotate, unrotate } from "./math";
import type { Shape } from "./shapes";
import type { QuatInput, VecInput } from "./types";

export type RayHit = {
    body: RigidBody;
    /** distance along the (normalized) ray */
    t: number;
    point: Vector3;
    /** surface normal, zero when the ray starts inside */
    normal: Vector3;
};

/** surface gap that counts as a hit */
const EPSILON = 1e-7;
/** conservative advancement steps before a grazing ray counts as a miss */
const MAX_STEPS = 64;

const min = new Vector3(0, 0, 0);
const max = new Vector3(0, 0, 0);
const scratch = new Vector3(0, 0, 0);
const box = { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 };

/** A single point as a gjk `Convex`, 2D or 3D. */
class PointConvex implements Convex {
    readonly flat = new Vector2(0, 0);
    readonly full = new Vector3(0, 0, 0);
    dimensions: 2 | 3 = 3;

    set(x: number, y: number, z: number) {
        this.flat.x = this.full.x = x;
        this.flat.y = this.full.y = y;
        this.full.z = z;
    }

    support() { return this.dimensions === 2 ? this.flat : this.full; }
}

const probe = new PointConvex();

/**
 * Closest body hit by the ray from `origin` along `direction`, up to `maxDistance`.
 * Planes are exact, every other shape uses GJK conservative advancement.
 * O(n) bounds tests plus a few GJK runs for the bodies whose bounds the ray crosses.
 */
export function raycast(bodies: readonly RigidBody[], origin: VecInput, direction: VecInput, maxDistance = Infinity): RayHit | null {
    const dimensions = bodies[0]?.dimensions ?? 3;
    const ox = origin.x, oy = origin.y, oz = dimensions === 2 ? 0 : origin.z ?? 0;
    let dx = direction.x, dy = direction.y, dz = dimensions === 2 ? 0 : direction.z ?? 0;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length === 0 || !(maxDistance >= 0)) return null;
    dx /= length; dy /= length; dz /= length;

    let best: RayHit | null = null;
    let limit = maxDistance;
    for (const body of bodies)
    {
        if (!body.shape) continue;
        const hit = body.shape.kind === "plane"
            ? rayPlane(body, ox, oy, oz, dx, dy, dz, limit)
            : rayConvex(body, ox, oy, oz, dx, dy, dz, limit);
        if (hit && hit.t <= limit)
        {
            best = hit;
            limit = hit.t;
        }
    }
    return best;
}

function rayPlane(body: RigidBody, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, limit: number): RayHit | null {
    const n = rotate(body.rotation, 0, 1, 0, new Vector3(0, 0, 0));
    const p = body.position;
    const height = n.x * (ox - p.x) + n.y * (oy - p.y) + n.z * (oz - p.z);
    if (height <= 0) return hit(body, 0, ox, oy, oz, new Vector3(0, 0, 0));
    const speed = n.x * dx + n.y * dy + n.z * dz;
    if (speed >= 0) return null;
    const t = -height / speed;
    if (t > limit) return null;
    return hit(body, t, ox + dx * t, oy + dy * t, oz + dz * t, n);
}

function rayConvex(body: RigidBody, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, limit: number): RayHit | null {
    body.bounds(min, max);
    box.x = min.x; box.y = min.y; box.z = min.z;
    box.w = max.x - min.x; box.h = max.y - min.y; box.d = max.z - min.z;
    const entry = rayBox({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz }, box);
    if (!entry || entry.t > limit) return null;

    probe.dimensions = body.dimensions;
    // advance from the origin, not the bounds entry: touching there would leave no normal
    let t = 0;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < MAX_STEPS && t <= limit; i++)
    {
        probe.set(ox + dx * t, oy + dy * t, oz + dz * t);
        const gap = distance(probe, body.convex);
        if (!gap) return hit(body, t, probe.full.x, probe.full.y, probe.full.z, normalize(nx, ny, nz));

        // from the shape towards the ray point
        nx = gap.pointA.x - gap.pointB.x;
        ny = gap.pointA.y - gap.pointB.y;
        nz = (gap.pointA.z ?? 0) - (gap.pointB.z ?? 0);
        if (gap.distance < EPSILON) return hit(body, t, gap.pointB.x, gap.pointB.y, gap.pointB.z ?? 0, normalize(nx, ny, nz));
        // heading away from the closest point: a convex shape cannot be hit any more
        if (nx * dx + ny * dy + nz * dz >= 0) return null;
        t += gap.distance;
    }
    return null;
}

function hit(body: RigidBody, t: number, x: number, y: number, z: number, normal: Vector3): RayHit {
    return { body, t, point: new Vector3(x, y, z), normal };
}

function normalize(x: number, y: number, z: number): Vector3 {
    const length = Math.sqrt(x * x + y * y + z * z);
    return length === 0 ? new Vector3(0, 0, 0) : new Vector3(x / length, y / length, z / length);
}

/** A shape placed in the world, as a gjk `Convex`. */
class PlacedShape implements Convex {
    readonly flat = new Vector2(0, 0);
    readonly full = new Vector3(0, 0, 0);
    readonly position = new Vector3(0, 0, 0);
    rotation = Quaternion.identity;
    shape!: Shape;
    dimensions: 2 | 3 = 3;

    support(d: { x: number; y: number; z?: number }) {
        unrotate(this.rotation, d.x, d.y, d.z ?? 0, scratch);
        this.shape.support(scratch.x, scratch.y, scratch.z, scratch);
        rotate(this.rotation, scratch.x, scratch.y, scratch.z, this.full);
        this.full.x += this.position.x;
        this.full.y += this.position.y;
        this.full.z += this.position.z;
        if (this.dimensions === 3) return this.full;
        this.flat.x = this.full.x;
        this.flat.y = this.full.y;
        return this.flat;
    }
}

const placed = new PlacedShape();

/**
 * Bodies whose shape overlaps `shape` placed at `position` / `rotation` (touching counts).
 * Planes are skipped. O(n) GJK runs.
 */
export function overlap(bodies: readonly RigidBody[], shape: Shape, position: VecInput, rotation?: QuatInput): RigidBody[] {
    const dimensions = bodies[0]?.dimensions ?? 3;
    placed.shape = shape;
    placed.dimensions = dimensions;
    placed.position.x = position.x;
    placed.position.y = position.y;
    placed.position.z = dimensions === 2 ? 0 : position.z ?? 0;
    placed.rotation = rotation ? new Quaternion([rotation.x, rotation.y, rotation.z, rotation.w]).normalize() : Quaternion.identity;

    const found: RigidBody[] = [];
    for (const body of bodies)
    {
        if (!body.shape || body.shape.kind === "plane") continue;
        if (gjk(placed, body.convex)) found.push(body);
    }
    return found;
}
