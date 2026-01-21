// import statements 
import path from "node:path";
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { Terminal } from "@papit/terminal";
import { EntryPoint, PackageNode } from "@papit/information";
import { Loglevel } from "@papit/arguments";

export async function tsBundler(
    entry: EntryPoint,
    node: PackageNode,
    tempOutDir: string,
) {
    let { input, output } = entry.types ?? {};
    if (!input || !output) return "no input or output file";

    input = input.replace(node.location, tempOutDir).replace(/\.ts$/, '.d.ts');

    const result = await Terminal.surpress(async () => {
        // create a config object programmatically
        const extractorConfig = ExtractorConfig.prepare({
            configObject: {
                mainEntryPointFilePath: input,
                projectFolder: node.location,
                compiler: {
                    tsconfigFilePath: node.tsconfigpath,
                },
                dtsRollup: {
                    enabled: true,
                    untrimmedFilePath: output,
                },
            },
            configObjectFullPath: undefined,
            packageJsonFullPath: path.join(node.location, "package.json"),
            // no configObjectFullPath needed if you don’t have a file
        });

        // run API Extractor
        return Extractor.invoke(extractorConfig, {
            localBuild: true,
            showVerboseMessages: !!Loglevel.verbose,
        });
    });

    if (!result.succeeded)
    {
        Terminal.error(`API Extractor failed with ${result.errorCount} errors`);
        process.exit(1);
    }
}

// * this
//   if (Arguments.args.flags.dev)
//   {
//     const srcName = path.basename(path.dirname(inputFile));
//     const outDir = path.dirname(outputFile);

//     await Terminal.execute(
//       "tsc",
//       info.local,
//       ["--emitDeclarationOnly", "-p", meta.tsconfig.path, "--declarationDir", outDir],
//     );

//     // The srcName folder that gets created INSIDE outDir (not in package root)
//     const tempDtsDir = path.join(outDir, srcName);

//     if (fs.existsSync(tempDtsDir))
//     {
//       // Copy the generated .d.ts files from the nested folder to outDir
//       await copyFolder(tempDtsDir, outDir, content => content);
//       // Delete the temporary nested folder
//       fs.rmSync(tempDtsDir, { recursive: true, force: true });
//     }

//     return;
//   }
