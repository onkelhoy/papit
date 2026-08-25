import { Vector2, VectorValue } from "@papit/vector";

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