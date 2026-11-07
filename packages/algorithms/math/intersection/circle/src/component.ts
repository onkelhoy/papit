import type { VectorValue } from "@papit/vector";
import { Vector2, Vector3 } from "@papit/vector";
import type { Circle, Point } from "types";

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

/**
 * Whether point `p` lies inside (or on the boundary of) `circle`.
 * 3D when the circle has a `z` (then `p` must be an object or `Vector` with `x, y, z`).
 */
export function isPointInCircle(p: VectorValue | Point, circle: Circle): boolean {
    if (circle.z === undefined) return Vector2.distance(p as VectorValue, position(circle)) <= radius(circle);

    const point = p as Point;
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const dz = (point.z ?? 0) - circle.z;
    const r = radius(circle);
    return dx * dx + dy * dy + dz * dz <= r * r;
}

/**
 * Overlap of two circles or spheres (3D when either has a `z`).
 * Touching counts as overlapping with depth 0.
 *
 * @returns `false` when apart, otherwise:
 * - `normal` — unit vector from `a`'s center towards `b`'s (`+x` when concentric)
 * - `depth` — how far they overlap along `normal`
 */
export function CircleOverlap(a: Circle, b: Circle): { normal: Vector2 | Vector3; depth: number } | false {
    const is3D = a.z !== undefined || b.z !== undefined;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = (b.z ?? 0) - (a.z ?? 0);
    const reach = radius(a) + radius(b);

    const squared = dx * dx + dy * dy + dz * dz;
    if (squared > reach * reach) return false;

    const d = Math.sqrt(squared);
    const nx = d === 0 ? 1 : dx / d;
    const ny = d === 0 ? 0 : dy / d;
    const nz = d === 0 ? 0 : dz / d;

    const normal = is3D ? new Vector3(nx, ny, nz) : new Vector2(nx, ny);
    return { normal, depth: reach - d };
}

/**
 * Ray vs circle or sphere (3D when the circle has a `z`).
 * A ray that starts inside hits at `t = 0` with a zero normal.
 *
 * @returns `false` on a miss, otherwise:
 * - `t` — distance in units of `direction`'s length: `point = origin + t * direction`
 * - `point` — the first hit on the surface
 * - `normal` — outward unit normal at `point`
 */
export function rayCircle(origin: Point, direction: Point, circle: Circle): {
    t: number;
    point: Vector2 | Vector3;
    normal: Vector2 | Vector3;
} | false {
    const is3D = circle.z !== undefined;
    const r = radius(circle);

    // m = origin - center
    const mx = origin.x - circle.x;
    const my = origin.y - circle.y;
    const mz = is3D ? (origin.z ?? 0) - (circle.z as number) : 0;
    const dx = direction.x;
    const dy = direction.y;
    const dz = is3D ? direction.z ?? 0 : 0;

    const c = mx * mx + my * my + mz * mz - r * r;
    if (c <= 0)
    {
        const point = is3D ? new Vector3(origin.x, origin.y, origin.z ?? 0) : new Vector2(origin.x, origin.y);
        return { t: 0, point, normal: is3D ? Vector3.zero : Vector2.zero };
    }

    const a = dx * dx + dy * dy + dz * dz;
    if (a === 0) return false; // zero direction, starting outside

    const b = mx * dx + my * dy + mz * dz;
    if (b > 0) return false; // outside and pointing away

    const discriminant = b * b - a * c;
    if (discriminant < 0) return false;

    const t = (-b - Math.sqrt(discriminant)) / a;
    const px = origin.x + t * dx;
    const py = origin.y + t * dy;
    const pz = (is3D ? origin.z ?? 0 : 0) + t * dz;

    // a zero radius has no surface direction, leave the normal at zero
    const inv = r === 0 ? 0 : 1 / r;
    const nx = (px - circle.x) * inv;
    const ny = (py - circle.y) * inv;

    if (!is3D) return { t, point: new Vector2(px, py), normal: new Vector2(nx, ny) };

    const nz = (pz - (circle.z as number)) * inv;
    return { t, point: new Vector3(px, py, pz), normal: new Vector3(nx, ny, nz) };
}
