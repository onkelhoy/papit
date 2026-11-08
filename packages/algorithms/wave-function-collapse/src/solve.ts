import type { Problem, SolveOptions, Solution } from "./types";

/**
 * Wave function collapse: repeatedly pick the most constrained open slot, collapse it to a
 * weighted random option, and remove options from neighbours that no longer fit.
 * On a contradiction the slot takes a weighted pick ignoring its neighbours and is reported
 * in `conflicts` (no backtracking yet). Deterministic for the same problem and seed.
 *
 * @example
 * const { assignment } = solve(problem, { random: new Random("map") });
 */
export function solve(problem: Problem, options: SolveOptions): Solution {
    const { random } = options;
    const n = problem.slotCount;
    const weight = problem.weight ?? (() => 1);
    const assignment = new Int32Array(n).fill(-1);
    const conflicts: number[] = [];

    // domains: remaining options per slot
    const domains: Uint8Array[] = new Array(n);
    const remaining = new Int32Array(n);
    const open = new Uint8Array(n);

    const region = options.region ? new Set(options.region) : null;
    for (let s = 0; s < n; s++)
    {
        const count = problem.options(s);
        domains[s] = new Uint8Array(count);
        if (region && !region.has(s))
        {
            const f = options.fixed?.[s] ?? -1;
            if (f >= 0 && f < count)
            {
                domains[s][f] = 1;
                remaining[s] = 1;
                assignment[s] = f;
            }
            continue;
        }
        domains[s].fill(1);
        remaining[s] = count;
        if (count > 0) open[s] = 1;
    }

    // does option `o` at slot `s` have a supporter in every neighbour's domain
    const supported = (s: number, o: number) => {
        for (const link of problem.links(s))
        {
            const d = domains[link.slot];
            if (!d || d.length === 0 || remaining[link.slot] === 0) continue;
            let any = false;
            for (let q = 0; q < d.length && !any; q++)
            {
                if (d[q] && problem.compatible(s, o, link, q)) any = true;
            }
            if (!any) return false;
        }
        return true;
    };

    const propagate = (start: number[]) => {
        const queue = start.slice();
        while (queue.length)
        {
            const changed = queue.shift()!;
            for (const link of problem.links(changed))
            {
                const t = link.slot;
                if (!open[t]) continue;
                const d = domains[t];
                let removed = false;
                for (let o = 0; o < d.length; o++)
                {
                    if (d[o] && !supported(t, o))
                    {
                        d[o] = 0;
                        remaining[t]--;
                        removed = true;
                    }
                }
                if (remaining[t] === 0)
                {
                    // contradiction: ignore neighbours for this slot
                    conflicts.push(t);
                    collapse(t, true);
                    queue.push(t);
                }
                else if (removed)
                {
                    queue.push(t);
                }
            }
        }
    };

    const collapse = (s: number, ignore = false) => {
        const d = domains[s];
        const weights = new Float64Array(d.length);
        for (let o = 0; o < d.length; o++) weights[o] = ignore || d[o] ? Math.max(0, weight(s, o)) : 0;
        let pick = random.weightedIndex(weights);
        if (pick < 0) pick = ignore ? 0 : d.indexOf(1);
        d.fill(0);
        d[pick] = 1;
        remaining[s] = 1;
        assignment[s] = pick;
        open[s] = 0;
    };

    // trim the start domains against fixed neighbours
    const initial: number[] = [];
    for (let s = 0; s < n; s++) if (!open[s] && remaining[s] === 1) initial.push(s);
    for (let s = 0; s < n; s++) if (open[s]) initial.push(s);
    propagate(initial);

    while (true)
    {
        // most constrained open slot, lowest index on ties
        let best = -1;
        for (let s = 0; s < n; s++)
        {
            if (!open[s]) continue;
            if (best < 0 || remaining[s] < remaining[best]) best = s;
        }
        if (best < 0) break;
        collapse(best);
        propagate([best]);
    }

    return { assignment, conflicts };
}
