import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Graph } from "@papit/information";

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(content, null, 2));
}

// builds a Graph as if the CLI ran from `cwd`, without npm's prefix pointing at this repo
function graphAt(cwd) {
    const previous = process.cwd();
    const prefix = process.env.npm_config_local_prefix;
    delete process.env.npm_config_local_prefix;
    process.chdir(cwd);
    try
    {
        return new Graph();
    }
    finally
    {
        process.chdir(previous);
        if (prefix !== undefined) process.env.npm_config_local_prefix = prefix;
    }
}

describe("Graph", () => {
    let root;
    let empty;

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        empty = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));

        write(path.join(root, "package.json"), { name: "@scope/root", workspaces: ["packages/**/*"] });
        write(path.join(root, "packages/a/package.json"), { name: "@scope/a", papit: { type: "node" } });
        write(path.join(root, "packages/app/package.json"), { name: "@scope/app", dependencies: { "@scope/a": "0.0.1" }, papit: { type: "browser" } });
        write(path.join(root, "packages/a/asset/template/package.json"), { name: "@scope/asset-copy" });
        write(path.join(root, "packages/app/dist/lib/@scope/a/package.json"), { name: "@scope/dist-copy" });
        write(path.join(root, "packages/app/node_modules/playwright-core/package.json"), { name: "playwright-core" });
        write(path.join(root, "packages/a/.temp/build/package.json"), { name: "@scope/temp-copy" });
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(empty, { recursive: true, force: true });
    });

    it("finds the workspace packages", () => {
        const graph = graphAt(root);
        assert.strictEqual(graph.ERROR, false);
        assert.ok(graph.get("@scope/a"));
        assert.ok(graph.get("@scope/app"));
        assert.deepStrictEqual(graph.getAncestors("@scope/app").map(n => n.name), ["@scope/a"]);
    });

    it("ignores package.json files under node_modules, dist, .temp and asset", () => {
        const graph = graphAt(root);
        assert.deepStrictEqual(
            graph.nodes.map(n => n.name).sort(),
            ["@scope/a", "@scope/app", "@scope/root"],
        );
    });

    it("flags ERROR quietly when there is no root package.json", () => {
        const error = mock.method(console, "error", () => { });
        try
        {
            const graph = graphAt(empty);
            assert.strictEqual(graph.ERROR, true);
            assert.strictEqual(error.mock.callCount(), 0);
        }
        finally
        {
            error.mock.restore();
        }
    });
});

describe("Graph.getOrder", () => {
    let root;

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));

        write(path.join(root, "package.json"), { name: "@scope/root", workspaces: ["packages/**/*"] });
        write(path.join(root, "packages/cycle-a/package.json"), { name: "@scope/cycle-a", devDependencies: { "@scope/cycle-b": "0.0.1" } });
        write(path.join(root, "packages/cycle-b/package.json"), { name: "@scope/cycle-b", devDependencies: { "@scope/cycle-a": "0.0.1" } });
        write(path.join(root, "packages/app/package.json"), { name: "@scope/app", dependencies: { "@scope/lib": "0.0.1" }, devDependencies: { "@scope/cycle-a": "0.0.1" } });
        write(path.join(root, "packages/lib/package.json"), { name: "@scope/lib", devDependencies: { "@scope/cycle-a": "0.0.1" } });
        write(path.join(root, "packages/early/package.json"), { name: "@scope/early", devDependencies: { "@scope/late": "0.0.1" } });
        write(path.join(root, "packages/late/package.json"), { name: "@scope/late", dependencies: { "@scope/early": "0.0.1" } });
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it("keeps dependencies first when a devDependency cycle blocks the sort", () => {
        const graph = graphAt(root);
        const batches = graph.getOrder({
            packages: graph.nodes.filter(node => node.type !== "root"),
            sortFilter: ["dependencies", "peerDependencies", "devDependencies"],
        });
        const batchOf = name => batches.findIndex(batch => batch.some(node => node.name === name));

        assert.ok(batchOf("@scope/lib") < batchOf("@scope/app"));
        assert.strictEqual(batches.flat().length, 6);
    });

    it("keeps a devDependency on a package found later as a devDependency", () => {
        const graph = graphAt(root);
        const batches = graph.getOrder({ packages: graph.nodes.filter(node => node.type !== "root") });
        const batchOf = name => batches.findIndex(batch => batch.some(node => node.name === name));

        assert.ok(batchOf("@scope/early") < batchOf("@scope/late"));
    });
});
