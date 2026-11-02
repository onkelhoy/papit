import { Vector } from "@papit/vector";

type Point = ArrayLike<number>;

/** Below this, `from` and `to` count as opposite in `setFromTo`. */
const OPPOSITE = 1e-6;
/** Above this dot product, `slerp` falls back to `nlerp`, the angle is too small to divide by. */
const NEARLY_EQUAL = 0.9995;

/**
 * A 3D rotation stored as x, y, z, w, where a unit quaternion is
 * `axis * sin(angle / 2), cos(angle / 2)`.
 * Create one with `Quaternion.identity`, `fromAxisAngle` or `fromTo`.
 * `multiply` and `lerp` are still Vector's component-wise ones,
 * use `multiplyInto` to combine rotations and `nlerp` or `slerp` to blend them.
 */
export class Quaternion extends Vector {

    /** Sets this to no rotation. */
    public identity(): this {
        this[0] = 0;
        this[1] = 0;
        this[2] = 0;
        this[3] = 1;
        return this;
    }

    /** Scales to length 1. A zero quaternion isn't a rotation, so it becomes the identity. */
    public override normalize(): this {
        const mag = Math.hypot(this[0], this[1], this[2], this[3]);
        if (mag === 0) return this.identity();

        this[0] /= mag;
        this[1] /= mag;
        this[2] /= mag;
        this[3] /= mag;
        return this;
    }

    /** Sets this to a turn of `angle` radians around an axis of any length. A zero axis gives the identity. */
    public setAxisAngle(x: number, y: number, z: number, angle: number): this {
        const mag = Math.hypot(x, y, z);
        if (mag === 0) return this.identity();

        const sin = Math.sin(angle / 2) / mag;
        this[0] = x * sin;
        this[1] = y * sin;
        this[2] = z * sin;
        this[3] = Math.cos(angle / 2);
        return this;
    }

    /**
     * Sets this to the shortest rotation that turns direction `from` onto direction `to`.
     * A zero vector has no direction, so it gives the identity.
     */
    public setFromTo(from: Point, to: Point): this {
        const ax = from[0], ay = from[1], az = from[2];
        const bx = to[0], by = to[1], bz = to[2];

        const lengths = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz);
        if (lengths === 0) return this.identity();

        const w = lengths + ax * bx + ay * by + az * bz;
        if (w < OPPOSITE * lengths) return this.setHalfTurn(ax, ay, az);

        this[0] = ay * bz - az * by;
        this[1] = az * bx - ax * bz;
        this[2] = ax * by - ay * bx;
        this[3] = w;
        return this.normalize();
    }

    /** Flips this to its inverse, which undoes a unit quaternion. */
    public conjugate(): this {
        this[0] = -this[0];
        this[1] = -this[1];
        this[2] = -this[2];
        return this;
    }

    /** Rotates a 3D point in place and returns it. This has to be a unit quaternion. */
    public rotate<T extends Float32Array | number[]>(point: T): T {
        const qx = this[0], qy = this[1], qz = this[2], qw = this[3];
        const x = point[0], y = point[1], z = point[2];

        const cx = 2 * (qy * z - qz * y);
        const cy = 2 * (qz * x - qx * z);
        const cz = 2 * (qx * y - qy * x);

        point[0] = x + qw * cx + qy * cz - qz * cy;
        point[1] = y + qw * cy + qz * cx - qx * cz;
        point[2] = z + qw * cz + qx * cy - qy * cx;
        return point;
    }

    /** Moves this towards `target` the short way, normalized: 0 stays, 1 lands on it. Fast, a good fit for small steps. */
    public nlerp(target: Quaternion, t: number): this {
        const sign = this.dot(target) < 0 ? -1 : 1;

        this[0] += (target[0] * sign - this[0]) * t;
        this[1] += (target[1] * sign - this[1]) * t;
        this[2] += (target[2] * sign - this[2]) * t;
        this[3] += (target[3] * sign - this[3]) * t;
        return this.normalize();
    }

    /** Moves this towards `target` the short way at a constant speed: 0 stays, 1 lands on it. */
    public slerp(target: Quaternion, t: number): this {
        const dot = this.dot(target);
        const sign = dot < 0 ? -1 : 1;
        const cos = dot * sign;

        if (cos > NEARLY_EQUAL) return this.nlerp(target, t);

        const angle = Math.acos(cos);
        const from = Math.sin((1 - t) * angle);
        const to = Math.sin(t * angle) * sign;

        this[0] = this[0] * from + target[0] * to;
        this[1] = this[1] * from + target[1] * to;
        this[2] = this[2] * from + target[2] * to;
        this[3] = this[3] * from + target[3] * to;
        return this.normalize();
    }

    /** Writes this rotation and an optional position into a column-major 4x4 matrix. This has to be a unit quaternion. */
    public writeMatrix<T extends Float32Array>(out: T, position?: Point): T {
        const x = this[0], y = this[1], z = this[2], w = this[3];

        out[0] = 1 - 2 * (y * y + z * z);
        out[1] = 2 * (x * y + z * w);
        out[2] = 2 * (x * z - y * w);
        out[3] = 0;

        out[4] = 2 * (x * y - z * w);
        out[5] = 1 - 2 * (x * x + z * z);
        out[6] = 2 * (y * z + x * w);
        out[7] = 0;

        out[8] = 2 * (x * z + y * w);
        out[9] = 2 * (y * z - x * w);
        out[10] = 1 - 2 * (x * x + y * y);
        out[11] = 0;

        out[12] = position ? position[0] : 0;
        out[13] = position ? position[1] : 0;
        out[14] = position ? position[2] : 0;
        out[15] = 1;
        return out;
    }

    /**
     * A half turn around the axis `x, y, z` leans on the least, made perpendicular to `x, y, z`.
     * For a direction in a plane that's the plane's normal, so 2D stays 2D.
     */
    private setHalfTurn(x: number, y: number, z: number): this {
        const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
        const projected = (az <= ax && az <= ay ? z : ay <= ax ? y : x) / (x * x + y * y + z * z);

        return this.setAxisAngle(
            (az > ax && ay > ax ? 1 : 0) - x * projected,
            (ay <= ax && ay < az ? 1 : 0) - y * projected,
            (az <= ax && az <= ay ? 1 : 0) - z * projected,
            Math.PI,
        );
    }

    /** Writes the Hamilton product `a * b`, which applies `b` first and then `a`. `out` can be `a` or `b`. */
    static multiplyInto<T extends Float32Array>(out: T, a: Float32Array, b: Float32Array): T {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3];
        const bx = b[0], by = b[1], bz = b[2], bw = b[3];

        out[0] = aw * bx + ax * bw + ay * bz - az * by;
        out[1] = aw * by - ax * bz + ay * bw + az * bx;
        out[2] = aw * bz + ax * by - ay * bx + az * bw;
        out[3] = aw * bw - ax * bx - ay * by - az * bz;
        return out;
    }

    /** A turn of `angle` radians around an axis of any length. */
    static fromAxisAngle(axis: Point, angle: number) {
        return Quaternion.identity.setAxisAngle(axis[0], axis[1], axis[2], angle);
    }

    /** The shortest rotation that turns direction `from` onto direction `to`. */
    static fromTo(from: Point, to: Point) {
        return Quaternion.identity.setFromTo(from, to);
    }

    static get identity() {
        return new Quaternion(0, 0, 0, 1);
    }
}
