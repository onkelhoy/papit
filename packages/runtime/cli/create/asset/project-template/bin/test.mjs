import path from "node:path";
import {Arguments} from "@papit/arguments";
import {Information} from "@papit/information";
import {Terminal} from "@papit/terminal";
import {setup, close} from "@papit/server";

function runner(node) {
    return new Promise(async resolve => {
        const {close, update} = Terminal.loading(
            `${Terminal.dim("testing")} ${node.name}`,
            80,
            frame => {
                if (frame === 50) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- so slow..")}`)
                if (frame === 100) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- jeez")}`)
                if (frame === 250) update(`${Terminal.dim("testing")} ${node.name} ${Terminal.dim("- yeah this is borked")}`)
            }
        );

        let buffer = "";
        process.env.LOCATION = path.relative(Information.root.location, node.location);
        const child = Terminal.spawn("npm test", {
            cwd: node.location,
            args: process.argv.slice(2),
            onData: text => (buffer += text),
            onError: text => (buffer += text),
        });

        child.on("close", code => {
            close();
            resolve({code, buffer});
        });
    });
}

(async function () {
    Arguments.set("port", 3500);
    Arguments.set("root", true);
    if (Arguments.has("ci")) Arguments.set("remote", true);
    if (Arguments.has("ci")) process.env.CI = true;

    await setup();
    const secondchance = [];

    const batches = Information.getBatches();
    for (const batch of batches)
    {
        for (const node of batch)
        {
            if (Arguments.has("ci"))
            {
                const remote = await node.remote();
                if (node.version === remote && remote)
                {
                    Terminal.write(Terminal.blue("●"), node.name, Terminal.green("skipped"));
                    continue;
                }
            }

            const {code} = await runner(node);

            if (code === 0)
            {
                Terminal.write(Terminal.green("●"), node.name, Terminal.green("passed"));
            }
            else 
            {
                Terminal.write(Terminal.red("●"), node.name, Terminal.red("failed"));
                secondchance.push(node);
            }
        }
    }

    if (secondchance.length > 0)
    {
        Terminal.write(Terminal.dim("\nRunning Second Chance"));
    }
    for (const node of secondchance)
    {
        const {code, buffer} = await runner(node);

        if (code === 0)
        {
            Terminal.write(Terminal.yellow("✅"), node.name, Terminal.green("passed"));
        }
        else 
        {
            Terminal.write(Terminal.yellow("❌"), node.name, Terminal.red("failed"));
            Terminal.write(buffer)
            process.exit(1);
        }
    }

    close();
}());