import { Random } from "@papit/random";
import { IrregularGrid } from "./component";
import { ChunkOptions } from "./types";

/**
 * Tiles hexagon chunks over the plane. Each chunk is its own `IrregularGrid` in world space,
 * seeded from the world seed and its coordinate, so any chunk can be built alone in any order.
 * Neighbouring chunks share their seam vertices exactly (seams are fixed while relaxing).
 *
 * @example const world = new GridWorld({ radius: 5, seed: "map" }); world.chunk(1, -2);
 */
export class GridWorld {
    readonly options: ChunkOptions;
    private random: Random;
    private cache = new Map<string, IrregularGrid>();

    constructor(options: ChunkOptions) {
        this.options = options;
        this.random = new Random(options.seed ?? 0);
    }

    /** Chunk at chunk coordinate (i, j), built once and cached. */
    chunk(i: number, j: number) {
        const id = i + "," + j;
        let grid = this.cache.get(id);
        if (!grid)
        {
            const [q, r] = GridWorld.chunkCenter(i, j, this.options.radius);
            grid = IrregularGrid.hex({ ...this.options, seed: this.random.fork("chunk:" + id).seed, center: [q, r] });
            this.cache.set(id, grid);
        }
        return grid;
    }

    /** Drops a cached chunk. */
    unload(i: number, j: number) {
        this.cache.delete(i + "," + j);
    }

    /** Lattice centre (q, r) of chunk (i, j). Hexagons of radius R tile with steps (2R, -R) and (R, R). */
    static chunkCenter(i: number, j: number, radius: number): [number, number] {
        const R = Math.max(1, Math.floor(radius));
        return [i * 2 * R + j * R, -i * R + j * R];
    }
}
