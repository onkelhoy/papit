import { Vector2, Vector3 } from "@papit/vector";
import type { Point, Rectangle } from "types";
import { dim, is3D } from "./util";

export type RayHit = {
    /** distance along `direction` in units of its length: `point = origin + t * direction` */
    t: number;
    point: Vector2 | Vector3;
    /** outward face normal at the hit, zero when the origin starts inside */
    normal: Vector2 | Vector3;
};

const AXES = ['x', 'y', 'z'] as const;
const SIZES = ['w', 'h', 'd'] as const;

/**
 * Ray vs axis-aligned box (slab test). 3D when the box has a `z`, otherwise 2D.
 * A ray that starts inside hits at `t = 0` with a zero normal.
 * A zero `direction` only hits when the origin is inside.
 */
export function rayBox(origin: Point, direction: Point, box: Rectangle): RayHit | false {
    const dimensions = is3D(box) ? 3 : 2;

    let tmin = -Infinity;
    let tmax = Infinity;
    let hitAxis = -1;
    let hitSign = 0;

    for (let i = 0; i < dimensions; i++)
    {
        const o = origin[AXES[i]] ?? 0;
        const d = direction[AXES[i]] ?? 0;
        const min = box[AXES[i]] as number;
        const max = min + dim(box, SIZES[i]);

        if (d === 0)
        {
            // parallel to this slab: must already be between its faces
            if (o < min || o > max) return false;
            continue;
        }

        let t1 = (min - o) / d;
        let t2 = (max - o) / d;
        let sign = -1; // entering through the min face
        if (t1 > t2)
        {
            const swap = t1; t1 = t2; t2 = swap;
            sign = 1;
        }

        if (t1 > tmin)
        {
            tmin = t1;
            hitAxis = i;
            hitSign = sign;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
    }

    if (tmax < 0) return false; // box is behind the ray

    const inside = tmin < 0 || hitAxis === -1;
    const t = inside ? 0 : tmin;
    const n = [0, 0, 0];
    if (!inside) n[hitAxis] = hitSign;

    const px = origin.x + t * direction.x;
    const py = origin.y + t * direction.y;
    if (dimensions === 2)
    {
        return { t, point: new Vector2(px, py), normal: new Vector2(n[0], n[1]) };
    }

    const pz = (origin.z ?? 0) + t * (direction.z ?? 0);
    return { t, point: new Vector3(px, py, pz), normal: new Vector3(n[0], n[1], n[2]) };
}
