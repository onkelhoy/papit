import { bounds } from "./bounds";
import type { Mesh } from "./types";

export type Point = [number, number, number];

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, or 0..1 channels `[r, g, b]` / `[r, g, b, a]`. */
export type Colour = string | [number, number, number] | [number, number, number, number];

export type Place = {
    at?: Point;
    /** around y, x and z, in radians, applied yaw then pitch then roll */
    yaw?: number;
    pitch?: number;
    roll?: number;
    /** one number for all three axes, or one each */
    scale?: number | Point;
};

export type BuildOptions = {
    /** weld vertices at the same position and average their normals, indexed output */
    smooth?: boolean;
};

/**
 * Low poly meshes in code: add shapes, each placed and coloured, then `build()`.
 * Every triangle gets its own normal (flat), or `build({ smooth: true })` averages them.
 */
export class MeshBuilder {
    private positions: number[] = [];
    private normals: number[] = [];
    private colors: number[] = [];
    private transform = new Transform();

    /** A triangle, counter clockwise seen from the outside. */
    triangle(a: Point, b: Point, c: Point, colour: Colour = "#fff") {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length; ny /= length; nz /= length;
        const [r, g, bl, alpha] = rgba(colour);
        for (const p of [a, b, c])
        {
            this.positions.push(p[0], p[1], p[2]);
            this.normals.push(nx, ny, nz);
            this.colors.push(r, g, bl, alpha);
        }
        return this;
    }

    /** A flat four sided face, `a b c d` counter clockwise. */
    quad(a: Point, b: Point, c: Point, d: Point, colour: Colour = "#fff") {
        return this.triangle(a, b, c, colour).triangle(a, c, d, colour);
    }

    /** A 1 by 1 square in the xz plane facing +y, around its centre. */
    plane(colour: Colour = "#fff", place: Place = {}) {
        const p = this.placer(place);
        return this.quad(p([-.5, 0, .5]), p([.5, 0, .5]), p([.5, 0, -.5]), p([-.5, 0, -.5]), colour);
    }

    /** A box of size 1 around its centre. */
    box(colour: Colour = "#fff", place: Place = {}) {
        const p = this.placer(place);
        const v = (x: number, y: number, z: number) => p([x * .5, y * .5, z * .5]);
        this.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), colour);
        this.quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), colour);
        this.quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), colour);
        this.quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), colour);
        this.quad(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), colour);
        this.quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), colour);
        return this;
    }

    /** A tube from y 0 to y 1 with `sides` sides and `bottom` / `top` radius. A top of 0 is a cone. */
    cylinder(colour: Colour = "#fff", place: Place = {}, sides = 8, bottom = .5, top = .5, caps = true) {
        sides = Math.max(3, Math.floor(sides));
        const p = this.placer(place);
        const ring = (radius: number, y: number) => Array.from({ length: sides }, (_, i) => {
            const angle = i / sides * Math.PI * 2;
            return p([Math.cos(angle) * radius, y, -Math.sin(angle) * radius]);
        });
        const low = ring(bottom, 0);
        const high = top > 0 ? ring(top, 1) : null;
        const tip = p([0, 1, 0]);
        for (let i = 0; i < sides; i++)
        {
            const j = (i + 1) % sides;
            if (high) this.quad(low[i], low[j], high[j], high[i], colour);
            else this.triangle(low[i], low[j], tip, colour);
        }
        if (caps)
        {
            const base = p([0, 0, 0]);
            for (let i = 0; i < sides; i++) this.triangle(base, low[(i + 1) % sides], low[i], colour);
            if (high)
            {
                for (let i = 0; i < sides; i++) this.triangle(tip, high[i], high[(i + 1) % sides], colour);
            }
        }
        return this;
    }

    /** A cone: a cylinder with a top radius of 0. */
    cone(colour: Colour = "#fff", place: Place = {}, sides = 8, radius = .5, caps = true) {
        return this.cylinder(colour, place, sides, radius, 0, caps);
    }

    /** A ball of radius 1, an icosahedron split `detail` times (20 * 4^detail triangles). */
    sphere(colour: Colour | ((point: Point) => Colour) = "#fff", place: Place = {}, detail = 1) {
        const p = this.placer(place);
        for (const [a, b, c] of icosphere(Math.max(0, Math.floor(detail))))
        {
            const middle: Point = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
            this.triangle(p(a), p(b), p(c), typeof colour === "function" ? colour(middle) : colour);
        }
        return this;
    }

    /** Another mesh or builder's triangles, placed. Indexed meshes are unrolled. */
    add(other: MeshBuilder | Mesh, place: Place = {}) {
        const mesh = other instanceof MeshBuilder ? other.build() : other;
        const matrix = this.transform.set(place);
        const count = mesh.indices ? mesh.indices.length : mesh.positions.length / 3;
        for (let k = 0; k < count; k++)
        {
            const i = mesh.indices ? mesh.indices[k] : k;
            const point = matrix.point([mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]]);
            const normal = matrix.normal([mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]]);
            this.positions.push(...point);
            this.normals.push(...normal);
            if (mesh.colors) this.colors.push(mesh.colors[i * 4], mesh.colors[i * 4 + 1], mesh.colors[i * 4 + 2], mesh.colors[i * 4 + 3]);
            else this.colors.push(1, 1, 1, 1);
        }
        return this;
    }

    build(options: BuildOptions = {}): Mesh {
        const positions = new Float32Array(this.positions);
        if (!options.smooth)
        {
            return {
                positions,
                normals: new Float32Array(this.normals),
                colors: new Float32Array(this.colors),
                bounds: bounds(positions),
            };
        }
        return weld(this.positions, this.normals, this.colors);
    }

    private placer(place: Place) {
        const matrix = this.transform.set(place);
        return (point: Point) => matrix.point(point);
    }
}

