import type { Matrix3 } from "@papit/matrix";
import type { Quaternion } from "@papit/quaternion";
import type { Vector3 } from "@papit/vector";

// Glue on top of @papit/vector, quaternion and matrix for the hot loops: write numbers
// into a preallocated vector, then use the package method. Nothing here allocates.

/** `out = (x, y, z)` rotated by `q`. */
export function rotate(q: Quaternion, x: number, y: number, z: number, out: Vector3): Vector3 {
    out[0] = x; out[1] = y; out[2] = z;
    return q.rotate(out);
}

/** `out = (x, y, z)` rotated by the inverse of `q`. */
export function unrotate(q: Quaternion, x: number, y: number, z: number, out: Vector3): Vector3 {
    out[0] = x; out[1] = y; out[2] = z;
    return q.unrotate(out);
}

/**
 * World inverse inertia `R * diag(local) * R^T` into `out`. Symmetric, so row- and column-major agree.
 * (Missing from @papit/matrix: a rotation-and-diagonal product without allocating.)
 */
export function worldInertia(q: Quaternion, local: Vector3, out: Matrix3): Matrix3 {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w);
    const r10 = 2 * (x * y + z * w), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - x * w);
    const r20 = 2 * (x * z - y * w), r21 = 2 * (y * z + x * w), r22 = 1 - 2 * (x * x + y * y);
    const a = local[0], b = local[1], c = local[2];
    out[0] = r00 * r00 * a + r01 * r01 * b + r02 * r02 * c;
    out[1] = r00 * r10 * a + r01 * r11 * b + r02 * r12 * c;
    out[2] = r00 * r20 * a + r01 * r21 * b + r02 * r22 * c;
    out[3] = out[1];
    out[4] = r10 * r10 * a + r11 * r11 * b + r12 * r12 * c;
    out[5] = r10 * r20 * a + r11 * r21 * b + r12 * r22 * c;
    out[6] = out[2];
    out[7] = out[5];
    out[8] = r20 * r20 * a + r21 * r21 * b + r22 * r22 * c;
    return out;
}

/** `out = m * (x, y, z)`. (Matrix3.multiply allocates a new matrix, too slow per contact.) */
export function multiply3(m: Matrix3, x: number, y: number, z: number, out: Vector3): Vector3 {
    out[0] = m[0] * x + m[3] * y + m[6] * z;
    out[1] = m[1] * x + m[4] * y + m[7] * z;
    out[2] = m[2] * x + m[5] * y + m[8] * z;
    return out;
}
