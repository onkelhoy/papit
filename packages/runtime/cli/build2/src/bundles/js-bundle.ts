// import statements
import path from "node:path";
import esbuild, { BuildOptions, WatchOptions } from "esbuild";
import { EntryPoint, PackageNode } from "@papit/information";

import { ChildProcessWithoutNullStreams } from "node:child_process";
import { Arguments, Loglevel } from "@papit/arguments";

export async function jsBundler(
    entry: EntryPoint,
    node: PackageNode,
) {
    if (!entry.import) return; // deal also with require? 

    const isDev = Arguments.has("dev");
    let logLevel = "silent";
    if (Loglevel.error) logLevel = "error";
    else if (Loglevel.warning) logLevel = "warning";
    else if (Loglevel.info) logLevel = "info";
    else if (Loglevel.verbose) logLevel = "info";
    else if (Loglevel.debug) logLevel = "info";

    const options: BuildOptions = {
        bundle: true,
        entryPoints: [entry.import.input],
        outfile: entry.import.output,
        write: entry.import.output !== undefined,
        external: node.externals,

        // 🔥 DEV vs PROD behavior
        minify: !isDev,
        sourcemap: isDev,
        treeShaking: !isDev,
        keepNames: isDev,


        tsconfig: node.tsconfigpath,
        format: node.packageJSON.type === "module" ? "esm" : "cjs",
        platform: ["node"].includes(meta.config.type ?? "web-component") ? "node" : "browser",

        logLevel: logLevel as BuildOptions["logLevel"],
        loader: {
            ".css": "css"
        }
    }

    if ((Arguments.args.flags.live && exoptions?.watch !== false) || exoptions?.watch === true)
    {
        return watch(options, info, exoptions);
    }

    return build(options);
}

async function build(options: BuildOptions) {
    const esbuildInfo = await esbuild.build(options);
    if (esbuildInfo.errors.length > 0)
    {
        if (Arguments.verbose)
        {
            Terminal.error(JSON.stringify(esbuildInfo.errors, null, 2));
        }

        Terminal.error("esbuild had errors", Arguments.verbose ? "" : "run with --verbose flag for details");
        process.exit(1);
    }

    if (esbuildInfo.warnings.length > 0)
    {
        if (Arguments.verbose)
        {
            Terminal.warn(JSON.stringify(esbuildInfo.warnings, null, 2));
        }

        Terminal.warn("esbuild had warnings", Arguments.verbose ? "" : "run with --verbose flag for details");
    }

    return esbuildInfo;
}

async function watch(options: BuildOptions, info: ReturnType<typeof getPathInfo>, exoptions?: Partial<ExecutorOptions>) {
    let counter = 0;
    const ctx = await esbuild.context({
        ...options,
        plugins: [{
            name: "rebuild",
            setup(build) {

                const childprocesses: Array<{ session: number, process: ChildProcessWithoutNullStreams }> = [];
                build.onStart(async () => {
                    while (childprocesses.length > 0)
                    {
                        const child = childprocesses.pop();
                        if (!child?.process || child.process.killed) continue;

                        const kill = child.process.kill("SIGTERM");
                        if (kill) Terminal.write("terminated child");
                        else 
                        {
                            Terminal.error("something went wrong terminating child process");
                            process.exit(1);
                        }

                        Terminal.clearSession(child.session);
                    }
                });

                build.onEnd(async result => {
                    if (result.errors.length > 0)
                    {
                        result.errors.forEach(e => {
                            Terminal.error(Terminal.red("esbuild"), e.detail);
                        });

                        return;
                    }

                    if (Arguments.info) 
                    {
                        counter++;
                        if (counter > 1)
                        {
                            Terminal.write(Terminal.blue("  ↳ rebuild"), "-", String(counter++));
                        }
                    }

                    let executables = Arguments.args.flags.execute;
                    if (typeof executables === "string") executables = [executables];

                    if (exoptions?.callback)
                    {
                        exoptions.callback(counter, result);
                    }

                    if (!Array.isArray(executables)) return;

                    for (const executable of executables)
                    {
                        childprocesses.push({
                            session: Terminal.createSession(),
                            process: Terminal.spawn("node", {
                                cwd: info.package,
                                args: [executable, ...process.argv.slice(2)],
                                onData: text => Terminal.write(text),
                                onError: text => Terminal.write(text),
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
