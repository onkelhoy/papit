// import statements
import fs from "node:fs";
import path from "node:path";
import esbuild, { BuildContext, type BuildOptions, type BuildResult } from "esbuild";
import { getESOptions, modifyOptions, type Options } from "./options";
import { hasChanged } from "changed";
import { getEntryPoints } from "entrypoints";
import { getTSconfig, type PackageJson } from "helper";

const timestamp_value = performance.now();
let timestamp_ticker = 0;
function timestamp(args: { has: (key: string) => boolean }, message?: string) {
    if (!args.has("debug")) return;
    if (!process.env.npm_package_json?.endsWith("bundle-js/package.json")) return;
    if (process.env.npm_lifecycle_event === "npx" && process.env._ && !process.env._.endsWith("papit-bundle-js")) return;

    timestamp_ticker++;
    console.log((performance.now() - timestamp_value).toFixed(3).toString() + "ms passed", "#" + timestamp_ticker, message ? "- " + message : "");
}

export type OnBuildEvent =
    | { type: "build" | "rebuild"; result: esbuild.BuildResult<esbuild.BuildOptions>; entry: { input: string, output: string | undefined } }
    | { type: "skipped" };

type OnBuild = (event: OnBuildEvent) => void;
export async function jsBundle(
    args: { has: (key: string) => boolean },
    location: string,
    // entryPoints: Array<{ input: string, output: string | undefined }>,
    options?: Partial<Options>,
    onBuild?: OnBuild,
) {
    timestamp(args);

    const tsconfig = options?.tsconfig ?? getTSconfig(args, location);
    const packageJsonLocation = path.join(location, "package.json");
    if (!fs.existsSync(packageJsonLocation)) throw new Error("[@papit/bundle-js] error no package.json file found");

    const packageJSON: PackageJson = options?.packageJSON ?? JSON.parse(fs.readFileSync(packageJsonLocation, { encoding: "utf-8" }));
    const entryPoints = options?.entryPoints ?? getEntryPoints(location, packageJSON, tsconfig);
    const entrypointsArray = options?.entryPointArray ? options.entryPointArray : Object.values(entryPoints.entries).map(value => value.import).filter(v => v !== undefined);

    const first = entrypointsArray.at(0);
    if (!first) throw new Error("[@papit/bundle-js] no entry-points passed");

    const inputs = options?.tsconfig && typeof options?.tsconfig !== "string" ? options.tsconfig.fileNames : entrypointsArray.map(v => v.input);
    if (
        !args.has("force")
        && first.output !== undefined
        && !hasChanged(location, inputs)
        && fs.existsSync(path.dirname(first.output))
    ) 
    {
        if (onBuild) onBuild({ type: "skipped" });
        return "skipped";
    }

    timestamp(args);
    const esoptions = options?.esoptions ?? getESOptions(args, location, options);

    timestamp(args, "before entryPointsArray loop");
    const errors: Array<{ input: string, result: BuildResult<BuildOptions> }> = [];
    for (const entry of entrypointsArray)
    {
        timestamp(args, `at entry "${path.relative(location, entry.input)}"`);

        const option = modifyOptions(entry, esoptions);
        const result = await esbuild.build(option);
        if (result.errors.length > 0) 
        {
            errors.push({ input: entry.input, result });
        }

        if (onBuild) onBuild({ type: "build", result, entry });
    }

    timestamp(args, "final");
    return errors;
}


export async function jsWatch(
    args: { has: (key: string) => boolean },
    location: string,
    options?: Partial<Options>,
    onBuild?: OnBuild,
): Promise<{ contexts: BuildContext[], dispose: () => void }> {

    const tsconfig = options?.tsconfig ?? getTSconfig(args, location);
    const packageJsonLocation = path.join(location, "package.json");
    if (!fs.existsSync(packageJsonLocation)) throw new Error("[@papit/bundle-js] error no package.json file found");

    const packageJSON: PackageJson = options?.packageJSON ?? JSON.parse(fs.readFileSync(packageJsonLocation, { encoding: "utf-8" }));
    const entryPoints = options?.entryPoints ?? getEntryPoints(location, packageJSON, tsconfig);
    const entrypointsArray = options?.entryPointArray ? options.entryPointArray : Object.values(entryPoints.entries).map(value => value.import).filter(v => v !== undefined);
    const first = entrypointsArray.at(0);

    if (!first) throw new Error("[@papit/bundle-js] no entry-points passed");

    const esoptions = options?.esoptions ?? getESOptions(args, location, options);

    const entrySet = new Set<string>();

    const contexts = await Promise.all(
        entrypointsArray.map(async entry => {
            const option = modifyOptions(entry, esoptions);
            const ctx = await esbuild.context({
                ...option,
                plugins: [{
                    name: "onbuild",
                    setup(build) {
                        build.onEnd(result => {
                            if (onBuild) onBuild({ type: entrySet.has(entry.input) ? "rebuild" : "build", result, entry });
                            entrySet.add(entry.input);
                        });
                    }
                }]
            });
            await ctx.watch();
            return ctx;
        })
    );

    return {
        contexts,
        dispose: () => Promise.all(contexts.map(ctx => ctx.dispose())),
    };
}