import { boxSupport, capsuleSupport, hullSupport, sphereSupport, type Convex } from "@papit/gjk";
import { Vector3 } from "@papit/vector";
import type { VecInput } from "./types";

export type ShapeKind = "sphere" | "box" | "capsule" | "plane" | "hull" | "convex";

// direction handed to the gjk support functions
const direction = { x: 0, y: 0, z: 0 };

/**
 * A collision shape in the body's local frame, centered on the body position,
 * which is also its center of mass. Shapes hold no position, so one shape can serve many bodies.
 * Collision geometry is a `@papit/gjk` `Convex`; a shape adds the inertia.
 */
export abstract class Shape {
    abstract readonly kind: ShapeKind;

    /** local-frame support, from `@papit/gjk` or anything with `support(direction)` */
    constructor(readonly convex: Convex) { }

    /** furthest local point along the local direction `(x, y, z)`, into `out` */
    support(x: number, y: number, z: number, out: Vector3): Vector3 {
        direction.x = x; direction.y = y; direction.z = z;
        const p = this.convex.support(direction) as { x?: number; y?: number; z?: number } & ArrayLike<number>;
        out[0] = p.x ?? p[0];
        out[1] = p.y ?? p[1];
        out[2] = (typeof p.x === "number" ? p.z : p[2]) ?? 0;
        return out;
    }

    /**
     * Principal moments of inertia for `mass` in the local frame, into `out`.
     * In 2D only `z` (about the view axis) is used.
     */
    abstract inertia(mass: number, dimensions: 2 | 3, out: Vector3): Vector3;
}

/** A sphere, or in a 2D world a circle (a disk's inertia). */
export class Sphere extends Shape {
    readonly kind = "sphere";

    constructor(readonly radius: number) {
        if (!(radius > 0)) throw new RangeError("radius must be above 0");
        super(sphereSupport({ x: 0, y: 0, z: 0, r: radius }));
    }


    inertia(mass: number, dimensions: 2 | 3, out: Vector3): Vector3 {
        const i = (dimensions === 2 ? 0.5 : 0.4) * mass * this.radius * this.radius;
        out.x = i; out.y = i; out.z = i;
        return out;
    }
}

/** A circle for 2D worlds, the same as a `Sphere`. */
export class Circle extends Sphere {}

/** A box from its full size. In 2D `depth` is ignored. */
export class Box extends Shape {
    readonly kind = "box";
    /** half sizes */
    readonly half: Vector3;

    constructor(width: number, height: number, depth = 1) {
        if (!(width > 0 && height > 0 && depth > 0)) throw new RangeError("box sizes must be above 0");
        super(boxSupport({ x: -width / 2, y: -height / 2, z: -depth / 2, w: width, h: height, d: depth }));
        this.half = new Vector3(width / 2, height / 2, depth / 2);
    }


    inertia(mass: number, dimensions: 2 | 3, out: Vector3): Vector3 {
        const x = 4 * this.half.x * this.half.x, y = 4 * this.half.y * this.half.y, z = 4 * this.half.z * this.half.z;
        out.x = mass / 12 * (y + z);
        out.y = mass / 12 * (x + z);
        out.z = mass / 12 * (x + y);
        return out;
    }
}

/** A capsule along local y: a segment of `height` between the cap centers, swept by `radius`. */
export class Capsule extends Shape {
    readonly kind = "capsule";

    constructor(readonly radius: number, readonly height: number) {
        if (!(radius > 0 && height >= 0)) throw new RangeError("capsule needs radius > 0 and height >= 0");
        super(capsuleSupport({ a: [0, -height / 2, 0], b: [0, height / 2, 0], r: radius }));
    }


    inertia(mass: number, dimensions: 2 | 3, out: Vector3): Vector3 {
        const r = this.radius, h = this.height;
        if (dimensions === 2)
        {
            // a rectangle plus two half disks, about z
            const rect = 2 * r * h, disk = Math.PI * r * r;
            const mr = mass * rect / (rect + disk), md = mass - mr;
            const iz = mr * (4 * r * r + h * h) / 12 + md * (0.5 * r * r + h * h / 4 + 4 * r * h / (3 * Math.PI));
            out.x = iz; out.y = iz; out.z = iz;
            return out;
        }
        const cylinder = Math.PI * r * r * h, caps = 4 / 3 * Math.PI * r * r * r;
        const mc = mass * cylinder / (cylinder + caps), ms = mass - mc;
        const side = mc * (r * r / 4 + h * h / 12) + ms * (0.4 * r * r + h * h / 4 + 3 * h * r / 8);
        out.x = side;
        out.y = mc * r * r / 2 + ms * 0.4 * r * r;
        out.z = side;
        return out;
    }
}

/**
 * An infinite plane through the body position with local normal +y (rotate the body to tilt it).
 * Static only. In 2D it is the line y = 0 in the body's frame.
 */
