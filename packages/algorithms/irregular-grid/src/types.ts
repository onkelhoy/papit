import type { Seed } from "@papit/random";

export type HexGridOptions = {
    /** hexagon radius in triangle edges, at least 1 */
    radius: number;
    seed?: Seed;
    /** relax iterations, default 50 */
    relax?: number;
    /** move per iteration toward the square shape, 0..1, default 0.3 */
    strength?: number;
    /** final edge length is about `size / 2`, default 1 */
    size?: number;
    /** chance a triangle pair becomes a quad, 0..1, default 1 */
    merge?: number;
    /** lattice offset of the hex centre (q, r), used by chunks */
    center?: [q: number, r: number];
};

export type ChunkOptions = Omit<HexGridOptions, "center">;
