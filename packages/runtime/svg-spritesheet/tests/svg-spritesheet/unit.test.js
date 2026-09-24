import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../lib/bundle.js");

function run(...args) {
    return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf-8" });
}

describe("svg-spritesheet CLI", () => {
    let dir;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        fs.writeFileSync(path.join(dir, "a.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>check</title><path d="M0 0"/></svg>');
        fs.writeFileSync(path.join(dir, "arrow-left.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 1"/></svg>');
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("runs the built bundle with every flag given", () => {
        const output = path.join(dir, "out", "sprite.svg");
        const result = run("--input", dir, "--output", output, "--name-query", "title");

        assert.strictEqual(result.status, 0, result.stderr);
        assert.ok(fs.existsSync(output));
    });

    it("defaults --output to <input>/spritesheet.svg", () => {
        const result = run("--input", dir, "--name-query", "title");

        assert.strictEqual(result.status, 0, result.stderr);
        assert.ok(fs.existsSync(path.join(dir, "spritesheet.svg")));
    });

    it("defaults --name-query to title, falling back to the filename", () => {
        const output = path.join(dir, "sprite.svg");
        const result = run("--input", dir, "--output", output);

        assert.strictEqual(result.status, 0, result.stderr);
        const content = fs.readFileSync(output, "utf-8");
        assert.match(content, /<symbol[^>]*id="check"/);
        assert.match(content, /<symbol[^>]*id="arrow-left"/);
        assert.match(content, /viewBox="0 0 16 16"/);
    });
});