export class Plane extends Shape {
    readonly kind = "plane";

    constructor() {
        // never asked by gjk, planes have their own contact test; this is the surface point
        super({ support: () => ({ x: 0, y: 0, z: 0 }) });
    }


    inertia(_mass: number, _dimensions: 2 | 3, out: Vector3): Vector3 {
        out.x = 0; out.y = 0; out.z = 0;
        return out;
    }
}

/**
 * The convex hull of local points (interior points are ignored), around the body origin.
 * 3D inertia is that of the points' bounding box, an approximation.
 */
export class Hull extends Shape {
    readonly kind = "hull";
    readonly points: Float64Array;

    constructor(points: VecInput[]) {
        if (points.length === 0) throw new RangeError("a hull needs at least one point");
        super(hullSupport(points.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 }))));
        this.points = new Float64Array(points.length * 3);
        points.forEach((p, i) => {
            this.points[i * 3] = p.x;
            this.points[i * 3 + 1] = p.y;
            this.points[i * 3 + 2] = p.z ?? 0;
        });
    }


    inertia(mass: number, dimensions: 2 | 3, out: Vector3): Vector3 {
        if (dimensions === 2) return polygonInertia(this.points, mass, out);
        let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        const p = this.points;
        for (let i = 0; i < p.length; i += 3)
        {
            minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
            minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
            minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
        }
        const x = (maxX - minX) ** 2, y = (maxY - minY) ** 2, z = (maxZ - minZ) ** 2;
        out.x = mass / 12 * (y + z);
        out.y = mass / 12 * (x + z);
        out.z = mass / 12 * (x + y);
        return out;
    }
}

/**
 * Any `@papit/gjk` `Convex` as a shape, a `@papit/game-shape` shape included: place it around the origin,
 * the body moves and turns it. `inertia` is the principal moments for 1 kg; leave it out to use the
 * bounding box of the support points, an approximation.
 */
export class ConvexShape extends Shape {
    readonly kind = "convex";
    private readonly unitInertia: Vector3;

    constructor(convex: Convex, inertia?: VecInput) {
        super(convex);
        if (inertia)
        {
            this.unitInertia = new Vector3(inertia.x, inertia.y, inertia.z ?? inertia.x);
            return;
        }
        const p = new Vector3(0, 0, 0);
        const size = (x: number, y: number, z: number) => {
            const high = this.support(x, y, z, p).dot([x, y, z]);
            return high - this.support(-x, -y, -z, p).dot([x, y, z]);
        };
        const x = size(1, 0, 0) ** 2, y = size(0, 1, 0) ** 2, z = size(0, 0, 1) ** 2;
        this.unitInertia = new Vector3((y + z) / 12, (x + z) / 12, (x + y) / 12);
    }

    inertia(mass: number, _dimensions: 2 | 3, out: Vector3): Vector3 {
        out[0] = this.unitInertia[0] * mass;
        out[1] = this.unitInertia[1] * mass;
        out[2] = this.unitInertia[2] * mass;
        return out;
    }
}

/** A convex polygon for 2D worlds, a `Hull` of `{ x, y }` points with exact 2D inertia. */
export class Polygon extends Hull {}

/** Exact inertia about the origin of the 2D convex hull of `points` (xyz triples, z ignored). */
function polygonInertia(points: Float64Array, mass: number, out: Vector3): Vector3 {
    const hull = hull2D(points);
    let numerator = 0, denominator = 0;
    for (let i = 0; i < hull.length; i += 2)
    {
        const ax = hull[i], ay = hull[i + 1];
        const bx = hull[(i + 2) % hull.length], by = hull[(i + 3) % hull.length];
        const cross = Math.abs(ax * by - ay * bx);
        numerator += cross * (ax * ax + ay * ay + ax * bx + ay * by + bx * bx + by * by);
        denominator += cross;
    }
    // fewer than 3 hull points: a point or a rod, fall back to the spread of the points
    let i = denominator > 0 ? mass * numerator / (6 * denominator) : 0;
    if (i === 0)
    {
        for (let k = 0; k < hull.length; k += 2) i += hull[k] * hull[k] + hull[k + 1] * hull[k + 1];
        i = hull.length > 0 ? mass * i / (hull.length / 2) : 0;
    }
    out.x = i; out.y = i; out.z = i;
    return out;
}

/** Monotone chain hull, counter-clockwise `[x0, y0, x1, y1, ...]`. */
function hull2D(points: Float64Array): number[] {
    const list: [number, number][] = [];
    for (let i = 0; i < points.length; i += 3) list.push([points[i], points[i + 1]]);
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (list.length < 3) return list.flat();

    const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: [number, number][] = [];
    for (const p of list)
    {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    const upper: [number, number][] = [];
    for (let i = list.length - 1; i >= 0; i--)
    {
        const p = list[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper).flat();
}
