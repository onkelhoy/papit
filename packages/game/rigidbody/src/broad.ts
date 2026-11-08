import { Vector3 } from "@papit/vector";
import type { RigidBody } from "./body";

/** static or asleep: a pair of these needs no contact */
function still(body: RigidBody) { return body.isStatic || body.sleeping; }

function ascending(a: number, b: number) { return a - b; }

/**
 * Sweep and prune on x: bodies sorted by their min x (insertion sort, cheap when
 * little moves between steps), then only overlapping bounds become pairs.
 */
export class BroadPhase {
    /** candidate pairs as `i * count + j`, `i < j` body indices, ascending */
    readonly pairs: number[] = [];

    private readonly mins: Vector3[] = [];
    private readonly maxs: Vector3[] = [];
    private readonly order: number[] = [];

    /** Fills `pairs` for `bodies`, returns how many. */
    update(bodies: readonly RigidBody[]): number {
        const count = bodies.length;
        const { mins, maxs, order, pairs } = this;
        while (mins.length < count)
        {
            mins.push(new Vector3(0, 0, 0));
            maxs.push(new Vector3(0, 0, 0));
        }
        if (order.length !== count)
        {
            order.length = 0;
            for (let i = 0; i < count; i++) order.push(i);
        }
        for (let i = 0; i < count; i++) bodies[i].bounds(mins[i], maxs[i]);

        // insertion sort by min x
        for (let i = 1; i < count; i++)
        {
            const index = order[i];
            const x = mins[index].x;
            let k = i - 1;
            while (k >= 0 && mins[order[k]].x > x)
            {
                order[k + 1] = order[k];
                k--;
            }
            order[k + 1] = index;
        }

        pairs.length = 0;
        for (let i = 0; i < count; i++)
        {
            const a = order[i];
            const minA = mins[a], maxA = maxs[a];
            for (let k = i + 1; k < count; k++)
            {
                const b = order[k];
                const minB = mins[b], maxB = maxs[b];
                if (minB.x > maxA.x) break;
                if (minB.y > maxA.y || minA.y > maxB.y) continue;
                if (minB.z > maxA.z || minA.z > maxB.z) continue;
                if (still(bodies[a]) && still(bodies[b])) continue;
                pairs.push(a < b ? a * count + b : b * count + a);
            }
        }
        // same order as a brute force i < j loop, keeps the solver deterministic
        pairs.sort(ascending);
        return pairs.length;
    }
}
