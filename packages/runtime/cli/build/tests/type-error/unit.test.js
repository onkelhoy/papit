import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";

const bin = path.join(import.meta.dirname, "..", "..", "lib", "bin.js");

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 4));
}

describe("@papit/build --error with a TypeScript error", () => {
    let root;
    let pkg;
    let result;

    before(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));
        pkg = path.join(root, "packages", "broken");

        write(path.join(root, "package.json"), { name: "@fixture/root", private: true, workspaces: ["packages/*"] });
        write(path.join(pkg, "package.json"), {
            name: "@fixture/broken",
            version: "0.0.0",
            type: "module",
            exports: { ".": { import: "./lib/bundle.js", types: "./lib/bundle.d.ts" } },
            papit: { type: "node" },
        });
        write(path.join(pkg, "tsconfig.json"), {
            compilerOptions: {
                target: "es2022",
                module: "esnext",
                moduleResolution: "bundler",
                noEmitOnError: true,
                skipLibCheck: true,
                strict: true,
                outDir: "lib",
                rootDir: "src",
                declaration: true,
            },
            include: ["src"],
        });
        write(path.join(pkg, "src", "index.ts"), "export const broken: number = \"not a number\";\n");

        const env = { ...process.env, PWD: pkg };
        delete env.npm_config_local_prefix;

        result = spawnSync(process.execPath, [bin, "--error", "--ci"], { cwd: pkg, env, encoding: "utf-8" });
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it("writes no declaration file", () => {
        assert.strictEqual(fs.existsSync(path.join(pkg, "lib", "bundle.d.ts")), false);
    });

    it("does not report success", () => {
        assert.doesNotMatch(result.stdout, /success/);
    });

    it("exits non-zero", () => {
        assert.notStrictEqual(result.status, 0);
    });
});
