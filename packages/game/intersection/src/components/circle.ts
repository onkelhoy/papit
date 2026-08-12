import { Vector2, VectorValue } from "@papit/vector";
import { CircleObject } from "@papit/game-shape";

/**
 * 
 * @param {CircleObject} a 
 * @param {CircleObject} b 
 * @returns boolean|Circle
 */
export function CircleIntersection(a: CircleObject, b: CircleObject) {
    const dv = Vector2.subtract(b, a);
    const d = dv.magnitude;

    if (d <= a.r + b.r) 
    {
        const r = (a.r + b.r - d) / 2;
        const arp = a.r ** 2;

        const aa = (arp - b.r ** 2 + d ** 2) / (2 * d);
        const h = Math.sqrt(arp - aa ** 2);

        const vc = Vector2.add(a, { x: aa * dv.x / d, y: aa * dv.y / d });
        const va = Vector2.add(vc, { x: h * dv.y / d, y: -h * dv.x / d });
        const vb = Vector2.add(vc, { x: -h * dv.y / d, y: h * dv.x / d });

        return {
            va: va,
            vb: vb,
            vc: vc,
            r,
            a: aa,
            h,
        }
    }

    return false;
}

/**
 * 
 * @param {VectorValue} p
 * @param {CircleObject} a 
 * @returns boolean
 */
export function isPointInCircle(p: VectorValue, a: CircleObject) {
    return Vector2.distance(p, a) <= a.r;
}