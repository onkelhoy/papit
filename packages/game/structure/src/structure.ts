import type { IrregularGrid } from "@papit/irregular-grid";
import { Random } from "@papit/random";
import { solve, Link } from "@papit/wave-function-collapse";
import { bounds, Mesh } from "@papit/game-mesh";
import { deform } from "./deform";
import { ModuleLibrary } from "./library";
import type { CellFrame, ModuleCandidate, StructureChunk, StructureOptions, TagPoint } from "./types";

// everything baked for one cell, cached until the cell is dirty
type CellData = {
    mesh: Mesh;
    walkable: Float32Array;
    collision: Float32Array[];
    points: TagPoint[];
};

/**
 * Occupancy on grid vertices, in stacked layers, turned into merged meshes per chunk.
 * Each cell slab reads its 8 corners (4 at layer k, 4 at k + 1), picks a module for the pattern
 * and warps it into the cell. Edits mark only the touched cells' chunks dirty.
 *
 * Vertex (v, k) sits at height k * layerHeight; its volume reaches half a layer up and down.
 *
 * @example
 * const s = new Structure(grid, new ModuleLibrary(blockModules()), { layers: 6 });
 * s.set(10, 0, 1);
 * for (const chunk of s.update()) upload(chunk.mesh);
 */
export class Structure {
    readonly grid: IrregularGrid;
    readonly library: ModuleLibrary;
    readonly layers: number;
    readonly layerHeight: number;
    readonly chunkSize: number;
    readonly walkableSlope: number;
    /** id per vertex and layer, 0 is empty: index `v * layers + k` */
    readonly occupancy: Uint8Array;

    private random: Random;
    private chunkOfCell: string[];
    private cellsOfChunk = new Map<string, number[]>();
    private chunks = new Map<string, StructureChunk>();
    private dirty = new Set<string>();
    private dirtyCellSet = new Set<number>();
    private cellData: (CellData | null)[];
    /** chosen candidate per slot (cell * slabs + k + 1), -1 when unsolved; used with sockets */
    private choices: Int32Array;
    private slabs: number;
    /** per cell and edge: the neighbour's edge index for the same edge, -1 on the boundary */
    private opposite: Int8Array;

    constructor(grid: IrregularGrid, library: ModuleLibrary, options: StructureOptions) {
        this.grid = grid;
        this.library = library;
        this.layers = Math.max(1, Math.floor(options.layers));
        this.layerHeight = options.layerHeight ?? 1;
        this.chunkSize = options.chunkSize ?? 8;
        this.walkableSlope = options.walkableSlope ?? .7;
        this.random = new Random(options.seed ?? 0);
        this.occupancy = new Uint8Array(grid.vertexCount * this.layers);
        this.cellData = new Array(grid.cellCount).fill(null);
        this.slabs = this.layers + 1;
        this.choices = new Int32Array(grid.cellCount * this.slabs).fill(-1);
        this.opposite = new Int8Array(grid.cellCount * 4).fill(-1);
        for (let c = 0; c < grid.cellCount; c++)
        {
            for (let i = 0; i < 4; i++)
            {
                const n = grid.cellNeighbours[c * 4 + i];
                if (n < 0) continue;
                const edge = grid.cellEdges[c * 4 + i];
                for (let j = 0; j < 4; j++)
                {
                    if (grid.cellEdges[n * 4 + j] === edge) this.opposite[c * 4 + i] = j;
                }
            }
        }

        // chunks are square buckets of cell centres, in cell order so baking is deterministic
        this.chunkOfCell = new Array(grid.cellCount);
        for (let c = 0; c < grid.cellCount; c++)
        {
            const [x, z] = grid.center(c);
            const key = Math.floor(x / this.chunkSize) + "," + Math.floor(z / this.chunkSize);
            this.chunkOfCell[c] = key;
            const list = this.cellsOfChunk.get(key);
            if (list) list.push(c);
            else this.cellsOfChunk.set(key, [c]);
        }
    }

    /** Id at vertex `v`, layer `k`. Out of range layers are empty. */
    get(v: number, k: number) {
        if (k < 0 || k >= this.layers) return 0;
        return this.occupancy[v * this.layers + k];
    }

    /** Sets vertex `v` at layer `k` to `id` (0 clears) and marks touched chunks dirty. */
    set(v: number, k: number, id: number) {
        if (k < 0 || k >= this.layers || v < 0 || v >= this.grid.vertexCount) return false;
        const index = v * this.layers + k;
        if (this.occupancy[index] === id) return false;
        this.occupancy[index] = id;
        for (const c of this.grid.cellsOfVertex(v))
        {
            this.dirtyCellSet.add(c);
            this.dirty.add(this.chunkOfCell[c]);
        }
        return true;
    }

    /** Chunk keys waiting for `update`. */
    get dirtyChunks(): ReadonlySet<string> {
        return this.dirty;
    }

