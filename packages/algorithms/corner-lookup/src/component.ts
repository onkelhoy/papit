import { CornerTableOptions, CornerCase } from "./types";

/**
 * Corner layout: bottom corners 0..3 counter-clockwise, top corners 4..7 above them.
 * Bit `i` of a pattern is corner `i`. Rotation turns around the vertical axis.
 */

/** Where corner `corner` ends up after mirroring (optional) then rotating by `rotation` quarter turns. */
export function permuteCorner(corner: number, rotation: number, mirror = false) {
    const layer = corner & 4;
    let i = corner & 3;
    if (mirror) i = 3 - i;
    return layer | ((i + rotation) & 3);
}

/** Applies a rotation and mirror to a whole pattern. */
export function transformPattern(pattern: number, corners: number, rotation: number, mirror = false) {
    let out = 0;
    for (let c = 0; c < corners; c++)
    {
        if (pattern & (1 << c)) out |= 1 << permuteCorner(c, rotation, mirror);
    }
    return out;
}

/**
 * A generated case table. Every pattern maps to the canonical case of its symmetry group,
 * plus the transform that turns the canonical case into the pattern.
 *
 * @example
 * const table = new CornerTable({ corners: 8 });
 * table.cases.length;        // 70 with rotation, 55 with mirror too
 * table.lookup(0b00010011);  // { canonical, rotation, mirror }
 */
export class CornerTable {
    readonly corners: 4 | 8;
    readonly mirror: boolean;
    /** canonical pattern per pattern */
    readonly canonical: Uint8Array;
    /** quarter turns per pattern */
    readonly rotation: Uint8Array;
    /** 1 when mirrored, per pattern */
    readonly mirrored: Uint8Array;
    /** every canonical pattern, ascending */
    readonly cases: number[];

    constructor(options: CornerTableOptions = {}) {
        this.corners = options.corners ?? 8;
        this.mirror = options.mirror ?? false;

        const size = 1 << this.corners;
        this.canonical = new Uint8Array(size);
        this.rotation = new Uint8Array(size);
        this.mirrored = new Uint8Array(size);
        const cases = new Set<number>();

        const mirrors = this.mirror ? [false, true] : [false];
        for (let pattern = 0; pattern < size; pattern++)
        {
            // smallest pattern reachable is the canonical one
            let best = pattern;
            for (const m of mirrors)
            {
                for (let r = 0; r < 4; r++)
                {
                    const t = transformPattern(pattern, this.corners, r, m);
                    if (t < best) best = t;
                }
            }

            // transform taking canonical back to pattern, no mirror preferred
            let found = false;
            for (const m of mirrors)
            {
                for (let r = 0; r < 4 && !found; r++)
                {
                    if (transformPattern(best, this.corners, r, m) === pattern)
                    {
                        this.rotation[pattern] = r;
                        this.mirrored[pattern] = m ? 1 : 0;
                        found = true;
                    }
                }
            }

            this.canonical[pattern] = best;
            cases.add(best);
        }

        this.cases = [...cases].sort((a, b) => a - b);
    }

    /** Canonical case and transform for a corner pattern. */
    lookup(pattern: number): CornerCase {
        return {
            canonical: this.canonical[pattern],
            rotation: this.rotation[pattern],
            mirror: this.mirrored[pattern] === 1,
        };
    }

    /** Builds a pattern from per-corner values, any truthy value counts as set. */
    static pattern(values: ArrayLike<unknown>) {
        let bits = 0;
        for (let i = 0; i < values.length; i++)
        {
            if (values[i]) bits |= 1 << i;
        }
        return bits;
    }
}
