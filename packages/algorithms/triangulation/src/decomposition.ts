import { type Polygon } from "@papit/polygon";
import { Vector2, VectorValue } from "@papit/vector";

/**
 * Hertel–Mehlhorn convex decomposition.
 * O(N) where N is the number of vertices (single pass over the
 * half-edges to build structure, single pass over diagonals, single
 * pass to emit convex pieces).
 * Assumes the polygon is calibrated (CCW winding) and triangulated.
 * Modifies polygon.convex to contain a flat array of vertex indices,
 * grouped by convex polygon size: [size1, i1, i2, …, size2, j1, j2, …].
 */
export function Decomposition(polygon: Polygon): ([error: false] | [error: true, message: string]) {
    const tris = polygon.triangles;
    if (!tris || tris.length < 3 || tris.length % 3 !== 0)
    {
        return [true, "No valid triangulation found. Run Triangulation first."];
    }

    const T = tris.length / 3;              // number of triangles
    const H = tris.length;                  // total half-edges (3 per triangle)

    // ---------- 1. Build half-edge arrays ----------
    const he_from = new Int32Array(H);
    const he_vertex = new Int32Array(H);
    const he_next = new Int32Array(H);
    const he_prev = new Int32Array(H);
    const he_tri = new Int32Array(H);        // triangle index for each half-edge

    for (let t = 0; t < T; t++)
    {
        const a = tris[3 * t];
        const b = tris[3 * t + 1];
        const c = tris[3 * t + 2];

        const h0 = 3 * t;
        const h1 = 3 * t + 1;
        const h2 = 3 * t + 2;

        // triangle order is CCW: a → b → c → a
        he_from[h0] = a; he_vertex[h0] = b; he_next[h0] = h1; he_tri[h0] = t;
        he_from[h1] = b; he_vertex[h1] = c; he_next[h1] = h2; he_tri[h1] = t;
        he_from[h2] = c; he_vertex[h2] = a; he_next[h2] = h0; he_tri[h2] = t;
    }

    for (let h = 0; h < H; h++)
    {
        he_prev[he_next[h]] = h;
    }

    // ---------- 2. Build edge map & collect internal diagonals ----------
    // Numeric keys instead of template-string keys: avoids H string
    // allocations + string hashing on every edge. K is derived from the
    // vertex count so the (min,max) pair always maps to a unique key,
    // no matter how large the indices get.
    const K = polygon.vertices.length + 1;
    const edgeMap = new Map<number, number[]>(); // key -> flat [h, from, to, h, from, to, ...]

    for (let h = 0; h < H; h++)
    {
        const f = he_from[h];
        const t = he_vertex[h];
        const key = f < t ? f * K + t : t * K + f;
        let entry = edgeMap.get(key);
        if (!entry) { entry = []; edgeMap.set(key, entry); }
        entry.push(h, f, t);
    }

    // he1/he2 pairs only — tri1/tri2 are cheap lookups (he_tri[he]) so
    // there's no need to store them alongside every diagonal.
    const diagHe: number[] = [];

    for (const entry of edgeMap.values())
    {
        if (entry.length !== 6) continue; // not exactly 2 half-edges on this edge
        const h1 = entry[0], f1 = entry[1], t1 = entry[2];
        const h2 = entry[3], f2 = entry[4], t2 = entry[5];
        if (f1 === t2 && t1 === f2)
        {
            diagHe.push(h1, h2);
        }
    }

    // ---------- 3. DSU for triangles (iterative, path-compressing) ----------
    const parent = new Int32Array(T);
    const rank = new Uint8Array(T); // union-by-rank never exceeds ~log2(T)
    for (let i = 0; i < T; i++) parent[i] = i;

    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) root = parent[root];
        while (parent[x] !== root)
        {
            const next = parent[x];
            parent[x] = root;
            x = next;
        }
        return root;
    }

    const union = (a: number, b: number) => {
        let ra = find(a);
        let rb = find(b);
        if (ra === rb) return;
        if (rank[ra] < rank[rb]) [ra, rb] = [rb, ra];
        parent[rb] = ra;
        if (rank[ra] === rank[rb]) rank[ra]++;
    }

    // ---------- 4. Local convexity check ----------
    // Standard incoming-edge x outgoing-edge turn test, matching the
    // sign convention `isConvex()` below already uses: cross(o - prev,
    // next - o) >= 0 means a left turn (convex for a CCW polygon).
    // The previous version computed cross(prev - o, next - o), which is
    // the *negation* of this — it happened to only be correct for a
    // specific combination of winding + coordinate handedness. Verify
    // against your actual coordinate convention (y-up vs y-down) with
    // a concave test shape before trusting this in production.
    const isVertexConvex = (prev: number, o: number, next: number, verts: VectorValue[]): boolean => {
        const vp = verts[prev];
        const vo = verts[o];
        const vn = verts[next];
        const e1 = Vector2.subtract(vo, vp); // prev -> o
        const e2 = Vector2.subtract(vn, vo); // o -> next
        return Vector2.cross(e1, e2) >= 0;
    }

    // ---------- 5. Process each diagonal once ----------
    const verts = polygon.vertices;
    const visited = new Uint8Array(H); // moved up from step 6

    for (let d = 0; d < diagHe.length; d += 2)
    {
        const he1 = diagHe[d];
        const he2 = diagHe[d + 1];
        const tri1 = he_tri[he1];
        const tri2 = he_tri[he2];

        if (find(tri1) === find(tri2)) continue;

        const prev1 = he_prev[he1];
        const next1 = he_next[he1];
        const prev2 = he_prev[he2];
        const next2 = he_next[he2];

        const u = he_from[he1];
        const v = he_vertex[he1];

        const u_prev = he_from[prev1];
        const u_next = he_vertex[next2];
        const v_prev = he_from[prev2];
        const v_next = he_vertex[next1];

        const convexU = isVertexConvex(u_prev, u, u_next, verts);
        const convexV = isVertexConvex(v_prev, v, v_next, verts);

        if (convexU && convexV)
        {
            union(tri1, tri2);

            he_next[prev1] = next2;
            he_prev[next2] = prev1;
            he_next[prev2] = next1;
            he_prev[next1] = prev2;

            // he1/he2 are now dangling — orphan them so step 6 never
            // treats them as a live cycle start.
            visited[he1] = 1;
            visited[he2] = 1;
        }
    }

    // ---------- 6. Extract convex pieces directly into the flat output ----------
    // (remove the `const visited = new Uint8Array(H);` line that was here)
    const flatConvex: number[] = [];

    for (let h = 0; h < H; h++)
    {
        if (visited[h]) continue;

        const sizeIndex = flatConvex.length;
        flatConvex.push(0); // placeholder, patched below

        let curr = h;
        let count = 0;
        let corrupted = false;
        do
        {
            visited[curr] = 1;
            flatConvex.push(he_from[curr]);
            count++;
            curr = he_next[curr];
            if (count > H) { corrupted = true; break; } // dangling chain guard
        } while (curr !== h);

        if (corrupted || count < 3)
        {
            flatConvex.length = sizeIndex; // discard this entry
            continue;
        }

        flatConvex[sizeIndex] = count;
    }

    polygon.shapesindeces = flatConvex;

    return [false];
}

/**
 * Utility: check if a shape (array of Vector2 or {x,y}) is convex.
 * Uses cross products; collinear points are accepted. Sign-agnostic —
 * doesn't assume a winding direction, only that all turns agree.
 */
export function isConvex(shape: { x: number; y: number }[]): boolean {
    const n = shape.length;
    if (n < 3) return false;

    let sign = 0;
    for (let i = 0; i < n; i++)
    {
        const a = shape[i];
        const b = shape[(i + 1) % n];
        const c = shape[(i + 2) % n];
        const e1 = Vector2.subtract(b, a);
        const e2 = Vector2.subtract(c, b);
        const cross = Vector2.cross(e1, e2);
        if (cross !== 0)
        {
            const curSign = Math.sign(cross);
            if (sign === 0) sign = curSign;
            else if (curSign !== sign) return false;
        }
    }
    return true;
}