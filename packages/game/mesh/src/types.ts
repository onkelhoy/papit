export type Vec3 = { x: number; y: number; z: number };

export type Bounds = { min: Vec3; max: Vec3; radius: number };

/** Mesh data as flat typed arrays, ready for GPU buffers. */
export type Mesh = {
    /** xyz per vertex */
    positions: Float32Array;
    /** xyz per vertex */
    normals: Float32Array;
    /** rgba per vertex */
    colors?: Float32Array;
    /** uv per vertex */
    uvs?: Float32Array;
    indices?: Uint16Array | Uint32Array;
    /** 4 joint indices per vertex, for skins */
    joints?: Uint16Array;
    /** 4 weights per vertex, for skins */
    weights?: Float32Array;
    bounds: Bounds;
};
