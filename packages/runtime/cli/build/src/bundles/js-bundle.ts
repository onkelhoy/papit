// import statements
import esbuild, { BuildOptions } from "esbuild";
import { PackageNode } from "@papit/information";

import { ChildProcess } from "node:child_process";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

export async function jsBundler(
    input: string|undefined,
    output: string|undefined,
    node: PackageNode,
    args = Arguments.instance,
    canprint = false,
    callback?: (counter: number, result: esbuild.BuildResult<esbuild.BuildOptions>) => void,
) {
    if (!input) return; // deal also with require? 

    const isDev = args.has("dev");
    let logLevel = "silent";
    if (args.error) logLevel = "error";
    else if (args.warning) logLevel = "warning";
    else if (args.info) logLevel = "info";
    else if (args.verbose) logLevel = "info";
    else if (args.debug) logLevel = "info";

    const options: BuildOptions = {
        bundle: true,
        entryPoints: [input],
        outfile: output,
        write: output !== undefined,
        external: node.externals,

        // 🔥 DEV vs PROD behavior
        minify: !isDev,
        sourcemap: isDev,
        treeShaking: !isDev,
        keepNames: isDev,


        tsconfig: node.tsconfigpath,
        format: node.packageJSON.type === "module" ? "esm" : "cjs",
        platform: ["node"].includes(node.packageJSON.papit.type ?? "web-component") ? "node" : "browser",

        logLevel: logLevel as BuildOptions["logLevel"],
        loader: {
            ".css": "css"
        }
    }

    if (args.has("live"))
    {
        return watch(options, node, args, canprint, callback);
    }

    return build(options, node, args, canprint);
}

async function build(
    options: BuildOptions, 
    node: PackageNode, 
    args = Arguments.instance,
    canprint = false,
) {
    const esbuildInfo = await esbuild.build(options);
    if (esbuildInfo.errors.length > 0)
    {
        if (canprint)
        {
            if (args.verbose)
            {
                Terminal.error(JSON.stringify(esbuildInfo.errors, null, 2));
            }
    
            Terminal.error("esbuild had errors", args.verbose ? "" : "run with --verbose flag for details");
        }
        process.exit(1);
    }

    if (esbuildInfo.warnings.length > 0 && canprint)
    {
        if (args.verbose)
        {
            Terminal.warn(JSON.stringify(esbuildInfo.warnings, null, 2));
        }

        Terminal.warn("esbuild had warnings", args.verbose ? "" : "run with --verbose flag for details");
    }

    return esbuildInfo;
}

async function watch(
    options: BuildOptions, 
    node: PackageNode,
    args = Arguments.instance,
    canprint = false,
    callback?: (counter: number, result: esbuild.BuildResult<esbuild.BuildOptions>) => void,
) {
    let counter = 0;
    const ctx = await esbuild.context({
        ...options,
        plugins: [{
            name: "rebuild",
            setup(build) {

                const childprocesses: Array<{ session: number, process: ChildProcess }> = [];
                build.onStart(async () => {
                    while (childprocesses.length > 0)
                    {
                        const child = childprocesses.pop();
                        if (!child?.process || child.process.killed) continue;

                        const kill = child.process.kill("SIGTERM");
                        if (kill && canprint) Terminal.write("terminated child");
                        else 
                        {
                            if (canprint) Terminal.error("something went wrong terminating child process");
                            process.exit(1);
                        }

                        if (canprint) Terminal.clearSession(child.session);
                    }
                });

                build.onEnd(async result => {
                    if (result.errors.length > 0)
                    {
                        result.errors.forEach(e => {
                            if (canprint) Terminal.error(Terminal.red("esbuild"), e.detail);
                        });

                        return;
                    }

                    if (Arguments.info) 
                    {
                        counter++;
                        if (counter > 1 && canprint)
                        {
                            Terminal.write(Terminal.blue("  ↳ rebuild"), "-", String(counter++));
                        }
                    }

                    let executables = args.get("execute");
                    if (callback) callback(counter, result);
                    if (!Array.isArray(executables)) return;

                    for (const executable of executables)
                    {
                        childprocesses.push({
                            session: Terminal.createSession(),
                            process: Terminal.spawn("node", {
                                cwd: node.location,
                                args: [executable, ...process.argv.slice(2)],
                                onData: text => canprint && Terminal.write(text),
                                onError: text => canprint && Terminal.write(text),
                                onClose: console.log.bind("close")
                            }),
                        });
                    }
                })
            },
        }]
    });

    await ctx.watch();

    return ctx;
}
