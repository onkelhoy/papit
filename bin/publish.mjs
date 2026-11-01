import fs from "node:fs";
import path from "node:path";

import { Arguments } from "@papit/arguments";
import { Information, PackageGraph } from "@papit/information";
import { Terminal } from "@papit/terminal";

import { getNewPackages } from "./changed.mjs";
import { BUILD_FAILED, Report, run, seconds } from "./report.mjs";

async function runner(node) {
    process.env.LOCATION = path.relative(Information.root.location, node.location);

    const { close, update } = Terminal.loading(
        `${Terminal.dim("publishing")} ${node.name}`,
        80,
        frame => {
            if (frame === 50) update(`${Terminal.dim("publishing")} ${node.name} ${Terminal.dim("- so slow..")}`);
            if (frame === 150) update(`${Terminal.dim("publishing")} ${node.name} ${Terminal.dim("- jeez")}`);
            if (frame === 400) update(`${Terminal.dim("publishing")} ${node.name} ${Terminal.dim("- yeah this is borked")}`);
        }
    );

    const dryRun = Arguments.has("dry-run") ? "--dry-run" : "";
    const args = process.argv.slice(2).join(" ");
    const result = await run(`npm publish --access public --loglevel verbose --provenance ${dryRun} ${args}`, node.location);

    close();
    return result;
}

(async function () {
    const nodes = await getNewPackages({ publish: true });
    const report = new Report("publish", nodes.length);
    const buildFailed = fs.existsSync(BUILD_FAILED) ? JSON.parse(fs.readFileSync(BUILD_FAILED, "utf-8")) : [];
    const failed = new Set(buildFailed);

    for (const node of nodes)
    {
        if (buildFailed.includes(node.name))
        {
            report.add({ name: node.name, status: "failed", detail: "build failed, not published" });
            continue;
        }

        // a dependent pins the exact version, which didn't make it to npm
        const missing = PackageGraph.getAncestors(node.name, ["dependencies", "peerDependencies"]).find(ancestor => failed.has(ancestor.name));
        if (missing)
        {
            failed.add(node.name);
            report.add({ name: node.name, status: "skipped", detail: `needs ${missing.name}` });
            continue;
        }

        const start = Date.now();
        const { code, output } = await runner(node);
        const version = node.packageJSON.version;

        if (code === 0)
        {
            report.add({ name: node.name, status: "passed", detail: `${version} · ${seconds(start)}`, output });
            continue;
        }

        failed.add(node.name);
        // only print lines that look like actual errors
        const errors = output.split("\n").filter(line => line.includes("npm error") || line.includes("ERR!"));
        report.add({ name: node.name, status: "failed", detail: `${version} · ${seconds(start)}`, output: errors.join("\n") || output });
    }

    process.exit(report.finish() ? 0 : 1);
}());
