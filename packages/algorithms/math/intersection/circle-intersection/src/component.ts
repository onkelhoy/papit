import { Vector2, VectorValue } from "@papit/vector";
import { Circle } from "types";

function radius(circle: Circle): number {
    if ('r' in circle && circle.r !== undefined) return circle.r;
    if ('radius' in circle && circle.radius !== undefined) return circle.radius;
    throw new Error("Circle must define either 'r' or 'radius'");
}

// Vector2's object coercion does Object.values() on *every* own property
// when there's no `order` key — so passing a Circle straight in leaks `r`
// (or `radius`) in as a spurious 3rd dimension. Strip to x/y first.
function position(circle: Circle): VectorValue {
    return { x: circle.x, y: circle.y };
}

/**
 * Finds where two circles intersect, via the radical-line method: the line
 * through both intersection points crosses the line connecting the two
 * centers at a single point, a known distance from circle `a`'s center;
 * stepping perpendicular from there lands on the two intersection points.
 *
 * @returns `false` if the circles are disjoint, concentric, or one fully
 * contains the other without touching. Otherwise an object:
 * - `va` — first intersection point of the two circles
 * - `vb` — second intersection point (equal to `va` when the circles are tangent)
 * - `vc` — midpoint of the chord `va`–`vb`, where it crosses the center-to-center line
 * - `a` — distance from circle `a`'s center to `vc`, along the center-to-center line
 * - `h` — half the chord length, i.e. the distance from `vc` to `va` (or `vb`)
 */
export function CircleIntersection(a: Circle, b: Circle): {
    va: VectorValue;
    vb: VectorValue;
    vc: VectorValue;
    a: number;
    h: number;
} | false {
    const pa = position(a);
    const pb = position(b);
    const ra = radius(a);
    const rb = radius(b);

    const dv = Vector2.subtract(pb, pa);
    const d = dv.magnitude;

    if (d === 0) return false;
    if (d > ra + rb || d < Math.abs(ra - rb)) return false;

    const aa = (ra ** 2 - rb ** 2 + d ** 2) / (2 * d);
    const h = Math.sqrt(Math.max(ra ** 2 - aa ** 2, 0));

    const vc = Vector2.add(pa, { x: (aa * dv.x) / d, y: (aa * dv.y) / d });
    const va = Vector2.add(vc, { x: (h * dv.y) / d, y: (-h * dv.x) / d });
    const vb = Vector2.add(vc, { x: (-h * dv.y) / d, y: (h * dv.x) / d });

    return { va, vb, vc, a: aa, h };
}

/** Whether point `p` lies inside (or on the boundary of) `circle`. */
export function isPointInCircle(p: VectorValue, circle: Circle): boolean {
    return Vector2.distance(p, position(circle)) <= radius(circle);
}