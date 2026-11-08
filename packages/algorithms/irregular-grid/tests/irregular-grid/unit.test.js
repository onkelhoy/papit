import { describe, it } from "node:test";
import assert from "node:assert";
import { IrregularGrid, GridWorld } from "@papit/irregular-grid";

const area = (grid, c) => {
    const p = grid.positions;
    const v = grid.cornersOf(c);
    let sum = 0;
    for (let i = 0; i < 4; i++)
    {
        const a = v[i];
        const b = v[(i + 1) % 4];
        sum += p[a * 2] * p[b * 2 + 1] - p[b * 2] * p[a * 2 + 1];
    }
    return sum / 2;
};

describe("hex", () => {
    const grid = IrregularGrid.hex({ radius: 4, seed: "test" });

    it("is all quads, counter-clockwise, no folded cells", () => {
        assert.strictEqual(grid.cells.length % 4, 0);
        for (let c = 0; c < grid.cellCount; c++) assert.ok(area(grid, c) > 0, "cell " + c);
    });

    it("covers the hexagon: total area matches", () => {
        let total = 0;
        for (let c = 0; c < grid.cellCount; c++) total += area(grid, c);
        const expected = 6 * (Math.sqrt(3) / 4) * 4 * 4; // 6 equilateral triangles of side radius
        assert.ok(Math.abs(total - expected) < 1e-6);
    });

    it("cell count follows from the merge: 3 per triangle, 4 per quad", () => {
        const triangles = 6 * 4 * 4;
        // each merge turns 2 triangles (6 cells) into 1 quad (4 cells)
        assert.ok(grid.cellCount <= triangles * 3 && grid.cellCount >= triangles * 2);
        assert.strictEqual((triangles * 3 - grid.cellCount) % 2, 0);
    });

    it("with merge 0 every triangle gives 3 cells", () => {
        const g = IrregularGrid.hex({ radius: 3, merge: 0 });
        assert.strictEqual(g.cellCount, 6 * 9 * 3);
    });

    it("is deterministic from the seed", () => {
        const a = IrregularGrid.hex({ radius: 4, seed: 9 });
        const b = IrregularGrid.hex({ radius: 4, seed: 9 });
        const c = IrregularGrid.hex({ radius: 4, seed: 10 });
        assert.deepStrictEqual(a.positions, b.positions);
        assert.deepStrictEqual(a.cells, b.cells);
        assert.notDeepStrictEqual(a.cells, c.cells);
    });

    it("radius below 1 is clamped", () => {
        assert.ok(IrregularGrid.hex({ radius: 0 }).cellCount > 0);
    });
});

describe("adjacency", () => {
    const grid = IrregularGrid.hex({ radius: 3, seed: 1 });

    it("cell neighbours are symmetric", () => {
        for (let c = 0; c < grid.cellCount; c++)
        {
            for (const n of grid.neighboursOf(c))
            {
                if (n === -1) continue;
                assert.ok([...grid.neighboursOf(n)].includes(c));
            }
        }
    });

    it("every edge has 1 or 2 cells, boundary edges only on boundary vertices", () => {
        for (let e = 0; e < grid.edgeCount; e++)
        {
            assert.ok(grid.edgeCells[e * 2] >= 0);
            if (grid.edgeCells[e * 2 + 1] === -1)
            {
                assert.strictEqual(grid.boundary[grid.edges[e * 2]], 1);
                assert.strictEqual(grid.boundary[grid.edges[e * 2 + 1]], 1);
            }
        }
    });

    it("vertex lookups agree with cells and edges", () => {
        for (let c = 0; c < grid.cellCount; c++)
        {
            for (const v of grid.cornersOf(c)) assert.ok([...grid.cellsOfVertex(v)].includes(c));
        }
        for (let e = 0; e < grid.edgeCount; e++)
        {
            const a = grid.edges[e * 2];
            const b = grid.edges[e * 2 + 1];
            assert.ok([...grid.neighboursOfVertex(a)].includes(b));
            assert.ok([...grid.neighboursOfVertex(b)].includes(a));
        }
    });

    it("cellAt finds the cell containing its centre", () => {
        for (let c = 0; c < grid.cellCount; c += 7)
        {
            const [x, y] = grid.center(c);
            assert.strictEqual(grid.cellAt(x, y), c);
        }
        assert.strictEqual(grid.cellAt(1000, 1000), -1);
    });
});

