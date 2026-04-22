import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";
import { setup, close } from "@papit/server";

function isPlaywright(node) {
    return (
        fs.existsSync(path.join(node.location, "playwright.config.ts")) ||
        fs.existsSync(path.join(node.location, "playwright.config.js"))
    );
}

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

function runner(node, extraEnv = {}, extraArgs = []) {
    return new Promise(resolve => {
        const { close, update } = Terminal.loading(
            `${Terminal.dim("testing")} ${node.name}`,
            80,
            frame => {
                if (frame === 50) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- so slow..")}`);
                if (frame === 150) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- jeez")}`);
                if (frame === 400) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- yeah this is borked")}`);
            }
        );

        let buffer = "";
        process.env.LOCATION = path.relative(Information.root.location, node.location);

        const child = Terminal.spawn("npm test", {
            cwd: node.location,
            args: [...process.argv.slice(2), ...extraArgs],
            env: { ...process.env, ...extraEnv },
            onData: text => (buffer += text),
            onError: text => (buffer += text),
        });

        child.on("close", code => {
            close();
            resolve({ code, buffer });
        });
    });
}

(async function () {
    Arguments.set("port", 3500);
    Arguments.set("root", true);
    if (Arguments.has("ci")) Arguments.set("remote", true);
    if (Arguments.has("ci")) process.env.CI = "true";

    const summery = [];

    await setup();

    const force = Arguments.has("force");
    const batches = Information.getBatches();


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

    for (const batch of batches)
    {
        for (const node of batch)
        {
            // Skip unchanged packages in CI
            if (Arguments.has("ci") || process.env.CI)
            {
                const remote = await node.remote();
                if (node.version === remote && remote)
                {
                    Terminal.write(Terminal.blue("●"), node.name, Terminal.green("skipped"));
                    log({ name: node.name, status: "skipped" }, testresultstream);
                    continue;
                }
            }

            const playwright = isPlaywright(node);
            const skipSnapshots = !force && playwright && !hasSnapshots(node);
            const extraEnv = skipSnapshots ? { SKIP_SNAPSHOTS: "true" } : {};

            if (skipSnapshots)
            {
                Terminal.write(Terminal.dim("○"), node.name, Terminal.dim("no snapshots — skipping snapshot.test.ts"));
            }

            const { code, buffer } = await runner(node, extraEnv);

            if (code === 0)
            {
                Terminal.write(Terminal.green("●"), node.name, Terminal.green("passed"));
                log({ name: node.name, status: "passed", buffer }, testresultstream);
                continue;
            }

            // Retry — last-failed for playwright, full rerun for node
            if (Arguments.has("ci")) Terminal.write(Terminal.yellow("●"), node.name, Terminal.yellow("failed — retrying"));

            const retryArgs = playwright ? ["--last-failed"] : [];
            const { code: code2, buffer: buffer2 } = await runner(node, extraEnv, retryArgs);

            if (code2 === 0)
            {
                if (Arguments.has("ci")) Terminal.write(Terminal.green("●"), node.name, Terminal.green("passed (flaky)"));
                else Terminal.write(Terminal.green("●"), node.name, Terminal.green("passed"));

                log({ name: node.name, status: "passed", buffer: buffer2 }, testresultstream);
            }
            else
            {
                Terminal.write(Terminal.red("●"), node.name, Terminal.red("failed"));
                log({ name: node.name, status: "failed", buffer: buffer2 }, testresultstream);
                close();

                if (Arguments.has("ci")) process.exit(1);
            }
        }
    }

    close();

    if (!Arguments.has("ci"))
    {
        testresultstream.end();
        Terminal.write(`\ncheck the test-results at: "${testresult_location}"`)
    }
    process.exit(0);
}());

function log(note, testresultstream) {
    if (Arguments.has("ci")) return;

    let output = Arguments.get("output")?.includes("terminal") ? Terminal : testresultstream;
    output.write(`\n● ${note.name} - ${note.status}`);
    output.write(`\n==== ${note.name} - logs ====\n`)
    output.write(note.buffer);
}