import type { VectorValue } from "@papit/vector";
import type { Convex, Shape } from "./types";

/** The direction GJK passes to `support`. `z` is `0` for 2D queries. */
export type Direction = { x: number; y: number; z: number };

/** Scratch for `read`: `[x, y, z, is3D]`. Overwritten on every call. */
export const R = new Float64Array(4);

/** Reads a vector (`Vector2`, `Vector3`, `{ x, y, z? }`, `[x, y, z?]`) into `R` without allocating. */
export function read(p: VectorValue) {
    if (typeof p === "number") throw new TypeError("expected a vector, got a number");
    const o = p as { x?: number; y?: number; z?: number } & ArrayLike<number>;
    if (typeof o.x === "number")
    {
        R[0] = o.x;
        R[1] = o.y ?? 0;
        R[2] = o.z ?? 0;
        R[3] = typeof o.z === "number" ? 1 : 0;
        return;
    }
    R[0] = o[0] ?? 0;
    R[1] = o[1] ?? 0;
    R[2] = o[2] ?? 0;
    R[3] = o.length >= 3 ? 1 : 0;
}

/** Normalises `Convex | Convex[]` to a list. Throws on an empty list. */
export function pieces(shape: Shape): Convex[] {
    if (!Array.isArray(shape)) return [shape];
    if (shape.length === 0) throw new RangeError("a compound shape needs at least one piece");
    return shape;
}
