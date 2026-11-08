import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('tests/structure/');
    await page.waitForFunction(() => (window as any).structure);
});

test.describe("deform", () => {
    test('unit cube corners land on the cell corners and layer heights', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { deform } = (window as any).structure;
            const V = (window as any).Vector2;
            const corners = [new V(0, 0), new V(2, 0.3), new V(2.4, 1.8), new V(-0.2, 1.5)];
            const square = {
                positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1]),
                normals: new Float32Array(12),
            };
            const out = deform(square, { corners, bottom: 1, top: 3 });
            return Array.from(out.positions);
        });
        const expected = [0, 1, 0, 2, 1, 0.3, 2.4, 3, 1.8, -0.2, 3, 1.5];
        r.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5));
    });

    test('rotation moves module corner 0 to cell corner 1', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { deform } = (window as any).structure;
            const V = (window as any).Vector2;
            const corners = [new V(0, 0), new V(1, 0), new V(1, 1), new V(0, 1)];
            const point = { positions: new Float32Array([0, 0, 0]), normals: new Float32Array([0, 1, 0]) };
            return Array.from(deform(point, { corners, bottom: 0, top: 1 }, 1).positions);
        });
        expect(r).toEqual([1, 0, 0]);
    });

    test('normals stay unit length and perpendicular to warped faces', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { deform, blockGeometry } = (window as any).structure;
            const V = (window as any).Vector2;
            const corners = [new V(0, 0), new V(1.3, 0.2), new V(1.1, 1.4), new V(-0.1, 0.9)];
            const out = deform(blockGeometry(0b00010011), { corners, bottom: 0, top: 0.8 });
            let worstLength = 0;
            let worstDot = 0;
            for (let t = 0; t < out.positions.length; t += 9)
            {
                const p = out.positions, n = out.normals;
                const ux = p[t + 3] - p[t], uy = p[t + 4] - p[t + 1], uz = p[t + 5] - p[t + 2];
                const vx = p[t + 6] - p[t], vy = p[t + 7] - p[t + 1], vz = p[t + 8] - p[t + 2];
                const l = Math.hypot(n[t], n[t + 1], n[t + 2]);
                worstLength = Math.max(worstLength, Math.abs(l - 1));
                const dot = (n[t] * ux + n[t + 1] * uy + n[t + 2] * uz) / Math.hypot(ux, uy, uz)
                    + (n[t] * vx + n[t + 1] * vy + n[t + 2] * vz) / Math.hypot(vx, vy, vz);
                worstDot = Math.max(worstDot, Math.abs(dot));
            }
            return { worstLength, worstDot };
        });
        expect(r.worstLength).toBeLessThan(1e-5);
        expect(r.worstDot).toBeLessThan(1e-3);
    });

    test('mirror flips winding so faces still point along their normals', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { deform, blockGeometry } = (window as any).structure;
            const V = (window as any).Vector2;
            const corners = [new V(0, 0), new V(1, 0), new V(1, 1), new V(0, 1)];
            const out = deform(blockGeometry(0b00000001), { corners, bottom: 0, top: 1 }, 0, true);
            let agree = true;
            const p = out.positions, n = out.normals;
            for (let t = 0; t < p.length; t += 9)
            {
                const ux = p[t + 3] - p[t], uy = p[t + 4] - p[t + 1], uz = p[t + 5] - p[t + 2];
                const vx = p[t + 6] - p[t], vy = p[t + 7] - p[t + 1], vz = p[t + 8] - p[t + 2];
                const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
                if (cx * n[t] + cy * n[t + 1] + cz * n[t + 2] <= 0) agree = false;
            }
            return agree;
        });
        expect(r).toBe(true);
    });
});

