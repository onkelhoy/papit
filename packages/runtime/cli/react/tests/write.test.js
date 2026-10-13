import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { MARKER, writeReact } from "@papit/react";

import { fixturePackage, tmp, write } from "./helpers.js";

const bin = fileURLToPath(new URL("../lib/bin.js", import.meta.url));

describe("writeReact", () => {
    let root;
    const file = () => path.join(root, "src/react-wrapper.tsx");
    const read = (target = file()) => fs.readFileSync(target, "utf8");

    before(() => {
        root = tmp();
        fixturePackage(root);
    });
    beforeEach(() => ["src/react-wrapper.tsx", "src/react-wrapper.ts"].forEach(name => fs.rmSync(path.join(root, name), { force: true })));
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("writes src/react-wrapper.tsx by default", () => {
        assert.deepStrictEqual(writeReact(root), { file: file(), status: "written" });
        assert.deepStrictEqual(read().split("\n").slice(0, 2), [`"use client";`, MARKER]);
    });

    it("overwrites a file that still has the marker after the directive", () => {
        write(root, { "src/react-wrapper.tsx": `"use client";\n${MARKER}\nexport const stale = true;\n` });
        assert.strictEqual(writeReact(root).status, "written");
        assert.doesNotMatch(read(), /stale/);
        assert.match(read(), /export function Fixture\(/);
    });

    it("overwrites a file with the marker on the first line", () => {
        write(root, { "src/react-wrapper.tsx": `${MARKER}\nexport const stale = true;\n` });
        assert.strictEqual(writeReact(root).status, "written");
        assert.doesNotMatch(read(), /stale/);
    });

    it("leaves a file without the marker untouched, directive or not", () => {
        const own = `"use client";\n// taken over by hand\nexport const mine = true;\n`;
        write(root, { "src/react-wrapper.tsx": own });
        assert.deepStrictEqual(writeReact(root), { file: file(), status: "skipped" });
        assert.strictEqual(read(), own);
    });

    it("deletes a generated src/react-wrapper.ts the .tsx replaces", () => {
        const stale = path.join(root, "src/react-wrapper.ts");
        write(root, { "src/react-wrapper.ts": `${MARKER}\nexport const stale = true;\n` });
        assert.deepStrictEqual(writeReact(root), { file: file(), status: "written", stale: { file: stale, removed: true } });
        assert.ok(!fs.existsSync(stale));
    });

    it("keeps a src/react-wrapper.ts taken over by hand, and reports it", () => {
        const stale = path.join(root, "src/react-wrapper.ts");
        const own = "// mine\nexport const mine = true;\n";
        write(root, { "src/react-wrapper.ts": own });
        assert.deepStrictEqual(writeReact(root), { file: file(), status: "written", stale: { file: stale, removed: false } });
        assert.strictEqual(read(stale), own);
    });

    it("leaves src/react-wrapper.ts alone when writing to another output", () => {
        const stale = path.join(root, "src/react-wrapper.ts");
        write(root, { "src/react-wrapper.ts": `${MARKER}\nexport const stale = true;\n` });
        assert.deepStrictEqual(writeReact(root, { output: "out/other.tsx" }), { file: path.join(root, "out/other.tsx"), status: "written" });
        assert.ok(fs.existsSync(stale));
    });

    it("writes to the output option, relative to the package", () => {
        const target = path.join(root, "out/wrappers.tsx");
        assert.deepStrictEqual(writeReact(root, { output: "out/wrappers.tsx" }), { file: target, status: "written" });
        assert.match(read(target), /export function FixtureItem\(/);
        assert.ok(!fs.existsSync(file()));
    });
});

describe("papit-react bin", () => {
    let root;
    let location;

    const run = (...args) => {
        const env = { ...process.env, PWD: location };
        delete env.npm_config_local_prefix;
        return spawnSync(process.execPath, [bin, ...args], { cwd: location, env, encoding: "utf8" });
    };

    before(() => {
        root = tmp();
        location = path.join(root, "packages/fixture");
        write(root, { "package.json": { name: "@tmp/root", private: true, workspaces: ["packages/*"] } });
        fixturePackage(location);
    });
    beforeEach(() => ["src/react-wrapper.tsx", "src/react-wrapper.ts"].forEach(name => fs.rmSync(path.join(location, name), { force: true })));
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("writes the -o file", () => {
        const result = run("-o", "out.tsx");
        assert.strictEqual(result.status, 0, result.stderr);
        assert.match(fs.readFileSync(path.join(location, "out.tsx"), "utf8"), /export function Fixture\(/);
        assert.ok(!fs.existsSync(path.join(location, "src/react-wrapper.tsx")));
    });

    it("says it removed a generated src/react-wrapper.ts", () => {
        write(location, { "src/react-wrapper.ts": `${MARKER}\nexport const stale = true;\n` });
        const result = run();
        assert.strictEqual(result.status, 0, result.stderr);
        assert.match(result.stdout, /removed .*react-wrapper\.ts/);
        assert.ok(!fs.existsSync(path.join(location, "src/react-wrapper.ts")));
    });

    it("warns that a src/react-wrapper.ts taken over by hand shadows the .tsx", () => {
        write(location, { "src/react-wrapper.ts": "export {};\n" });
        const result = run();
        assert.strictEqual(result.status, 0, result.stderr);
        assert.match(result.stderr, /react-wrapper\.ts.*shadows/);
        assert.ok(fs.existsSync(path.join(location, "src/react-wrapper.ts")));
    });

    it("says so when it skips a file taken over by hand", () => {
        write(location, { "src/react-wrapper.tsx": "export {};\n" });
        const result = run();
        assert.strictEqual(result.status, 0, result.stderr);
        assert.match(result.stdout, /by hand/);
        assert.strictEqual(fs.readFileSync(path.join(location, "src/react-wrapper.tsx"), "utf8"), "export {};\n");
    });
});
