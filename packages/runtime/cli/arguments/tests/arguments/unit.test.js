import { describe, it } from "node:test";
import assert from "node:assert";
import { Args } from "@papit/arguments";

describe("Args", () => {
    it("a bare flag is set but has no value", () => {
        const args = new Args(["--package", "--type=node"]);
        assert.ok(args.has("package"));
        assert.strictEqual(args.string("package"), undefined);
        assert.strictEqual(args.string("package") ?? args.string("type"), "node");
    });

    it("a flag takes the next argument as its value", () => {
        assert.strictEqual(new Args(["--name", "foo"]).string("name"), "foo");
    });

    it("an island never takes the next argument", () => {
        const args = new Args(["--install", "foo"], ["install"]);
        assert.ok(args.has("install"));
        assert.deepStrictEqual(args.values, ["foo"]);
    });
});
