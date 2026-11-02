import { Rectangle } from "types";
import { dim } from "./util";

/**
 * 
 * @param {Rectangle} a 
 * @param {Rectangle} b 
 * @returns boolean|rectangle
 */
export function AABB(a: Rectangle, b: Rectangle) {
    const x = AABBhelper(a, b, 'x');
    if (x === false) return false;

    const y = AABBhelper(a, b, 'y');
    if (y === false) return false

    return { ...x, ...y };
}

const MAP: { x: 'w', y: 'h' } = { x: 'w', y: 'h' };

function AABBhelper(a: Rectangle, b: Rectangle, type: "x" | "y" = "x") {
    const min = Math.min(a[type], b[type]);
    const max = Math.max(a[type] + dim(a, MAP[type]), b[type] + dim(b, MAP[type]));

    const global = dim(a, MAP[type]) + dim(b, MAP[type]);
    const local = max - min;
    if (local <= global)
    {
        return { [type]: Math.max(a[type], b[type]), [MAP[type]]: global - local };
    }

    return false;
}
