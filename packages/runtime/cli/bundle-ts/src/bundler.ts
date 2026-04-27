import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { getEntryPoints, getTSconfig, getTSlocation, hasChanged, type PackageJson } from "@papit/bundle-js";
import { Extractor, ExtractorConfig } from "@microsoft/api-extractor";

const timestamp_value = performance.now();
let timestamp_ticker = 0;

function timestamp(args: { has: (key: string) => boolean }, message?: string) {
    if (!args.has("debug")) return;

    const isNpmContext = process.env.npm_package_json?.endsWith("bundle-js/package.json");

    // process.argv[1] contains the resolved script path — works on Windows too
    const isNpxContext = process.env.npm_lifecycle_event === "npx"
        && process.argv[1]?.endsWith("papit-bundle-js");

    if (!isNpmContext && !isNpxContext) return;

    timestamp_ticker++;
    console.log((performance.now() - timestamp_value).toFixed(3).toString() + "ms passed", "#" + timestamp_ticker, message ? "- " + message : "");
}

export async function tsBundle(
    args: { has(key: string): boolean },
    location: string,
    options?: Partial<{
        tsconfig: ts.ParsedCommandLine;
        entryPoints: ReturnType<typeof getEntryPoints>;
        entryPointsArray: { input: string, output: string }[];
        packageJSON: PackageJson;
    }>
) {
    timestamp(args);
    const tsconfig = options?.tsconfig ?? getTSconfig(args, location);
    const packageJSON = options?.packageJSON ?? JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));

    let entryPointsArray: { input: string, output: string }[] = [];
    if (options?.entryPointsArray)
    {
        entryPointsArray = options.entryPointsArray;
    } else
    {
        const entryPoints = options?.entryPoints ?? getEntryPoints(location, packageJSON, tsconfig);
        entryPointsArray = Object.values(entryPoints.entries).map(value => value.types).filter(v => v !== undefined);
    }

    const tempOutDir = path.join(location, ".temp", "ts-bundle");
    if (!fs.existsSync(tempOutDir)) fs.mkdirSync(tempOutDir, { recursive: true });
    timestamp(args, "before has-changed");

    if (
        !(args.has("force") || args.has("f"))
        && !hasChanged(location, tsconfig?.fileNames, { tempSuffix: "papit-bundle-ts" })
        && !entryPointsArray.some(entry => !fs.existsSync(entry.output))) 
    {
        return "skipped";
    }

    // lets clear the output folder
    fs.rmSync(path.join(location, "lib", "ts-output"), { recursive: true, force: true });

    // if (!fs.existsSync(path.join(location, "reports"))) {
    //     fs.mkdirSync(path.join(location, "reports"), { recursive: true });
    // }
    timestamp(args, "before fileNames filter");

    // const isBundleTS = /cli\/bundle-ts/.test(location);
    const fileNames = tsconfig?.fileNames?.filter(f => {
        // if (!isBundleTS && f.includes('/tests/')) return false; // without custom build this is not needed for running tests 
        if (!/[/\\]src[/\\]/.test(f)) return false;
        return true;
    });

    const program = ts.createProgram(fileNames ?? [], {
        ...(tsconfig?.options ?? {}),
        declaration: true,
        declarationMap: args.has("dev"),
        emitDeclarationOnly: true,
        declarationDir: tempOutDir,
    });

    const res = program.emit();
    if (res.emitSkipped)
    {
        for (const diag of res.diagnostics)
        {
            if (diag.file)
            {
                const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
                console.error(`\nFile: ${diag.file.fileName}`);
                console.error(`Line ${line + 1}, Column ${character + 1}`);
                console.error(`Error: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}\n`);
            }
        }
        return;
    }
    timestamp(args, "before entryPointsArray loop");

    const errors = new Array<{ input: string, logs: string[] }>();
    for (const entry of entryPointsArray)
    {
        timestamp(args, `at entry "${path.relative(location, entry.input)}"`);

        // const tempEntry = path.join(tempOutDir, entry.input.replace(location, '').replace(/\.ts$/, '.d.ts'));
        // console.log({entry})
        const rootDir = tsconfig?.options.rootDir ?? path.join(location, 'src');
        const tempEntry = path.join(
            tempOutDir,
            path.relative(rootDir, entry.input).replace(/\.ts$/, '.d.ts')
        );

        const extractorConfig = ExtractorConfig.prepare({
            configObject: {
                projectFolder: location,
                mainEntryPointFilePath: tempEntry,
                bundledPackages: [],
                compiler: {
                    tsconfigFilePath: getTSlocation(args, location), // path.join(location, "tsconfig.json"),
                    overrideTsconfig: {
                        compilerOptions: {
                            baseUrl: tempOutDir,
                            paths: tsconfig?.options.paths,
                        }
                    }
                },
                dtsRollup: {
                    enabled: true,
                    untrimmedFilePath: entry.output,
                },
                apiReport: {
                    enabled: false,
                    reportFileName: "<unscopedPackageName>.api.md",
                    reportFolder: path.join(location, "reports"),
                    reportTempFolder: path.join(location, ".temp", "api-extractor"),
                },
                docModel: {
                    enabled: false, // if we use api-documenter we could enable this to build documentation 
                    apiJsonFilePath: path.join(location, ".temp", "api-extractor", "<unscopedPackageName>.api.json"),
                },
            },
            configObjectFullPath: path.join(location, "api-extractor.json"),
            packageJsonFullPath: path.join(location, "package.json"),
        });

        const logs = new Array<string>();
        const originalWrite = process.stdout.write;
        process.stdout.write = (msg) => {
            const message = msg.toString();
            if (!(/^Analysis will use the bundled TypeScript/.test(message) || /^\*\*\* /.test(message)))
            {
                logs.push(message);
            }
            return true;
        };

        Extractor.invoke(extractorConfig, {
            localBuild: true,
            showVerboseMessages: false,
        });

        process.stdout.write = originalWrite;
        // logs.forEach(log => originalWrite(log));
        if (logs.length > 0)
        {
            errors.push({ input: entry.input, logs });
        }
    }
    timestamp(args, "final");

    if (errors.length > 0)
    {
        return errors;
    }
}