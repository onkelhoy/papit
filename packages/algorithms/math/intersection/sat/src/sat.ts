import { Vector2, VectorValue } from "@papit/vector";
import { getMTV, getAxes, getCenter } from "./util";
import { getBoundary, getShapes } from "shape";
import { Polygon } from "types";
import { AABB } from "@papit/box-intersection";

export function SAT(a: Polygon, b: Polygon): false | { axis: Vector2, overlap: number } {
    let overlap = Number.MAX_SAFE_INTEGER;
    let axis = Vector2.zero;
    let collided = false;

    const aboudnary = getBoundary(a);
    const bboudnary = getBoundary(b);

    if (aboudnary && bboudnary && !AABB(aboudnary, bboudnary))
    {
        return false;
    }

    const ashapes = getShapes(a);
    const bshapes = getShapes(b);

    for (const shapeA of ashapes)
    {
        for (const shapeB of bshapes)
        {
            const result = localSAT(shapeA, shapeB);
            if (result === false) continue; // this piece-pair is separated, not a full-polygon separation

            collided = true;
            if (result.overlap < overlap)
            {
                overlap = result.overlap;
                axis = result.axis;
            }
        }
    }

    if (!collided) return false;

    // --- NEW: ensure axis points from a to b ---
    const centerA = getCenter(a);
    const centerB = getCenter(b);
    if (centerA && centerB)
    {
        const dir = Vector2.subtract(centerB, centerA);
        if (Vector2.dot(axis, dir) < 0)
        {
            axis.multiply(-1);   // flip so it points from a to b
        }
    }

    return { axis, overlap };
}

// Local SAT between two individual convex pieces — a decomposed polygon
// is a set of these, so overall collision = any pair of pieces colliding.
// Every edge of a piece (original boundary or decomposition diagonal)
// is a valid separating-axis candidate for THIS test; the diagonal is
// real geometry for this convex shape, so it must not be filtered out.
function localSAT(
    vertices1: VectorValue[],
    vertices2: VectorValue[]
): { axis: Vector2; overlap: number } | false {
    let overlap = Number.MAX_SAFE_INTEGER;
    let axis: Vector2 | null = null;

    for (let i = 0; i < 2; i++)
    {
        const axes = getAxes(i === 0 ? vertices1 : vertices2);
        const mtv = getMTV(axes, vertices1, vertices2);
        if (mtv === false) return false; // separating axis found — pieces don't overlap

        if (mtv !== null && mtv.overlap < overlap)
        {
            overlap = mtv.overlap;
            axis = mtv.axis;
        }
    }

    if (axis === null) return false;
    return { axis, overlap };
}
