// import statements
import path from "node:path";
import fs from "node:fs";
import { type BuildOptions } from "esbuild";
import ts from "typescript";
import { getArguments, getExternals, getTSlocation, type PackageJson } from "./helper";
import { type getEntryPoints } from "./entrypoints";

export type Options = {
    tsconfig: ts.ParsedCommandLine,
    packageJSON: PackageJson,
    logLevel: BuildOptions["logLevel"];
    externals: string[];
    esoptions: BuildOptions;
    entryPoints: ReturnType<typeof getEntryPoints>;
    entryPointArray: Array<{ output: string|undefined, input: string }>;
}

export function getESOptions(
    args: { has: (key: string) => boolean },
    location: string,
    {
        logLevel,
        packageJSON,
        externals,
    }: Partial<Options> = {}
): BuildOptions {
    if (!args) args = getArguments();
    const isDev = args.has("dev");

    const tsconfigLocation = getTSlocation(args, location);

    if (!packageJSON) packageJSON = JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));
    if (!packageJSON) throw new Error("could not find package.json");

    return {
        bundle: true,
        external: externals ?? getExternals(packageJSON),

        // 🔥 DEV vs PROD behavior
        minify: !isDev,
        sourcemap: isDev,
        treeShaking: !isDev,
        keepNames: isDev,

        tsconfig: tsconfigLocation,
        format: packageJSON.type === "module" ? "esm" : "cjs",
        platform: ["node"].includes(packageJSON.papit?.type ?? "web-component") ? "node" : "browser",

        logLevel: logLevel ?? "error",
        loader: {
            ".css": "css"
        }
    };
}

export function modifyOptions(
    entryPoint: { input: string, output: string | undefined },
    options: BuildOptions
): BuildOptions {
    return {
        ...options,
        entryPoints: [entryPoint.input],
        outfile: entryPoint.output,
        write: entryPoint.output !== undefined,
    }
} 