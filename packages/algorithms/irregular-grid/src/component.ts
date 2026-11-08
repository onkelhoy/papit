import { Random } from "@papit/random";
import { Vector2 } from "@papit/vector";
import { HexGridOptions } from "./types";

const SQRT3_2 = Math.sqrt(3) / 2;

/**
 * An all-quad mesh in the XY plane with full adjacency, stored in flat typed arrays.
 * Cells are counter-clockwise; edge `i` of a cell runs from corner `i` to corner `i + 1`.
 *
 * @example const grid = IrregularGrid.hex({ radius: 6, seed: "town" });
 */
export class IrregularGrid {
    /** x, y per vertex */
    readonly positions: Float64Array;
    /** 4 vertex indices per cell */
    readonly cells: Uint32Array;
    /** 2 vertex indices per edge, lower index first */
    readonly edges: Uint32Array;
    /** 2 cells per edge, -1 on the boundary side */
    readonly edgeCells: Int32Array;
    /** 4 per cell: edge index of cell edge `i` */
    readonly cellEdges: Uint32Array;
    /** 4 per cell: neighbour across cell edge `i`, -1 on the boundary */
    readonly cellNeighbours: Int32Array;
    /** 1 for boundary vertices, they stay fixed when relaxing */
    readonly boundary: Uint8Array;

    private vertexCellOffsets: Uint32Array;
    private vertexCellList: Uint32Array;
    private vertexNeighbourOffsets: Uint32Array;
    private vertexNeighbourList: Uint32Array;

    constructor(positions: Float64Array, cells: Uint32Array) {
        this.positions = positions;
        this.cells = cells;

        const vertexCount = positions.length / 2;
        const cellCount = cells.length / 4;

        // edges
        const edgeIndex = new Map<number, number>();
        const edges: number[] = [];
        const edgeCells: number[] = [];
        this.cellEdges = new Uint32Array(cellCount * 4);
        for (let c = 0; c < cellCount; c++)
        {
            for (let i = 0; i < 4; i++)
            {
                const a = cells[c * 4 + i];
                const b = cells[c * 4 + ((i + 1) & 3)];
                const lo = a < b ? a : b;
                const hi = a < b ? b : a;
                const key = lo * vertexCount + hi;
                let e = edgeIndex.get(key);
                if (e === undefined)
                {
                    e = edges.length / 2;
                    edgeIndex.set(key, e);
                    edges.push(lo, hi);
                    edgeCells.push(c, -1);
                }
                else
                {
                    edgeCells[e * 2 + 1] = c;
                }
                this.cellEdges[c * 4 + i] = e;
            }
        }
        this.edges = Uint32Array.from(edges);
        this.edgeCells = Int32Array.from(edgeCells);

        // neighbours and boundary
        this.cellNeighbours = new Int32Array(cellCount * 4);
        this.boundary = new Uint8Array(vertexCount);
        for (let c = 0; c < cellCount; c++)
        {
            for (let i = 0; i < 4; i++)
            {
                const e = this.cellEdges[c * 4 + i];
                const a = this.edgeCells[e * 2];
                const b = this.edgeCells[e * 2 + 1];
                this.cellNeighbours[c * 4 + i] = a === c ? b : a;
            }
        }
        for (let e = 0; e < this.edges.length / 2; e++)
        {
            if (this.edgeCells[e * 2 + 1] === -1)
            {
                this.boundary[this.edges[e * 2]] = 1;
                this.boundary[this.edges[e * 2 + 1]] = 1;
            }
        }

        // vertex -> cells, vertex -> vertices (compressed rows)
        [this.vertexCellOffsets, this.vertexCellList] = compress(vertexCount, cells.length, (add) => {
            for (let k = 0; k < cells.length; k++) add(cells[k], k >> 2);
        });
        [this.vertexNeighbourOffsets, this.vertexNeighbourList] = compress(vertexCount, this.edges.length, (add) => {
            for (let e = 0; e < this.edges.length; e += 2)
            {
                add(this.edges[e], this.edges[e + 1]);
                add(this.edges[e + 1], this.edges[e]);
            }
        });
    }

    /** Builds a hexagon of triangles, merges pairs into quads, subdivides to quads and relaxes. */
    static hex(options: HexGridOptions) {
        return buildHex(options);
    }

    get vertexCount() {
        return this.positions.length / 2;
    }
    get cellCount() {
        return this.cells.length / 4;
    }
    get edgeCount() {
        return this.edges.length / 2;
    }

