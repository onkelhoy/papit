import type { Point, Rectangle } from "types";
import { dim, is3D } from "./util";

/**
 * Whether `p` lies inside (or on the edge of) `rec`. The z axis is checked
 * only when both the box and the point have a `z`.
 */
export function isPointInRectangle(p: Point, rec: Rectangle) {
    if (p.x < rec.x || p.x > rec.x + dim(rec, 'w')) return false;
    if (p.y < rec.y || p.y > rec.y + dim(rec, 'h')) return false;

    if (is3D(rec) && p.z !== undefined)
    {
        const z = rec.z as number;
        if (p.z < z || p.z > z + dim(rec, 'd')) return false;
    }

    return true;
}
