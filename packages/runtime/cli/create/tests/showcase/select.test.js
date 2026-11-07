import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { selectPackages, packagePath, packageTypes, globToRegExp } from "@papit/create";

let root;
const source = (relative, papit = {}, views = false) => {
    const location = path.join(root, "packages", relative);
    fs.mkdirSync(location, { recursive: true });
    if (views) fs.mkdirSync(path.join(location, "views"));
    return { name: "@x/" + path.basename(relative), location, packageJSON: { papit } };
};

let button, input, lexer, skipped, typed;
before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-select-"));
    button = source("web/design-system/1-foundations/button", { type: "web-component" }, true);
    input = source("web/design-system/atoms/input", { type: "web-component" });
    lexer = source("runtime/lexer", { type: "node" });
    skipped = source("web/old", { type: "web-component", skip: true }, true);
    typed = source("game/engine", { type: { main: "browser", bin: "node" } });
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("selectPackages", () => {
    it("keeps everything but skipped packages by default", () => {
        assert.deepStrictEqual(selectPackages(root, [button, input, lexer, skipped]), [button, input, lexer]);
    });

    it("filters by papit type, string or object form", () => {
        assert.deepStrictEqual(selectPackages(root, [button, lexer, typed], { types: ["web-component"] }), [button]);
        assert.deepStrictEqual(selectPackages(root, [button, lexer, typed], { types: ["browser"] }), [typed]);
    });

    it("can require a views folder", () => {
        assert.deepStrictEqual(selectPackages(root, [button, input, lexer], { viewsOnly: true }), [button]);
    });

    it("applies include and exclude globs", () => {
        const all = [button, input, lexer];
        assert.deepStrictEqual(selectPackages(root, all, { include: ["web/design-system/**"] }), [button, input]);
        assert.deepStrictEqual(selectPackages(root, all, { include: ["web/design-system"] }), [button, input]);
        assert.deepStrictEqual(selectPackages(root, all, { exclude: ["**/atoms/*"] }), [button, lexer]);
    });

    it("drops packages outside packages/", () => {
        const outside = { name: "x", location: path.join(root, "bin"), packageJSON: {} };
        assert.deepStrictEqual(selectPackages(root, [outside]), []);
    });
});

describe("helpers", () => {
    it("packagePath uses forward slashes", () => {
        assert.strictEqual(packagePath(root, button.location), "web/design-system/1-foundations/button");
    });

    it("packageTypes dedupes the object form", () => {
        assert.deepStrictEqual(packageTypes({ ...typed, packageJSON: { papit: { type: { a: "node", b: "node" } } } }), ["node"]);
        assert.deepStrictEqual(packageTypes({ ...typed, packageJSON: {} }), []);
    });

    it("globToRegExp keeps * inside one folder", () => {
        assert.ok(globToRegExp("web/*").test("web/router"));
        assert.ok(!globToRegExp("web/*").test("web/tools/router"));
        assert.ok(globToRegExp("**/router").test("router"));
    });
});
