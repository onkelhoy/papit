export type CornerTableOptions = {
    /** 4 for a square (marching squares), 8 for a cube (marching cubes), default 8 */
    corners?: 4 | 8;
    /** also reduce mirror images, default false */
    mirror?: boolean;
};

/** How to place a canonical case so it matches a pattern. */
export type CornerCase = {
    /** the canonical pattern, the smallest in its symmetry group */
    canonical: number;
    /** quarter turns, counter-clockwise, 0..3 */
    rotation: number;
    /** mirrored before rotating; flips triangle winding */
    mirror: boolean;
};
