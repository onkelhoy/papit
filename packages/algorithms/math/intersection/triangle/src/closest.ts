import { Vector2, Vector3 } from "@papit/vector";
import type { Point } from "types";

const EPSILON = 1e-12;

/**
 * Closest point to `p` on triangle `a, b, c` (Ericson, Real-Time Collision Detection 5.1.5),
 * found by testing which vertex, edge or face region `p` projects into.
 * 3D when any point has a `z`. A degenerate (flat) triangle still returns a point on it.
 *
 * @returns the closest `point` and its `distance` to `p`
 */
export function closestPointOnTriangle(p: Point, a: Point, b: Point, c: Point) {
    const is3D = p.z !== undefined || a.z !== undefined || b.z !== undefined || c.z !== undefined;
    const az = a.z ?? 0;

    const abx = b.x - a.x, aby = b.y - a.y, abz = (b.z ?? 0) - az;
    const acx = c.x - a.x, acy = c.y - a.y, acz = (c.z ?? 0) - az;
    const apx = p.x - a.x, apy = p.y - a.y, apz = (p.z ?? 0) - az;

    // barycentric weights along ab (v) and ac (w), point = a + v * ab + w * ac
    let v = 0;
    let w = 0;

    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;

    const bpx = p.x - b.x, bpy = p.y - b.y, bpz = (p.z ?? 0) - (b.z ?? 0);
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;

    const cpx = p.x - c.x, cpy = p.y - c.y, cpz = (p.z ?? 0) - (c.z ?? 0);
    const d5 = abx * cpx + aby * cpy + abz * cpz;
    const d6 = acx * cpx + acy * cpy + acz * cpz;

    const vc = d1 * d4 - d3 * d2;
    const vb = d5 * d2 - d1 * d6;
    const va = d3 * d6 - d5 * d4;

    if (d1 <= 0 && d2 <= 0)
    {
        // vertex a
    }
    else if (d3 >= 0 && d4 <= d3)
    {
        v = 1; // vertex b
    }
    else if (d6 >= 0 && d5 <= d6)
    {
        w = 1; // vertex c
    }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0)
    {
        v = d1 / (d1 - d3); // edge ab
    }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0)
    {
        w = d2 / (d2 - d6); // edge ac
    }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0)
    {
        // edge bc
        w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        v = 1 - w;
    }
    else
    {
        // inside the face
        const sum = va + vb + vc;
        if (Math.abs(sum) > EPSILON)
        {
            v = vb / sum;
            w = vc / sum;
        }
    }

    const x = a.x + v * abx + w * acx;
    const y = a.y + v * aby + w * acy;
    const z = az + v * abz + w * acz;
    const distance = Math.hypot(p.x - x, p.y - y, (p.z ?? 0) - z);

    return { point: is3D ? new Vector3(x, y, z) : new Vector2(x, y), distance };
}

/**
 * Ray vs 3D triangle (Möller–Trumbore). Two-sided: hits from the front and the back.
 *
 * @returns `false` on a miss, a parallel ray or a degenerate triangle, otherwise:
 * - `t` — distance in units of `direction`'s length: `point = origin + t * direction`
 * - `u`, `v` — barycentric weights of `b` and `c` at the hit
 * - `point` — the hit
 */
export function rayTriangle(origin: Point, direction: Point, a: Point, b: Point, c: Point): {
    t: number;
    u: number;
    v: number;
    point: Vector3;
} | false {
    const az = a.z ?? 0;
    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = (b.z ?? 0) - az;
    const e2x = c.x - a.x, e2y = c.y - a.y, e2z = (c.z ?? 0) - az;
    const dx = direction.x, dy = direction.y, dz = direction.z ?? 0;

    // p = direction × e2
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;

    const determinant = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(determinant) <= EPSILON) return false;
    const inverse = 1 / determinant;

    const sx = origin.x - a.x, sy = origin.y - a.y, sz = (origin.z ?? 0) - az;
    const u = (sx * px + sy * py + sz * pz) * inverse;
    if (u < 0 || u > 1) return false;

    // q = s × e1
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;

    const v = (dx * qx + dy * qy + dz * qz) * inverse;
    if (v < 0 || u + v > 1) return false;

    const t = (e2x * qx + e2y * qy + e2z * qz) * inverse;
    if (t < 0) return false;

    return {
        t,
        u,
        v,
        point: new Vector3(origin.x + t * dx, origin.y + t * dy, (origin.z ?? 0) + t * dz),
    };
}
