import { faceSegments } from "./table";
import { saddleInside } from "./cubes";
import type { Field2, FieldOptions } from "./types";

// square corners 0..3 at (0,0),(1,0),(1,1),(0,1); edge i runs from corner i to i + 1
const SQUARE: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

/**
 * Marching squares: contour lines where the field crosses `iso`, 4 floats (x0, y0, x1, y1) per segment
 * in grid steps. Segments run with the inside on their left, so they chain into outlines.
 *
 * @example
 * const lines = marchingSquares({ values, width: 64, height: 64 }, { iso: 0.5 });
 */
export function marchingSquares(field: Field2, options: Omit<FieldOptions, "transform"> = {}): Float32Array {
    const { values, width, height } = field;
    const iso = options.iso ?? 0;
    const ambiguity = options.ambiguity ?? "separate";
    if (width < 2 || height < 2 || values.length < width * height) return new Float32Array();
    const out: number[] = [];
    const value = [0, 0, 0, 0];

    for (let y = 0; y < height - 1; y++)
    {
        for (let x = 0; x < width - 1; x++)
        {
            let bits = 0;
            for (let i = 0; i < 4; i++)
            {
                value[i] = values[x + SQUARE[i][0] + width * (y + SQUARE[i][1])] - iso;
                if (value[i] >= 0) bits |= 1 << i;
            }
            if (bits === 0 || bits === 15) continue;
            const join = bits === 5 || bits === 10
                ? ambiguity === "join" || (ambiguity === "decide" && saddleInside(value))
                : false;

            for (const [from, to] of faceSegments(4, (i) => (bits >> i & 1) === 1, (i) => i, join))
            {
                for (const e of [from, to])
                {
                    const a = e, b = (e + 1) & 3;
                    const t = value[a] / (value[a] - value[b]);
                    out.push(x + SQUARE[a][0] + t * (SQUARE[b][0] - SQUARE[a][0]), y + SQUARE[a][1] + t * (SQUARE[b][1] - SQUARE[a][1]));
                }
            }
        }
    }
    return new Float32Array(out);
}
