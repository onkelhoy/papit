import { Vector2, VectorValue } from "@papit/vector";
import { PolygonObject, SimplePolygonObject } from "@papit/game-shape";
import { AABB } from "components/rectangle";

/**
 * Seperate Axis Theorem : SAT 
 * @param {PolygonObject} a 
 * @param {PolygonObject} b 
 */
export function SAT(a: PolygonObject, b: PolygonObject) {
    const aboundary = a.boundary;
    const bboundary = b.boundary;

    if (aboundary && bboundary && !AABB(aboundary, bboundary)) return false;

    const direction = Vector2.subtract(a.center, b.center);

    if (a.concave)
    {
        if (b.concave)
        {
            return sat_concave_concave(a, b, direction);
        }
        else 
        {
            return sat_concave_convex(a, b, direction);
        }
    }
    else if (b.concave)
    {
        return sat_concave_convex(b, a, direction);
    }

    return sat_convex_convex(a, b, direction);
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

    for (let i = 0; i < a.verticies.length; i++) 
    {
        const localaxis = Vector2.perpendicular(a.verticies[i], a.verticies[(i + 1) % a.verticies.length]).normalize();

        const [mina, maxa] = sat_project(a.verticies, localaxis);
        const [minb, maxb] = sat_project(b.verticies, localaxis);

        if (mina >= maxb || minb >= maxa) return false;

        const localdepth = Math.min(maxb - mina, maxa - minb);
        if (localdepth < depth)
        {
            depth = localdepth;
            axis = localaxis;
        }
    }

    return { axis, depth };
}
function sat_project(verticies: VectorValue[], axis: VectorValue) {
    let min = Number.MAX_SAFE_INTEGER;
    let max = Number.MIN_SAFE_INTEGER;
    for (const v of verticies) 
    {
        const projection = Vector2.dot(v, axis);
        if (projection < min) min = projection;
        if (projection > max) max = projection;
    }

    return [min, max];
}
//#endregion

//#region SAT concave convex
function sat_concave_convex(a: PolygonObject, b: PolygonObject, direction: VectorValue) {
    const ta: SimplePolygonObject = { verticies: [], triangles: [] };

    for (let i = 0; i < a.triangles.length / 3; i++)
    {
        ta.verticies = a.getTriangle(i);

        const intersectioninfo = sat_convex_convex(ta, b, direction);
        if (intersectioninfo)
        {
            return intersectioninfo;
        }
    }
}
//#endregion

//#region SAT concave concave
function sat_concave_concave(a: PolygonObject, b: PolygonObject, direction: VectorValue) {
    const ta: SimplePolygonObject = { verticies: [], triangles: [] };
    const tb: SimplePolygonObject = { verticies: [], triangles: [] };

    for (let i = 0; i < a.triangles.length / 3; i++)
    {
        ta.verticies = a.getTriangle(i);

        for (let j = 0; j < b.triangles.length / 3; j++)
        {
            tb.verticies = b.getTriangle(j);

            const intersectioninfo = sat_convex_convex(ta, tb, direction);
            if (intersectioninfo)
            {
                return intersectioninfo;
            }
        }
    }
}
//#endregion