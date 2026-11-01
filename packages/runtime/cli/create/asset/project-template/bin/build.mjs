import fs from "node:fs";

import { Arguments } from "@papit/arguments";
import { Information, PackageGraph } from "@papit/information";

import { getNewPackages } from "./changed.mjs";
import { BUILD_FAILED, Report, run, seconds } from "./report.mjs";

const EDGES = ["dependencies", "peerDependencies", "devDependencies"];

(async function () {
    const nodes = await getNewPackages({ publish: Arguments.has("publish") });

    // what the new packages need to build and test, in build order
    const names = new Set();
    for (const node of nodes)
    {
        names.add(node.name);
        for (const ancestor of PackageGraph.getAncestors(node.name, EDGES)) names.add(ancestor.name);
    }

    const order = Information.getPriorityBatches(Arguments.instance, p => names.has(p.name)).flat();
    const flags = Arguments.has("ci") ? "--ci" : "";
    const report = new Report("build", order.length);

    for (const node of order)
    {
        const start = Date.now();
        const { code, output } = await run(`npx @papit/build --individual --error ${flags}`, node.location);
        const status = code !== 0 ? "failed" : output.includes("skipped") ? "skipped" : "passed";

        report.add({ name: node.name, status, detail: seconds(start), output });
    }

    if (Arguments.has("publish"))
    {
        const failed = report.rows.filter(row => row.status === "failed").map(row => row.name);
        fs.writeFileSync(BUILD_FAILED, JSON.stringify(failed));
    }

    if (!report.finish()) process.exitCode = 1;
}());
