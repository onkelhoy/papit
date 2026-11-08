import { CORNERS, EDGES, FACES, ambiguous, cubeCase } from "./table";
import type { Field3, FieldOptions, Surface } from "./types";

/**
 * Marching cubes: the surface where the field crosses `iso`, as non-indexed triangles with
 * smooth normals from the field gradient. Positions are in grid steps unless `transform` moves them.
 *
 * @example
 * const surface = marchingCubes({ values, width: 32, height: 16, depth: 32 }, { iso: 0 });
 */
export function marchingCubes(field: Field3, options: FieldOptions = {}): Surface {
    const { values, width, height, depth } = field;
    const iso = options.iso ?? 0;
    const ambiguity = options.ambiguity ?? "separate";
    const positions: number[] = [];
    const normals: number[] = [];
    if (width < 2 || height < 2 || depth < 2 || values.length < width * height * depth)
    {
        return { positions: new Float32Array(), normals: new Float32Array() };
    }

    const at = (x: number, y: number, z: number) => {
        x = Math.min(width - 1, Math.max(0, x));
        y = Math.min(height - 1, Math.max(0, y));
        z = Math.min(depth - 1, Math.max(0, z));
        return values[x + width * (y + height * z)] - iso;
    };
    const value = new Float64Array(8);
    const gradient = new Float64Array(24);
    const out: [number, number, number] = [0, 0, 0];

    for (let z = 0; z < depth - 1; z++)
    {
        for (let y = 0; y < height - 1; y++)
        {
            for (let x = 0; x < width - 1; x++)
            {
                let bits = 0;
                for (let i = 0; i < 8; i++)
                {
                    const [cx, cy, cz] = CORNERS[i];
                    value[i] = at(x + cx, y + cy, z + cz);
                    if (value[i] >= 0) bits |= 1 << i;
                }
                if (bits === 0 || bits === 255) continue;

                let joinMask = 0;
                if (ambiguity !== "separate")
                {
                    FACES.forEach((face, f) => {
                        if (!ambiguous(bits, face)) return;
                        if (ambiguity === "join" || saddleInside(face.map((i) => value[i]))) joinMask |= 1 << f;
                    });
                }

                // central difference gradient at each corner, negated so normals leave the solid
                for (let i = 0; i < 8; i++)
                {
                    const px = x + CORNERS[i][0], py = y + CORNERS[i][1], pz = z + CORNERS[i][2];
                    gradient[i * 3] = at(px - 1, py, pz) - at(px + 1, py, pz);
                    gradient[i * 3 + 1] = at(px, py - 1, pz) - at(px, py + 1, pz);
                    gradient[i * 3 + 2] = at(px, py, pz - 1) - at(px, py, pz + 1);
                }

                for (const e of cubeCase(bits, joinMask))
                {
                    const [a, b] = EDGES[e];
                    const t = value[a] / (value[a] - value[b]);
                    const pa = CORNERS[a], pb = CORNERS[b];
                    const gx = x + pa[0] + t * (pb[0] - pa[0]);
                    const gy = y + pa[1] + t * (pb[1] - pa[1]);
                    const gz = z + pa[2] + t * (pb[2] - pa[2]);
                    if (options.transform)
                    {
                        options.transform(gx, gy, gz, out);
                        positions.push(out[0], out[1], out[2]);
                    }
                    else positions.push(gx, gy, gz);

                    const nx = gradient[a * 3] + t * (gradient[b * 3] - gradient[a * 3]);
                    const ny = gradient[a * 3 + 1] + t * (gradient[b * 3 + 1] - gradient[a * 3 + 1]);
                    const nz = gradient[a * 3 + 2] + t * (gradient[b * 3 + 2] - gradient[a * 3 + 2]);
                    const length = Math.hypot(nx, ny, nz) || 1;
                    normals.push(nx / length, ny / length, nz / length);
                }
            }
        }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

/** Bilinear saddle of a face (values minus iso, in cycle order) is inside: the inside corners connect. */
export function saddleInside([a, b, c, d]: number[]) {
    const denominator = a + c - b - d;
    if (denominator === 0) return false;
    return (a * c - b * d) / denominator >= 0;
}