test.describe("blockModules and ModuleLibrary", () => {
    test('one module per canonical case covers every pattern', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { blockModules, ModuleLibrary } = (window as any).structure;
            const modules = blockModules();
            const library = new ModuleLibrary(modules);
            return { count: modules.length, missing: library.missing() };
        });
        expect(r.count).toBe(68); // 70 cases minus empty and full
        expect(r.missing).toEqual([255]);
    });

    test('candidate transform turns the module pattern into the asked pattern', async ({ page }) => {
        const ok = await page.evaluate(() => {
            const { blockModules, ModuleLibrary } = (window as any).structure;
            const library = new ModuleLibrary(blockModules(), { mirror: true });
            const turn = (p: number, r: number, m: boolean) => {
                let out = 0;
                for (let c = 0; c < 8; c++)
                {
                    if (!(p >> c & 1)) continue;
                    let i = c & 3;
                    if (m) i = 3 - i;
                    out |= 1 << ((c & 4) | ((i + r) & 3));
                }
                return out;
            };
            for (let p = 1; p < 255; p++)
            {
                for (const c of library.candidates(p))
                {
                    if (turn(c.module.pattern, c.rotation, c.mirror) !== p) return false;
                }
            }
            return true;
        });
        expect(ok).toBe(true);
    });

    test('a block with ground under open sky is walkable', async ({ page }) => {
        const tags = await page.evaluate(() => {
            const { blockModules } = (window as any).structure;
            const find = (p: number) => blockModules().find((m: any) => m.pattern === p).tags;
            return { ground: find(0b00001111), tower: find(0b00010001) };
        });
        expect(tags.ground).toContain("walkable");
        expect(tags.tower).not.toContain("walkable");
    });
});

