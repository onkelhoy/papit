/**
 * A circle `{ x, y, r }`. Add `z` to make it a sphere. `r` or `radius` both work.
 */
export type Circle = ({
    x: number;
    y: number;
    r: number;
} | {
    x: number;
    y: number;
    radius: number;
}) & {
    z?: number;
}

/** A sphere: a `Circle` with a `z`. */
export type Sphere = Circle & { z: number };

/** A point or vector, e.g. a `Vector2` / `Vector3` or a plain `{ x, y, z? }`. */
export type Point = { x: number; y: number; z?: number };
