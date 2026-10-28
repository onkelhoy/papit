import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../lib/bin.js");

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

function read(file) {
    return fs.readFileSync(file, "utf-8");
}

let tmp;
let fakebin;

// runs create from `cwd` with a stubbed npm, so nothing is installed
function create(cwd, args) {
    const env = { ...process.env, PWD: cwd, USER: "tester", PATH: fakebin + path.delimiter + process.env.PATH };
    delete env.npm_config_local_prefix;
    delete env.CI;
    return spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: "utf-8", timeout: 30000 });
}

before(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));
    fakebin = path.join(tmp, "bin");
    write(path.join(fakebin, "npm"), "#!/bin/sh\nexit 0\n");
    fs.chmodSync(path.join(fakebin, "npm"), 0o755);
});

after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe("create --project", () => {
    let cwd;
    let project;

    before(() => {
        cwd = path.join(tmp, "empty");
        fs.mkdirSync(cwd);
        project = path.join(cwd, "demo");
    });

    it("creates the project at --destination without prompting", () => {
        const result = create(cwd, [
            "--project",
            "--name=demo",
            "--description=a demo",
            `--destination=${project}`,
            "--repository=https://github.com/acc/demo",
            "--skip-git",
        ]);
        assert.strictEqual(result.status, 0, result.stderr || result.stdout);
        assert.ok(fs.existsSync(path.join(project, "package.json")));
    });

    it("ships the template gitignore as .gitignore", () => {
        assert.ok(fs.existsSync(path.join(project, ".gitignore")));
        assert.ok(!fs.existsSync(path.join(project, "gitignore")));
        assert.match(read(path.join(project, ".gitignore")), /^packages\/\*\*\/dist\/$/m);
    });

    it("fills repository and logo from --repository", () => {
        const pkg = JSON.parse(read(path.join(project, "package.json")));
        assert.deepStrictEqual(pkg.repository, { type: "git", url: "git+https://github.com/acc/demo.git" });
        assert.ok(pkg.workspaces.includes("!packages/**/dist/**"));
        assert.ok(read(path.join(project, "README.md")).includes("https://raw.githubusercontent.com/acc/demo/refs/heads/main/asset/logo.svg"));
    });

    it("refuses a non-empty --destination and leaves it untouched", () => {
        const occupied = path.join(cwd, "occupied");
        write(path.join(occupied, "keep.txt"), "keep");

        const result = create(cwd, ["--project", "--name=occupied", "--description=x", `--destination=${occupied}`, "--skip-git"]);
        assert.strictEqual(result.status, 1);
        assert.deepStrictEqual(fs.readdirSync(occupied), ["keep.txt"]);
    });
});

describe("create --package", () => {
    let root;

    before(() => {
        root = path.join(tmp, "workspace");
        write(path.join(root, "package.json"), {
            name: "@scope/root",
            workspaces: ["packages/**/*"],
            repository: { type: "git", url: "git+https://github.com/acc/repo.git" },
            papit: {},
        });
        fs.mkdirSync(path.join(root, "packages"));
    });

    it("creates the package inside --destination without prompting for a folder", () => {
        const result = create(root, [
            "--package=node",
            "--name=foo",
            "--description=a foo",
            "--destination=packages/libs",
            "--no",
        ]);
        assert.strictEqual(result.status, 0, result.stderr || result.stdout);

        const location = path.join(root, "packages/libs/foo");
        assert.strictEqual(JSON.parse(read(path.join(location, "package.json"))).name, "@scope/foo");
        assert.ok(read(path.join(location, "README.md")).includes("https://raw.githubusercontent.com/acc/repo/refs/heads/main/asset/logo.svg"));
    });
});