    /** Cells whose mesh is rebuilt on the next `update`. */
    get dirtyCells(): ReadonlySet<number> {
        return this.dirtyCellSet;
    }

    /** Every baked chunk. */
    get baked(): Iterable<StructureChunk> {
        return this.chunks.values();
    }

    /** Chunk key of cell `c`. */
    chunkOf(c: number) {
        return this.chunkOfCell[c];
    }

    /** 8 bit corner pattern of cell `c`, slab `k` (from layer k to k + 1). */
    pattern(c: number, k: number) {
        const corners = this.grid.cornersOf(c);
        let bits = 0;
        for (let i = 0; i < 4; i++)
        {
            if (this.get(corners[i], k)) bits |= 1 << i;
            if (this.get(corners[i], k + 1)) bits |= 1 << (i + 4);
        }
        return bits;
    }

    /** Module picked for cell `c`, slab `k`. Seeded per cell, so edit order never matters. */
    choose(c: number, k: number): ModuleCandidate | undefined {
        const candidates = this.library.candidates(this.pattern(c, k));
        if (candidates.length <= 1) return candidates[0];
        const rng = this.random.fork(c + ":" + k);
        return candidates[rng.weightedIndex(candidates.map((x) => x.module.weight ?? 1))];
    }

    /** The world frame of cell `c`, slab `k`. Grid y becomes world z. */
    frame(c: number, k: number): CellFrame {
        const [a, b, c2, d] = this.grid.cornersOf(c);
        return {
            corners: [this.grid.vertex(a), this.grid.vertex(b), this.grid.vertex(c2), this.grid.vertex(d)],
            bottom: k * this.layerHeight,
            top: (k + 1) * this.layerHeight,
        };
    }

    /** Rebuilds dirty chunks only and returns them. Empty chunks come back with an empty mesh. */
    update(): StructureChunk[] {
        if (this.library.hasSockets && this.dirtyCellSet.size > 0) this.solveDirty();
        const rebuilt: StructureChunk[] = [];
        for (const key of [...this.dirty].sort())
        {
            const chunk = this.bake(key);
            this.chunks.set(key, chunk);
            rebuilt.push(chunk);
        }
        this.dirty.clear();
        this.dirtyCellSet.clear();
        return rebuilt;
    }

    /** The module in use for cell `c`, slab `k`: solved when the library has sockets, else `choose`. */
    picked(c: number, k: number): ModuleCandidate | undefined {
        if (!this.library.hasSockets) return this.choose(c, k);
        const choice = this.choices[c * this.slabs + k + 1];
        return choice < 0 ? undefined : this.library.candidates(this.pattern(c, k))[choice];
    }

    // wave function collapse over the dirty cells, everything else stays as it is
    private solveDirty() {
        const slabs = this.slabs;
        const cand = (slot: number) => this.library.candidates(this.pattern(Math.floor(slot / slabs), slot % slabs - 1));
        const region: number[] = [];
        const cells = [...this.dirtyCellSet].sort((a, b) => a - b);
        for (const c of cells) for (let k = 0; k < slabs; k++) region.push(c * slabs + k);

        const links = (slot: number): Link[] => {
            const c = Math.floor(slot / slabs);
            const k = slot % slabs;
            const out: Link[] = [];
            for (let i = 0; i < 4; i++)
            {
                const n = this.grid.cellNeighbours[c * 4 + i];
                if (n >= 0) out.push({ slot: n * slabs + k, side: i });
            }
            if (k + 1 < slabs) out.push({ slot: slot + 1, side: 4 });
            if (k > 0) out.push({ slot: slot - 1, side: 5 });
            return out;
        };

        const { assignment } = solve({
            slotCount: this.grid.cellCount * slabs,
            options: (slot) => cand(slot).length,
            weight: (slot, o) => cand(slot)[o].module.weight ?? 1,
            links,
            compatible: (slot, o, link, other) => {
                const a = cand(slot)[o];
                const b = cand(link.slot)[other];
                if (link.side === 4) return match(socketOf(a, "top"), socketOf(b, "bottom"));
                if (link.side === 5) return match(socketOf(a, "bottom"), socketOf(b, "top"));
                const c = Math.floor(slot / slabs);
                const j = this.opposite[c * 4 + link.side];
                return match(socketOf(a, link.side), socketOf(b, j));
            },
        }, { random: this.random.fork("solve:" + cells.join(",")), region, fixed: this.choices });

        for (const slot of region) this.choices[slot] = assignment[slot];
    }

