import { Vector2, VectorValue } from "@papit/vector";
import { PolygonObject, SimplePolygonObject } from "@papit/game-shape";
import { AABB } from "components/rectangle";

const DEGENERATE_EPS = 1e-6;

/**
 * Seperate Axis Theorem : SAT 
 * @param {PolygonObject} a 
 * @param {PolygonObject} b 
 */
export function SAT(a: PolygonObject, b: PolygonObject) {
    const aboundary = a.boundary;
    const bboundary = b.boundary;

    if (aboundary && bboundary && !AABB(aboundary, bboundary)) return false;

    // Global fallback direction, used only when a local (per-triangle) direction
    // is too close to zero to reliably determine normal orientation.
    const globalDirection = Vector2.subtract(a.center, b.center);

    if (a.concave)
    {
        if (b.concave)
        {
            return sat_concave_concave(a, b, globalDirection);
        }
        else 
        {
            return sat_concave_convex(a, b, globalDirection);
        }
    }
    else if (b.concave)
    {
        return sat_concave_convex(b, a, globalDirection);
    }

    return sat_convex_convex(a, b, globalDirection);
}

//#region SAT convex convex
function sat_convex_convex(a: SimplePolygonObject, b: SimplePolygonObject, direction: VectorValue) {
    const ainfo = sat_helper(a, b);
    if (!ainfo) return false;

    const binfo = sat_helper(b, a);
    if (!binfo) return false;

    let target = binfo;
    if (ainfo.depth < binfo.depth)
    {
        target = ainfo;
    }

    const normalmag = target.axis.magnitude;
    const normal = target.axis.normalize();

    if (Vector2.dot(direction, normal) > 0)
    {
        normal.multiply(-1); // flip
    }

    return {
        depth: target.depth / normalmag,
        normal,
    }
}
function sat_helper(a: SimplePolygonObject, b: SimplePolygonObject) {
    let depth = Number.MAX_SAFE_INTEGER;
    let axis = Vector2.zero;

    let internalDepth = Number.MAX_SAFE_INTEGER;
    let internalAxis = Vector2.zero;

    for (let i = 0; i < a.vertices.length; i++) 
    {
        const edge = Vector2.subtract(
            a.vertices[(i + 1) % a.vertices.length],
            a.vertices[i]
        );

        if (edge.magnitude < DEGENERATE_EPS) continue; // safe guard in case edge has very tiny edge size

        // const localaxis = edge.perpendicular().normalize();

        const localaxis = Vector2.perpendicular(a.vertices[i], a.vertices[(i + 1) % a.vertices.length]).normalize();

        const [mina, maxa] = sat_project(a.vertices, localaxis);
        const [minb, maxb] = sat_project(b.vertices, localaxis);

        if (mina >= maxb || minb >= maxa) return false;

        const localdepth = Math.min(maxb - mina, maxa - minb);


        // if (localdepth < depth)
        // {
        //     depth = localdepth;
        //     axis = localaxis;
        // }

        // Internal/diagonal edge:
        // still allowed to prove separation, but not allowed to become MTV
        if (a.boundaryflags && a.boundaryflags[i] === false)
        {
            if (localdepth < internalDepth)
            {
                internalDepth = localdepth;
                internalAxis = localaxis;
            }
            continue;
        }

        if (localdepth < depth)
        {
            depth = localdepth;
            axis = localaxis;
        }
    }

    // If every edge was internal, fall back to the best internal edge.
    // This avoids returning Vector2.zero for a rare fully-internal triangle.
    if (depth === Number.MAX_SAFE_INTEGER)
    {
        return {
            axis: internalAxis,
            depth: internalDepth,
        };
    }

    return { axis, depth };
}
function sat_project(vertices: VectorValue[], axis: VectorValue) {
    let min = Number.MAX_SAFE_INTEGER;
    let max = Number.MIN_SAFE_INTEGER;
    for (const v of vertices) 
    {
        const projection = Vector2.dot(v, axis);
        if (projection < min) min = projection;
        if (projection > max) max = projection;
    }

    return [min, max];
}
//#endregion

