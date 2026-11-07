import { Vector2, Vector3 } from "@papit/vector";
import type { Plane, Point } from "types";

const EPSILON = 1e-12;

function vector(x: number, y: number, z: number, is3D: boolean) {
    return is3D ? new Vector3(x, y, z) : new Vector2(x, y);
}
function clamp01(value: number) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Closest point to `p` on segment `a`–`b`, any of 2D or 3D (3D when any point has a `z`).
 * A zero-length segment returns `a`.
 *
 * @returns `t` in [0, 1] along the segment, the `point` and its `distance` to `p`
 */
export function closestPointOnSegment(p: Point, a: Point, b: Point) {
    const is3D = p.z !== undefined || a.z !== undefined || b.z !== undefined;
    const az = a.z ?? 0;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = (b.z ?? 0) - az;

    const lengthSquared = abx * abx + aby * aby + abz * abz;
    const t = lengthSquared <= EPSILON
        ? 0
        : clamp01(((p.x - a.x) * abx + (p.y - a.y) * aby + ((p.z ?? 0) - az) * abz) / lengthSquared);

    const x = a.x + t * abx;
    const y = a.y + t * aby;
    const z = az + t * abz;
    const distance = Math.hypot(p.x - x, p.y - y, (p.z ?? 0) - z);

    return { t, point: vector(x, y, z, is3D), distance };
}

/**
 * Closest points between segment `p1`–`q1` and segment `p2`–`q2` (Ericson, Real-Time
 * Collision Detection 5.1.9). 3D when any point has a `z`. Handles parallel and
 * zero-length segments.
 *
 * @returns
 * - `s`, `t` — parameters in [0, 1] along the first and second segment
 * - `a`, `b` — the closest point on each segment
 * - `distance` — between `a` and `b`, 0 when they cross
 */
export function closestSegmentPoints(p1: Point, q1: Point, p2: Point, q2: Point) {
    const is3D = p1.z !== undefined || q1.z !== undefined || p2.z !== undefined || q2.z !== undefined;
    const p1z = p1.z ?? 0;
    const p2z = p2.z ?? 0;

    // d1 = q1 - p1, d2 = q2 - p2, r = p1 - p2
    const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = (q1.z ?? 0) - p1z;
    const d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = (q2.z ?? 0) - p2z;
    const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1z - p2z;

    const a = d1x * d1x + d1y * d1y + d1z * d1z; // squared length of segment 1
    const e = d2x * d2x + d2y * d2y + d2z * d2z; // squared length of segment 2
    const f = d2x * rx + d2y * ry + d2z * rz;

    let s = 0;
    let t = 0;

    if (a <= EPSILON && e <= EPSILON)
    {
        // both are points
    }
    else if (a <= EPSILON)
    {
        t = clamp01(f / e);
    }
    else
    {
        const c = d1x * rx + d1y * ry + d1z * rz;
        if (e <= EPSILON)
        {
            s = clamp01(-c / a);
        }
        else
        {
            const b = d1x * d2x + d1y * d2y + d1z * d2z;
            const denominator = a * e - b * b; // 0 when parallel

            s = denominator > EPSILON ? clamp01((b * f - c * e) / denominator) : 0;
            t = (b * s + f) / e;

            if (t < 0)
            {
                t = 0;
                s = clamp01(-c / a);
            }
            else if (t > 1)
            {
                t = 1;
                s = clamp01((b - c) / a);
            }
        }
    }

    const ax = p1.x + d1x * s, ay = p1.y + d1y * s, az = p1z + d1z * s;
    const bx = p2.x + d2x * t, by = p2.y + d2y * t, bz = p2z + d2z * t;

    return {
        s,
        t,
        a: vector(ax, ay, az, is3D),
        b: vector(bx, by, bz, is3D),
        distance: Math.hypot(ax - bx, ay - by, az - bz),
    };
}

/**
 * Ray vs plane. A ray lying in the plane hits at `t = 0`.
 *
 * @returns `false` when parallel (and off the plane) or the plane is behind, otherwise
 * `t` in units of `direction`'s length and the hit `point`
 */
export function rayPlane(origin: Point, direction: Point, plane: Plane): { t: number; point: Vector3 } | false {
    const n = plane.normal;
    const nz = n.z ?? 0;
    const d = 'd' in plane
        ? plane.d
        : n.x * plane.point.x + n.y * plane.point.y + nz * (plane.point.z ?? 0);

    const oz = origin.z ?? 0;
    const dz = direction.z ?? 0;
    const distance = d - (n.x * origin.x + n.y * origin.y + nz * oz); // scaled by |n|
    const denominator = n.x * direction.x + n.y * direction.y + nz * dz;

    if (Math.abs(denominator) <= EPSILON)
    {
        if (Math.abs(distance) <= EPSILON) return { t: 0, point: new Vector3(origin.x, origin.y, oz) };
        return false;
    }

    const t = distance / denominator;
    if (t < 0) return false;

    return { t, point: new Vector3(origin.x + t * direction.x, origin.y + t * direction.y, oz + t * dz) };
}
