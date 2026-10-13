import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";

import { tsBundle } from "@papit/bundle-ts";

describe("tsBundle on a TypeScript emit error", () => {
    let location;
    let result;

    before(async () => {
        location = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        fs.mkdirSync(path.join(location, "src"));
        fs.writeFileSync(path.join(location, "package.json"), JSON.stringify({ name: "broken", types: "./lib/bundle.d.ts" }));
        fs.writeFileSync(path.join(location, "tsconfig.json"), JSON.stringify({
            compilerOptions: { strict: true, noEmitOnError: true, declaration: true, rootDir: "src", outDir: "lib" },
            include: ["src"],
        }));
        fs.writeFileSync(path.join(location, "src", "index.ts"), "export const broken: number = \"not a number\";\n");

        result = await tsBundle(new Set(["force"]), location, {
            entryPointsArray: [{ input: path.join(location, "src", "index.ts"), output: path.join(location, "lib", "bundle.d.ts") }],
        });
    });

    after(() => {
        fs.rmSync(location, { recursive: true, force: true });
    });

    it("resolves the failed entry with the diagnostic", () => {
        assert.ok(Array.isArray(result), `expected an error array, got ${result}`);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].input, path.join(location, "src", "index.ts"));
        assert.match(result[0].logs.join("\n"), /not assignable to type 'number'/);
    });

    it("writes no declaration file", () => {
        assert.strictEqual(fs.existsSync(path.join(location, "lib", "bundle.d.ts")), false);
    });
});
