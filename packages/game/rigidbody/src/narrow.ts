import { Vector3 } from "@papit/vector";
import { penetration } from "@papit/gjk";
import type { RigidBody } from "./body";
import { rotate } from "./math";

/** One point of a contact, world space. `a - b` is `normal * depth`. */
export type ContactPoint = {
    /** on the surface of body a */
    a: Vector3;
    /** on the surface of body b */
    b: Vector3;
    /** overlap along the normal, may be slightly negative for a point about to touch */
    depth: number;
};

/** most points one query produces, the manifold keeps at most 4 (2 in 2D) */
export const MAX_RAW_POINTS = 16;
/** extra points this close to touching are kept, they stop resting bodies from rocking */
const MARGIN = 0.01;
/** how far support directions tilt to find the other corners of a face */
const TILT = 0.05;
/** how far outside the other shape a point may lie and still count */
const SIDE_TOLERANCE = 1e-3;
/** points closer than this (squared) are the same point */
const SAME = 1e-8;

/** Result of `collide`: a normal from a to b and up to `MAX_RAW_POINTS` points. */
export class RawContact {
    readonly normal: Vector3 = new Vector3(0, 0, 0);
    readonly points: ContactPoint[] = [];
    count = 0;

    constructor() {
        for (let i = 0; i < MAX_RAW_POINTS; i++) this.points.push({ a: new Vector3(0, 0, 0), b: new Vector3(0, 0, 0), depth: 0 });
    }
}

// scratch
const n = new Vector3(0, 0, 0), t1 = new Vector3(0, 0, 0), t2 = new Vector3(0, 0, 0), dir = new Vector3(0, 0, 0), p = new Vector3(0, 0, 0), q = new Vector3(0, 0, 0);
const tangents: Vector3[] = [new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0)];
let tangentCount = 0;

/**
 * Contact between two bodies, normal pointing from `a` to `b`. False when they do not overlap.
 * Sphere-sphere and anything against a plane use exact tests, the rest GJK + EPA.
 */
export function collide(a: RigidBody, b: RigidBody, out: RawContact): boolean {
    out.count = 0;
    if (!a.shape || !b.shape) return false;
    const ka = a.shape.kind, kb = b.shape.kind;
    if (ka === "plane" && kb === "plane") return false;

    if (kb === "plane")
    {
        if (!planeContact(b, a, out)) return false;
        flip(out);
        return true;
    }
    if (ka === "plane") return planeContact(a, b, out);
    if (ka === "sphere" && kb === "sphere") return sphereContact(a, b, out);

    const hit = penetration(a.convex, b.convex);
    if (!hit) return false;
    const normal = hit.normal;
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + (normal[2] ?? 0) * (normal[2] ?? 0));
    if (length === 0) return false;
    n.x = normal[0] / length;
    n.y = normal[1] / length;
    n.z = (normal[2] ?? 0) / length;
    out.normal.x = n.x; out.normal.y = n.y; out.normal.z = n.z;
    gather(a, b, false, out);
    return out.count > 0;
}

function sphereContact(a: RigidBody, b: RigidBody, out: RawContact): boolean {
    const ra = (a.shape as unknown as { radius: number }).radius;
    const rb = (b.shape as unknown as { radius: number }).radius;
    const dx = b.position.x - a.position.x, dy = b.position.y - a.position.y, dz = b.position.z - a.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const depth = ra + rb - distance;
    if (depth <= 0) return false;

    const normal = out.normal;
    if (distance === 0)
    {
        normal.x = 0; normal.y = 1; normal.z = 0;
    }
    else
    {
        normal.x = dx / distance; normal.y = dy / distance; normal.z = dz / distance;
    }
    const point = out.points[0];
    point.a.x = a.position.x + normal.x * ra;
    point.a.y = a.position.y + normal.y * ra;
    point.a.z = a.position.z + normal.z * ra;
    point.b.x = b.position.x - normal.x * rb;
    point.b.y = b.position.y - normal.y * rb;
    point.b.z = b.position.z - normal.z * rb;
    point.depth = depth;
    out.count = 1;
    return true;
}

/** `plane` is a, `other` is b. */
function planeContact(plane: RigidBody, other: RigidBody, out: RawContact): boolean {
    rotate(plane.rotation, 0, 1, 0, n);
    out.normal.x = n.x; out.normal.y = n.y; out.normal.z = n.z;
    other.support(-n.x, -n.y, -n.z, p);
    const depth = n.x * (plane.position.x - p.x) + n.y * (plane.position.y - p.y) + n.z * (plane.position.z - p.z);
    if (depth <= 0) return false;
    gather(plane, other, true, out);
    return out.count > 0;
}

/**
 * Collects contact points along the normal `n`: the deepest points of each shape plus the
 * ones found by tilting the direction a little, which walks the corners of a touching face.
 */
function gather(a: RigidBody, b: RigidBody, planeA: boolean, out: RawContact) {
    buildTangents(a.dimensions);

    // a's furthest plane along n, b's furthest plane against n
    const offsetA = planeA ? dotN(a.position) : dotN(a.support(n.x, n.y, n.z, p));
    const offsetB = dotN(b.support(-n.x, -n.y, -n.z, p));
    const tiltA = !planeA && a.shape!.kind !== "sphere";
    const tiltB = b.shape!.kind !== "sphere";

    for (let i = -1; i < tangentCount; i++)
    {
        if (i >= 0 && !tiltA && !tiltB) break;
        tilted(i);

        if (i < 0 || tiltB)
        {
            b.support(-dir.x, -dir.y, -dir.z, p);
            const depth = offsetA - dotN(p);
            if (depth > -MARGIN && (planeA || inside(a, p))) add(out, p, depth, false);
        }
        if (!planeA && (i < 0 || tiltA))
        {
            a.support(dir.x, dir.y, dir.z, p);
            const depth = dotN(p) - offsetB;
            if (depth > -MARGIN && inside(b, p)) add(out, p, depth, true);
        }
    }

    // nothing inside the other's outline (crossed edges): one point in the middle of the candidates
    if (out.count === 0 && !planeA) fallback(a, b, offsetA, offsetB, out);
}

