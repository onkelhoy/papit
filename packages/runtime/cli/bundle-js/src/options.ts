// import statements
import path from "node:path";
import fs from "node:fs";
import { type Platform, type BuildOptions } from "esbuild";
import ts from "typescript";

import { getArguments, getExternals, getTSlocation, type PackageJson } from "./helper";
import { type getEntryPoints } from "./entrypoints";

export type Options = {
    tsconfig: ts.ParsedCommandLine,
    packageJSON: PackageJson,
    logLevel: BuildOptions["logLevel"];
    externals: string[];
    esoptions: BuildOptions & { platformRecord?: undefined | Record<string, string> };
    entryPoints: ReturnType<typeof getEntryPoints>;
    entryPointArray: Array<{ output: string | undefined, input: string }>;
}

// const cssModulePlugin = {
//     name: "css-module",
//     setup(build: any) {
//         build.onLoad({ filter: /\.css$/ }, (args: any) => {
//             const { outdir, outfile } = build.initialOptions;
//             const resolvedOutdir = outdir ?? (outfile ? path.dirname(outfile) : null);
//             const filename = path.basename(args.path);

//             if (resolvedOutdir)
//             {
//                 fs.mkdirSync(resolvedOutdir, { recursive: true });
//                 fs.copyFileSync(args.path, path.join(resolvedOutdir, filename));
//             }

//             return {
//                 contents: `
//                     const sheet = new CSSStyleSheet();
//                     const url = new URL('./${filename}', import.meta.url);
//                     const text = await fetch(url).then(r => r.text());
//                     sheet.replaceSync(text);
//                     export default sheet;
//                 `,
//                 loader: "js"
//             };
//         });
//     }
// };

// ESBUILD does not support import sheet ...
// const cssModulePlugin = {
//     name: "css-module",
//     setup(build: any) {
//         build.onResolve({ filter: /\.css$/ }, (args: any) => {
//             const { outdir, outfile } = build.initialOptions;
//             const resolvedOutdir = outdir ?? (outfile ? path.dirname(outfile) : null);
//             const srcPath = path.resolve(args.resolveDir, args.path);
//             const filename = path.basename(args.path);

//             if (resolvedOutdir)
//             {
//                 fs.mkdirSync(resolvedOutdir, { recursive: true });
//                 fs.copyFileSync(srcPath, path.join(resolvedOutdir, filename));
//             }

//             // tell esbuild: don't touch this import, leave it as-is
//             return { path: args.path, external: true };
//         });
//     }
// };

const cssModulePlugin = {
    name: "css-module",
    setup(build: any) {
        build.onLoad({ filter: /\.css$/ }, (args: any) => {
            const css = fs.readFileSync(args.path, "utf8");

            return {
                contents: `
                    const sheet = new CSSStyleSheet();
                    sheet.replaceSync(\`${css.replace(/`/g, "\\`")}\`);
                    export default sheet;
                `,
                loader: "js"
            };
        });
    }
};

export function getESOptions(
    args: { has: (key: string) => boolean },
    location: string,
    {
        logLevel,
        packageJSON,
        externals,
    }: Partial<Options> = {}
): BuildOptions & { platformRecord?: undefined | Record<string, string> } {
    if (!args) args = getArguments();
    const isDev = args.has("dev");

    const tsconfigLocation = getTSlocation(args, location);

    if (!packageJSON) packageJSON = JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));
    if (!packageJSON) throw new Error("could not find package.json");

    let type = typeof packageJSON.papit?.type === "string" ? packageJSON.papit?.type : undefined;

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
        platform: ["node"].includes(type ?? "web-component") ? "node" : "browser",

        platformRecord: typeof packageJSON.papit?.type === "string" ? undefined : packageJSON.papit?.type,

        logLevel: logLevel ?? "error",
        plugins: [cssModulePlugin],
        // loader: {
        //     ".css": "css"
        // }
    };
}

export function modifyOptions(
    entryPoint: { input: string, output: string | undefined, name?: string },
    options: ReturnType<typeof getESOptions>,
): BuildOptions {

    const { platformRecord, ...restOptions } = options;
    let platform = options.platform;
    if (entryPoint.name && platformRecord)
    {
        // platform: ["node"].includes(packageJSON.papit?.type ?? "web-component") ? "node" : "browser",
        platform = platformRecord[entryPoint.name] as Platform;
    }

    return {
        ...restOptions,
        platform,
        entryPoints: [entryPoint.input],
        outfile: entryPoint.output,
        write: entryPoint.output !== undefined,
    }
} 