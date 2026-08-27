import { Vector2 } from "@papit/vector";
import { isPointInTriangle } from "@papit/triangle-intersection";
import { type Polygon } from "types";

/**
 * Ear Clipping
 */
export function Triangulation(polygon: Polygon): { error: false | string; triangles: number[] } {
    let indexlist = polygon.vertices.map((_v, i) => i);
    const triangles: number[] = [];

    // validate if polygon can be triangulated
    if (polygon.vertices.length < 3)
    {
        return { error: "polygon has less then 3 vertices", triangles };
    }

    while (indexlist.length > 3)
    {
        let bestIndex = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < indexlist.length; i++)
        {
            const a = indexlist[i];
            const b = getitem(indexlist, i - 1);
            const c = getitem(indexlist, i + 1);

            const va = polygon.vertices[a];
            const vb = polygon.vertices[b];
            const vc = polygon.vertices[c];

            const va_to_vb = Vector2.subtract(vb, va);
            const va_to_vc = Vector2.subtract(vc, va);

            // check if convex
            if (Vector2.cross(va_to_vb, va_to_vc) > 0)
            {
                continue;
            }

            let isear = true;
            // check if any points inside potential triangle
            for (let j = 0; j < polygon.vertices.length; j++)
            {
                if (j === a || j === b || j === c)
                {
                    continue;
                }

                if (isPointInTriangle(polygon.vertices[j], vb, va, vc))
                {
                    isear = false;
                    break;
                }
            }

            if (isear)
            {
                const score = Vector2.cross(va_to_vb, va_to_vc); // or angle-based score
                if (score > bestScore)
                {
                    bestScore = score;
                    bestIndex = i;
                }
            }
        }

        if (bestIndex === -1)
        {
            return { error: "no further triangle could be established", triangles };
        }

        const a = indexlist[bestIndex];
        const b = getitem(indexlist, bestIndex - 1);
        const c = getitem(indexlist, bestIndex + 1);
        triangles.push(b, a, c);
        indexlist.splice(bestIndex, 1);
    }

    // add last triangle
    if (indexlist.length === 3)
    {
        triangles.push(indexlist[0]);
        triangles.push(indexlist[1]);
        triangles.push(indexlist[2]);
    }
    else 
    {
        return { error: "the remaining vertices is not 3", triangles };
    }

    return { error: false, triangles };
}

function getitem(array: number[], index: number) {
    let v = index % array.length;
    if (v < 0) v += array.length;

    return array[v];
}