import type { Mesh } from "@papit/game-mesh";
import { bounds } from "@papit/game-mesh";
import { permuteCorner } from "@papit/corner-lookup";
import type { CellFrame } from "./types";

/**
 * Warps a unit cube module into an irregular cell: bilinear across the 4 corners (x, z),
 * linear in height (y). Normals use the inverse transpose of the warp, so lighting stays right.
 * Rotation and mirror turn the module first; mirrored output has its winding flipped.
 *
 * @returns a new non-indexed or indexed mesh, same layout as the input
 */
export function deform(mesh: Mesh, frame: CellFrame, rotation = 0, mirror = false): Mesh {
    // module corner k lands on cell corner permuteCorner(k)
    const q = [0, 1, 2, 3].map((k) => frame.corners[permuteCorner(k, rotation, mirror)]);
    const height = frame.top - frame.bottom;

    const count = mesh.positions.length / 3;
    const positions = new Float32Array(mesh.positions.length);
    const normals = new Float32Array(mesh.normals.length);

    for (let i = 0; i < count; i++)
    {
        const u = mesh.positions[i * 3];
        const h = mesh.positions[i * 3 + 1];
        const w = mesh.positions[i * 3 + 2];

        const a = (1 - u) * (1 - w);
        const b = u * (1 - w);
        const c = u * w;
        const d = (1 - u) * w;
        positions[i * 3] = a * q[0].x + b * q[1].x + c * q[2].x + d * q[3].x;
        positions[i * 3 + 1] = frame.bottom + h * height;
        positions[i * 3 + 2] = a * q[0].y + b * q[1].y + c * q[2].y + d * q[3].y;

        // derivatives of the bilinear map along u and w
        const ux = (1 - w) * (q[1].x - q[0].x) + w * (q[2].x - q[3].x);
        const uz = (1 - w) * (q[1].y - q[0].y) + w * (q[2].y - q[3].y);
        const wx = (1 - u) * (q[3].x - q[0].x) + u * (q[2].x - q[1].x);
        const wz = (1 - u) * (q[3].y - q[0].y) + u * (q[2].y - q[1].y);
        const det = ux * wz - wx * uz;

        const nx = mesh.normals[i * 3];
        const ny = mesh.normals[i * 3 + 1];
        const nz = mesh.normals[i * 3 + 2];
        let ox = (wz * nx - uz * nz) / det;
        let oy = height === 0 ? 0 : ny / height;
        let oz = (-wx * nx + ux * nz) / det;
        const length = Math.hypot(ox, oy, oz) || 1;
        normals[i * 3] = ox / length;
        normals[i * 3 + 1] = oy / length;
        normals[i * 3 + 2] = oz / length;
    }

    const out: Mesh = { positions, normals, bounds: bounds(positions) };
    if (mesh.colors) out.colors = mesh.colors.slice();
    if (mesh.uvs) out.uvs = mesh.uvs.slice();

    if (mesh.indices)
    {
        out.indices = mesh.indices.slice();
        if (mirror) flipWinding(out.indices);
    }
    else if (mirror)
    {
        flipTriangles(out);
    }
    return out;
}

function flipWinding(indices: Uint16Array | Uint32Array) {
    for (let i = 0; i < indices.length; i += 3)
    {
        const t = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = t;
    }
}

// swap vertex 1 and 2 of every triangle in all attributes
function flipTriangles(mesh: Mesh) {
    const swap = (array: Float32Array | undefined, size: number) => {
        if (!array) return;
        for (let t = 0; t < array.length; t += size * 3)
        {
            for (let k = 0; k < size; k++)
            {
                const tmp = array[t + size + k];
                array[t + size + k] = array[t + size * 2 + k];
                array[t + size * 2 + k] = tmp;
            }
        }
    };
    swap(mesh.positions, 3);
    swap(mesh.normals, 3);
    swap(mesh.colors, 4);
    swap(mesh.uvs, 2);
}
