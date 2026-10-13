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

/**
 * API Extractor leaves `declare module "x" { ... }` and `declare global { ... }` out of a rollup.
 * Copies those of the entry file itself into the rolled-up `output`, before its closing `export { }`.
 */
function keepAugmentations(declarations: string, output: string) {
    if (!fs.existsSync(declarations) || !fs.existsSync(output)) return;

    const source = ts.createSourceFile(declarations, fs.readFileSync(declarations, "utf-8"), ts.ScriptTarget.Latest, true);
    const blocks = source.statements
        .filter(statement => ts.isModuleDeclaration(statement) && (ts.isStringLiteral(statement.name) || statement.name.text === "global"))
        .map(statement => statement.getText(source));
    if (blocks.length === 0) return;

    const rollup = fs.readFileSync(output, "utf-8");
    const eol = rollup.includes("\r\n") ? "\r\n" : "\n";
    const text = blocks.join(eol + eol).replace(/\r?\n/g, eol) + eol + eol;
    const end = rollup.lastIndexOf("export { }");
    fs.writeFileSync(output, end === -1 ? rollup + eol + text : rollup.slice(0, end) + text + rollup.slice(end));
}

/**
 * Emits declarations for `src/` and rolls each package.json `types` entry up into one .d.ts file.
 * Every entry but the main one (`bundle`) keeps the package's own name external, so e.g. `./react`
 * importing `@papit/x` gets `import { X } from "@papit/x"` instead of a copy of the class.
 * The entry file's own `declare module "x"` and `declare global` blocks are kept in its rollup.
 *
 * @param args - flags: `force`/`f` rebuilds regardless of changes, `dev` adds declaration maps, `prod`
 * @returns `"skipped"` when nothing changed, the entries that failed or logged warnings, or `undefined` on success.
 * A TypeScript emit error prints the diagnostics and returns every entry with them as `logs`.
 */
export async function tsBundle(
    args: { has(key: string): boolean },
    location: string,
    options?: Partial<{
        tsconfig: ts.ParsedCommandLine;
        entryPoints: ReturnType<typeof getEntryPoints>;
        entryPointsArray: { input: string, output: string, name?: string }[];
        packageJSON: PackageJson;
    }>
) {
    timestamp(args);
    const tsconfig = options?.tsconfig ?? getTSconfig(args, location);
    const packageJSON = options?.packageJSON ?? JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));

    let entryPointsArray: { input: string, output: string, name?: string }[] = [];
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
        const logs = new Array<string>();
        for (const diag of res.diagnostics)
        {
            const message = `Error: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`;
            if (diag.file)
            {
                const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
                console.error(`\nFile: ${diag.file.fileName}`);
                console.error(`Line ${line + 1}, Column ${character + 1}`);
                console.error(`${message}\n`);
                logs.push(`${diag.file.fileName}:${line + 1}:${character + 1} ${message}`);
            }
            else
            {
                logs.push(message);
            }
        }
        // nothing was emitted, so every entry failed
        return entryPointsArray.map(entry => ({ input: entry.input, logs }));
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
            path.relative(rootDir, entry.input).replace(/\.tsx?$/, '.d.ts')
        );

        // the main entry maps its own name to src, the others resolve it as the external package
        let paths = tsconfig?.options.paths;
        if (paths && packageJSON.name && entry.name !== undefined && entry.name !== "bundle")
        {
            const { [packageJSON.name]: _self, ...rest } = paths;
            paths = rest;
        }

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
                            paths,
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
        keepAugmentations(tempEntry, entry.output);
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