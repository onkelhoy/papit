import { Vector2, VectorValue } from "@papit/vector";

import { SegmentIntersection } from "components/line";
import { SimplePolygonObject } from "./types";


export function isPointInPolygonTriangles(point: VectorValue, polygon: SimplePolygonObject) {
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

export function isPointInPolygonRayCasting(point: VectorValue, polygon: SimplePolygonObject) {
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

/**
 * 
 * @param {VectorValue} p 
 * @param {VectorValue[]} triangle 
 */
export function isPointInTriangle(p: VectorValue, ...triangle: VectorValue[]) {
    if (triangle.length !== 3) throw new Error(`${triangle} is not a triangle`);

    if (!pointintriangle_helper(p, triangle, 0)) return false; // a -> p
    if (!pointintriangle_helper(p, triangle, 1)) return false; // b -> p
    if (!pointintriangle_helper(p, triangle, 2)) return false; // c -> p

    return true;
}

function pointintriangle_helper(p: VectorValue, triangle: VectorValue[], index: number) {
    const ab = Vector2.subtract(triangle[(index + 1) % triangle.length], triangle[index]); // b - a 
    const ap = Vector2.subtract(p, triangle[index]); // p - a 

    return Vector2.cross(ab, ap) >= 0;
}