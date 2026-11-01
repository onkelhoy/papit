import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";
import { setup, close } from "@papit/server";

import { getNewPackages, isPlaywright } from "./changed.mjs";
import { Report, run, seconds } from "./report.mjs";

function hasSnapshots(node) {
    const dir = path.join(node.location, "tests", "snapshots");
    try
    {
        return fs.readdirSync(dir).some(f => f.endsWith(os.platform + ".png"));
    } catch
    {
        return false;
    }
}

async function runner(node, extraEnv = {}, extraArgs = []) {
    process.env.LOCATION = path.relative(Information.root.location, node.location);

    const command = extraArgs.length ? `npm test -- ${extraArgs.join(" ")}` : "npm test";
    if (Arguments.has("ci")) return run(command, node.location, extraEnv);

    const { close, update } = Terminal.loading(
        `${Terminal.dim("testing")} ${node.name}`,
        80,
        frame => {
            if (frame === 50) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- so slow..")}`);
            if (frame === 150) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- jeez")}`);
            if (frame === 400) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- yeah this is borked")}`);
        }
    );

    const result = await run(command, node.location, extraEnv);
    close();
    return result;
}

function testCount(output) {
    const count = /(?:^|\s)(\d+) passed/.exec(output)?.[1] ?? /(?:ℹ|#) pass (\d+)/.exec(output)?.[1];
    return count ? `${count} tests · ` : "";
}

(async function () {
    Arguments.set("port", 3500);
    Arguments.set("root", true);
    if (process.env.CI) Arguments.set("ci", true);
    if (Arguments.has("ci")) Arguments.set("remote", true);
    if (Arguments.has("ci")) process.env.CI = "true";

    // CI tests what is new in this PR, locally everything
    const nodes = Arguments.has("ci")
        ? await getNewPackages()
        : Information.getBatches(Arguments.instance, p => p.name.startsWith(Information.scope)).flat();
    const report = new Report("test", nodes.length);

    if (nodes.length === 0)
    {
        report.finish();
        process.exit(0);
    }

    await setup();

    const force = Arguments.has("force");
    // only playwright packages get --project (e.g. `npm test -- --project=chromium`), after a `--` so npm passes it on
    const playwrightArgs = process.argv.slice(2).filter(arg => arg.startsWith("--project"));
    if (Arguments.has("ci")) playwrightArgs.push("--reporter=list,github");

    const testresult_location = path.join(Information.root.location, "test-result.log");
    if (!Arguments.has("ci") && fs.existsSync(testresult_location)) fs.rmSync(testresult_location);
    const testresultstream = Arguments.has("ci") ? null : fs.createWriteStream(testresult_location, { flags: "a" }); // append mode

    if (!Arguments.has("ci"))
    {
        testresultstream.write("# Test Results\n");
        testresultstream.write("\n==== Meta Information ====\n")
        testresultstream.write("\nmachine: " + os.machine)
        testresultstream.write("\nplatform: " + os.platform)
        testresultstream.write("\ntimestamp: " + new Date().toISOString());
        testresultstream.write("\n\n==== (meta end) ====\n\n")
    }

    for (const node of nodes)
    {
        if (node.packageJSON.papit?.skip)
        {
            report.add({ name: node.name, status: "skipped" });
            log({ name: node.name, status: "skipped" }, testresultstream);
            continue;
        }

        const start = Date.now();
        const playwright = isPlaywright(node);
        const skipSnapshots = Arguments.has("ci") || (!force && playwright && !hasSnapshots(node));
        const extraEnv = skipSnapshots ? { SKIP_SNAPSHOTS: "true" } : {};

        const { code, output } = await runner(node, extraEnv, playwright ? playwrightArgs : []);

        if (code === 0)
        {
            report.add({ name: node.name, status: "passed", detail: testCount(output) + seconds(start), output });
            log({ name: node.name, status: "passed", buffer: output }, testresultstream);
            continue;
        }

        // Retry — last-failed for playwright, full rerun for node
        const retryArgs = playwright ? [...playwrightArgs, "--last-failed"] : [];
        const retry = await runner(node, extraEnv, retryArgs);
        const buffer = `${output}\n\n==== retry ====\n\n${retry.output}`;

        if (retry.code === 0)
        {
            report.add({ name: node.name, status: "flaky", detail: seconds(start), output: buffer });
            log({ name: node.name, status: "passed", buffer }, testresultstream);
        }
        else
        {
            report.add({ name: node.name, status: "failed", detail: seconds(start), output: retry.output });
            log({ name: node.name, status: "failed", buffer: retry.output }, testresultstream);
        }
    }

    close();

    if (!Arguments.has("ci"))
    {
        testresultstream.end();
        Terminal.write(`\ncheck the test-results at: "${testresult_location}"`)
    }

    const ok = report.finish();
    process.exit(ok || !Arguments.has("ci") ? 0 : 1);
}());

function log(note, testresultstream) {
    if (Arguments.has("ci")) return;

    let output = Arguments.get("output")?.includes("terminal") ? Terminal : testresultstream;
    output.write(`\n● ${note.name} - ${note.status}`);
    output.write(`\n==== ${note.name} - logs ====\n`)
    output.write(note.buffer);
}