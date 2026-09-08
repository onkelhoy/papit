import { SegmentIntersection } from "@papit/line-intersection";
import { isPointInTriangle } from "@papit/triangle-intersection";
import { Vector2, VectorValue } from "@papit/vector";
import { Polygon } from "types";

/**
 * @deprecated use SAT implementation from @papit/sat instead 
 */
export function isPointInPolygonTriangles(point: VectorValue, polygon: Polygon) {
    if (!polygon.triangles) return false;
    for (let i = 0; i < polygon.triangles.length; i += 3)
    {
        const a = polygon.vertices[polygon.triangles[i]];
        const b = polygon.vertices[polygon.triangles[i + 1]];
        const c = polygon.vertices[polygon.triangles[i + 2]];

        if (isPointInTriangle(point, a, b, c))
        {
            return [true, [a, b, c]];
        }
    }

    return false;
}

export function isPointInPolygonRayCasting(point: VectorValue, polygon: Polygon) {
    const ray = [point, Vector2.add(point, { x: 10000, y: 0 })];
    let intersections = 0;
    for (let i = 0; i < polygon.vertices.length; i++) 
    {
        const a = polygon.vertices[i];
        const b = polygon.vertices[(i + 1) % polygon.vertices.length];

        if (SegmentIntersection(ray[0], ray[1], a, b))
        {
            intersections++;
        }
    }

    return intersections % 2 === 1;
}