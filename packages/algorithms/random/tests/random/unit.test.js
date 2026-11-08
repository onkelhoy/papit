import { describe, it } from "node:test";
import assert from "node:assert";
import { Random, hash } from "@papit/random";

const take = (rng, n) => Array.from({ length: n }, () => rng.uint());

describe("determinism", () => {
    it("replays the same sequence from the same seed", () => {
        assert.deepStrictEqual(take(new Random(42), 50), take(new Random(42), 50));
        assert.deepStrictEqual(take(new Random("town"), 50), take(new Random("town"), 50));
    });

    it("gives different sequences for different seeds", () => {
        assert.notDeepStrictEqual(take(new Random(1), 10), take(new Random(2), 10));
    });

    it("stays fixed across versions", () => {
        // pinned output, changing it breaks saved worlds and multiplayer
        assert.deepStrictEqual(take(new Random(0), 3), [4205396811, 3543653536, 1222415357]);
        assert.strictEqual(hash(7), 7);
        assert.strictEqual(hash("a"), 444641715);
        assert.notStrictEqual(hash("a"), hash("b"));
    });

    it("restores from state", () => {
        const rng = new Random(9);
        take(rng, 5);
        const state = rng.state;
        const expected = take(rng, 10);
        rng.state = state;
        assert.deepStrictEqual(take(rng, 10), expected);
    });
});

describe("fork", () => {
    it("does not depend on how much the parent was used", () => {
        const a = new Random(5);
        const b = new Random(5);
        take(b, 100);
        assert.deepStrictEqual(take(a.fork("chunk:1,2"), 10), take(b.fork("chunk:1,2"), 10));
    });

    it("does not advance the parent", () => {
        const a = new Random(5);
        const b = new Random(5);
        a.fork("x");
        assert.deepStrictEqual(take(a, 5), take(b, 5));
    });

    it("gives different streams for different keys", () => {
        const rng = new Random(5);
        assert.notDeepStrictEqual(take(rng.fork(1), 10), take(rng.fork(2), 10));
    });
});

describe("ranges", () => {
    const rng = new Random(123);

    it("next is in [0, 1) and roughly uniform", () => {
        let sum = 0;
        for (let i = 0; i < 10000; i++)
        {
            const v = rng.next();
            assert.ok(v >= 0 && v < 1);
            sum += v;
        }
        assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
    });

    it("int covers [min, max) and nothing else", () => {
        const seen = new Set();
        for (let i = 0; i < 1000; i++) seen.add(rng.int(-2, 3));
        assert.deepStrictEqual([...seen].sort((a, b) => a - b), [-2, -1, 0, 1, 2]);
        assert.strictEqual(rng.int(4, 4), 4);
        assert.strictEqual(rng.int(5, 1), 5);
    });

    it("float stays in range", () => {
        for (let i = 0; i < 1000; i++)
        {
            const v = rng.float(-1, 1);
            assert.ok(v >= -1 && v < 1);
        }
    });
});

describe("pick, weighted, shuffle", () => {
    it("pick handles empty input", () => {
        assert.strictEqual(new Random(1).pick([]), undefined);
        assert.strictEqual(new Random(1).pick(["only"]), "only");
    });

    it("weighted follows the weights", () => {
        const rng = new Random(77);
        const counts = [0, 0, 0];
        for (let i = 0; i < 10000; i++) counts[rng.weightedIndex([1, 0, 3])]++;
        assert.strictEqual(counts[1], 0);
        assert.ok(Math.abs(counts[2] / 10000 - 0.75) < 0.03);
    });

    it("weighted handles no or zero weights", () => {
        const rng = new Random(1);
        assert.strictEqual(rng.weightedIndex([]), -1);
        assert.strictEqual(rng.weightedIndex([0, -2]), -1);
        assert.strictEqual(rng.weighted(["a", "b"], [0, 0]), undefined);
        assert.strictEqual(rng.weighted(["a", "b"], [0, 1]), "b");
    });

    it("shuffle keeps the elements and is deterministic", () => {
        const a = new Random(3).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
        const b = new Random(3).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
        assert.deepStrictEqual(a, b);
        assert.deepStrictEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
    });
});
