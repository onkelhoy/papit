import { Vector2, VectorValue } from "@papit/vector";

/**
 * A polygon defined by a list of vertices, with optional triangle or convex‑hull indices.
 * 
 * @remarks
 * At least **one** of `triangles` or `convex` **must** be provided.
 * Both can be present simultaneously – that is allowed.
 */
export type Polygon = {
    /** The polygon's vertices in order. */
    vertices: VectorValue[];

    /**
     * Optional triangle indices (e.g. for rendering or physics).
     * If present, this is a flat array of vertex indices forming triangles.
     */
    triangles?: number[];
    concave?: boolean;
    centeroffset?: Vector2;
    boundaryindex?: null | number[];

    /**
     * Optional convex‑hull grouping of vertices.
     * 
     * You may supply this in **two forms**:
     * 
     * 1. **Pre‑grouped** (`number[][]`): e.g. `[[1,2,3], [4,5,6,1]]`
     *    – each inner array is one convex group.
     * 
     * 2. **Flat with group‑size markers** (`number[]`):
     *    e.g. `[3, 1,2,3, 4, 4,5,6,1]`
     *    – the first number of each group is the size of that group,
     *    followed by that many vertex indices.
     *    This yields the same as `[[1,2,3], [4,5,6,1]]`.
     * 
     * @default undefined
     */
    shapesindeces?: number[] | number[][];
} & (
        | { triangles: number[] }
        | { convex: number[] | number[][] }
    );