test.describe("Structure", () => {
    const setup = `
        const { Structure, ModuleLibrary, blockModules } = window.structure;
        const g = window.grid.IrregularGrid.hex({ radius: 4, seed: "s", size: 1.6 });
        const make = () => new Structure(g, new ModuleLibrary(blockModules()), { layers: 4, chunkSize: 2, seed: 1 });
        const inner = Array.from({ length: g.vertexCount }, (_, v) => v).filter((v) => !g.boundary[v]);
    `;

    test('pattern reads bottom corners at layer k and top corners at k + 1', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const s = make();
            const corners = g.cornersOf(0);
            s.set(corners[0], 0, 1);
            s.set(corners[2], 1, 1);
            return [s.pattern(0, 0), s.pattern(0, -1), s.pattern(0, 1)];
        })()`);
        expect(r).toEqual([0b01000001, 0b00010000, 0b00000100]);
    });

    test('one edit dirties only the cells around that vertex', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const s = make();
            const v = inner[5];
            s.set(v, 1, 1);
            const cells = [...s.dirtyCells].sort((a, b) => a - b);
            const expected = [...g.cellsOfVertex(v)].sort((a, b) => a - b);
            const chunks = s.dirtyChunks.size;
            const rebuilt = s.update().length;
            return { same: JSON.stringify(cells) === JSON.stringify(expected), chunks, rebuilt, after: s.dirtyCells.size, total: new Set([...Array(g.cellCount).keys()].map((c) => s.chunkOf(c))).size };
        })()`) as any;
        expect(r.same).toBe(true);
        expect(r.rebuilt).toBe(r.chunks);
        expect(r.chunks).toBeLessThan(r.total);
        expect(r.after).toBe(0);
    });

    test('setting the same value or an out of range layer changes nothing', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const s = make();
            return [s.set(inner[0], 0, 0), s.set(inner[0], 9, 1), s.set(inner[0], -1, 1), s.dirtyCells.size];
        })()`);
        expect(r).toEqual([false, false, false, 0]);
    });

    test('mesh does not depend on edit order', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const edits = inner.slice(0, 30).map((v, i) => [v, i % 3]);
            const bake = (list) => {
                const s = make();
                for (const [v, k] of list) { s.set(v, k, 1); s.update(); }
                return [...s.baked].sort((a, b) => a.key < b.key ? -1 : 1).map((c) => Array.from(c.mesh.positions).join()).join("|");
            };
            return bake(edits) === bake([...edits].reverse());
        })()`);
        expect(r).toBe(true);
    });

    test('a filled vertex becomes a closed block around its height', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const s = make();
            s.set(inner[0], 1, 1);
            let min = Infinity, max = -Infinity, count = 0;
            for (const c of s.update())
            {
                const p = c.mesh.positions;
                for (let i = 1; i < p.length; i += 3) { min = Math.min(min, p[i]); max = Math.max(max, p[i]); count++; }
            }
            return { min, max, count };
        })()`) as any;
        expect(r.min).toBeCloseTo(0.5, 5);
        expect(r.max).toBeCloseTo(1.5, 5);
        expect(r.count).toBeGreaterThan(0);
    });
});

test.describe("sockets and wfc", () => {
    test('socketOf follows rotation and mirror to the right cell edge', async ({ page }) => {
        const ok = await page.evaluate(() => {
            const { socketOf } = (window as any).structure;
            const sockets = { 0: "a", 1: "b", 2: "c", 3: "d" };
            const perm = (k: number, r: number, m: boolean) => ((m ? 3 - k : k) + r) & 3;
            for (const mirror of [false, true])
            {
                for (let rotation = 0; rotation < 4; rotation++)
                {
                    for (let side = 0; side < 4; side++)
                    {
                        const a = perm(side, rotation, mirror), b = perm((side + 1) & 3, rotation, mirror);
                        const edge = ((b - a) & 3) === 1 ? a : b; // cell edge e runs e -> e + 1
                        const got = socketOf({ module: { sockets }, rotation, mirror }, edge);
                        if (got !== (sockets as any)[side]) return false;
                    }
                }
            }
            return true;
        });
        expect(ok).toBe(true);
    });

    test('neighbouring modules agree on sockets: one colour per building', async ({ page }) => {
        const r = await page.evaluate(() => {
            const { Structure, ModuleLibrary, blockModules, touchingSides, socketOf } = (window as any).structure;
            const g = (window as any).grid.IrregularGrid.hex({ radius: 4, seed: "w", size: 1.6 });
            const modules = ["red", "blue", "green"].flatMap((name) => blockModules().map((m: any) => ({
                ...m,
                id: m.id + "-" + name,
                sockets: Object.fromEntries(touchingSides(m.pattern).map((side: any) => [side, name])),
            })));
            const s = new Structure(g, new ModuleLibrary(modules), { layers: 3, seed: 2 });
            // two separate blobs, built in two batches
            for (let v = 0; v < g.vertexCount; v++)
            {
                const p = g.vertex(v);
                if (Math.hypot(p.x - 1.5, p.y) < 1.5) s.set(v, 0, 1);
            }
            s.update();
            for (let v = 0; v < g.vertexCount; v++)
            {
                const p = g.vertex(v);
                if (Math.hypot(p.x + 1.5, p.y) < 1.5) s.set(v, 0, 1);
                if (Math.hypot(p.x - 1.5, p.y) < 0.8) s.set(v, 1, 1);
            }
            s.update();

            let pairs = 0, bad = 0;
            for (let c = 0; c < g.cellCount; c++)
            {
                for (let k = -1; k < 3; k++)
                {
                    const a = s.picked(c, k);
                    if (!a) continue;
                    for (let i = 0; i < 4; i++)
                    {
                        const n = g.cellNeighbours[c * 4 + i];
                        if (n < 0) continue;
                        const b = s.picked(n, k);
                        if (!b) continue;
                        let j = 0;
                        while (g.cellEdges[n * 4 + j] !== g.cellEdges[c * 4 + i]) j++;
                        const x = socketOf(a, i), y = socketOf(b, j);
                        if (x === undefined || y === undefined) continue;
                        pairs++;
                        if (x !== y) bad++;
                    }
                }
            }
            return { pairs, bad };
        });
        expect(r.pairs).toBeGreaterThan(20);
        expect(r.bad).toBe(0);
    });
});

test.describe("gameplay data", () => {
    const setup = `
        const { Structure, ModuleLibrary, blockModules } = window.structure;
        const g = window.grid.IrregularGrid.hex({ radius: 4, seed: "s", size: 1.6 });
        const inner = Array.from({ length: g.vertexCount }, (_, v) => v).filter((v) => !g.boundary[v]);
        const all = (chunks, f) => chunks.flatMap(f);
    `;

    test('walkable triangles lie on the top of a single block', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const s = new Structure(g, new ModuleLibrary(blockModules()), { layers: 4, seed: 1 });
            s.set(inner[0], 1, 1);
            const ys = all(s.update(), (c) => Array.from(c.walkable).filter((_, i) => i % 3 === 1));
            return { count: ys.length, min: Math.min(...ys), max: Math.max(...ys) };
        })()`) as any;
        expect(r.count).toBeGreaterThan(0);
        expect(r.min).toBeCloseTo(1.5, 5);
        expect(r.max).toBeCloseTo(1.5, 5);
    });

    test('one collision box per filled eighth, inside the block height', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const s = new Structure(g, new ModuleLibrary(blockModules()), { layers: 4, seed: 1 });
            s.set(inner[0], 1, 1);
            const hulls = all(s.update(), (c) => c.collision);
            const ys = hulls.flatMap((h) => Array.from(h).filter((_, i) => i % 3 === 1));
            return { hulls: hulls.length, cells: g.cellsOfVertex(inner[0]).length, sizes: [...new Set(hulls.map((h) => h.length))], min: Math.min(...ys), max: Math.max(...ys) };
        })()`) as any;
        // each cell around the vertex has 2 filled eighths (below and above the vertex)
        expect(r.hulls).toBe(r.cells * 2);
        expect(r.sizes).toEqual([24]);
        expect(r.min).toBeCloseTo(0.5, 5);
        expect(r.max).toBeCloseTo(1.5, 5);
    });

    test('module points are warped into the world with their tag', async ({ page }) => {
        const r = await page.evaluate(`(() => { ${setup}
            const modules = blockModules().map((m) => ({ ...m, points: [{ tag: "door", position: [0.5, 0, 0.5] }] }));
            const s = new Structure(g, new ModuleLibrary(modules), { layers: 4, seed: 1 });
            s.set(inner[0], 0, 1);
            const points = all(s.update(), (c) => c.points);
            return { count: points.length, tags: [...new Set(points.map((p) => p.tag))], up: points.every((p) => Math.abs(p.normal[1] - 1) < 1e-5) };
        })()`) as any;
        expect(r.count).toBeGreaterThan(0);
        expect(r.tags).toEqual(["door"]);
        expect(r.up).toBe(true);
    });
});

test.describe("surface modules", () => {
    test('marching cubes modules cover every pattern and wrap a lone vertex in a closed blob', async ({ page }) => {
        const r = await page.evaluate(`(() => {
            const { Structure, ModuleLibrary, surfaceModules } = window.structure;
            const g = window.grid.IrregularGrid.hex({ radius: 4, seed: "s", size: 1.6 });
            const library = new ModuleLibrary(surfaceModules());
            const v = Array.from({ length: g.vertexCount }, (_, i) => i).find((i) => !g.boundary[i]);
            const s = new Structure(g, library, { layers: 4, seed: 1 });
            s.set(v, 1, 1);
            const p = s.update().flatMap((c) => Array.from(c.mesh.positions));
            const key = (i) => [0, 1, 2].map((k) => p[i * 3 + k].toFixed(3)).join(",");
            const edges = new Map();
            for (let t = 0; t < p.length / 3; t += 3) for (let k = 0; k < 3; k++)
            {
                const a = key(t + k), b = key(t + (k + 1) % 3);
                const e = a < b ? a + "|" + b : b + "|" + a;
                edges.set(e, (edges.get(e) ?? 0) + 1);
            }
            const ys = p.filter((_, i) => i % 3 === 1);
            return { missing: library.missing(), closed: [...edges.values()].every((c) => c === 2), min: Math.min(...ys), max: Math.max(...ys) };
        })()`) as any;
        expect(r.missing).toEqual([255]);
        expect(r.closed).toBe(true);
        expect(r.min).toBeCloseTo(0.5, 5);
        expect(r.max).toBeCloseTo(1.5, 5);
    });
});
