import { Pixel, Pixels } from "@papit/game-engine";

export type Point = {
    x: number;
    y: number;
    key: string;
};

// ... your existing Anchor / FIXED_OFFSET / Constraint / SIDE / sideFor /
// resolveVertex / toVertices stay exactly as they are ...

/**
 * Moore neighbourhood in clockwise order.
 *
 * Image coordinates:
 *        NW   N   NE
 *         7   0    1
 *         W   P    E
 *         6        2
 *        SW   S   SE
 *         5   4    3
 */
export const MOORE_NEIGHBOURS = [
    { x: 0, y: -1 }, // 0 N
    { x: 1, y: -1 }, // 1 NE
    { x: 1, y: 0 },  // 2 E
    { x: 1, y: 1 },  // 3 SE
    { x: 0, y: 1 },  // 4 S
    { x: -1, y: 1 }, // 5 SW
    { x: -1, y: 0 }, // 6 W
    { x: -1, y: -1 }, // 7 NW
];

export function key(x: number, y: number): string {
    return `${x}x${y}`;
}

export function makePoint(x: number, y: number): Point {
    return { x, y, key: key(x, y) };
}

export function isEmpty(pixel: Pixel | undefined): boolean {
    if (!pixel) return true;
    if (pixel.a === 0) return true;
    return pixel.r === 255 && pixel.g === 255 && pixel.b === 255;
}

export function isFilled(pixels: Pixels, x: number, y: number): boolean {
    const pixel = pixels.get(x, y);
    return pixel !== undefined && !isEmpty(pixel);
}

export function neighbourIndex(current: Point, neighbour: Point): number {
    const dx = neighbour.x - current.x;
    const dy = neighbour.y - current.y;
    return MOORE_NEIGHBOURS.findIndex((d) => d.x === dx && d.y === dy);
}

export type Anchor =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center"
    | "auto";

const FIXED_OFFSET: Record<Exclude<Anchor, "auto">, { x: number; y: number }> = {
    "top-left": { x: 0, y: 0 },
    "top-right": { x: 1, y: 0 },
    "bottom-left": { x: 0, y: 1 },
    "bottom-right": { x: 1, y: 1 },
    center: { x: 0.5, y: 0.5 },
};

type Constraint =
    | { kind: "corner"; ox: 0 | 1; oy: 0 | 1 }
    | { kind: "vedge"; ox: 0 | 1 } // vertical edge, x fixed, y free
    | { kind: "hedge"; oy: 0 | 1 }; // horizontal edge, y fixed, x free

// Direction FROM a pixel TO a neighbour -> which side/corner of the
// current pixel is shared with that neighbour.
const SIDE: Record<string, Constraint> = {
    "0,-1": { kind: "hedge", oy: 0 }, // N -> top edge
    "0,1": { kind: "hedge", oy: 1 }, // S -> bottom edge
    "1,0": { kind: "vedge", ox: 1 }, // E -> right edge
    "-1,0": { kind: "vedge", ox: 0 }, // W -> left edge
    "1,-1": { kind: "corner", ox: 1, oy: 0 }, // NE -> top-right
    "-1,-1": { kind: "corner", ox: 0, oy: 0 }, // NW -> top-left
    "1,1": { kind: "corner", ox: 1, oy: 1 }, // SE -> bottom-right
    "-1,1": { kind: "corner", ox: 0, oy: 1 }, // SW -> bottom-left
};

function sideFor(dx: number, dy: number): Constraint {
    const c = SIDE[`${dx},${dy}`];
    if (!c) throw new Error(`Unexpected direction ${dx},${dy}`);
    return c;
}

/**
 * Resolve the exact grid vertex for a boundary pixel, given the
 * direction we entered it from (dIn = current - prev) and the
 * direction we leave it in (dOut = next - current).
 */
function resolveVertex(
    px: number,
    py: number,
    dIn: { x: number; y: number },
    dOut: { x: number; y: number }
): { x: number; y: number } {
    // The side shared with `prev` is the one facing -dIn.
    const entry = sideFor(-dIn.x, -dIn.y);
    const exit = sideFor(dOut.x, dOut.y);

    let ox: 0 | 1 | undefined;
    let oy: 0 | 1 | undefined;

    for (const c of [entry, exit])
    {
        if (c.kind === "corner")
        {
            ox = c.ox;
            oy = c.oy;
        }
    }

    if (ox === undefined) ox = entry.kind === "vedge" ? entry.ox : exit.kind === "vedge" ? exit.ox : 0;
    if (oy === undefined) oy = entry.kind === "hedge" ? entry.oy : exit.kind === "hedge" ? exit.oy : 0;

    return { x: px + ox, y: py + oy };
}

export function toVertices(boundary: Point[], anchor: Anchor): { x: number; y: number }[] {
    if (anchor !== "auto")
    {
        const offset = FIXED_OFFSET[anchor];
        return boundary.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
    }

    const n = boundary.length;
    if (n < 2) return boundary.map((p) => ({ x: p.x, y: p.y }));

    return boundary.map((point, i) => {
        const prev = boundary[(i - 1 + n) % n];
        const next = boundary[(i + 1) % n];
        const dIn = { x: point.x - prev.x, y: point.y - prev.y };
        const dOut = { x: next.x - point.x, y: next.y - point.y };
        return resolveVertex(point.x, point.y, dIn, dOut);
    });
}