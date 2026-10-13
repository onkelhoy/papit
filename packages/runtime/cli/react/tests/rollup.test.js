import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { tsBundle } from "@papit/bundle-ts";
import { writeReact } from "@papit/react";

import { fixturePackage, linkReactTypes, tmp, typecheck, write } from "./helpers.js";

// API Extractor renames the element import in the rolled-up .d.ts (`Fixture` clashes with the component),
// but bundle-ts copies the `declare module "react"` block verbatim, so nothing in it may name the alias
describe("generated react-wrapper.tsx rolled up by @papit/bundle-ts", () => {
    const name = "@tmp/fixture";
    let root;
    let result;

    before(async () => {
        root = tmp();
        fixturePackage(root, name);
        write(root, {
            "package.json": {
                name,
                version: "1.0.0",
                type: "module",
                types: "./lib/bundle.d.ts",
                exports: {
                    ".": { import: "./lib/bundle.js", types: "./lib/bundle.d.ts" },
                    "./react": { import: "./lib/react-wrapper.js", types: "./lib/react-wrapper.d.ts" },
                },
            },
            "tsconfig.json": {
                compilerOptions: {
                    target: "es2020",
                    module: "esnext",
                    moduleResolution: "bundler",
                    strict: true,
                    skipLibCheck: true,
                    jsx: "react-jsx",
                    experimentalDecorators: true,
                    useDefineForClassFields: false,
                    lib: ["es2020", "dom", "dom.iterable"],
                    types: [],
                    declaration: true,
                    rootDir: "src",
                    outDir: "lib",
                    baseUrl: "src",
                    paths: { [name]: ["./index"] },
                },
                include: ["src"],
            },
        });
        linkReactTypes(root);
        fs.mkdirSync(path.join(root, "node_modules/@tmp"), { recursive: true });
        fs.symlinkSync(root, path.join(root, "node_modules", name), "dir");
        writeReact(root);
        result = await tsBundle(new Set(["force"]), root);

        write(root, {
            "consumer/usage.tsx": [
                `import "${name}/react";`,
                ``,
                `export const raw = <fixture-el click label-text="hi" open />;`,
                ``,
            ].join("\n"),
        });
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("rolls up without errors", () => {
        assert.strictEqual(result, undefined);
        assert.ok(fs.existsSync(path.join(root, "lib/react-wrapper.d.ts")));
    });

    it("a consumer using the raw tag with a renamed attribute typechecks against the built .d.ts, lib check on", () => {
        const diagnostics = typecheck([path.join(root, "consumer/usage.tsx")], {
            [name]: [path.join(root, "lib/bundle.d.ts")],
            [`${name}/react`]: [path.join(root, "lib/react-wrapper.d.ts")],
        }, { skipLibCheck: false });
        assert.deepStrictEqual(diagnostics, []);
    });
});
