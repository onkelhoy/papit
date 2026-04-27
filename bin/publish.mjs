import path from "node:path";

import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

function runner(node, extraEnv = {}, extraArgs = []) {
    return new Promise(resolve => {
        const { close, update } = Terminal.loading(
            `${Terminal.dim("publishing")} ${node.name}`,
            80,
            frame => {
                if (frame === 50) update(`${Terminal.dim("publishing")} ${node.name} ${Terminal.dim("- so slow..")}`);
                if (frame === 150) update(`${Terminal.dim("publishing")} ${node.name} ${Terminal.dim("- jeez")}`);
                if (frame === 400) update(`${Terminal.dim("publishing")} ${node.name} ${Terminal.dim("- yeah this is borked")}`);
            }
        );

        let buffer = "";
        process.env.LOCATION = path.relative(Information.root.location, node.location);

        const child = Terminal.spawn("npm publish --access public  --verbose", {
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

    const batches = Information.getBatches();

    for (const batch of batches)
    {
        for (const node of batch)
        {
            // Skip unchanged packages in CI
            if (Arguments.has("ci") || process.env.CI)
            {
                const remote = await node.remote() ?? node.packageJSON.remoteVersion;
                if (node.packageJSON.version === remote && remote)
                {
                    Terminal.write(Terminal.blue("●"), node.name, Terminal.green("skipped"));
                    continue;
                }
            }

            const { code, buffer } = await runner(node);

            if (code === 0)
            {
                Terminal.write(Terminal.green("●"), node.name, Terminal.green("passed"));
            }
            else
            {
                Terminal.write(Terminal.red("●"), node.name, Terminal.red("failed"));
                // only print lines that look like actual errors
                const errors = buffer.split("\n").filter(line => line.includes("npm error") || line.includes("ERR!"));
                Terminal.write(errors.join("\n") || buffer);
            }
        }
    }

    process.exit(0);
}());
