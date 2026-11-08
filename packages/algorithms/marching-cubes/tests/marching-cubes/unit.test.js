import { describe, it } from "node:test";
import assert from "node:assert";
import { marchingCubes, marchingSquares, triangulate, EDGES } from "@papit/marching-cubes";

// sphere of radius r in an n^3 grid, positive inside
function sphere(n, r) {
    const values = new Float32Array(n * n * n);
    const c = (n - 1) / 2;
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    {
        values[x + n * (y + n * z)] = r - Math.hypot(x - c, y - c, z - c);
    }
    return { values, width: n, height: n, depth: n };
}

// every undirected edge of the mesh (by rounded position) must be used by exactly two triangles
function isClosed(positions) {
    const key = (i) => [0, 1, 2].map((k) => positions[i * 3 + k].toFixed(4)).join(",");
    const count = new Map();
    for (let t = 0; t < positions.length / 3; t += 3)
    {
        for (let k = 0; k < 3; k++)
        {
            const a = key(t + k), b = key(t + (k + 1) % 3);
            if (a === b) continue;
            const e = a < b ? a + "|" + b : b + "|" + a;
            count.set(e, (count.get(e) ?? 0) + 1);
        }
    }
    return [...count.values()].every((c) => c === 2);
}

describe("triangle table", () => {
    it("empty and full cubes have no triangles, every other case does", () => {
        assert.deepStrictEqual(triangulate(0, 0), []);
        assert.deepStrictEqual(triangulate(255, 0), []);
        for (let bits = 1; bits < 255; bits++) assert.ok(triangulate(bits, 0).length >= 3, "case " + bits);
    });

    it("each case uses exactly the crossed edges", () => {
        for (let bits = 1; bits < 255; bits++)
        {
            const crossed = EDGES.map(([a, b], e) => ((bits >> a & 1) !== (bits >> b & 1) ? e : -1)).filter((e) => e >= 0);
            const used = [...new Set(triangulate(bits, 0))].sort((a, b) => a - b);
            assert.deepStrictEqual(used, crossed, "case " + bits);
        }
    });

    it("one corner gives one triangle", () => {
        assert.strictEqual(triangulate(1, 0).length, 3);
    });
});

describe("marchingCubes", () => {
    it("a sphere is closed, with points at the radius and normals pointing out", () => {
        const n = 16, r = 5, c = (n - 1) / 2;
        const { positions, normals } = marchingCubes(sphere(n, r));
        assert.ok(positions.length > 0);
        assert.ok(isClosed(positions));
        let worst = 0, inward = 0;
        for (let i = 0; i < positions.length; i += 3)
        {
            const dx = positions[i] - c, dy = positions[i + 1] - c, dz = positions[i + 2] - c;
            const d = Math.hypot(dx, dy, dz);
            worst = Math.max(worst, Math.abs(d - r));
            if (dx * normals[i] + dy * normals[i + 1] + dz * normals[i + 2] <= 0) inward++;
        }
        assert.ok(worst < 0.1, "radius error " + worst);
        assert.strictEqual(inward, 0);
    });

    it("triangle winding agrees with the normals", () => {
        const { positions: p, normals: n } = marchingCubes(sphere(12, 4));
        for (let t = 0; t < p.length; t += 9)
        {
            const ux = p[t + 3] - p[t], uy = p[t + 4] - p[t + 1], uz = p[t + 5] - p[t + 2];
            const vx = p[t + 6] - p[t], vy = p[t + 7] - p[t + 1], vz = p[t + 8] - p[t + 2];
            const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
            assert.ok(cx * n[t] + cy * n[t + 1] + cz * n[t + 2] > 0);
        }
    });

    it("random fields stay closed in every ambiguity mode", () => {
        let seed = 7;
        const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - .5;
        const n = 8;
        const values = new Float32Array(n * n * n).map(rand);
        // pad the border outside so the surface closes
        for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
        {
            if ([x, y, z].some((v) => v === 0 || v === n - 1)) values[x + n * (y + n * z)] = -1;
        }
        for (const ambiguity of ["separate", "join", "decide"])
        {
            const { positions } = marchingCubes({ values, width: n, height: n, depth: n }, { ambiguity });
            assert.ok(isClosed(positions), ambiguity);
        }
    });

    it("transform moves the points", () => {
        const field = sphere(8, 2);
        const plain = marchingCubes(field).positions;
        const moved = marchingCubes(field, { transform: (x, y, z, out) => { out[0] = x * 2; out[1] = y + 10; out[2] = z; } }).positions;
        assert.ok(Math.abs(moved[0] - plain[0] * 2) < 1e-5);
        assert.ok(Math.abs(moved[1] - plain[1] - 10) < 1e-5);
    });

    it("degenerate input gives an empty surface", () => {
        assert.strictEqual(marchingCubes({ values: [], width: 0, height: 0, depth: 0 }).positions.length, 0);
        assert.strictEqual(marchingCubes({ values: [1], width: 1, height: 1, depth: 1 }).positions.length, 0);
    });
});

describe("marchingSquares", () => {
    it("a circle outline closes and sits on the radius", () => {
        const n = 20, r = 6, c = (n - 1) / 2;
        const values = new Float32Array(n * n);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) values[x + n * y] = r - Math.hypot(x - c, y - c);
        const lines = marchingSquares({ values, width: n, height: n });
        assert.ok(lines.length > 0);
        const ends = new Map();
        let worst = 0;
        for (let i = 0; i < lines.length; i += 2)
        {
            worst = Math.max(worst, Math.abs(Math.hypot(lines[i] - c, lines[i + 1] - c) - r));
            const k = lines[i].toFixed(4) + "," + lines[i + 1].toFixed(4);
            ends.set(k, (ends.get(k) ?? 0) + 1);
        }
        assert.ok(worst < 0.1);
        assert.ok([...ends.values()].every((v) => v === 2), "every point is shared by two segments");
    });

    it("saddle cells cut differently when separated or joined", () => {
        const field = { values: [1, -1, -1, 1], width: 2, height: 2 };
        const separate = marchingSquares(field, { ambiguity: "separate" });
        const join = marchingSquares(field, { ambiguity: "join" });
        assert.strictEqual(separate.length, 8);
        assert.strictEqual(join.length, 8);
        assert.notDeepStrictEqual(Array.from(separate), Array.from(join));
    });
});
