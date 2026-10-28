import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../lib/bundle.js");

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(content, null, 2));
}

// meta() reads the workspace from the process location, so it runs in its own process
function meta(cwd, print = "") {
    const env = { ...process.env, PWD: cwd };
    delete env.npm_config_local_prefix;
    return spawnSync(process.execPath, [
        "--input-type=module",
        "-e",
        `const { meta } = await import(${JSON.stringify(BUNDLE)}); const data = await meta(); ${print}`,
    ], { cwd, env, encoding: "utf-8" });
}

describe("meta", () => {
    let root;

    before(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));
        write(path.join(root, "package.json"), { name: "@scope/root", workspaces: ["packages/*"] });
        write(path.join(root, "packages/plain/package.json"), { name: "@scope/plain", version: "0.0.1" });
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it("accepts workspace packages without a papit field", () => {
        const result = meta(root);
        assert.strictEqual(result.status, 0, result.stderr);
    });

    it("maps the dependencies of external dependencies, nested versions first", () => {
        const app = path.join(root, "packages/app");
        write(path.join(app, "package.json"), { name: "@scope/app", version: "0.0.1", dependencies: { "@other/sidebar": "1.0.0" } });
        write(path.join(root, "node_modules/@other/sidebar/package.json"), { name: "@other/sidebar", main: "index.js", dependencies: { "@other/treeview": "1.0.0", "@other/popover": "2.0.0" } });
        write(path.join(root, "node_modules/@other/treeview/package.json"), { name: "@other/treeview", main: "index.js" });
        write(path.join(root, "node_modules/@other/sidebar/node_modules/@other/popover/package.json"), { name: "@other/popover", main: "nested.js" });
        write(path.join(root, "node_modules/@other/popover/package.json"), { name: "@other/popover", main: "root.js" });

        const result = meta(app, "console.log(JSON.stringify(data.importmap.imports));");
        assert.strictEqual(result.status, 0, result.stderr);
        const imports = JSON.parse(result.stdout.trim().split("\n").at(-1));

        assert.ok(imports["@other/sidebar"]?.endsWith("/node_modules/@other/sidebar/index.js"));
        assert.ok(imports["@other/treeview"]?.endsWith("/node_modules/@other/treeview/index.js"));
        assert.ok(imports["@other/popover"]?.endsWith("/node_modules/@other/sidebar/node_modules/@other/popover/nested.js"));
    });
});
