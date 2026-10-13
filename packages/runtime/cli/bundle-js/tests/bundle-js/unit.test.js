import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getEntryPoints, getTSconfig, jsBundle } from "@papit/bundle-js";

/** Writes `files` (relative path → content) under `root`. */
function write(root, files) {
    for (const [file, content] of Object.entries(files))
    {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
}

describe("jsBundle with a secondary entry that imports the package by its own name", () => {
    let root;
    const read = (file) => fs.readFileSync(path.join(root, file), "utf-8");

    before(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        write(root, {
            "package.json": {
                name: "@papit/fixture-self",
                version: "1.0.0",
                type: "module",
                main: "./lib/bundle.js",
                exports: {
                    ".": { import: "./lib/bundle.js" },
                    "./extra": { import: "./lib/extra.js" },
                },
                papit: { type: "web-component" },
            },
            "tsconfig.json": {
                compilerOptions: { baseUrl: "src", outDir: "lib", paths: { "@papit/fixture-self": ["./index"] } },
                include: ["src"],
            },
            "src/index.ts": `customElements.define("fixture-self", class extends HTMLElement {});\nexport const value = 1;`,
            "src/extra.ts": `import { value } from "@papit/fixture-self";\nexport const extra = value + 1;`,
        });

        const errors = await jsBundle({ has: (flag) => flag === "force" || flag === "dev" }, root);
        assert.deepStrictEqual(errors, []);
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("keeps the self import external instead of inlining the main entry", () => {
        const extra = read("lib/extra.js");
        assert.match(extra, /from\s*"@papit\/fixture-self"/);
        assert.doesNotMatch(extra, /customElements\.define/);
    });

    it("still bundles the main entry itself", () => {
        assert.match(read("lib/bundle.js"), /customElements\.define/);
    });
});

describe("a .tsx entry", () => {
    let root;
    const read = (file) => fs.readFileSync(path.join(root, file), "utf-8");
    const packageJSON = {
        name: "@papit/fixture-tsx",
        version: "1.0.0",
        type: "module",
        main: "./lib/bundle.js",
        exports: {
            ".": { import: "./lib/bundle.js", types: "./lib/bundle.d.ts" },
            "./extra": { import: "./lib/extra.js", types: "./lib/extra.d.ts" },
        },
        peerDependencies: { react: "^19" },
        papit: { type: "web-component" },
    };

    before(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        write(root, {
            "package.json": packageJSON,
            "tsconfig.json": {
                compilerOptions: { baseUrl: "src", outDir: "lib", jsx: "react-jsx", paths: { "@papit/fixture-tsx": ["./index"] } },
                include: ["src"],
            },
            "src/index.ts": `customElements.define("fixture-tsx", class extends HTMLElement {});\nexport const value = 1;`,
            "src/extra.tsx": `import { value } from "@papit/fixture-tsx";\nexport function Extra() {\n    return <fixture-tsx data-value={value} />;\n}`,
        });
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("resolves src/x.tsx when src/x.ts doesn't exist, for the import and the types entry", () => {
        const { entries } = getEntryPoints(root, packageJSON, getTSconfig({ has: () => false }, root));
        assert.strictEqual(entries["./extra"].import.input, path.join(root, "src/extra.tsx"));
        assert.strictEqual(entries["./extra"].types.input, path.join(root, "src/extra.tsx"));
        assert.strictEqual(entries.bundle.import.input, path.join(root, "src/index.ts"));
    });

    it("bundles it with the JSX compiled and the self import kept external", async () => {
        const errors = await jsBundle({ has: (flag) => flag === "force" || flag === "dev" }, root);
        assert.deepStrictEqual(errors, []);

        const extra = read("lib/extra.js");
        assert.match(extra, /from\s*"react\/jsx-runtime"/);
        assert.match(extra, /from\s*"@papit\/fixture-tsx"/);
        assert.doesNotMatch(extra, /<fixture-tsx/);
        assert.doesNotMatch(extra, /customElements\.define/);
    });
});
