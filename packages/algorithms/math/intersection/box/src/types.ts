/**
 * An axis-aligned box. `x, y, w, h` is a 2D rectangle; add `z` and `d` (or `depth`)
 * to make it a 3D box. Either the short or the long size names work.
 */
export type Rectangle = ({
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
}

/** A 3D axis-aligned box: a `Rectangle` with `z` and a depth. */
export type Box = Rectangle & { z: number } & ({ d: number } | { depth: number });

/** A point or vector, e.g. a `Vector2` / `Vector3` or a plain `{ x, y, z? }`. */
export type Point = { x: number; y: number; z?: number };
