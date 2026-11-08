import type { Mesh } from "@papit/game-mesh";
import type { Vector2 } from "@papit/vector";

/** Sides of a cell, matching cell edge `i` (corner `i` to `i + 1`), then top and bottom. */
export type Side = 0 | 1 | 2 | 3 | "top" | "bottom";

/**
 * A module, authored in the unit cube: x and z in 0..1 across the cell, y in 0..1 up one layer.
 * Corner `i` of the pattern sits at (0,0), (1,0), (1,1), (0,1) in x, z for i = 0..3, top corners above.
 */
export type ModuleDefinition = {
    id: string;
    /** 8 bit corner pattern this module fills */
    pattern: number;
    geometry: Mesh;
    /** relative chance among modules for the same pattern, default 1 */
    weight?: number;
    /** game data, e.g. "door", "stairs", "walkable" */
    tags?: string[];
    /** socket names per side, for neighbour matching */
    sockets?: Partial<Record<Side, string>>;
    /** convex point sets in the unit cube for collision, default the geometry's bounding box */
    collision?: [number, number, number][][];
    /** named spots in the unit cube, e.g. a door or a stair foot */
    points?: ModulePoint[];
};

/** A named spot on a module, in the unit cube. */
export type ModulePoint = {
    tag: string;
    position: [number, number, number];
    /** facing direction, default up */
    normal?: [number, number, number];
};

/** A module point placed in the world. */
export type TagPoint = {
    tag: string;
    position: [number, number, number];
    normal: [number, number, number];
    cell: number;
    /** slab, -1 for the lower half of layer 0 */
    layer: number;
};

/** A module placed for a concrete pattern. */
export type ModuleCandidate = {
    module: ModuleDefinition;
    /** quarter turns, counter-clockwise */
    rotation: number;
    mirror: boolean;
};

/** Where a cell sits in the world: its 4 grid corners (x, z) and the layer heights. */
export type CellFrame = {
    corners: [Vector2, Vector2, Vector2, Vector2];
    bottom: number;
    top: number;
};

export type LibraryOptions = {
    /** also use mirrored modules, default false */
    mirror?: boolean;
};

export type StructureOptions = {
    /** number of occupancy layers per vertex */
    layers: number;
    /** height of one layer, default 1 */
    layerHeight?: number;
    /** seeds module choice per cell, default 0 */
    seed?: number | string;
    /** chunk size in world units for baking, default 8 */
    chunkSize?: number;
    /** smallest normal y a triangle needs to count as walkable, default 0.7 (about 45 degrees) */
    walkableSlope?: number;
};

/** One baked chunk: merged render mesh of all its cells. */
export type StructureChunk = {
    key: string;
    mesh: import("@papit/game-mesh").Mesh;
    /** cells in this chunk */
    cells: number[];
    /** walkable triangles, 9 floats (3 xyz points) each */
    walkable: Float32Array;
    /** convex hulls in world space, xyz flat; e.g. `new Hull(points)` in `@papit/rigidbody` */
    collision: Float32Array[];
    /** module points placed in the world */
    points: TagPoint[];
};
