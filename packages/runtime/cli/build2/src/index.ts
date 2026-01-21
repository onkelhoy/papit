import { Information, PackageNode, PackageGraph } from "@papit/information";
import { ArgInstance, Arguments, Loglevel } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { getBatches } from "./helper";
import { tsBundler } from "./bundles/ts-bundle";
import path from "node:path";

function canPrint() {
    return !(!Arguments.isCLI && !Arguments.has("run")) || !process.env._?.endsWith("papit-build2");
}
export async function build(args = process.argv, islands?: string[]) {
    const _args = new ArgInstance(args, islands);

    const batches = getBatches(_args);
    const failed = new Set<string>();

    for (const batch of batches)
    {
        await runBatch(batch, failed, _args);
    }
};

function runBatch(batch: PackageNode[], failed: Set<string>, args: ArgInstance) {
    const canprint = canPrint();
    const promises = batch.map(node => {
        return new Promise<void>(async resolve => {

            let close: () => void = () => null;
            let update: (text: string) => void = () => null;

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
                    if (canprint) update(Terminal.dim(node.name, "building - bundle javascript"));
                    // await jsBundle(entrypoins.entries[entry], node);
                    status = "ts";

                    if (node.tsconfig.options.declaration)
                    {
                        if (canprint) update(Terminal.dim(node.name, "building - bundle javascript"));
                        tsstatus = await tsBundler(entrypoins.entries[entry], node, tempOutDir);
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
                }

                if (Loglevel.error) 
                {
                    console.log('failed at', status, node.entrypoints.entries["bundle"]?.types);
                    console.log(e);
                }

                failed.add(node.name);
            }
            finally 
            {
                resolve();
            }
        });
    });

    return Promise.all(promises);
}

(async function () {
    if (!canPrint()) return;
    await build();
}())