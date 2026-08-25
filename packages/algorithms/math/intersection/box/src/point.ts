import type { Rectangle } from "types";
import { dim } from "./util";

type Vector2 = { x: number, y: number }
/**
 * 
 * @param {Vector2} p 
 * @param {Rectangle} rec 
 * @returns boolean
 */
export function isPointInRectangle(p: Vector2, rec: Rectangle) {
    return p.x >= rec.x && p.x <= rec.x + dim(rec, 'w') && p.y >= rec.y && p.y <= rec.y + dim(rec, 'h');
}