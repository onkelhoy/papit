import { Vector2, Vector3 } from "@papit/vector";
import type { Convex, Shape } from "./types";
import { simplex, solve, supportPair, W } from "./core";
import { pieces } from "./util";

export type Penetration = {
    /** unit direction to push `b` out of `a` (from a towards b) */
    normal: Vector2 | Vector3;
    /** how far `b` must move along `normal` to only touch `a`, 0 when touching */
    depth: number;
};

const MAX_EXPANSIONS = 256;
/** stop when a new support point improves the depth by less than this */
const TOLERANCE = 1e-12;
/** squared length below which a blow-up point adds nothing */
const FLAT = 1e-18;

// result of the last single-pair query
let depth = 0;
let nx = 0, ny = 0, nz = 0;

/**
 * Penetration depth and contact normal (EPA on the final GJK simplex), or `false` when the
 * shapes do not overlap. Arrays: the deepest overlapping pair of pieces.
 * Curved shapes (spheres, capsules, margins) converge to about 1e-6 of their size.
 */
export function penetration(a: Shape, b: Shape): Penetration | false {
    let best = -1;
    let bx = 0, by = 0, bz = 0, is3D = false;

    for (const pa of pieces(a))
    {
        for (const pb of pieces(b))
        {
            if (!single(pa, pb)) continue;
            if (depth <= best) continue;
            best = depth;
            bx = nx; by = ny; bz = nz;
            is3D = simplex.dimensions === 3;
        }
    }

    if (best < 0) return false;
    return is3D
        ? { normal: new Vector3(bx, by, bz), depth: best }
        : { normal: new Vector2(bx, by), depth: best };
}

function single(a: Convex, b: Convex): boolean {
    if (solve(a, b, false) > 0) return false;

    nx = 1; ny = 0; nz = 0; depth = 0;
    if (simplex.dimensions === 2)
    {
        if (blowUp2D(a, b)) polygon(a, b);
    }
    else if (blowUp3D(a, b))
    {
        polytope(a, b);
    }
    return true;
}

// blow-up: grow a touching / degenerate GJK simplex to a full one around the origin

function distance2(slot: number, other: number) {
    const i = slot * 3, j = other * 3;
    const x = W[i] - W[j], y = W[i + 1] - W[j + 1], z = W[i + 2] - W[j + 2];
    return x * x + y * y + z * z;
}

/** Tries ±(x, y, z); keeps the new vertex when `accept` says it adds a dimension. */
function tryDirection(a: Convex, b: Convex, x: number, y: number, z: number, accept: () => boolean) {
    const slot = simplex.count;
    for (let sign = 1; sign >= -1; sign -= 2)
    {
        supportPair(a, b, x * sign, y * sign, z * sign, slot);
        if (accept())
        {
            simplex.count = slot + 1;
            return true;
        }
    }
    return false;
}

const notVertex = () => distance2(1, 0) > FLAT;

function blowUp2D(a: Convex, b: Convex): boolean {
    if (simplex.count === 1 && !tryDirection(a, b, 1, 0, 0, notVertex) && !tryDirection(a, b, 0, 1, 0, notVertex)) return false;
    if (simplex.count === 2)
    {
        const ex = W[3] - W[0], ey = W[4] - W[1];
        const offLine = () => Math.abs(ex * (W[7] - W[1]) - ey * (W[6] - W[0])) > Math.sqrt(FLAT);
        if (!tryDirection(a, b, -ey, ex, 0, offLine))
        {
            nx = -ey; ny = ex; normalise();
            return false;
        }
    }
    return true;
}

function blowUp3D(a: Convex, b: Convex): boolean {
    if (simplex.count === 1
        && !tryDirection(a, b, 1, 0, 0, notVertex)
        && !tryDirection(a, b, 0, 1, 0, notVertex)
        && !tryDirection(a, b, 0, 0, 1, notVertex)) return false;

    if (simplex.count === 2)
    {
        const ex = W[3] - W[0], ey = W[4] - W[1], ez = W[5] - W[2];
        const offLine = () => {
            const px = W[6] - W[0], py = W[7] - W[1], pz = W[8] - W[2];
            const cx = ey * pz - ez * py, cy = ez * px - ex * pz, cz = ex * py - ey * px;
            return cx * cx + cy * cy + cz * cz > FLAT;
        };
        // two directions perpendicular to the edge
        const ax = Math.abs(ex) <= Math.abs(ey) && Math.abs(ex) <= Math.abs(ez) ? 1 : 0;
        const ay = ax === 0 && Math.abs(ey) <= Math.abs(ez) ? 1 : 0;
        const az = ax === 0 && ay === 0 ? 1 : 0;
        const p1x = ey * az - ez * ay, p1y = ez * ax - ex * az, p1z = ex * ay - ey * ax;
        const p2x = ey * p1z - ez * p1y, p2y = ez * p1x - ex * p1z, p2z = ex * p1y - ey * p1x;
        if (!tryDirection(a, b, p1x, p1y, p1z, offLine) && !tryDirection(a, b, p2x, p2y, p2z, offLine)) return false;
    }

    if (simplex.count === 3)
    {
        const abx = W[3] - W[0], aby = W[4] - W[1], abz = W[5] - W[2];
        const acx = W[6] - W[0], acy = W[7] - W[1], acz = W[8] - W[2];
        const fx = aby * acz - abz * acy, fy = abz * acx - abx * acz, fz = abx * acy - aby * acx;
        const length = Math.sqrt(fx * fx + fy * fy + fz * fz);
        const offPlane = () => Math.abs((W[9] - W[0]) * fx + (W[10] - W[1]) * fy + (W[11] - W[2]) * fz) > Math.sqrt(FLAT) * length;
        if (!tryDirection(a, b, fx, fy, fz, offPlane))
        {
            // A - B is flat here: no depth out of the plane
            nx = fx; ny = fy; nz = fz; normalise();
            return false;
        }
    }
    return true;
}

