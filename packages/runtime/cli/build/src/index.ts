import path from "node:path";
import fs from "node:fs";

import { type LogLevel } from "esbuild";

import { Information, PackageNode } from "@papit/information";
import { Args, Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { getESOptions, hasChanged, jsBundle, jsWatch, OnBuildEvent } from "@papit/bundle-js";
import { tsBundle } from "@papit/bundle-ts";

import { npmInstall } from "helper";

function canPrint() {
    return Arguments.has("run-build") || (Arguments.isCLI && !!process.env._?.endsWith("papit-build"));
}

// function runBatch(batch: PackageNode[], failed: Set<string>, args: Args, canprint: boolean) {
//     const promises = batch.map(node => runner(node, failed, args, canprint));
//     return Promise.all(promises);
// }

export function debounceFn<T extends (...args: any[]) => any>(
    execute: T,
    delay: number = 100
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;

    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (timer)
        {
            clearTimeout(timer);
        }

        timer = setTimeout(() => {
            execute.apply(this, args);
            timer = null;
        }, delay);
    };
}

(async function () {

    if (!canPrint()) return;
    const watchers = await build();

    await new Promise<void>(resolve => {
        process.on("SIGINT", async () => {
            Terminal.write("\ndisposing watchers...");
            await Promise.all(watchers.map(w => w.dispose()));
            resolve();
        });
    });
}())

export async function build(
    args = new Args(process.argv),
    onPackageBuild?: (node: PackageNode, info: OnBuildEvent) => void,
) {
    const canprint = canPrint();
    const ordered = Information.getPriorityBatches(args);

    let logLevel: LogLevel = "silent";
    if (args.error) logLevel = "error";
    else if (args.warning) logLevel = "warning";
    else if (args.info) logLevel = "info";
    else if (args.verbose || args.debug) logLevel = "info";

    const failed = new Set<string>();
    const watchers: Awaited<ReturnType<typeof jsWatch>>[] = [];
    let hasprintedPriority = false;

    const debouncedInstall = debounceFn(npmInstall);

    // always do initial build first, in order
    for (const batch of ordered)
    {
        let shouldinstall = false;
        const isPriority = batch === ordered[0];
        if (isPriority && batch.length > 0 && canprint) 
        {
            Terminal.write(Terminal.yellow("priority"));
            hasprintedPriority = true;
        }
        else if (canprint && hasprintedPriority)
        {
            hasprintedPriority = false;
            Terminal.write("\n" + Terminal.yellow("normal"));
        }

        for (const node of batch)
        {
            if (node.packageJSON.papit?.type === "theme")
            {
                const result = buildTheme(args, node);
                if (canprint && !args.has("live"))
                {
                    if (result === "skipped") Terminal.write(Terminal.blue("●"), Terminal.dim(node.name), Terminal.blue("skipped"));
                    else Terminal.write(Terminal.green("●"), Terminal.dim(node.name), Terminal.green("success"));
                }
                continue;
            }
            const install = await runner(node, failed, args, canprint, logLevel);
            if (install) shouldinstall = true;
        }

        if (shouldinstall) await npmInstall(args, canprint);
    }


    // after initial build, start watchers if live
    if (args.has("live"))
    {
        for (const batch of ordered)
        {
            for (const node of batch)
            {
                if (failed.has(node.name)) continue;
                if (node.packageJSON.papit?.type === "theme") 
                {
                    buildTheme(args, node);
                    continue;
                }

                const baseOptions = getESOptions(Arguments.instance, node.location, {
                    logLevel,
                    packageJSON: node.packageJSON,
                    externals: node.externals,
                });
                const watcher = await jsWatch(
                    args, node.location,
                    {
                        entryPoints: node.entrypoints,
                        logLevel,
                        externals: node.externals,
                        packageJSON: node.packageJSON,
                        tsconfig: node.tsconfig,
                        esoptions: baseOptions,
                    },
                    async (info) => {
                        const shouldinstall = onBuild(args, node, info);

                        onPackageBuild?.(node, info);
                        if (node.tsconfig.options.declaration)
                        {
                            await tsBundle(args, node.location, {
                                entryPoints: node.entrypoints,
                                packageJSON: node.packageJSON,
                                tsconfig: node.tsconfig,
                            });
                        }

                        if (shouldinstall)
                        {
                            debouncedInstall(args, canprint);
                        }
                    }
                );
                watchers.push(watcher);
            }
        }

        if (canprint) Terminal.write(Terminal.green("watching..."));
    }

    return watchers;
}

