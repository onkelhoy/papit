import path from "node:path";
import fs from "node:fs";

import { type LogLevel } from "esbuild";

import { Information, PackageNode } from "@papit/information";
import { Args, Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { getESOptions, hasChanged, jsBundle, OnBuildEvent } from "@papit/bundle-js";
import { tsBundle } from "@papit/bundle-ts";

import { npmInstall } from "helper";

function canRun() {
    return Arguments.has("run-build") || Arguments.isCLI;
}

function canPrint() {
    if (!canRun()) return false;
    // Windows-safe binary name check
    const execPath = process.env._ ?? process.env.npm_lifecycle_script ?? "";
    return execPath.endsWith("papit-build") || Arguments.has("run-build");
}

(async function () {
    if (!canRun()) return;
    await build();
}())

export async function build(
    args = new Args(process.argv),
    node?: PackageNode,
    onPackageBuild?: (node: PackageNode, info: "failed" | "skipped" | "success") => void,
) {
    const canprint = canPrint();
    const failed = new Set<string>();

    let logLevel: LogLevel = "silent";
    if (args.error) logLevel = "error";
    else if (args.warning) logLevel = "warning";
    else if (args.info) logLevel = "info";
    else if (args.verbose || args.debug) logLevel = "info";

    if (node)
    {
        if (node.packageJSON.papit?.type === "theme")
        {
            const result = buildTheme(args, node);
            if (onPackageBuild) onPackageBuild(node, result);
            return;
        }

        const shouldinstall = await runner(node, failed, args, canprint, logLevel, onPackageBuild);
        if (shouldinstall) await npmInstall(args, canprint);
        return;
    }

    const ordered = Information.getPriorityBatches(args);

    let hasprintedPriority = false;

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
            const install = await runner(node, failed, args, canprint, logLevel, onPackageBuild);
            if (install) shouldinstall = true;
        }

        if (shouldinstall) await npmInstall(args, canprint);
    }
}

async function runner(
    node: PackageNode,
    failed: Set<string>,
    args: Args,
    canprint: boolean,
    logLevel: LogLevel,
    onPackageBuild?: (node: PackageNode, info: "failed" | "skipped" | "success") => void,
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

        if (skipped.bundlejs)
        {
            onPackageBuild?.(node, "skipped");
        }
        else
        {
            onPackageBuild?.(node, "success");
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

        onPackageBuild?.(node, "failed");
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
    if (info.type !== "build") return; // && info.type !== "rebuild") return;

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
    fs.writeFileSync(importOutput, updated);
    fs.chmodSync(importOutput, 0o755);

    return true; // should install 
}