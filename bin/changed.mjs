import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

export function isPlaywright(node) {
    return ["", "tests"].some(folder =>
        fs.existsSync(path.join(node.location, folder, "playwright.config.ts")) ||
        fs.existsSync(path.join(node.location, folder, "playwright.config.js"))
    );
}

function git(...args) {
    return execFileSync("git", args, { cwd: Information.root.location, encoding: "utf-8" }).trim();
}

// the files this branch changed, whatever its base has gained since
function changedFiles() {
    const base = Arguments.get("base") ?? `origin/${process.env.GITHUB_BASE_REF || "main"}`;
    return git("diff", "--name-only", git("merge-base", base, "HEAD")).split("\n").filter(Boolean);
}

function contains(node, file) {
    const folder = path.relative(Information.root.location, node.location);
    return file.startsWith(folder + "/");
}

async function isNew(node) {
    const remote = await node.remote() ?? node.packageJSON.remoteVersion;
    return node.packageJSON.version !== remote;
}

/**
 * Packages to act on, in build order. New means a version npm doesn't have.
 * A PR also needs files changed in it, so an unreleased package from an earlier PR is left alone.
 */
export async function getNewPackages({ publish = false } = {}) {
    const nodes = Information.getBatches().flat();
    const files = publish ? [] : changedFiles();
    const result = [];

    for (const node of nodes)
    {
        if (publish && node.packageJSON.private) continue;
        if (!publish && !files.some(file => contains(node, file))) continue;
        if (await isNew(node)) result.push(node);
    }

    return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
    const nodes = await getNewPackages({ publish: Arguments.has("publish") });

    for (const node of nodes) Terminal.write(Terminal.green("●"), node.name, node.packageJSON.version);
    if (nodes.length === 0) Terminal.write(Terminal.blue("●"), "no new packages");

    if (process.env.GITHUB_OUTPUT)
    {
        const output = `packages=${JSON.stringify(nodes.map(node => node.name))}\nplaywright=${nodes.some(isPlaywright)}\n`;
        fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
    }
}