    /** Cells touching vertex `v`. */
    cellsOfVertex(v: number) {
        return this.vertexCellList.subarray(this.vertexCellOffsets[v], this.vertexCellOffsets[v + 1]);
    }

    /** Vertices sharing an edge with vertex `v`. */
    neighboursOfVertex(v: number) {
        return this.vertexNeighbourList.subarray(this.vertexNeighbourOffsets[v], this.vertexNeighbourOffsets[v + 1]);
    }

    /** The 4 vertex indices of cell `c`. */
    cornersOf(c: number) {
        return this.cells.subarray(c * 4, c * 4 + 4);
    }

    /** The up to 4 neighbouring cells of `c`, -1 on the boundary. */
    neighboursOf(c: number) {
        return this.cellNeighbours.subarray(c * 4, c * 4 + 4);
    }

    /** Position of vertex `v`. */
    vertex(v: number) {
        return new Vector2(this.positions[v * 2], this.positions[v * 2 + 1]);
    }

    /** Centre of cell `c`. */
    center(c: number) {
        const sum = new Vector2(2);
        for (let i = 0; i < 4; i++) sum.add(this.vertex(this.cells[c * 4 + i]));
        return sum.divide(4);
    }

    /** Signed area of cell `c`, positive for counter-clockwise. */
    area(c: number) {
        const p = this.positions;
        let sum = 0;
        for (let i = 0; i < 4; i++)
        {
            const a = this.cells[c * 4 + i];
            const b = this.cells[c * 4 + ((i + 1) & 3)];
            sum += p[a * 2] * p[b * 2 + 1] - p[b * 2] * p[a * 2 + 1];
        }
        return sum / 2;
    }

    /** Cell containing point (x, y), or -1. O(cells). */
    cellAt(x: number, y: number) {
        for (let c = 0; c < this.cellCount; c++)
        {
            if (this.contains(c, x, y)) return c;
        }
        return -1;
    }

    /** True when (x, y) is inside cell `c` (cells are convex after relaxing). */
    contains(c: number, x: number, y: number) {
        const point = new Vector2(x, y);
        for (let i = 0; i < 4; i++)
        {
            const a = this.vertex(this.cells[c * 4 + i]);
            const b = this.vertex(this.cells[c * 4 + ((i + 1) & 3)]);
            if (Vector2.cross(b.subtract(a), point.clone.subtract(a)) < 0) return false;
        }
        return true;
    }

    /**
     * Pulls each cell toward a square of the average cell size, boundary vertices fixed.
     * Deterministic: no randomness, fixed iteration order.
     */
    relax(iterations = 50, strength = 0.3) {
        const p = this.positions;
        const target = new Float64Array(p.length);
        const count = new Uint32Array(this.vertexCount);

        // square of the mean area: centre-to-corner distance sqrt(area / 2)
        let total = 0;
        for (let c = 0; c < this.cellCount; c++) total += this.area(c);
        const reach = Math.sqrt(total / this.cellCount / 2);

        for (let it = 0; it < iterations; it++)
        {
            target.fill(0);
            count.fill(0);

            for (let c = 0; c < this.cellCount; c++)
            {
                const o = c * 4;
                const center = this.center(c);

                // average corner offset, corner i turned back by i quarter turns
                const offset = new Vector2(2);
                for (let i = 0; i < 4; i++)
                {
                    const corner = this.vertex(this.cells[o + i]).subtract(center);
                    offset.add(quarterTurns(corner, -i));
                }
                if (offset.magnitude === 0) continue;
                offset.magnitude = reach;

                for (let i = 0; i < 4; i++)
                {
                    const v = this.cells[o + i];
                    const corner = quarterTurns(offset, i).add(center);
                    target[v * 2] += corner.x;
                    target[v * 2 + 1] += corner.y;
                    count[v]++;
                }
            }

            for (let v = 0; v < this.vertexCount; v++)
            {
                if (this.boundary[v] || count[v] === 0) continue;
                const tx = target[v * 2] / count[v];
                const ty = target[v * 2 + 1] / count[v];
                p[v * 2] += (tx - p[v * 2]) * strength;
                p[v * 2 + 1] += (ty - p[v * 2 + 1]) * strength;
            }
        }
        return this;
    }
}

// counter-clockwise for positive turns
function quarterTurns(v: Vector2, turns: number) {
    let out = v.clone;
    for (let i = 0; i < (turns & 3); i++) out = out.perpendicular();
    return out;
}

