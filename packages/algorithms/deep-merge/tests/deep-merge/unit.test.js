import { describe, it } from "node:test";
import assert from "node:assert";
import { deepMerge, deepMergeTwo } from "@papit/deep-merge";

describe("deepMerge", () => {
    it("merges nested objects, later values winning", () => {
        const result = deepMerge({ a: 1, n: { x: 1 } }, { n: { y: 2 } }, { a: 3, n: { x: 9 } });
        assert.deepStrictEqual(result, { a: 3, n: { x: 9, y: 2 } });
    });
});

describe("prototype keys", () => {
    it("ignores a JSON-parsed __proto__ payload", () => {
        const result = deepMerge({ a: 1 }, JSON.parse('{"__proto__": {"polluted": true}, "b": 2}'));

        assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
        assert.strictEqual(result.polluted, undefined);
        assert.strictEqual(({}).polluted, undefined);
        assert.deepStrictEqual(result, { a: 1, b: 2 });
    });

    it("ignores __proto__ in nested objects", () => {
        const result = deepMerge({ n: { x: 1 } }, JSON.parse('{"n": {"__proto__": {"polluted": true}, "y": 2}}'));

        assert.strictEqual(Object.getPrototypeOf(result.n), Object.prototype);
        assert.strictEqual(result.n.polluted, undefined);
        assert.deepStrictEqual(result, { n: { x: 1, y: 2 } });
    });

    it("skips constructor keys", () => {
        const result = deepMerge({ a: 1 }, JSON.parse('{"constructor": {"prototype": {"polluted": true}}}'));

        assert.strictEqual(Object.hasOwn(result, "constructor"), false);
        assert.strictEqual(result.constructor, Object);
        assert.strictEqual(({}).polluted, undefined);
    });

    it("skips prototype keys", () => {
        const result = deepMergeTwo({ a: 1 }, JSON.parse('{"prototype": {"polluted": true}}'));

        assert.strictEqual(Object.hasOwn(result, "prototype"), false);
        assert.deepStrictEqual(result, { a: 1 });
    });
});
