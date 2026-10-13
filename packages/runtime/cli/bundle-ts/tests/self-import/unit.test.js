import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";

import { tsBundle } from "@papit/bundle-ts";

/** Writes `files` (relative path → content) under `root`. */
function write(root, files) {
    for (const [file, content] of Object.entries(files))
    {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
}

describe("tsBundle with a secondary types entry that imports the package by its own name", () => {
    const name = "@papit/fixture-self-ts";
    let root;
    let result;
    const read = (file) => fs.readFileSync(path.join(root, file), "utf-8");

    before(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        write(root, {
            "package.json": {
                name,
                version: "1.0.0",
                type: "module",
                types: "./lib/bundle.d.ts",
                exports: {
                    ".": { import: "./lib/bundle.js", types: "./lib/bundle.d.ts" },
                    "./extra": { import: "./lib/extra.js", types: "./lib/extra.d.ts" },
                },
            },
            "tsconfig.json": {
                compilerOptions: {
                    target: "es2020",
                    module: "esnext",
                    moduleResolution: "bundler",
                    strict: true,
                    declaration: true,
                    skipLibCheck: true,
                    rootDir: "src",
                    outDir: "lib",
                    baseUrl: "src",
                    paths: { [name]: ["./index"] },
                },
                include: ["src"],
            },
            "src/index.ts": "export class Thing {\n    private secret = 1;\n    value = 2;\n}\n",
            "src/extra.ts": `import type { Thing } from "${name}";\n\nexport function make(thing: Thing): Thing {\n    return thing;\n}\n`,
        });
        // the workspace symlink npm creates for every package
        fs.mkdirSync(path.join(root, "node_modules", "@papit"), { recursive: true });
        fs.symlinkSync(root, path.join(root, "node_modules", name), "dir");

        result = await tsBundle(new Set(["force"]), root);
    });

    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("reports no errors", () => {
        assert.strictEqual(result, undefined);
    });

    it("imports the element type by package name instead of copying the class", () => {
        const extra = read("lib/extra.d.ts");
        assert.match(extra, new RegExp(`from '${name}'`));
        assert.doesNotMatch(extra, /declare class/);
    });

    it("still rolls the class into the main entry", () => {
        const bundle = read("lib/bundle.d.ts");
        assert.match(bundle, /export declare class Thing/);
        assert.doesNotMatch(bundle, new RegExp(name));
    });
});
