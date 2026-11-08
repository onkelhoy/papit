// Internal GJK solver shared by gjk(), distance() and penetration().
// All state lives in module scratch buffers so a query allocates nothing.
import { Vector3 } from "@papit/vector";
import type { Convex } from "./types";
import { read, R, type Direction } from "./util";

export const MAX_ITERATIONS = 64;
/** relative convergence on the squared distance */
const TOLERANCE = 1e-14;
/** absolute slack on the squared distance, for near-touching shapes */
const SLACK = 1e-15;
/**
 * gaps at or below this, relative to the shapes' size, count as touching (overlap).
 * Curved shapes only resolve tangency to about sqrt(float64 epsilon) ≈ 1.5e-8.
 */
const TOUCH = 1e-7;

/** simplex vertices of the Minkowski difference A - B, x y z per vertex */
export const W = new Float64Array(12);
/** support points on A and B that made each vertex */
export const PA = new Float64Array(12);
export const PB = new Float64Array(12);
/** barycentric weights of the closest point */
export const L = new Float64Array(4);

export const simplex = { count: 0, dimensions: 2 };

const dir: Direction = new Vector3(0, 0, 0);
let any3D = false;

/** Writes the support of A - B along (dx, dy, dz) into vertex `slot`. */
export function supportPair(a: Convex, b: Convex, dx: number, dy: number, dz: number, slot: number) {
    const i = slot * 3;
    dir.x = dx; dir.y = dy; dir.z = dz;
    read(a.support(dir));
    PA[i] = R[0]; PA[i + 1] = R[1]; PA[i + 2] = R[2];
    if (R[3]) any3D = true;

    dir.x = -dx; dir.y = -dy; dir.z = -dz;
    read(b.support(dir));
    PB[i] = R[0]; PB[i + 1] = R[1]; PB[i + 2] = R[2];
    if (R[3]) any3D = true;

    W[i] = PA[i] - PB[i];
    W[i + 1] = PA[i + 1] - PB[i + 1];
    W[i + 2] = PA[i + 2] - PB[i + 2];
}

// candidate sub-simplex: vertex indices + weights
const CI = new Int32Array(4);
const CL = new Float64Array(4);
let cn = 0;

function vertex(i: number): number {
    CI[0] = i; CL[0] = 1; cn = 1;
    const o = i * 3;
    return W[o] * W[o] + W[o + 1] * W[o + 1] + W[o + 2] * W[o + 2];
}

function edge(i: number, j: number, t: number): number {
    CI[0] = i; CI[1] = j; CL[0] = 1 - t; CL[1] = t; cn = 2;
    const a = i * 3, b = j * 3;
    const x = W[a] + (W[b] - W[a]) * t;
    const y = W[a + 1] + (W[b + 1] - W[a + 1]) * t;
    const z = W[a + 2] + (W[b + 2] - W[a + 2]) * t;
    return x * x + y * y + z * z;
}

/** Closest point of segment i-j to the origin. */
function segment(i: number, j: number): number {
    const a = i * 3, b = j * 3;
    const abx = W[b] - W[a], aby = W[b + 1] - W[a + 1], abz = W[b + 2] - W[a + 2];
    const length2 = abx * abx + aby * aby + abz * abz;
    if (length2 === 0) return vertex(i);

    const t = -(W[a] * abx + W[a + 1] * aby + W[a + 2] * abz) / length2;
    if (t <= 0) return vertex(i);
    if (t >= 1) return vertex(j);
    return edge(i, j, t);
}

/** Closest point of triangle i-j-k to the origin (Ericson, Voronoi regions). */
function triangle(i: number, j: number, k: number): number {
    const a = i * 3, b = j * 3, c = k * 3;
    const abx = W[b] - W[a], aby = W[b + 1] - W[a + 1], abz = W[b + 2] - W[a + 2];
    const acx = W[c] - W[a], acy = W[c + 1] - W[a + 1], acz = W[c + 2] - W[a + 2];

    const d1 = -(abx * W[a] + aby * W[a + 1] + abz * W[a + 2]);
    const d2 = -(acx * W[a] + acy * W[a + 1] + acz * W[a + 2]);
    if (d1 <= 0 && d2 <= 0) return vertex(i);

    const d3 = -(abx * W[b] + aby * W[b + 1] + abz * W[b + 2]);
    const d4 = -(acx * W[b] + acy * W[b + 1] + acz * W[b + 2]);
    if (d3 >= 0 && d4 <= d3) return vertex(j);

    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0 && d1 - d3 > 0) return edge(i, j, d1 / (d1 - d3));

    const d5 = -(abx * W[c] + aby * W[c + 1] + abz * W[c + 2]);
    const d6 = -(acx * W[c] + acy * W[c + 1] + acz * W[c + 2]);
    if (d6 >= 0 && d5 <= d6) return vertex(k);

    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0 && d2 - d6 > 0) return edge(i, k, d2 / (d2 - d6));

    const va = d3 * d6 - d5 * d4;
    const e = (d4 - d3) + (d5 - d6);
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0 && e > 0) return edge(j, k, (d4 - d3) / e);

    const sum = va + vb + vc;
    if (!(sum > 1e-300))
    {
        // degenerate (collinear) triangle: best of its edges
        const ab = segment(i, j), bc = segment(j, k), ac = segment(i, k);
        if (ab <= bc && ab <= ac) return segment(i, j);
        if (bc <= ac) return segment(j, k);
        return segment(i, k);
    }

    const v = vb / sum;
    const w = vc / sum;
    CI[0] = i; CI[1] = j; CI[2] = k;
    CL[0] = 1 - v - w; CL[1] = v; CL[2] = w;
    cn = 3;
    const x = W[a] + abx * v + acx * w;
    const y = W[a + 1] + aby * v + acy * w;
    const z = W[a + 2] + abz * v + acz * w;
    return x * x + y * y + z * z;
}

