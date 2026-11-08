/** How a face with two diagonal inside corners is cut. */
export type Ambiguity =
    /** inside corners stay apart (default) */
    | "separate"
    /** inside corners join through the face centre */
    | "join"
    /** asymptotic decider: the field's bilinear saddle value picks per face */
    | "decide";

export type FieldOptions = {
    /** surface level, a point is inside when its value is at least `iso`. Default 0 */
    iso?: number;
    ambiguity?: Ambiguity;
    /**
     * Moves an output point from grid space (x, y, z in grid steps) to the world, e.g. to warp into irregular cells.
     * Write into `out`. Normals follow the field gradient in grid space, so warp gently or recompute them.
     */
    transform?: (x: number, y: number, z: number, out: [number, number, number]) => void;
};

/** A scalar field on a grid of points, index `x + width * (y + height * z)`. */
export type Field3 = {
    values: ArrayLike<number>;
    width: number;
    height: number;
    depth: number;
};

/** A scalar field on a grid of points, index `x + width * y`. */
export type Field2 = {
    values: ArrayLike<number>;
    width: number;
    height: number;
};

/** Non-indexed triangles, 9 floats each, normals point toward lower values (out of the solid). */
export type Surface = {
    positions: Float32Array;
    normals: Float32Array;
};