async function runner(
    node: PackageNode,
    failed: Set<string>,
    args: Args,
    canprint: boolean,
    logLevel: LogLevel,
): Promise<boolean> {
    // we store terminal functions for the loading
    let close: () => void = () => null;
    let update = (text: string) => Terminal.write(text);
    let shouldinstall = false;

    try
    {
        if (canprint)
        {
            const loadinfo = Terminal.loading(Terminal.dim(node.name, "building"));
            update = loadinfo.update;
            close = loadinfo.close;
        }

        const baseOptions = getESOptions(
            Arguments.instance,
            node.location,
            {
                logLevel,
                packageJSON: node.packageJSON,
                externals: node.externals,
            }
        );

        const skipped = {
            bundlejs: false,
            bundlets: false,
        }
        const bundlejs = await jsBundle(
            args, node.location,
            {
                entryPoints: node.entrypoints,
                logLevel,
                externals: node.externals,
                packageJSON: node.packageJSON,
                tsconfig: node.tsconfig,
                esoptions: baseOptions,
            },
            info => {
                const localshouldinstall = onBuild(args, node, info);
                if (localshouldinstall) shouldinstall = localshouldinstall;
            }
        );

        if (bundlejs === "skipped")
        {
            skipped.bundlejs = true;
        }

        if (bundlejs && bundlejs !== "skipped" && bundlejs.length > 0)
        {
            throw bundlejs;
        }


        if (node.tsconfig.options.declaration)
        {
            if (canprint) update(Terminal.dim(node.name, "building - bundle typescript"));
            const bundlets = await tsBundle(args, node.location, {
                entryPoints: node.entrypoints,
                packageJSON: node.packageJSON,
                tsconfig: node.tsconfig,
            });

            if (bundlets === "skipped")
            {
                skipped.bundlets = true;
            }

            if (bundlets && bundlets !== "skipped" && bundlets.length > 0)
            {
                throw bundlets;
            }
        }

        if (canprint) 
        {
            close(); // cool

            if (skipped.bundlejs || skipped.bundlets)
            {
                Terminal.write(Terminal.blue("●"), Terminal.dim(node.name), Terminal.blue("skipped"));
            }
            else
            {
                Terminal.write(Terminal.green("●"), Terminal.dim(node.name), Terminal.green("success"));
            }
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
                console.log(e);
            }
        }

        failed.add(node.name);
    }
    finally 
    {
        close();
        return shouldinstall;
    }
}

function buildTheme(args: Args, node: PackageNode) {
    const src = path.join(node.location, node.sourceFolder);
    const files = fs.readdirSync(src)
        .filter(f => f.endsWith(".css"));

    const out = path.join(node.location, node.outFolder);

    if (!(args.has("force") || args.has("f")) && fs.existsSync(out) && !hasChanged(node.location, files.map(f => path.join(src, f))))
    {
        return "skipped"
    }

    fs.mkdirSync(out, { recursive: true });
    files.forEach(f => fs.cpSync(path.join(src, f), path.join(out, f)));

    return "success"
}

function onBuild(args: Args, node: PackageNode, info: OnBuildEvent) {
    if (info.type !== "build" && info.type !== "rebuild") return;

    const importOutput = info.entry.output ?? "";
    const binName = node.entrypoints.bin.get(importOutput);
    if (!binName) return;

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

    return true; // should install 
}