describe("relax", () => {
    it("keeps boundary vertices fixed", () => {
        const before = IrregularGrid.hex({ radius: 3, seed: 2, relax: 0 });
        const after = IrregularGrid.hex({ radius: 3, seed: 2, relax: 50 });
        let moved = 0;
        for (let v = 0; v < before.vertexCount; v++)
        {
            const dx = before.positions[v * 2] - after.positions[v * 2];
            const dy = before.positions[v * 2 + 1] - after.positions[v * 2 + 1];
            if (before.boundary[v]) assert.ok(Math.hypot(dx, dy) < 1e-12);
            else if (Math.hypot(dx, dy) > 1e-6) moved++;
        }
        assert.ok(moved > 0);
    });

    it("makes corners closer to 90 degrees", () => {
        const deviation = (g) => {
            const p = g.positions;
            let sum = 0;
            for (let c = 0; c < g.cellCount; c++)
            {
                const v = g.cornersOf(c);
                for (let i = 0; i < 4; i++)
                {
                    const a = v[(i + 3) % 4], b = v[i], d = v[(i + 1) % 4];
                    const ux = p[a * 2] - p[b * 2], uy = p[a * 2 + 1] - p[b * 2 + 1];
                    const wx = p[d * 2] - p[b * 2], wy = p[d * 2 + 1] - p[b * 2 + 1];
                    const cos = (ux * wx + uy * wy) / Math.hypot(ux, uy) / Math.hypot(wx, wy);
                    sum += Math.abs(Math.acos(cos) * 180 / Math.PI - 90);
                }
            }
            return sum / g.cellCount / 4;
        };
        const raw = IrregularGrid.hex({ radius: 4, seed: 3, relax: 0 });
        const relaxed = IrregularGrid.hex({ radius: 4, seed: 3, relax: 50 });
        assert.ok(deviation(relaxed) < deviation(raw) * 0.7);
    });
});

describe("GridWorld", () => {
    const world = new GridWorld({ radius: 3, seed: "w" });

    it("builds the same chunk in any order", () => {
        const other = new GridWorld({ radius: 3, seed: "w" });
        other.chunk(5, 5);
        assert.deepStrictEqual(world.chunk(1, 0).positions, other.chunk(1, 0).positions);
    });

    it("caches chunks", () => {
        assert.strictEqual(world.chunk(0, 0), world.chunk(0, 0));
    });

    for (const [i, j] of [[1, 0], [0, 1], [-1, 1]])
    {
        it(`chunk (0,0) and (${i},${j}) share seam vertices`, () => {
            const a = world.chunk(0, 0);
            const b = world.chunk(i, j);
            const keys = (g) => {
                const set = new Set();
                for (let v = 0; v < g.vertexCount; v++)
                {
                    if (g.boundary[v]) set.add(g.positions[v * 2].toFixed(9) + "," + g.positions[v * 2 + 1].toFixed(9));
                }
                return set;
            };
            const kb = keys(b);
            const shared = [...keys(a)].filter((k) => kb.has(k));
            // a hex side of radius 3 has 3 triangle edges, subdivided into 6 segments: 7 points
            assert.strictEqual(shared.length, 7);
        });
    }

    it("chunks do not overlap", () => {
        const a = world.chunk(0, 0);
        const b = world.chunk(1, 0);
        for (let c = 0; c < b.cellCount; c++)
        {
            const [x, y] = b.center(c);
            assert.strictEqual(a.cellAt(x, y), -1);
        }
    });
});