function compress(rows: number, size: number, fill: (add: (row: number, value: number) => void) => void): [Uint32Array, Uint32Array] {
    const offsets = new Uint32Array(rows + 1);
    fill((row) => offsets[row + 1]++);
    for (let i = 0; i < rows; i++) offsets[i + 1] += offsets[i];
    const list = new Uint32Array(size);
    const cursor = offsets.slice(0, rows);
    fill((row, value) => list[cursor[row]++] = value);
    return [offsets, list];
}

// build

function buildHex(options: HexGridOptions) {
    const radius = Math.max(1, Math.floor(options.radius));
    const size = options.size ?? 1;
    const mergeChance = options.merge ?? 1;
    const [cq, cr] = options.center ?? [0, 0];
    const rng = new Random(options.seed ?? 0);

    // triangle lattice points inside the hexagon
    const pointIndex = new Map<string, number>();
    const coords: number[] = [];
    const inside = (q: number, r: number) => Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius;
    for (let r = -radius; r <= radius; r++)
    {
        for (let q = -radius; q <= radius; q++)
        {
            if (!inside(q, r)) continue;
            pointIndex.set(q + "," + r, coords.length / 2);
            const gq = q + cq;
            const gr = r + cr;
            coords.push((gq + gr / 2) * size, gr * SQRT3_2 * size);
        }
    }
    const at = (q: number, r: number) => pointIndex.get(q + "," + r)!;

    // triangles, counter-clockwise
    const triangles: number[][] = [];
    for (let r = -radius; r <= radius; r++)
    {
        for (let q = -radius; q <= radius; q++)
        {
            if (inside(q, r) && inside(q + 1, r) && inside(q, r + 1)) triangles.push([at(q, r), at(q + 1, r), at(q, r + 1)]);
            if (inside(q + 1, r) && inside(q + 1, r + 1) && inside(q, r + 1)) triangles.push([at(q + 1, r), at(q + 1, r + 1), at(q, r + 1)]);
        }
    }

    // merge random neighbouring triangle pairs into quads
    const edgeTriangles = new Map<string, number[]>();
    const key = (a: number, b: number) => a < b ? a + "," + b : b + "," + a;
    triangles.forEach((t, i) => {
        for (let k = 0; k < 3; k++)
        {
            const id = key(t[k], t[(k + 1) % 3]);
            const list = edgeTriangles.get(id);
            if (list) list.push(i);
            else edgeTriangles.set(id, [i]);
        }
    });

    const used = new Uint8Array(triangles.length);
    const polygons: number[][] = [];
    const order = rng.shuffle(triangles.map((_, i) => i));
    for (const i of order)
    {
        if (used[i]) continue;
        const t = triangles[i];
        const options: [j: number, k: number][] = [];
        for (let k = 0; k < 3; k++)
        {
            for (const j of edgeTriangles.get(key(t[k], t[(k + 1) % 3]))!)
            {
                if (j !== i && !used[j]) options.push([j, k]);
            }
        }
        if (options.length === 0 || !rng.chance(mergeChance)) continue;

        const [j, k] = rng.pick(options)!;
        const other = triangles[j];
        const a = t[k];
        const b = t[(k + 1) % 3];
        const c = t[(k + 2) % 3];
        const d = other.find((v) => v !== a && v !== b)!;
        polygons.push([b, c, a, d]); // keeps counter-clockwise
        used[i] = used[j] = 1;
    }
    triangles.forEach((t, i) => { if (!used[i]) polygons.push(t); });

    // subdivide every polygon into quads: corner, edge midpoint, centre, edge midpoint
    const positions = coords.slice();
    const midpoints = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
        const id = key(a, b);
        let m = midpoints.get(id);
        if (m === undefined)
        {
            m = positions.length / 2;
            positions.push((positions[a * 2] + positions[b * 2]) / 2, (positions[a * 2 + 1] + positions[b * 2 + 1]) / 2);
            midpoints.set(id, m);
        }
        return m;
    };

    const cells: number[] = [];
    for (const poly of polygons)
    {
        const n = poly.length;
        let x = 0;
        let y = 0;
        for (const v of poly)
        {
            x += positions[v * 2];
            y += positions[v * 2 + 1];
        }
        const center = positions.length / 2;
        positions.push(x / n, y / n);

        for (let i = 0; i < n; i++)
        {
            const prev = poly[(i + n - 1) % n];
            const curr = poly[i];
            const next = poly[(i + 1) % n];
            cells.push(curr, midpoint(curr, next), center, midpoint(prev, curr));
        }
    }

    const grid = new IrregularGrid(Float64Array.from(positions), Uint32Array.from(cells));
    return grid.relax(options.relax ?? 50, options.strength ?? 0.3);
}
