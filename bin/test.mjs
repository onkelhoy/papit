import path from "node:path";
import { Arguments, Terminal, getDependencyOrder, getPathInfo } from "@papit/util";
import { setup, close } from "@papit/server";

function runner(b, info) {
    return new Promise(resolve => {
        const { close, update } = Terminal.loading(
            `${Terminal.dim("testing")} ${b.name}`,
            80,
            frame => {
                if (frame === 50) update(`${Terminal.dim("testing")} ${b.name} ${Terminal.dim("- so slow..")}`)
                if (frame === 100) update(`${Terminal.dim("testing")} ${b.name} ${Terminal.dim("- jeez")}`)
                if (frame === 250) update(`${Terminal.dim("testing")} ${b.name} ${Terminal.dim("- yeah this is borked")}`)
            }
        );

        let buffer = "";
        process.env.LOCATION = path.relative(info.root, b.location);
        const child = Terminal.spawn("npm test", {
            cwd: b.location,
            args: process.argv.slice(2),
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
    Arguments.args.flags.port = "3500";
    Arguments.args.flags.root = true;
    const info = getPathInfo();
    if (Arguments.has("ci")) process.env.CI = true;

    await setup();
    const secondchance = [];
    await getDependencyOrder(async batch => {
        for (const b of batch)
        {
            const { code } = await runner(b, info);

            if (code === 0)
            {
                Terminal.write(Terminal.yellow("✅"), b.name, Terminal.green("passed"));
            }
            else 
            {
                Terminal.write(Terminal.yellow("❌"), b.name, Terminal.red("failed"));
                secondchance.push(b);
            }
        }
    });

    if (secondchance.length > 0)
    {
        Terminal.write(Terminal.dim("\nRunning Second Chance"));
    }
    for (const b of secondchance)
    {
        const { code, buffer } = await runner(b, info);

        if (code === 0)
        {
            Terminal.write(Terminal.yellow("✅"), b.name, Terminal.green("passed"));
        }
        else 
        {
            Terminal.write(Terminal.yellow("❌"), b.name, Terminal.red("failed"));
            Terminal.write(buffer)
            process.exit(1);
        }
    }

    close();
}());