//#region SAT concave convex
function sat_concave_convex(a: PolygonObject, b: PolygonObject, globalDirection: Vector2) {
    const ta: SimplePolygonObject = { vertices: [], triangles: [] };

    let best: { depth: number; normal: Vector2 } | undefined;

    for (let i = 0; i < a.triangles.length / 3; i++)
    {
        ta.vertices = a.getTriangle(i);
        ta.boundaryflags = getTriangleBoundaryFlags(a, i);

        const triCenter = centroid(ta.vertices);
        let direction = Vector2.subtract(b.center, triCenter);

        if (direction.magnitude < DEGENERATE_EPS)
        {
            direction = globalDirection;
        }

        const intersectioninfo = sat_convex_convex(ta, b, direction);
        if (intersectioninfo && (!best || intersectioninfo.depth < best.depth))
        {
            best = intersectioninfo;
        }
    }

    return best ?? false;
}
//#endregion

//#region SAT concave concave
function sat_concave_concave(a: PolygonObject, b: PolygonObject, globalDirection: Vector2) {
    const ta: SimplePolygonObject = { vertices: [], triangles: [] };
    const tb: SimplePolygonObject = { vertices: [], triangles: [] };

    let best: { depth: number; normal: Vector2 } | undefined;

    for (let i = 0; i < a.triangles.length / 3; i++)
    {
        ta.vertices = a.getTriangle(i);
        ta.boundaryflags = getTriangleBoundaryFlags(a, i);
        const centerA = centroid(ta.vertices);

        for (let j = 0; j < b.triangles.length / 3; j++)
        {
            tb.vertices = b.getTriangle(j);
            tb.boundaryflags = getTriangleBoundaryFlags(b, j);
            const centerB = centroid(tb.vertices);

            let direction = Vector2.subtract(centerB, centerA);

            if (direction.magnitude < DEGENERATE_EPS)
            {
                direction = globalDirection;
            }

            const intersectioninfo = sat_convex_convex(ta, tb, direction);
            if (intersectioninfo && (!best || intersectioninfo.depth < best.depth))
            {
                best = intersectioninfo;
            }
        }
    }

    return best ?? false;
}
//#endregion

function centroid(verts: VectorValue[]) {
    const vec = Vector2.zero;
    for (const v of verts) { vec.add(v); }
    return vec.divide(verts.length);
}

/**
     * A polygon edge between two ORIGINAL vertex indices is a real boundary
     * edge iff the indices are consecutive around the polygon (wrapping).
     * Any other index pairing that shows up inside a triangle is a diagonal
     * introduced purely by triangulation and does not correspond to real
     * outward-facing geometry.
     */
function isBoundaryEdge(polygon: PolygonObject, i1: number, i2: number) {
    const n = polygon.vertices.length;
    const diff = Math.abs(i1 - i2);
    return diff === 1 || diff === n - 1;
}

function getTriangleIndices(polygon: PolygonObject, i: number) {
    return [
        polygon.triangles[i * 3],
        polygon.triangles[i * 3 + 1],
        polygon.triangles[i * 3 + 2],
    ];
}

/**
 * Returns which of triangle i's 3 edges are real polygon boundary edges
 * vs. internal diagonals. Edge k connects the vertex returned at position
 * k of getTriangle(i) to the vertex at position (k+1) % 3 — same order
 * sat_helper iterates edges in, so the two line up index-for-index.
 */
function getTriangleBoundaryFlags(polygon: PolygonObject, i: number) {
    const [i0, i1, i2] = getTriangleIndices(polygon, i);
    return [
        isBoundaryEdge(polygon, i0, i1),
        isBoundaryEdge(polygon, i1, i2),
        isBoundaryEdge(polygon, i2, i0),
    ];
}