// smooth: one vertex per position and colour, normals summed (area weighted) then normalised
function weld(positions: number[], normals: number[], colors: number[]): Mesh {
    const lookup = new Map<string, number>();
    const outPositions: number[] = [], outNormals: number[] = [], outColors: number[] = [];
    const indices: number[] = [];
    for (let v = 0; v < positions.length / 3; v++)
    {
        const key = [
            positions[v * 3].toFixed(5), positions[v * 3 + 1].toFixed(5), positions[v * 3 + 2].toFixed(5),
            colors[v * 4], colors[v * 4 + 1], colors[v * 4 + 2], colors[v * 4 + 3],
        ].join();
        let index = lookup.get(key);
        if (index === undefined)
        {
            index = outPositions.length / 3;
            lookup.set(key, index);
            outPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
            outNormals.push(0, 0, 0);
            outColors.push(colors[v * 4], colors[v * 4 + 1], colors[v * 4 + 2], colors[v * 4 + 3]);
        }
        outNormals[index * 3] += normals[v * 3];
        outNormals[index * 3 + 1] += normals[v * 3 + 1];
        outNormals[index * 3 + 2] += normals[v * 3 + 2];
        indices.push(index);
    }
    for (let i = 0; i < outNormals.length; i += 3)
    {
        const length = Math.hypot(outNormals[i], outNormals[i + 1], outNormals[i + 2]) || 1;
        outNormals[i] /= length; outNormals[i + 1] /= length; outNormals[i + 2] /= length;
    }
    const outPositionArray = new Float32Array(outPositions);
    const vertexCount = outPositions.length / 3;
    return {
        positions: outPositionArray,
        normals: new Float32Array(outNormals),
        colors: new Float32Array(outColors),
        indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
        bounds: bounds(outPositionArray),
    };
}

// translate * rotate(yaw, pitch, roll) * scale; normals use rotate * scale^-1
class Transform {
    private rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    private scale: Point = [1, 1, 1];
    private at: Point = [0, 0, 0];

    set({ at = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = 1 }: Place) {
        this.at = at;
        this.scale = typeof scale === "number" ? [scale, scale, scale] : scale;
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cr = Math.cos(roll), sr = Math.sin(roll);
        // Ry * Rx * Rz, row major
        this.rotation = [
            cy * cr + sy * sp * sr, -cy * sr + sy * sp * cr, sy * cp,
            cp * sr, cp * cr, -sp,
            -sy * cr + cy * sp * sr, sy * sr + cy * sp * cr, cy * cp,
        ];
        return this;
    }

    point(p: Point): Point {
        const [x, y, z] = this.rotate(p[0] * this.scale[0], p[1] * this.scale[1], p[2] * this.scale[2]);
        return [x + this.at[0], y + this.at[1], z + this.at[2]];
    }

    normal(n: Point): Point {
        const [x, y, z] = this.rotate(n[0] / (this.scale[0] || 1), n[1] / (this.scale[1] || 1), n[2] / (this.scale[2] || 1));
        const length = Math.hypot(x, y, z) || 1;
        return [x / length, y / length, z / length];
    }

    private rotate(x: number, y: number, z: number): Point {
        const m = this.rotation;
        return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
    }
}

/** Parse a colour into 0..1 rgba. Unknown strings give white. */
export function rgba(colour: Colour): [number, number, number, number] {
    if (typeof colour !== "string") return [colour[0], colour[1], colour[2], colour[3] ?? 1];
    let hex = colour.replace("#", "");
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return [1, 1, 1, 1];
    const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return [channel(0), channel(2), channel(4), hex.length === 8 ? channel(6) : 1];
}

function icosphere(detail: number) {
    const t = (1 + Math.sqrt(5)) / 2;
    const points = ([
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ] as Point[]).map(unit);
    let faces: [Point, Point, Point][] = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ].map(([a, b, c]) => [points[a], points[b], points[c]]);
    for (let i = 0; i < detail; i++)
    {
        faces = faces.flatMap(([a, b, c]) => {
            const ab = unit(half(a, b)), bc = unit(half(b, c)), ca = unit(half(c, a));
            return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]] as [Point, Point, Point][];
        });
    }
    return faces;
}

const half = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const unit = (v: Point): Point => {
    const length = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / length, v[1] / length, v[2] / length];
};
