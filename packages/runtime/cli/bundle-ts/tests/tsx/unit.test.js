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

describe("tsBundle with a .tsx types entry", () => {
    const name = "@papit/fixture-tsx-ts";
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
                    jsx: "preserve",
                    rootDir: "src",
                    outDir: "lib",
                    baseUrl: "src",
                    paths: { [name]: ["./index"] },
                },
                include: ["src"],
            },
            "src/index.ts": "export class Thing {\n    value = 2;\n}\n",
            "src/extra.tsx": [
                `import type { Thing } from "${name}";`,
                ``,
                `export function make(thing: Thing): Thing {`,
                `    return thing;`,
                `}`,
                ``,
                `export interface Extra { size: number }`,
                ``,
                `declare module "${name}" {`,
                `    interface Thing {`,
                `        extra?: Extra;`,
                `    }`,
                `}`,
                ``,
                `declare global {`,
                `    interface HTMLElementTagNameMap {`,
                `        "fixture-thing": HTMLElement;`,
                `    }`,
                `}`,
                ``,
            ].join("\n"),
        });
        fs.mkdirSync(path.join(root, "node_modules", "@papit"), { recursive: true });
        fs.symlinkSync(root, path.join(root, "node_modules", name), "dir");

        result = await tsBundle(new Set(["force"]), root);
    });

    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("reports no errors", () => {
        assert.strictEqual(result, undefined);
    });

    it("rolls src/extra.tsx up into lib/extra.d.ts", () => {
        const extra = read("lib/extra.d.ts");
        assert.match(extra, /export declare function make\(thing: Thing\): Thing;/);
        assert.match(extra, new RegExp(`from '${name}'`));
    });

    // API Extractor leaves augmentations out of the rollup, e.g. the JSX intrinsic elements of a react wrapper
    it("keeps the entry's module augmentations and global declarations", () => {
        const extra = read("lib/extra.d.ts");
        assert.match(extra, new RegExp(`declare module ["']${name}["'] \\{\\s*interface Thing \\{\\s*extra\\?: Extra;`));
        assert.match(extra, /declare global \{\s*interface HTMLElementTagNameMap \{\s*"fixture-thing": HTMLElement;/);
        assert.strictEqual(extra.match(/declare module/g).length, 1);
    });
});
