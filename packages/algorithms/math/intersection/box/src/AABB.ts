import type { Rectangle } from "types";
import { dim, is3D } from "./util";

type Overlap = { x: number; y: number; w: number; h: number; z?: number; d?: number };

/**
 * Axis-aligned overlap test. Touching edges count as overlapping (size 0).
 * The z axis is tested only when both boxes have a `z`.
 *
 * @returns the overlapping region `{ x, y, w, h }` (plus `z, d` in 3D), or `false`
 */
export function AABB(a: Rectangle, b: Rectangle): Overlap | false {
    const x = AABBhelper(a, b, 'x');
    if (x === false) return false;

    const y = AABBhelper(a, b, 'y');
    if (y === false) return false;

    if (!is3D(a) || !is3D(b)) return { ...x, ...y } as Overlap;

    const z = AABBhelper(a, b, 'z');
    if (z === false) return false;

    return { ...x, ...y, ...z } as Overlap;
}

const MAP = { x: 'w', y: 'h', z: 'd' } as const;

function AABBhelper(a: Rectangle, b: Rectangle, type: "x" | "y" | "z" = "x") {
    const size = MAP[type];
    const pa = a[type] as number;
    const pb = b[type] as number;

    const min = Math.min(pa, pb);
    const max = Math.max(pa + dim(a, size), pb + dim(b, size));

    const global = dim(a, size) + dim(b, size);
    const local = max - min;
    if (local <= global)
    {
        return { [type]: Math.max(pa, pb), [size]: global - local };
    }

    return false;
}
