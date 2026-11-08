import { MeshBuilder, Colour } from "@papit/game-mesh";
import { CornerTable } from "@papit/corner-lookup";
import { triangulate, CORNERS, EDGES } from "@papit/marching-cubes";
import type { ModuleDefinition, Side } from "./types";

type Point = [number, number, number];

// unit cube corner positions (x, z) for bottom corner index 0..3
const CORNER_XZ: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export type BlockColours = {
    wall?: Colour;
    top?: Colour;
    bottom?: Colour;
};

/**
 * Placeholder modules, one per canonical case: each filled corner is a box in its eighth
 * of the cube. Only faces toward empty eighths are built, so neighbouring cells join seamlessly.
 * Meant for tests and demos until real art exists.
 */
export function blockModules(colours: BlockColours = {}): ModuleDefinition[] {
    const table = new CornerTable({ corners: 8 });
    return table.cases
        .filter((pattern) => pattern !== 0 && pattern !== 255)
        .map((pattern) => {
            const geometry = blockGeometry(pattern, colours);
            const tags: string[] = [];
            if (hasWalkableTop(pattern)) tags.push("walkable");
            return { id: "block-" + pattern, pattern, geometry, tags, collision: blockCollision(pattern) };
        });
}

/** Geometry for one pattern: the filled eighths with their inner faces. */
export function blockGeometry(pattern: number, colours: BlockColours = {}) {
    const wall = colours.wall ?? "#e8e2d6";
    const top = colours.top ?? "#c0503c";
    const bottom = colours.bottom ?? "#8a8070";
    const builder = new MeshBuilder();
    const filled = (corner: number) => (pattern >> corner & 1) === 1;

    for (let corner = 0; corner < 8; corner++)
    {
        if (!filled(corner)) continue;
        const [cx, cz] = CORNER_XZ[corner & 3];
        const upper = corner >= 4;

        // box of this eighth
        const x0 = cx === 0 ? 0 : .5, x1 = x0 + .5;
        const z0 = cz === 0 ? 0 : .5, z1 = z0 + .5;
        const y0 = upper ? .5 : 0, y1 = y0 + .5;

        // the inner face (at .5) toward each axis neighbour, if that eighth is empty
        const xNeighbour = (corner & 4) | [1, 0, 3, 2][corner & 3];
        const zNeighbour = (corner & 4) | [3, 2, 1, 0][corner & 3];
        const yNeighbour = corner ^ 4;

        if (!filled(xNeighbour))
        {
            const x = cx === 0 ? x1 : x0;
            const facing = cx === 0 ? 1 : -1;
            face(builder, "x", x, facing, [y0, y1], [z0, z1], wall);
        }
        if (!filled(zNeighbour))
        {
            const z = cz === 0 ? z1 : z0;
            const facing = cz === 0 ? 1 : -1;
            face(builder, "z", z, facing, [x0, x1], [y0, y1], wall);
        }
        if (!filled(yNeighbour))
        {
            const y = upper ? y0 : y1;
            const facing = upper ? -1 : 1;
            face(builder, "y", y, facing, [z0, z1], [x0, x1], facing > 0 ? top : bottom);
        }
    }
    return builder.build();
}

/** One box (8 points) per filled eighth of the cube, for collision. */
export function blockCollision(pattern: number) {
    const hulls: [number, number, number][][] = [];
    for (let corner = 0; corner < 8; corner++)
    {
        if (!(pattern >> corner & 1)) continue;
        const [cx, cz] = CORNER_XZ[corner & 3];
        const x0 = cx * .5, z0 = cz * .5, y0 = corner >= 4 ? .5 : 0;
        const box: [number, number, number][] = [];
        for (let i = 0; i < 8; i++) box.push([x0 + (i & 1) * .5, y0 + (i >> 1 & 1) * .5, z0 + (i >> 2 & 1) * .5]);
        hulls.push(box);
    }
    return hulls;
}

// a filled bottom corner with empty space above it
function hasWalkableTop(pattern: number) {
    for (let i = 0; i < 4; i++)
    {
        if ((pattern >> i & 1) && !(pattern >> (i + 4) & 1)) return true;
    }
    return false;
}

// axis aligned rectangle at `axis = at`, counter-clockwise seen from the `facing` side
function face(builder: MeshBuilder, axis: "x" | "y" | "z", at: number, facing: 1 | -1, [a0, a1]: number[], [b0, b1]: number[], colour: Colour) {
    // (a, b) span the plane: x face uses (y, z), y face uses (z, x), z face uses (x, y)
    const point = (a: number, b: number): Point => {
        if (axis === "x") return [at, a, b];
        if (axis === "y") return [b, at, a];
        return [a, b, at];
    };
    const p0 = point(a0, b0), p1 = point(a1, b0), p2 = point(a1, b1), p3 = point(a0, b1);
    if (facing > 0) builder.quad(p0, p1, p2, p3, colour);
    else builder.quad(p0, p3, p2, p1, colour);
}

/**
 * Sides a module's geometry reaches for `pattern`: edge `i` when corner `i` or `i + 1` is filled
 * (bottom or top), `top` / `bottom` when a corner of that layer is filled.
 * Handy to give every reached side the same socket, e.g. one roof colour per building.
 */
export function touchingSides(pattern: number) {
    const sides: Side[] = [];
    for (let i = 0; i < 4; i++)
    {
        const next = (i + 1) & 3;
        if (pattern & (0x11 << i) || pattern & (0x11 << next)) sides.push(i as Side);
    }
    if (pattern & 0xf0) sides.push("top");
    if (pattern & 0x0f) sides.push("bottom");
    return sides;
}

export type SurfaceColours = {
    /** faces that point up, default grass */
    ground?: Colour;
    /** steep faces, default rock */
    cliff?: Colour;
};

/**
 * Smooth terrain modules from the marching cubes table, one per canonical case: surface points sit
 * halfway along crossed edges, so filled vertices become rolling ground instead of blocks.
 * Up facing triangles get the ground colour, steep ones the cliff colour.
 */
export function surfaceModules(colours: SurfaceColours = {}): ModuleDefinition[] {
    const table = new CornerTable({ corners: 8 });
    return table.cases
        .filter((pattern) => pattern !== 0 && pattern !== 255)
        .map((pattern) => ({ id: "surface-" + pattern, pattern, geometry: surfaceGeometry(pattern, colours), tags: ["walkable"] }));
}

/** Marching cubes geometry for one pattern, in the unit cube. */
export function surfaceGeometry(pattern: number, colours: SurfaceColours = {}) {
    const builder = new MeshBuilder();
    const edges = triangulate(pattern, 0);
    const point = (e: number): Point => {
        const [a, b] = EDGES[e];
        return [0, 1, 2].map((k) => (CORNERS[a][k] + CORNERS[b][k]) / 2) as Point;
    };
    for (let t = 0; t < edges.length; t += 3)
    {
        const a = point(edges[t]), b = point(edges[t + 1]), c = point(edges[t + 2]);
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const ny = uz * vx - ux * vz;
        const length = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) || 1;
        builder.triangle(a, b, c, ny / length > .6 ? colours.ground ?? "#7da35a" : colours.cliff ?? "#8d8478");
    }
    return builder.build();
}
