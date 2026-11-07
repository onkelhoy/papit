import { Vector2, Vector3 } from "@papit/vector";
import type { Shape } from "./types";
import { L, PA, PB, simplex, solve } from "./core";
import { pieces } from "./util";

export type Distance = {
    /** gap between the shapes, always > 0 */
    distance: number;
    /** closest point on `a` */
    pointA: Vector2 | Vector3;
    /** closest point on `b` */
    pointB: Vector2 | Vector3;
};

/**
 * Whether two shapes overlap (touching counts). 2D or 3D, decided by the support points.
 * An array is a concave shape made of convex pieces: any overlapping pair is a hit.
 * O(k) iterations per pair, k is small (capped at 64).
 */
export function gjk(a: Shape, b: Shape): boolean {
    for (const pa of pieces(a))
    {
        for (const pb of pieces(b))
        {
            if (solve(pa, pb, true) === 0) return true;
        }
    }
    return false;
}

/**
 * Smallest gap between two shapes with the closest points on each,
 * or `false` when they overlap or touch. Arrays: the closest pair of pieces.
 */
export function distance(a: Shape, b: Shape): Distance | false {
    let best = Infinity;
    let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, is3D = false;

    for (const pa of pieces(a))
    {
        for (const pb of pieces(b))
        {
            const d = solve(pa, pb, false);
            if (d === 0) return false;
            if (d >= best) continue;

            best = d;
            is3D = simplex.dimensions === 3;
            ax = ay = az = bx = by = bz = 0;
            for (let n = 0; n < simplex.count; n++)
            {
                const o = n * 3;
                ax += L[n] * PA[o]; ay += L[n] * PA[o + 1]; az += L[n] * PA[o + 2];
                bx += L[n] * PB[o]; by += L[n] * PB[o + 1]; bz += L[n] * PB[o + 2];
            }
        }
    }

    if (best === Infinity) return false;
    if (is3D) return { distance: best, pointA: new Vector3(ax, ay, az), pointB: new Vector3(bx, by, bz) };
    return { distance: best, pointA: new Vector2(ax, ay), pointB: new Vector2(bx, by) };
}