function normalise() {
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length === 0) { nx = 1; ny = 0; nz = 0; return; }
    nx /= length; ny /= length; nz /= length;
}

// 2D: expand a polygon around the origin, edge by edge

function polygon(a: Convex, b: Convex) {
    const xs = [W[0], W[3], W[6]];
    const ys = [W[1], W[4], W[7]];
    // counter-clockwise, so (ey, -ex) points outwards
    if ((xs[1] - xs[0]) * (ys[2] - ys[0]) - (ys[1] - ys[0]) * (xs[2] - xs[0]) < 0)
    {
        xs.reverse();
        ys.reverse();
    }

    for (let iteration = 0; iteration < MAX_EXPANSIONS; iteration++)
    {
        let closest = -1;
        let best = Infinity, bx = 0, by = 0;
        for (let i = 0; i < xs.length; i++)
        {
            const j = (i + 1) % xs.length;
            const ex = xs[j] - xs[i], ey = ys[j] - ys[i];
            const length = Math.sqrt(ex * ex + ey * ey);
            if (length === 0) continue;
            const ux = ey / length, uy = -ex / length;
            const d = ux * xs[i] + uy * ys[i];
            if (d < best) { best = d; closest = i; bx = ux; by = uy; }
        }
        if (closest === -1) return;

        nx = bx; ny = by; nz = 0;
        depth = Math.max(0, best);

        supportPair(a, b, bx, by, 0, 0);
        if (bx * W[0] + by * W[1] - best <= TOLERANCE) return;

        xs.splice(closest + 1, 0, W[0]);
        ys.splice(closest + 1, 0, W[1]);
    }
}

// 3D: expand a polytope around the origin, face by face

function polytope(a: Convex, b: Convex) {
    const v: number[] = [];
    for (let i = 0; i < 12; i++) v.push(W[i]);
    // a point strictly inside, to orient every face outwards
    const cx = (v[0] + v[3] + v[6] + v[9]) / 4;
    const cy = (v[1] + v[4] + v[7] + v[10]) / 4;
    const cz = (v[2] + v[5] + v[8] + v[11]) / 4;

    // faces: [i, j, k, nx, ny, nz, distance] per face
    const faces: number[][] = [];
    // `orient` flips against the inner point; only the first tetrahedron needs it,
    // faces from horizon edges already wind outwards and a flip there breaks the hull
    const addFace = (i: number, j: number, k: number, orient = true) => {
        const abx = v[j * 3] - v[i * 3], aby = v[j * 3 + 1] - v[i * 3 + 1], abz = v[j * 3 + 2] - v[i * 3 + 2];
        const acx = v[k * 3] - v[i * 3], acy = v[k * 3 + 1] - v[i * 3 + 1], acz = v[k * 3 + 2] - v[i * 3 + 2];
        let fx = aby * acz - abz * acy, fy = abz * acx - abx * acz, fz = abx * acy - aby * acx;
        const length = Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (length === 0)
        {
            faces.push([i, j, k, 0, 0, 0, Infinity]);
            return;
        }
        fx /= length; fy /= length; fz /= length;
        if (orient && fx * (v[i * 3] - cx) + fy * (v[i * 3 + 1] - cy) + fz * (v[i * 3 + 2] - cz) < 0)
        {
            faces.push([i, k, j, -fx, -fy, -fz, -(fx * v[i * 3] + fy * v[i * 3 + 1] + fz * v[i * 3 + 2])]);
            return;
        }
        faces.push([i, j, k, fx, fy, fz, fx * v[i * 3] + fy * v[i * 3 + 1] + fz * v[i * 3 + 2]]);
    };

    addFace(0, 1, 2);
    addFace(0, 3, 1);
    addFace(0, 2, 3);
    addFace(1, 3, 2);

    for (let iteration = 0; iteration < MAX_EXPANSIONS; iteration++)
    {
        let closest: number[] | undefined;
        for (const face of faces)
        {
            if (!closest || face[6] < closest[6]) closest = face;
        }
        if (!closest || closest[6] === Infinity) return;

        nx = closest[3]; ny = closest[4]; nz = closest[5];
        depth = Math.max(0, closest[6]);

        supportPair(a, b, nx, ny, nz, 0);
        const wx = W[0], wy = W[1], wz = W[2];
        if (nx * wx + ny * wy + nz * wz - closest[6] <= TOLERANCE) return;

        // remove every face the new point sees, keep the horizon edges
        const edges: number[] = [];
        for (let f = faces.length - 1; f >= 0; f--)
        {
            const face = faces[f];
            const i = face[0] * 3;
            if (face[3] * (wx - v[i]) + face[4] * (wy - v[i + 1]) + face[5] * (wz - v[i + 2]) <= 0) continue;

            for (let e = 0; e < 3; e++)
            {
                const from = face[e], to = face[(e + 1) % 3];
                let shared = -1;
                for (let s = 0; s < edges.length; s += 2)
                {
                    if (edges[s] === to && edges[s + 1] === from) { shared = s; break; }
                }
                if (shared >= 0) edges.splice(shared, 2);
                else edges.push(from, to);
            }
            faces.splice(f, 1);
        }

        const index = v.length / 3;
        v.push(wx, wy, wz);
        for (let s = 0; s < edges.length; s += 2) addFace(edges[s], edges[s + 1], index, false);
    }
}
