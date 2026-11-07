import { describe, it } from "node:test";
import assert from "node:assert";

import { buildTree } from "@papit/create";

describe("buildTree", () => {
    it("groups packages under their folders", () => {
        const tree = buildTree([
            { name: "@x/button", path: "web/design-system/1-foundations/button" },
            { name: "@x/input", path: "web/design-system/atoms/input" },
        ]);

        assert.strictEqual(tree.length, 1);
        const web = tree[0];
        assert.strictEqual(web.path, "web");
        const ds = web.children[0];
        assert.deepStrictEqual(ds.children.map(n => n.path), ["web/design-system/1-foundations", "web/design-system/atoms"]);
        assert.deepStrictEqual(ds.children[1].children[0], { name: "input", path: "web/design-system/atoms/input", package: "@x/input", children: [] });
    });

    it("sorts folders before packages, then by name", () => {
        const tree = buildTree([
            { name: "@x/zeta", path: "web/zeta" },
            { name: "@x/router", path: "web/tools/router" },
            { name: "@x/alpha", path: "web/alpha" },
        ]);
        assert.deepStrictEqual(tree[0].children.map(n => n.name), ["tools", "alpha", "zeta"]);
    });

    it("ignores empty paths and returns [] for no packages", () => {
        assert.deepStrictEqual(buildTree([]), []);
        assert.deepStrictEqual(buildTree([{ name: "@x/root", path: "" }]), []);
    });
});