/** direction for candidate `i`: n itself for -1, else n tilted towards tangent i */
function tilted(i: number) {
    if (i < 0)
    {
        dir.x = n.x; dir.y = n.y; dir.z = n.z;
        return;
    }
    const t = tangents[i];
    dir.x = n.x + TILT * t.x;
    dir.y = n.y + TILT * t.y;
    dir.z = n.z + TILT * t.z;
}

function fallback(a: RigidBody, b: RigidBody, offsetA: number, offsetB: number, out: RawContact) {
    let x = 0, y = 0, z = 0, count = 0;
    for (let i = -1; i < tangentCount; i++)
    {
        tilted(i);
        b.support(-dir.x, -dir.y, -dir.z, p);
        a.support(dir.x, dir.y, dir.z, q);
        x += p.x + q.x; y += p.y + q.y; z += p.z + q.z;
        count += 2;
    }
    p.x = x / count; p.y = y / count; p.z = z / count;
    // move onto b's deepest plane
    const shift = offsetB - dotN(p);
    p.x += n.x * shift; p.y += n.y * shift; p.z += n.z * shift;
    add(out, p, offsetA - offsetB, false);
}

/** Adds a point given on b's surface (`onA` false) or a's surface (`onA` true). */
function add(out: RawContact, point: Vector3, depth: number, onA: boolean) {
    if (out.count === MAX_RAW_POINTS) return;
    const sign = onA ? -1 : 1;
    const ax = onA ? point.x : point.x + n.x * depth;
    const ay = onA ? point.y : point.y + n.y * depth;
    const az = onA ? point.z : point.z + n.z * depth;
    for (let i = 0; i < out.count; i++)
    {
        const other = out.points[i].a;
        const dx = other.x - ax, dy = other.y - ay, dz = other.z - az;
        if (dx * dx + dy * dy + dz * dz < SAME) return;
    }
    const slot = out.points[out.count++];
    slot.a.x = ax; slot.a.y = ay; slot.a.z = az;
    slot.b.x = point.x + (onA ? sign * n.x * depth : 0);
    slot.b.y = point.y + (onA ? sign * n.y * depth : 0);
    slot.b.z = point.z + (onA ? sign * n.z * depth : 0);
    slot.depth = depth;
}

/** Is `point` within `body`'s outline seen along n (checked on the tangent directions)? */
function inside(body: RigidBody, point: Vector3): boolean {
    for (let i = 0; i < tangentCount; i++)
    {
        const t = tangents[i];
        const along = point.x * t.x + point.y * t.y + point.z * t.z;
        body.support(t.x, t.y, t.z, q);
        if (along > q.x * t.x + q.y * t.y + q.z * t.z + SIDE_TOLERANCE) return false;
        body.support(-t.x, -t.y, -t.z, q);
        if (along < q.x * t.x + q.y * t.y + q.z * t.z - SIDE_TOLERANCE) return false;
    }
    return true;
}

/** Tangents around n: ±t in 2D; ±t1, ±t2 and the four diagonals in 3D, so any box yaw finds its corners. */
function buildTangents(dimensions: 2 | 3) {
    if (dimensions === 2)
    {
        set(tangents[0], -n.y, n.x, 0);
        set(tangents[1], n.y, -n.x, 0);
        tangentCount = 2;
        return;
    }
    // t1 perpendicular to n, picked from the smallest component for stability
    if (Math.abs(n.x) < 0.57735) set(t1, 0, n.z, -n.y);
    else set(t1, n.y, -n.x, 0);
    const length = Math.sqrt(t1.x * t1.x + t1.y * t1.y + t1.z * t1.z);
    t1.x /= length; t1.y /= length; t1.z /= length;
    set(t2, n.y * t1.z - n.z * t1.y, n.z * t1.x - n.x * t1.z, n.x * t1.y - n.y * t1.x);
    const s = Math.SQRT1_2;
    set(tangents[0], t1.x, t1.y, t1.z);
    set(tangents[1], t2.x, t2.y, t2.z);
    set(tangents[2], (t1.x + t2.x) * s, (t1.y + t2.y) * s, (t1.z + t2.z) * s);
    set(tangents[3], (t1.x - t2.x) * s, (t1.y - t2.y) * s, (t1.z - t2.z) * s);
    for (let i = 0; i < 4; i++) set(tangents[i + 4], -tangents[i].x, -tangents[i].y, -tangents[i].z);
    tangentCount = 8;
}

function set(out: Vector3, x: number, y: number, z: number) {
    out.x = x; out.y = y; out.z = z;
}

function dotN(v: Vector3) {
    return n.dot(v);
}

/** Swaps the roles of a and b. */
function flip(out: RawContact) {
    out.normal.x = -out.normal.x;
    out.normal.y = -out.normal.y;
    out.normal.z = -out.normal.z;
    for (let i = 0; i < out.count; i++)
    {
        const point = out.points[i];
        const { a } = point;
        point.a = point.b;
        point.b = a;
    }
}
