import { describe, it } from "node:test";
import assert from "node:assert";
import { Random } from "@papit/random";
import { solve } from "@papit/wave-function-collapse";

// w by h grid, 4 neighbours, side = direction 0..3
function grid(w, h, count, rule, weight) {
    const links = [];
    for (let y = 0; y < h; y++)
    {
        for (let x = 0; x < w; x++)
        {
            const list = [];
            if (x + 1 < w) list.push({ slot: y * w + x + 1, side: 0 });
            if (y + 1 < h) list.push({ slot: (y + 1) * w + x, side: 1 });
            if (x > 0) list.push({ slot: y * w + x - 1, side: 2 });
            if (y > 0) list.push({ slot: (y - 1) * w + x, side: 3 });
            links.push(list);
        }
    }
    return {
        slotCount: w * h,
        options: () => count,
        weight,
        links: (s) => links[s],
        compatible: (s, o, link, other) => rule(o, other, link.side),
    };
}

const valid = (problem, assignment) => {
    for (let s = 0; s < problem.slotCount; s++)
    {
        for (const link of problem.links(s))
        {
            if (!problem.compatible(s, assignment[s], link, assignment[link.slot])) return false;
        }
    }
    return true;
};

describe("solve", () => {
    it("meets an 'equal neighbours' rule: one option everywhere", () => {
        const p = grid(6, 6, 4, (a, b) => a === b);
        const { assignment, conflicts } = solve(p, { random: new Random(1) });
        assert.strictEqual(new Set(assignment).size, 1);
        assert.deepStrictEqual(conflicts, []);
    });

    it("meets a checkerboard rule", () => {
        const p = grid(7, 5, 2, (a, b) => a !== b);
        const { assignment, conflicts } = solve(p, { random: new Random(2) });
        assert.ok(valid(p, assignment));
        assert.deepStrictEqual(conflicts, []);
    });

    it("meets a directional rule (stripes: left/right differ, up/down equal)", () => {
        const p = grid(6, 6, 3, (a, b, side) => side % 2 === 0 ? a !== b : a === b);
        const { assignment, conflicts } = solve(p, { random: new Random(3) });
        assert.ok(valid(p, assignment));
        assert.deepStrictEqual(conflicts, []);
    });

    it("is deterministic from the seed", () => {
        const p = grid(8, 8, 3, (a, b) => Math.abs(a - b) <= 1);
        const a = solve(p, { random: new Random("x") }).assignment;
        const b = solve(p, { random: new Random("x") }).assignment;
        const c = solve(p, { random: new Random("y") }).assignment;
        assert.deepStrictEqual(a, b);
        assert.notDeepStrictEqual(a, c);
    });

    it("never picks a zero weight option when others fit", () => {
        const p = grid(5, 5, 3, () => true, (s, o) => o === 1 ? 0 : 1);
        const { assignment } = solve(p, { random: new Random(4) });
        assert.ok(!assignment.includes(1));
    });

    it("reports conflicts on an impossible rule and still assigns every slot", () => {
        // odd cycle can't be 2-coloured
        const links = [[{ slot: 1, side: 0 }, { slot: 2, side: 0 }], [{ slot: 0, side: 0 }, { slot: 2, side: 0 }], [{ slot: 0, side: 0 }, { slot: 1, side: 0 }]];
        const p = { slotCount: 3, options: () => 2, links: (s) => links[s], compatible: (s, o, l, other) => o !== other };
        const { assignment, conflicts } = solve(p, { random: new Random(5) });
        assert.ok(conflicts.length > 0);
        assert.ok([...assignment].every((o) => o === 0 || o === 1));
    });

    it("region: solves only the region and fits it to fixed slots", () => {
        const p = grid(5, 1, 3, (a, b) => a === b);
        const fixed = [2, 2, -1, 2, 2];
        const { assignment } = solve(p, { random: new Random(6), region: [2], fixed });
        assert.deepStrictEqual([...assignment], [2, 2, 2, 2, 2]);
    });

    it("slots with no options stay -1", () => {
        const p = { slotCount: 2, options: (s) => s === 0 ? 0 : 2, links: () => [], compatible: () => true };
        const { assignment } = solve(p, { random: new Random(7) });
        assert.strictEqual(assignment[0], -1);
        assert.ok(assignment[1] >= 0);
    });
});