    // merges the chunk from cached cell data, rebuilding only dirty cells
    private bake(key: string): StructureChunk {
        const cells = this.cellsOfChunk.get(key) ?? [];
        const meshes: Mesh[] = [];
        const walkable: Float32Array[] = [];
        const collision: Float32Array[] = [];
        const points: TagPoint[] = [];
        for (const c of cells)
        {
            if (this.dirtyCellSet.has(c) || this.cellData[c] === null) this.cellData[c] = this.bakeCell(c);
            const data = this.cellData[c]!;
            if (data.mesh.positions.length > 0) meshes.push(data.mesh);
            if (data.walkable.length > 0) walkable.push(data.walkable);
            collision.push(...data.collision);
            points.push(...data.points);
        }
        return { key, cells, mesh: merge(meshes), walkable: concat(walkable), collision, points };
    }

    // every slab of one cell; slab -1 holds the lower half of layer 0
    private bakeCell(c: number): CellData {
        const meshes: Mesh[] = [];
        const collision: Float32Array[] = [];
        const points: TagPoint[] = [];
        for (let k = -1; k < this.layers; k++)
        {
            const pick = this.picked(c, k);
            if (!pick) continue;
            const frame = this.frame(c, k);
            const { module, rotation, mirror } = pick;
            meshes.push(deform(module.geometry, frame, rotation, mirror));

            const hulls = module.collision ?? [boxPoints(module.geometry)];
            for (const hull of hulls)
            {
                collision.push(deform(pointMesh(hull.map((p) => [p, [0, 1, 0]])), frame, rotation, mirror).positions);
            }
            for (const point of module.points ?? [])
            {
                const placed = deform(pointMesh([[point.position, point.normal ?? [0, 1, 0]]]), frame, rotation, mirror);
                const [x, y, z, nx, ny, nz] = [...placed.positions, ...placed.normals];
                points.push({ tag: point.tag, position: [x, y, z], normal: [nx, ny, nz], cell: c, layer: k });
            }
        }
        const mesh = merge(meshes);
        return { mesh, walkable: upward(mesh, this.walkableSlope), collision, points };
    }
}

// a non-indexed mesh of loose points with normals, to warp them with deform
function pointMesh(points: [number[], number[]][]): Mesh {
    const positions = new Float32Array(points.length * 3);
    const normals = new Float32Array(points.length * 3);
    points.forEach(([p, n], i) => {
        positions.set(p, i * 3);
        normals.set(n, i * 3);
    });
    return { positions, normals, bounds: bounds(positions) };
}

// 8 corners of the geometry's bounding box, clamped to the unit cube
function boxPoints(mesh: Mesh): [number, number, number][] {
    const b = mesh.bounds ?? bounds(mesh.positions);
    const lo = [b.min.x, b.min.y, b.min.z].map((v) => Math.max(0, v));
    const hi = [b.max.x, b.max.y, b.max.z].map((v) => Math.min(1, v));
    const out: [number, number, number][] = [];
    for (let i = 0; i < 8; i++) out.push([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]);
    return out;
}

// triangles whose face normal points up enough, from a non-indexed mesh
function upward(mesh: Mesh, slope: number) {
    const p = mesh.positions;
    const out: number[] = [];
    for (let t = 0; t + 8 < p.length; t += 9)
    {
        const ux = p[t + 3] - p[t], uy = p[t + 4] - p[t + 1], uz = p[t + 5] - p[t + 2];
        const vx = p[t + 6] - p[t], vy = p[t + 7] - p[t + 1], vz = p[t + 8] - p[t + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz);
        if (length > 0 && ny / length >= slope) for (let i = 0; i < 9; i++) out.push(p[t + i]);
    }
    return new Float32Array(out);
}

function concat(parts: Float32Array[]) {
    let length = 0;
    for (const p of parts) length += p.length;
    const out = new Float32Array(length);
    let offset = 0;
    for (const p of parts)
    {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

/** Concatenates non-indexed meshes. */
export function merge(parts: Mesh[]): Mesh {
    let vertices = 0;
    for (const p of parts) vertices += p.positions.length / 3;
    const positions = new Float32Array(vertices * 3);
    const normals = new Float32Array(vertices * 3);
    const colors = new Float32Array(vertices * 4);
    let offset = 0;
    for (const p of parts)
    {
        const n = p.positions.length / 3;
        positions.set(p.positions, offset * 3);
        normals.set(p.normals, offset * 3);
        if (p.colors) colors.set(p.colors, offset * 4);
        else colors.fill(1, offset * 4, (offset + n) * 4);
        offset += n;
    }
    return { positions, normals, colors, bounds: bounds(positions) };
}

/** Socket of a placed module facing cell edge `edge` (0..3), or top / bottom. */
export function socketOf(candidate: ModuleCandidate, edge: number | "top" | "bottom") {
    const sockets = candidate.module.sockets;
    if (!sockets) return undefined;
    if (edge === "top" || edge === "bottom") return sockets[edge];
    const r = candidate.rotation;
    const side = candidate.mirror ? (2 + r - edge) & 3 : (edge - r) & 3;
    return sockets[side as 0 | 1 | 2 | 3];
}

// a missing socket fits anything
function match(a: string | undefined, b: string | undefined) {
    return a === undefined || b === undefined || a === b;
}
