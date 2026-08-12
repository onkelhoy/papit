import { Vector2 } from "@papit/vector";
import { RectangleObject } from "@papit/game-shape";

/**
 * 
 * @param {RectangleObject} a 
 * @param {RectangleObject} b 
 * @returns boolean|rectangle
 */
export function AABB(a: RectangleObject, b: RectangleObject) {
    const x = AABBhelper(a, b, 'x');
    if (x === false) return false;

    const y = AABBhelper(a, b, 'y');
    if (y === false) return false

    return { ...x, ...y };
}
const aabb_map: { x: 'w', y: 'h' } = { x: 'w', y: 'h' };
function AABBhelper(a: RectangleObject, b: RectangleObject, type: "x" | "y" = "x") {
    const min = Math.min(a[type], b[type]);
    const max = Math.max(a[type] + a[aabb_map[type]], b[type] + b[aabb_map[type]]);

    const global = a[aabb_map[type]] + b[aabb_map[type]];
    const local = max - min;
    if (local <= global)
    {
        return { [type]: Math.max(a[type], b[type]), [aabb_map[type]]: global - local };
    }

    return false;
}

/**
 * 
 * @param {Vector2} p 
 * @param {RectangleObject} rec 
 * @returns boolean
 */
export function isPointInRectangle(p: Vector2, rec: RectangleObject) {
    return p.x >= rec.x && p.x <= rec.x + rec.w && p.y >= rec.y && p.y <= rec.y + rec.h;
}