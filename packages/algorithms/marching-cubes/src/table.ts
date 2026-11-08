// The triangle table is generated, not hand-written: every face of the cube is cut into segments
// between its crossed edges, the segments chain into closed loops, and each loop becomes a fan.
// Two cubes sharing a face cut it the same way, so the surface has no cracks.

// corner i at (x, y, z); bottom 0..3 at (0,0),(1,0),(1,1),(0,1) in x, z, top 4..7 above
export const CORNERS: [number, number, number][] = [
    [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
    [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
];

// edge = [corner a, corner b]: bottom ring, top ring, verticals
export const EDGES: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
];

// faces as corner cycles, ordered counter-clockwise seen from outside the cube
export const FACES: number[][] = [
    [0, 1, 2, 3], [4, 5, 6, 7],
    [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
].map(outward);

function outward(face: number[]) {
    const [a, b, c] = face.map((i) => CORNERS[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const centre = face.reduce((s, i) => s.map((x, k) => x + CORNERS[i][k] - .5), [0, 0, 0]);
    const dot = n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2];
    return dot > 0 ? face : [...face].reverse();
}

function edgeOf(a: number, b: number) {
    return EDGES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Segments of one face polygon: pairs [from edge, to edge], from where the walk leaves the inside to where it enters.
 * `corners` are in walk order, `inside(i)` tells if corner i of the walk is inside, `edge(i)` is the edge from walk corner i to i + 1.
 * With 4 crossings, `join` pairs across the outside corners instead of around the inside ones.
 */
export function faceSegments(n: number, inside: (i: number) => boolean, edge: (i: number) => number, join: boolean): [number, number][] {
    const leaves: number[] = [];
    const enters: number[] = [];
    for (let i = 0; i < n; i++)
    {
        const a = inside(i), b = inside((i + 1) % n);
        if (a && !b) leaves.push(i);
        if (!a && b) enters.push(i);
    }
    const out: [number, number][] = [];
    for (let k = 0; k < leaves.length; k++)
    {
        // separate: the enter just before this leave (around its inside corner); join: the enter just after
        const from = leaves[k];
        let pick = -1;
        for (let step = 1; step < n && pick < 0; step++)
        {
            const i = join ? (from + step) % n : (from - step + n) % n;
            if (enters.includes(i)) pick = i;
        }
        out.push([edge(from), edge(pick)]);
    }
    return out;
}

/** Triangles (3 edge ids each) for corner bits and a mask of faces that join (bit f for face f). */
export function triangulate(bits: number, joinMask: number): number[] {
    const next = new Map<number, number>();
    FACES.forEach((face, f) => {
        const segments = faceSegments(4, (i) => (bits >> face[i] & 1) === 1, (i) => edgeOf(face[i], face[(i + 1) % 4]), (joinMask >> f & 1) === 1);
        for (const [from, to] of segments) next.set(from, to);
    });

    const triangles: number[] = [];
    const seen = new Set<number>();
    for (const start of next.keys())
    {
        if (seen.has(start)) continue;
        const loop: number[] = [];
        for (let e = start; !seen.has(e); e = next.get(e)!)
        {
            seen.add(e);
            loop.push(e);
        }
        for (let i = 1; i + 1 < loop.length; i++) triangles.push(loop[0], loop[i + 1], loop[i]);
    }
    return triangles;
}

/** True when a face (corner cycle) has its inside corners on one diagonal only. */
export function ambiguous(bits: number, face: number[]) {
    const b = face.map((i) => bits >> i & 1);
    return b[0] === b[2] && b[1] === b[3] && b[0] !== b[1];
}

const cache = new Map<number, number[]>();

/** Cached `triangulate`. */
export function cubeCase(bits: number, joinMask: number) {
    const key = bits | joinMask << 8;
    let triangles = cache.get(key);
    if (!triangles)
    {
        triangles = triangulate(bits, joinMask);
        cache.set(key, triangles);
    }
    return triangles;
}
