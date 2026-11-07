/** A point or vector, e.g. a `Vector2` / `Vector3` or a plain `{ x, y, z? }`. */
export type Point = { x: number; y: number; z?: number };

/**
 * A plane `normal · p = d`, or given by a `normal` and any `point` on it.
 * The normal does not need to be unit length.
 */
export type Plane = { normal: Point; d: number } | { normal: Point; point: Point };