/** Whether the origin is on the far side of face i-j-k from vertex `opposite` (or on it). */
function outside(i: number, j: number, k: number, opposite: number): boolean {
    const a = i * 3, b = j * 3, c = k * 3, d = opposite * 3;
    const abx = W[b] - W[a], aby = W[b + 1] - W[a + 1], abz = W[b + 2] - W[a + 2];
    const acx = W[c] - W[a], acy = W[c + 1] - W[a + 1], acz = W[c + 2] - W[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const origin = -(W[a] * nx + W[a + 1] * ny + W[a + 2] * nz);
    const other = (W[d] - W[a]) * nx + (W[d + 1] - W[a + 1]) * ny + (W[d + 2] - W[a + 2]) * nz;
    return origin * other <= 0;
}

const BI = new Int32Array(4);
const BL = new Float64Array(4);
let bn = 0;

function keep() {
    bn = cn;
    for (let n = 0; n < cn; n++) { BI[n] = CI[n]; BL[n] = CL[n]; }
}

/** Closest point of tetrahedron 0-1-2-3 to the origin. Origin inside gives all 4 vertices. */
function tetrahedron(): number {
    let best = Infinity;
    if (outside(0, 1, 2, 3)) { const d = triangle(0, 1, 2); if (d < best) { best = d; keep(); } }
    if (outside(0, 2, 3, 1)) { const d = triangle(0, 2, 3); if (d < best) { best = d; keep(); } }
    if (outside(0, 3, 1, 2)) { const d = triangle(0, 3, 1); if (d < best) { best = d; keep(); } }
    if (outside(1, 3, 2, 0)) { const d = triangle(1, 3, 2); if (d < best) { best = d; keep(); } }

    if (best === Infinity)
    {
        cn = 4;
        for (let n = 0; n < 4; n++) { CI[n] = n; CL[n] = 0.25; }
        return 0;
    }

    cn = bn;
    for (let n = 0; n < bn; n++) { CI[n] = BI[n]; CL[n] = BL[n]; }
    return best;
}

const T = new Float64Array(36);

/** Shrinks the simplex to the candidate vertices, in order. */
function commit() {
    for (let n = 0; n < cn; n++)
    {
        const from = CI[n] * 3;
        for (let c = 0; c < 3; c++)
        {
            T[n * 9 + c] = W[from + c];
            T[n * 9 + 3 + c] = PA[from + c];
            T[n * 9 + 6 + c] = PB[from + c];
        }
    }
    for (let n = 0; n < cn; n++)
    {
        for (let c = 0; c < 3; c++)
        {
            W[n * 3 + c] = T[n * 9 + c];
            PA[n * 3 + c] = T[n * 9 + 3 + c];
            PB[n * 3 + c] = T[n * 9 + 6 + c];
        }
        L[n] = CL[n];
    }
    simplex.count = cn;
}

function reduce() {
    const count = simplex.count;
    if (count === 2) segment(0, 1);
    else if (count === 3) triangle(0, 1, 2);
    else tetrahedron();
    commit();
}

/**
 * Runs GJK on A - B. Returns the distance, `0` when the shapes overlap or touch.
 * With `early`, stops at the first proof of separation and returns a positive lower bound.
 * Afterwards `simplex`, `W`, `PA`, `PB` and `L` hold the final simplex.
 */
export function solve(a: Convex, b: Convex, early: boolean): number {
    any3D = false;
    supportPair(a, b, 1, 0, 0, 0);
    simplex.count = 1;
    L[0] = 1;

    let vx = W[0], vy = W[1], vz = W[2];
    let v2 = vx * vx + vy * vy + vz * vz;
    const touch = TOUCH * Math.max(1, Math.sqrt(v2));
    const touch2 = touch * touch;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++)
    {
        simplex.dimensions = any3D ? 3 : 2;
        if (v2 <= touch2) return 0;

        const slot = simplex.count;
        supportPair(a, b, -vx, -vy, -vz, slot);
        simplex.dimensions = any3D ? 3 : 2;

        const o = slot * 3;
        const wx = W[o], wy = W[o + 1], wz = W[o + 2];
        const vw = vx * wx + vy * wy + vz * wz;

        // the plane through w, facing v, separates A - B from the origin
        if (early && vw > touch * Math.sqrt(v2)) return vw / Math.sqrt(v2);

        // w is no closer than v: converged
        if (v2 - vw <= TOLERANCE * v2 + SLACK) break;

        let duplicate = false;
        for (let n = 0; n < slot; n++)
        {
            if (W[n * 3] === wx && W[n * 3 + 1] === wy && W[n * 3 + 2] === wz) duplicate = true;
        }
        if (duplicate) break;

        simplex.count = slot + 1;
        reduce();
        if (simplex.count === simplex.dimensions + 1) return 0;

        vx = 0; vy = 0; vz = 0;
        for (let n = 0; n < simplex.count; n++)
        {
            vx += L[n] * W[n * 3];
            vy += L[n] * W[n * 3 + 1];
            vz += L[n] * W[n * 3 + 2];
        }
        const next = vx * vx + vy * vy + vz * vz;
        const stalled = next >= v2;
        v2 = next;
        if (stalled) break;
    }

    return v2 <= touch2 ? 0 : Math.sqrt(v2);
}
