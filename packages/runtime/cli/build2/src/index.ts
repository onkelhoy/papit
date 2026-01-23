export * from "./bundles/js-bundle";
export * from "./bundles/ts-bundle";

import { Information, PackageNode, PackageGraph } from "@papit/information";
import { Args, Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { getBatches } from "./helper";
import { tsBundler } from "./bundles/ts-bundle";
import path from "node:path";
import { jsBundler } from "./bundles/js-bundle";

function canPrint() {
    return !(!Arguments.isCLI && !Arguments.has("run")) || !process.env._?.endsWith("papit-build2");
}
export async function build(args = process.argv, islands?: string[]) {
    const _args = new Args(args, islands);

    const batches = getBatches(_args);
    const failed = new Set<string>();

    for (const batch of batches)
    {
        await runBatch(batch, failed, _args);
    }
};

function runBatch(batch: PackageNode[], failed: Set<string>, args: Args) {
    const canprint = canPrint();
    const promises = batch.map(node => {
        return new Promise<boolean>(async resolve => {

            let close: () => void = () => null;
            let update: (text: string) => void = () => null;
            let shouldinstall = false;

            let status: "tsc" | "js" | "ts" = "tsc";
            const tempOutDir = path.join(node.location, ".temp/build");

            try 
            {
                if (!args.has("force"))
                {
                    const { current, previous } = Information.package.modifiedtime;
                    if (current === previous)
                    {
                        if (canprint) Terminal.write(Terminal.blue("●"), Terminal.dim(node.name), Terminal.blue("skipped"));
                        return;
                    }
                }

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
                        "tsc",
                        node.location,
                        ["--emitDeclarationOnly", "-p", node.tsconfigpath, "--declarationDir", tempOutDir],
                    );
                }

                status = "js";

                let tsstatus: null | string | undefined;

                for (const entry in entrypoins.entries)
                {
                    const entrypoint = entrypoins.entries[entry];
                    if (canprint) update(Terminal.dim(node.name, "building - bundle javascript"));
                    await jsBundler(entrypoint, node, args, canprint);

                    // check if bin 
                    if (entrypoint.import?.output && entrypoins.bin.has(entrypoint.import.output))
                    {
                        shouldinstall = true;
                        // add shebang and remove from root/node_modeles/.bin
                        if (!args.has("ci"))
                        {
                            const rootNodeModuleBin = path.join(Information.root.location, "node_modules/.bin", binEntry);
                            if (fs.existsSync(rootNodeModuleBin)) 
                            {
                            fs.rmSync(rootNodeModuleBin);
                            }
                        }

                        const bundle = fs.readFileSync(javascriptFileOutput, { encoding: "utf-8" });
                        const updated = bundle.startsWith("#!/usr/bin/env node") ? bundle : `#!/usr/bin/env node\n${bundle}`;
                        fs.writeFileSync(javascriptFileOutput, updated, { mode: 0o755 });
                    }

                    status = "ts";

                    if (node.tsconfig.options.declaration)
                    {
                        if (canprint) update(Terminal.dim(node.name, "building - bundle javascript"));
                        tsstatus = await tsBundler(entrypoint, node, tempOutDir);
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

                failed.add(node.name);
            }
            finally 
            {
                resolve(shouldinstall);
            }
        });
    });

    return Promise.all(promises);
}

(async function () {
    if (!canPrint()) return;
    await build();
}())