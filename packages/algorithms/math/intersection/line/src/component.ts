import { Vector2, VectorValue } from "@papit/vector";

/**
 * Where infinite line `p1`–`p2` crosses line `p3`–`p4` (2D).
 * @returns the crossing `x, y` with `t`, `u` along each line, or `false` when parallel
 */
export function LineIntersection(p1: VectorValue, p2: VectorValue, p3: VectorValue, p4: VectorValue) {
    const D1 = Vector2.subtract(p2, p1);
    const D2 = Vector2.subtract(p4, p3);

    const denominator = Vector2.cross(D1, D2);
    if (denominator === 0) return false;

    const D3 = Vector2.subtract(p3, p1);
    const t = Vector2.cross(D3, D2) / denominator;
    const u = Vector2.cross(D3, D1) / denominator;

    return {
        x: new Vector2(p1).x + t * D1.x,
        y: new Vector2(p1).y + t * D1.y,
        t,
        u,
    };
}
/** Like `LineIntersection`, but only when the crossing lies on both segments (`t`, `u` in [0, 1]). */
export function SegmentIntersection(p1: VectorValue, p2: VectorValue, p3: VectorValue, p4: VectorValue) {

    const i = LineIntersection(p1, p2, p3, p4);
    if (i === false) return false;

    if (i.t >= 0 && i.t <= 1 && i.u >= 0 && i.u <= 1)
    {
        return i;
    }

    return false;
}