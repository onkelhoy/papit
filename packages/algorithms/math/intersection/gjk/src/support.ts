import type { VectorValue } from "@papit/vector";
import type { Box, Capsule, Convex, Sphere, Transform } from "./types";
import { read, R, type Direction } from "./util";

type Out = { x: number; y: number; z?: number };

function point(x: number, y: number, z: number, is3D: boolean): Out {
    return is3D ? { x, y, z } : { x, y };
}

function size(box: Box, short: string, long: string): number {
    const b = box as Record<string, number | undefined>;
    return b[short] ?? b[long] ?? 0;
}

/** Circle or sphere: center plus `r` along the direction. */
export function sphereSupport(sphere: Sphere): Convex {
    const is3D = sphere.z !== undefined;
    return {
        support(direction: VectorValue) {
            const d = direction as Direction;
            const length = Math.sqrt(d.x * d.x + d.y * d.y + (is3D ? d.z * d.z : 0));
            const s = length === 0 ? 0 : sphere.r / length;
            return point(sphere.x + d.x * s, sphere.y + d.y * s, (sphere.z ?? 0) + d.z * s, is3D);
        },
    };
}

/** Axis-aligned box: the corner furthest along the direction. */
export function boxSupport(box: Box): Convex {
    const is3D = box.z !== undefined;
    const w = size(box, "w", "width");
    const h = size(box, "h", "height");
    const depth = size(box, "d", "depth");
    return {
        support(direction: VectorValue) {
            const d = direction as Direction;
            return point(
                d.x < 0 ? box.x : box.x + w,
                d.y < 0 ? box.y : box.y + h,
                d.z < 0 ? box.z ?? 0 : (box.z ?? 0) + depth,
                is3D,
            );
        },
    };
}

/** Capsule: the segment end furthest along the direction, plus `r`. */
export function capsuleSupport(capsule: Capsule): Convex {
    const r = capsule.r;
    read(capsule.a);
    const ax = R[0], ay = R[1], az = R[2], a3D = R[3] === 1;
    read(capsule.b);
    const bx = R[0], by = R[1], bz = R[2];
    const is3D = a3D || R[3] === 1;
    return {
        support(direction: VectorValue) {
            const d = direction as Direction;
            const dz = is3D ? d.z : 0;
            const useB = bx * d.x + by * d.y + bz * dz > ax * d.x + ay * d.y + az * dz;
            const length = Math.sqrt(d.x * d.x + d.y * d.y + dz * dz);
            const s = length === 0 ? 0 : r / length;
            return point((useB ? bx : ax) + d.x * s, (useB ? by : ay) + d.y * s, (useB ? bz : az) + dz * s, is3D);
        },
    };
}

/**
 * Convex hull of `points` (the points need not be the hull, interior ones are ignored).
 * O(n) per support call. Throws on an empty list.
 */
export function hullSupport(points: VectorValue[]): Convex {
    if (points.length === 0) throw new RangeError("hullSupport needs at least one point");

    let is3D = false;
    for (const p of points)
    {
        read(p);
        if (R[3]) is3D = true;
    }

    return {
        support(direction: VectorValue) {
            const d = direction as Direction;
            let best = -Infinity;
            let bx = 0, by = 0, bz = 0;
            for (let i = 0; i < points.length; i++)
            {
                read(points[i]);
                const dot = R[0] * d.x + R[1] * d.y + R[2] * d.z;
                if (dot > best)
                {
                    best = dot;
                    bx = R[0]; by = R[1]; bz = R[2];
                }
            }
            return point(bx, by, bz, is3D);
        },
    };
}

/** `shape` moved by `offset`. */
export function translated(shape: Convex, offset: VectorValue): Convex {
    read(offset);
    const ox = R[0], oy = R[1], oz = R[2], offset3D = R[3] === 1;
    return {
        support(direction: VectorValue) {
            const d = direction as Direction;
            read(shape.support(d));
            return point(R[0] + ox, R[1] + oy, R[2] + oz, offset3D || R[3] === 1);
        },
    };
}

/**
 * `shape` under a column-major homogeneous `matrix` (3x3 for 2D, 4x4 for 3D), e.g. a
 * `Matrix3` / `Matrix4`. Any linear part works: rotation, scale, shear.
 */
export function transformed(shape: Convex, matrix: Transform): Convex {
    const n = matrix.length === 16 ? 4 : matrix.length === 9 ? 3 : 0;
    if (n === 0) throw new RangeError("transformed needs a 3x3 or 4x4 matrix");

    const m = (row: number, col: number) => matrix[col * n + row];
    const local: Direction = { x: 0, y: 0, z: 0 };
    const is3D = n === 4;

    return {
        support(direction: VectorValue): Out {
            const d = direction as Direction;
            // support of M·S along d is M · (support of S along Mᵀd)
            if (is3D)
            {
                local.x = m(0, 0) * d.x + m(1, 0) * d.y + m(2, 0) * d.z;
                local.y = m(0, 1) * d.x + m(1, 1) * d.y + m(2, 1) * d.z;
                local.z = m(0, 2) * d.x + m(1, 2) * d.y + m(2, 2) * d.z;
            }
            else
            {
                local.x = m(0, 0) * d.x + m(1, 0) * d.y;
                local.y = m(0, 1) * d.x + m(1, 1) * d.y;
                local.z = 0;
            }

            read(shape.support(local));
            const x = R[0], y = R[1], z = R[2];
            if (is3D)
            {
                return {
                    x: m(0, 0) * x + m(0, 1) * y + m(0, 2) * z + m(0, 3),
                    y: m(1, 0) * x + m(1, 1) * y + m(1, 2) * z + m(1, 3),
                    z: m(2, 0) * x + m(2, 1) * y + m(2, 2) * z + m(2, 3),
                };
            }
            return {
                x: m(0, 0) * x + m(0, 1) * y + m(0, 2),
                y: m(1, 0) * x + m(1, 1) * y + m(1, 2),
            };
        },
    };
}

/** `shape` grown by radius `r` on every side (a rounded shape). */
export function margin(shape: Convex, r: number): Convex {
    return {
        support(direction: VectorValue) {
            const d = direction as Direction;
            read(shape.support(d));
            const is3D = R[3] === 1;
            const dz = is3D ? d.z : 0;
            const length = Math.sqrt(d.x * d.x + d.y * d.y + dz * dz);
            const s = length === 0 ? 0 : r / length;
            return point(R[0] + d.x * s, R[1] + d.y * s, R[2] + dz * s, is3D);
        },
    };
}
