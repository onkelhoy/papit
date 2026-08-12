import { Vector2 } from "@papit/vector";
import { SimplePolygonObject } from "./types";
import { isPointInTriangle } from "./intersection";

export function Triangulate(polygon: SimplePolygonObject) {
    let indexlist = polygon.verticies.map((_v, i) => i);
    const triangles = [];

    // validate if polygon can be triangulated
    if (polygon.verticies.length < 3)
    {
        return [false, "polygon has less then 3 verticies"];
    }

    while (indexlist.length > 3)
    {
        const startinglenght = indexlist.length;

        for (let i = 0; i < indexlist.length; i++)
        {
            const a = indexlist[i];
            const b = getitem(indexlist, i - 1);
            const c = getitem(indexlist, i + 1);

            const va = polygon.verticies[a];
            const vb = polygon.verticies[b];
            const vc = polygon.verticies[c];

            const va_to_vb = Vector2.subtract(vb, va);
            const va_to_vc = Vector2.subtract(vc, va);

            // check if convex
            if (Vector2.cross(va_to_vb, va_to_vc) > 0)
            {
                console.log('convex');
                continue;
            }

            let isear = true;
            // check if any points inside potential triangle
            for (let j = 0; j < polygon.verticies.length; j++)
            {
                if (j === a || j === b || j === c)
                {
                    continue;
                }

                if (isPointInTriangle(polygon.verticies[j], vb, va, vc))
                {
                    isear = false;
                    break;
                }
            }

            if (isear)
            {
                triangles.push(b);
                triangles.push(a);
                triangles.push(c);

                indexlist.splice(i, 1);
                break;
            }
        }

        if (startinglenght === indexlist.length)
        {
            return [false, "no further triangle could be established"];
        }
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
        return [false, "the remaining verticies is not 3"];
    }

    polygon.triangles = triangles;
    return [true];
}

function getitem(array: number[], index: number) {
    let v = index % array.length;
    if (v < 0) v += array.length;

    return array[v];
}