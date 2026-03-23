import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { getEntryPoints, getTSconfig, hasChanged, type PackageJson, sourceFolder } from "@papit/bundle-js";

import { extractExports } from "./extractor/exports";
import { extractSymbols } from "./extractor/symbol";
import { type Data } from "./extractor/helper";
import { output } from "./output";

export async function tsBundle(
    args: { has(key: string): boolean },
    location: string,
    options?: Partial<{
        tsconfig: ts.ParsedCommandLine;
        entryPoints: ReturnType<typeof getEntryPoints>;
        entryPointsArray: { input: string, output: string }[]; // used for testing 
        packageJSON: PackageJson;
    }>
) {
    const tsconfig = options?.tsconfig ?? getTSconfig(args, location);

    let entryPointsArray: { input: string, output: string }[] = [];
    if (options?.entryPointsArray)
    {
        entryPointsArray = options.entryPointsArray;
    }
    else 
    {
        const packageJSON = options?.packageJSON ?? JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));
        const entryPoints = options?.entryPoints ?? getEntryPoints(location, packageJSON, tsconfig);
        entryPointsArray = Object.values(entryPoints.entries).map(value => value.types).filter(v => v !== undefined);
    }

    const tempOutDir = path.join(location, ".temp/ts-bundle");
    if (!fs.existsSync(tempOutDir))
    {
        fs.mkdirSync(tempOutDir, { recursive: true });
    }

    const tsPrebuildOutput = path.join(tsconfig?.options.outDir ?? path.join(location, "lib"), "ts-output");
    if (fs.existsSync(tsPrebuildOutput)) fs.rmSync(tsPrebuildOutput, { force: true, recursive: true });


    const mappedEntryinputs: Record<'input' | 'output' | 'temp', string[]> = {
        output: [],
        input: [],
        temp: [],
    };
    entryPointsArray.forEach(entry => {
        mappedEntryinputs.input.push(entry.input);
        mappedEntryinputs.output.push(entry.output);
        mappedEntryinputs.temp.push(path.join(tempOutDir, entry.input.replace(location, '').replace(/.ts$/, '.d.ts')));
    });

    if ((args.has("force") || args.has("f")) || hasChanged(location, tsconfig?.fileNames) || !fs.existsSync(path.join(tempOutDir, sourceFolder(location, tsconfig)))) 
    {
        // this is stupid, but html needs it but then we cannot test this own package.. 
        // const fileNames = /cli\/bundle-ts/.test(location) ? tsconfig?.fileNames : tsconfig?.fileNames?.filter(f => !f.includes('/tests/'));

        const isBundleTS = /cli\/bundle-ts/.test(location);
        const fileNames = tsconfig?.fileNames?.filter(f => {
            if (!isBundleTS && f.includes('/tests/')) return false;
            if (!f.includes("/src/")) return false;

            return true;
        });

        const program = ts.createProgram(
            fileNames || mappedEntryinputs.input,
            {
                ...(tsconfig?.options ?? {}),
                declaration: true,
                emitDeclarationOnly: true,
                declarationDir: tempOutDir,
            }
        );

        const res = program.emit();

        if (res.emitSkipped)
        {
            console.error('Declaration emit failed:');
            for (const diag of res.diagnostics) {
                if (diag.file) {
                    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
                    console.error(`\nFile: ${diag.file.fileName}`);
                    console.error(`Line ${line + 1}, Column ${character + 1}`);
                    console.error(`Error: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}\n`);
                }
            }
        }
    }

    runner(
        location,
        mappedEntryinputs,
        tempOutDir,
        tsconfig,
    );
}

function runner(
    location: string,
    entrypoints: Record<'input' | 'output' | 'temp', string[]>,
    tempOutDir: string,
    tsconfig?: ts.ParsedCommandLine,
) {
    const program = ts.createProgram(
        entrypoints.temp,
        {
            ...(tsconfig?.options ?? {}),
            allowJs: false,

            baseUrl: tsconfig?.options.baseUrl
                ? path.join(tempOutDir, path.relative(location, path.resolve(location, tsconfig.options.baseUrl)))
                : undefined,
        }
    );

    const printer = ts.createPrinter();
    const checker = program.getTypeChecker();
    const outdir = path.basename(tsconfig?.options.outDir ?? "lib");

    const { unique, common, externalReexports } = extractExports(checker, program, entrypoints, location, tempOutDir);

    let commonData: Data | undefined;
    if (common.size > 0)
    {
        commonData = extractSymbols(
            program,
            checker,
            location,
            common,
        );

        output(
            printer, commonData, location,
            path.join(location, outdir, "types.d.ts"),
        );
    }


    for (const [entry, metadata] of unique)
    {
        const entryExternalReexports = externalReexports.get(entry) || [];

        // if (metadata.size === 0 && entryExternalReexports.length === 0) continue;

        const symbols = new Set(metadata.keys());
        const data = extractSymbols(program, checker, location, symbols);

        output(
            printer,
            data,
            location,
            entry,
            commonData,
            checker,
            metadata,
            entryExternalReexports,
        );
    }
}
