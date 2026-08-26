import { Vector2 } from "@papit/vector";
import { type Polygon } from "@papit/polygon";

export function Calibrate(polygon: Polygon, verbose = false) {

    // setting properties
    polygon.boundaryindex = [];
    polygon.concave = false;

    // no point for polygons less then or equal to 2
    if (polygon.vertices.length <= 2) return;

    // boundary calculation
    let minx = Number.MAX_SAFE_INTEGER;
    let miny = Number.MAX_SAFE_INTEGER;
    let maxx = Number.MIN_SAFE_INTEGER;
    let maxy = Number.MIN_SAFE_INTEGER;
    let minxindex = -1;
    let minyindex = -1;
    let maxxindex = -1;
    let maxyindex = -1;

    // keep track on number of convex and concave to determine if concave + counter clockwise direction
    let convex = 0, concave = 0;
    for (let i = 0; i < polygon.vertices.length; i++)
    {
        const v = new Vector2(polygon.vertices[i]);
        const prev = (i - 1 + polygon.vertices.length) % polygon.vertices.length;
        const next = (i + 1) % polygon.vertices.length;

        const AB = Vector2.subtract(v, polygon.vertices[prev]);
        const BC = Vector2.subtract(polygon.vertices[next], v);

        const crossproduct = Vector2.cross(AB, BC);

        if (crossproduct > 0)
        {
            convex++;
        }
        else if (crossproduct < 0)
        {
            concave++;
        }
        else
        {
            // its collinear
            polygon.vertices.splice(i, 1);
            i--;
            continue;
        }

        if (v.x < minx) { minx = v.x; minxindex = i; }
        if (v.x > maxx) { maxx = v.x; maxxindex = i; }
        if (v.y < miny) { miny = v.y; minyindex = i; }
        if (v.y > maxy) { maxy = v.y; maxyindex = i; }
    }

    polygon.boundaryindex = [minxindex, minyindex, maxxindex, maxyindex];

    if (concave > convex)
    {
        polygon.vertices = polygon.vertices.reverse();
        polygon.boundaryindex = polygon.boundaryindex.map(i => polygon.vertices.length - 1 - i);
    }
    polygon.concave = convex > 0 && concave > 0;
}