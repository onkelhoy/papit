import fs from "node:fs";
import path from "node:path";

const TEMPLATE = "packages/runtime/cli/create/asset/project-template";
const FILES = [
    ".github/workflows/publish.yml",
    ".github/workflows/pull-request.yml",
    ".github/workflows/update-playwright-cache.yml",
    ".github/workflows/update-snapshots.yml",
    "bin/build.mjs",
    "bin/changed.mjs",
    "bin/clean.mjs",
    "bin/publish.mjs",
    "bin/report.mjs",
    "bin/spawn-command.mjs",
    "bin/test.mjs",
];

// the repo installs with `npm install` for its esbuild problem, a new project uses `npm ci`
function read(file) {
    return fs.readFileSync(file, "utf-8").replace(/run: npm (install|ci).*/g, "run: npm install");
}

const different = FILES.filter(file => read(file) !== read(path.join(TEMPLATE, file)));

if (different.length > 0)
{
    console.error(`out of sync with ${TEMPLATE}:\n${different.join("\n")}`);
    process.exit(1);
}
