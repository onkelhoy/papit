import { Vector2, VectorValue } from "@papit/vector";
import { AABB } from "@papit/box-intersection";
import { getShapes } from "shape";
import { Polygon, Shape } from "types";
import { getMTV, getAxes, getMeta } from "./util";

type Contact = { normal: Vector2, overlap: number };
export function SAT(polygonA: Polygon, polygonB: Polygon): Contact | false {
    let overlap = Number.MAX_SAFE_INTEGER;
    let axis = Vector2.zero;
    let collided = false;
    const raw: Contact[] = [];

    let centerA: Vector2 | undefined = undefined;
    let centerB: Vector2 | undefined = undefined;

    const polygonMetaA = getMeta(polygonA, true);
    const polygonMetaB = getMeta(polygonB, true);

    if (!AABB(polygonMetaA.boundary, polygonMetaB.boundary))
    {
        return false;
    }

    const ashapes = getShapes(polygonA);
    const bshapes = getShapes(polygonB);

    const cacheMeta = new WeakMap<Shape, ReturnType<typeof getMeta>>();

    const _getMeta = (shape: Shape) => {
        const cached = cacheMeta.get(shape);
        if (cached) return cached;
        const meta = getMeta(shape);
        cacheMeta.set(shape, meta);
        return meta;
    }

    for (const shapeA of ashapes)
    {
        const shapeMetaA = _getMeta(shapeA);
        if (!AABB(shapeMetaA.boundary, polygonMetaB.boundary))
        {
            continue;
        }

        for (const shapeB of bshapes)
        {
            const shapeMetaB = _getMeta(shapeB);
            if (!AABB(shapeMetaA.boundary, shapeMetaB.boundary))
            {
                continue;
            }

            const result = localSAT(
                polygonA,
                polygonB,
                polygonMetaA.vertexindexmap,
                polygonMetaB.vertexindexmap,
                shapeA,
                shapeB
            );
            if (result === false) continue; // this piece-pair is separated, not a full-polygon separation

            // collided = true;

            raw.push({
                normal: result.axis,
                overlap: result.overlap,
            });

            // if (result.overlap < overlap)
            // {
            //     overlap = result.overlap;
            //     axis = result.axis;
            //     centerA = shapeMetaA.center;
            //     centerB = shapeMetaB.center;
            // }
        }
    }

    if (raw.length === 0) return false;
    // 1. Merge contacts that represent the same physical edge
    const merged = mergeContacts(raw);

    // 2. Choose the best contact
    let bestSignificant: Contact | null = null;
    let bestSignificantOverlap = Infinity;
    let fallback: Contact | null = null;
    let fallbackOverlap = Infinity;

    for (const c of merged)
    {
        if (c.overlap > SIGNIFICANT_OVERLAP_THRESHOLD && c.overlap < bestSignificantOverlap)
        {
            bestSignificantOverlap = c.overlap;
            bestSignificant = c;
        }
        if (c.overlap < fallbackOverlap)
        {
            fallbackOverlap = c.overlap;
            fallback = c;
        }
    }

    const chosen = bestSignificant ?? fallback;
    return chosen ? chosen : false;

    // const normal = axis.clone;

    // if (centerA && centerB)
    // {
    //     const dir = Vector2.subtract(centerB, centerA);
    //     if (Vector2.dot(normal, dir) < 0)
    //     {
    //         normal.multiply(-1);   // flip so it points from a to b
    //     }
    // }

    // return raw; // { normal: axis, overlap };
}

const SIGNIFICANT_OVERLAP_THRESHOLD = 0.001; // tune to your world scale
const MERGE_DOT = 0.995; // dot product threshold for “same” normal

function mergeContacts(raw: Contact[]): Contact[] {
    const merged: Contact[] = [];
    for (const { normal, overlap } of raw)
    {
        const existing = merged.find(m => Vector2.dot(normal, m.normal) > MERGE_DOT);
        if (existing)
        {
            if (overlap > existing.overlap) existing.overlap = overlap;
        } else
        {
            merged.push({ normal: normal.clone, overlap });
        }
    }
    return merged;
}

// Local SAT between two individual convex pieces — a decomposed polygon
// is a set of these, so overall collision = any pair of pieces colliding.
// Every edge of a piece (original boundary or decomposition diagonal)
// is a valid separating-axis candidate for THIS test; the diagonal is
// real geometry for this convex shape, so it must not be filtered out.
function localSAT(
    polygonA: Polygon,
    polygonB: Polygon,
    vertexindexmapA: Record<string, number>,
    vertexindexmapB: Record<string, number>,
    shapeA: Shape,
    shapeB: Shape
): { axis: Vector2; overlap: number } | false {
    let overlap = Number.MAX_SAFE_INTEGER;
    let axis: Vector2 | null = null;

    for (let i = 0; i < 2; i++)
    {
        const axes = i === 0 ? getAxes(polygonA, vertexindexmapA, shapeA) : getAxes(polygonB, vertexindexmapB, shapeB);
        const mtv = getMTV(axes, shapeA, shapeB);
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
