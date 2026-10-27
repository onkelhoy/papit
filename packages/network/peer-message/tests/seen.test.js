import { describe, it } from "node:test";
import assert from "node:assert";

import { Seen } from "@papit/peer-message";

describe("Seen", () => {

    it("returns true the first time and false for duplicates", () => {
        const seen = new Seen();
        assert.strictEqual(seen.check("a"), true);
        assert.strictEqual(seen.check("a"), false);
        assert.strictEqual(seen.check("b"), true);
        assert.strictEqual(seen.check("a"), false);
    });

    it("evicts the oldest id past the limit", () => {
        const seen = new Seen(2);
        seen.check("a");
        seen.check("b");
        seen.check("c"); // evicts "a"

        assert.strictEqual(seen.check("c"), false);
        assert.strictEqual(seen.check("b"), false);
        assert.strictEqual(seen.check("a"), true); // forgotten, seen again, evicts "b"
        assert.strictEqual(seen.check("b"), true);
    });

    it("defaults to remembering 1024 ids", () => {
        const seen = new Seen();
        for (let i = 0; i < 1024; i++) seen.check(String(i));
        assert.strictEqual(seen.check("0"), false);

        seen.check("new"); // a duplicate check does not refresh "0", so it is still the oldest
        assert.strictEqual(seen.check("1"), false);
        assert.strictEqual(seen.check("0"), true);
    });
});
