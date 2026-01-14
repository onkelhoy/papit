import path from "node:path";
import {Arguments, Terminal, getDependencyOrder, getPathInfo} from "@papit/util";
import {setup, close} from "@papit/server";

function runner(b, info) {
    return new Promise(resolve => {
        let buffer = "";
        process.env.LOCATION = path.relative(info.root, b.location);
        console.log({loc: process.env.LOCATION})
        const child = Terminal.spawn("npm test", {
            cwd: b.location,
            args: process.argv.slice(2),
            onData: text => (buffer += text),
            onError: text => (buffer += text),
        });

        child.on("close", code => resolve({code, buffer}));
    });
}

(async function () {
    Arguments.args.flags.port = "3500";
    Arguments.args.flags.root = true;
    const info = getPathInfo();
    if (Arguments.has("ci")) process.env.CI = true;

    console.log(Arguments.args.flags)

    await setup();
    const secondchance = [];
    await getDependencyOrder(async batch => {
        for (const b of batch)
        {
            const {code, buffer} = await runner(b, info);

            if (code === 0)
            {
                Terminal.write(Terminal.yellow("test"), b.name, Terminal.green("passed"));
            }
            else 
            {
                Terminal.write(Terminal.yellow("test"), b.name, Terminal.red("failed"));
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
        const {code, buffer} = await runner(b, info);
        if (code !== 0) 
        {
            Terminal.write(Terminal.yellow("test"), b.name, Terminal.red("failed"));
            process.exit(1);
        }
    }

    close();
}());