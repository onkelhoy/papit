export * from "./bundles/js-bundle";
export * from "./bundles/ts-bundle";

import path from "node:path";
import fs from "node:fs";

import { PriorityQueue } from "@papit/data-structure";
import { Information, PackageNode } from "@papit/information";
import { Args, Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

import { npmInstall } from "./helper";
import { tsBundler } from "./bundles/ts-bundle";
import { jsBundler } from "./bundles/js-bundle";

function canPrint() {
    return Arguments.has("run-build") || (Arguments.isCLI && !!process.env._?.endsWith("papit-build"));
}

function runBatch(batch: PackageNode[], failed: Set<string>, args: Args, canprint: boolean) {
    const promises = batch.map(node => runner(node, failed, args, canprint));
    return Promise.all(promises);
}

(async function () {
    if (!canPrint()) return;
    await build();
}())

export async function build(args = process.argv, islands?: string[]) {
    const _args = new Args(args, islands);

    // we can safely create even if our current target package doesnt have. (assuming fs.createFile dont create the deep nested folder for us - it does not =)
    const binFolder = path.join(Information.root.location, "node_modules/.bin");
    if (!fs.existsSync(binFolder)) fs.mkdirSync(binFolder, { recursive: true }); // I assume reqursive is same as "-p" flag in unix mkdir command. - its correct =) 
    const canprint = canPrint();

    const batches = Information.getBatches(_args);
    const prioQueue = new PriorityQueue<PackageNode>();
    for (const batch of batches) 
    {
        for (const node of batch)
        {
            if (node.packageJSON.papit.priority === undefined) continue;
            if (Information.package.name === node.name) continue; 
            prioQueue.enqueue(node, node.packageJSON.papit.priority);
        }
    }

    const failed = new Set<string>();

    if (prioQueue.size > 0)
    {
        Terminal.write(Terminal.yellow("priority*"))

        let shouldinstall = false;
        for (const node of prioQueue) 
        {
            const install = await runner(node, failed, _args, canprint);
            if (install) shouldinstall = true;
        }
        if (shouldinstall) await npmInstall(_args, canprint)
        console.log();
    }

    const prioArray = Array.from(prioQueue);
    for (const batch of batches)
    {
        let shouldinstall = false;
        for (const node of batch) 
        {
            if (prioArray.some(v => v.name === node.name)) continue;
            const install = await runner(node, failed, _args, canprint);
            if (install) shouldinstall = true;
        }
        // const shouldinstall = await runBatch(batch, failed, _args, canprint);
        if (shouldinstall) await npmInstall(_args, canprint);
    }
};

async function runner(node: PackageNode, failed: Set<string>, args: Args, canprint: boolean): Promise<boolean> {
    // we store terminal functions for the loading
    let close: () => void = () => null;
    let update = (text:string) => Terminal.write(text);
    let shouldinstall = false;

    let status: "tsc" | "js" | "ts" = "tsc";
    const tempOutDir = path.join(node.location, ".temp/build");
    // let previousModifiedtime: number | undefined;
    try
    {
        if (!args.has("force"))
        {
            const { current, previous } = node.modifiedtime;
            // previousModifiedtime = previous;  
            if (current === previous && fs.existsSync(path.join(node.location, node.outFolder)))
            {
                if (canprint) Terminal.write(Terminal.blue("●"), Terminal.dim(node.name), Terminal.blue("skipped"));
                return true;
            }
        }

        // lets clear the output folder
        fs.rmSync(path.join(node.location, node.outFolder), { recursive: true, force: true });

        if (canprint)
        {
            const loadinfo = Terminal.loading(Terminal.dim(node.name, "building"));
            update = loadinfo.update;
            close = loadinfo.close;
        }

        const entrypoins = node.entrypoints;

        if (node.tsconfig.options.declaration)
        {
            if (canprint) update(Terminal.dim(node.name, "building - running typescript"));
            await Terminal.execute(
                "npx",
                node.location,
                [
                    "tsc",
                    "--emitDeclarationOnly", "-p", node.tsconfigpath, "--declarationDir", tempOutDir
                ],
            );
        }

        status = "js";

        for (const entry in entrypoins.entries)
        {
            const entrypoint = entrypoins.entries[entry];
            if (canprint) update(Terminal.dim(node.name, "building - bundle javascript"));
            await jsBundler(entrypoint.import?.input, entrypoint.import?.output, node, args, canprint);

            // check if bin 
            const importOutput = entrypoint.import?.output ?? "";
            const binName = entrypoins.bin.get(importOutput);
            if (binName)
            {
                shouldinstall = true;
                // add shebang and remove from root/node_modeles/.bin
                if (!args.has("ci"))
                {
                    const rootNodeModuleBin = path.join(Information.root.location, "node_modules/.bin", binName);
                    if (fs.existsSync(rootNodeModuleBin)) 
                    {
                        fs.rmSync(rootNodeModuleBin);
                    }
                }

                const bundle = fs.readFileSync(importOutput, { encoding: "utf-8" });
                const updated = bundle.startsWith("#!/usr/bin/env node") ? bundle : `#!/usr/bin/env node\n${bundle}`;
                fs.writeFileSync(importOutput, updated, { mode: 0o755 });
            }

            status = "ts";

            if (node.tsconfig.options.declaration)
            {
                if (canprint) update(Terminal.dim(node.name, "building - bundle javascript"));
                await tsBundler(entrypoint, node, tempOutDir);
            }
        }

        if (canprint) 
        {
            close();
            Terminal.write(Terminal.green("●"), Terminal.dim(node.name), Terminal.green("success"));
        }
    }
    catch (e)
    {
        if (canprint) 
        {
            close();

            Terminal.write(Terminal.red("●"), Terminal.dim(node.name), Terminal.red("failed"));
            if (args.error) 
            {
                Terminal.error('failed at', status);
                console.log(e);
            }
        }

        // if (previousModifiedtime !== undefined) node.modifiedtime = previousModifiedtime; // after a long session i realise actually - why should we rebuild a failured build 
        failed.add(node.name);
    }
    finally 
    {
        return shouldinstall;
    }
}
