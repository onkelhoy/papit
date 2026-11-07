import type { VectorValue } from "@papit/vector";

/**
 * Anything convex that can answer "which of your points is furthest along `direction`?".
 * `direction` is a `{ x, y, z }` object (`z` is 0 in 2D). Return any vector: a `Vector2` for
 * 2D shapes, a `Vector3` for 3D ones, or a plain `{ x, y, z? }` / `[x, y, z?]`.
 */
export type Convex = {
    support(direction: VectorValue): VectorValue;
};

/** A convex shape, or a concave one split into convex pieces. */
export type Shape = Convex | Convex[];

/** A circle (`x, y, r`) or, with `z`, a sphere. */
export type Sphere = { x: number; y: number; z?: number; r: number };

/**
 * An axis-aligned box from its min corner. `x, y, w, h` is 2D; add `z` and `d` (or `depth`)
 * for 3D. Either the short or the long size names work.
 */
export type Box = ({
    x: number;
    y: number;
    w: number;
    h: number;
} | {
    x: number;
    y: number;
    width: number;
    height: number;
}) & {
    z?: number;
    d?: number;
    depth?: number;
};

/** A segment `a`-`b` swept by radius `r`. 3D when either end has a `z`. */
export type Capsule = {
    a: VectorValue;
    b: VectorValue;
    r: number;
};

/**
 * A column-major homogeneous transform: 3x3 (9 values) for 2D, 4x4 (16 values) for 3D.
 * `Matrix3` / `Matrix4` from `@papit/matrix` fit.
 */
export type Transform = ArrayLike<number>;
